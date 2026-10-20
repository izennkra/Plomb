// Compares local AIs (Ollama) on the same real articles, with the editor-in-chief instructions.
// Usage: npm run compare:ai   (Ollama must be running; models must be downloaded)
// Result: docs/comparatif-ia.md
import { writeFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const MODELS = ["ministral-3:14b", "gemma4:12b", "gemma4:e4b"];
const OLLAMA = "http://127.0.0.1:11434/api/chat";
const THEMES = ["Identité", "Typographie", "Packaging", "Édition", "Digital & motion", "Illustration & photo", "Culture & métier"];
/** One article per source, for variety. */
const SOURCES = ["the-brandidentity.com/features", "itsnicethat.com", "findings.mouthwash.studio", "offbrandkoto.substack.com", "dandad.org/insights"];
const MAX_CHARS = 6000;

const SYSTEM = `Tu es le rédacteur en chef de Plomb, un journal de veille quotidien pour designers et créatifs.
Tu écris en français, dans un ton de journal : clair, factuel, élégant, sans superlatifs publicitaires.
Tu t'appuies UNIQUEMENT sur le texte de l'article fourni : n'invente aucun fait, nom, chiffre ou citation.
Tu réponds uniquement en JSON, selon le format demandé.`;

const summarySchema = {
  type: "object",
  properties: {
    titre: { type: "string", description: "Titre en français, 90 caractères maximum" },
    resume: { type: "string", description: "Résumé en 2 ou 3 phrases, 60 mots maximum" },
    theme: { type: "string", enum: THEMES },
    importance: { type: "integer", minimum: 1, maximum: 10 },
    raison: { type: "string", description: "Pourquoi cette note, en une phrase" },
  },
  required: ["titre", "resume", "theme", "importance", "raison"],
};

const leadSchema = {
  type: "object",
  properties: { texte: { type: "string", description: "Article de Une, environ 120 mots, en français" } },
  required: ["texte"],
};

function summaryPrompt(article) {
  return `Article publié par ${article.source} :
TITRE D'ORIGINE : ${article.title}
TEXTE :
${article.content.slice(0, MAX_CHARS)}

Rédige pour l'édition du matin :
- "titre" : un titre de journal en français (90 caractères max) ;
- "resume" : l'essentiel en 2 ou 3 phrases (60 mots max) ;
- "theme" : un thème parmi ${THEMES.join(", ")} ;
- "importance" : une note de 1 à 10 de l'intérêt pour un designer (ampleur du projet, originalité, qualité du travail) ;
- "raison" : la raison de cette note en une phrase.`;
}

function leadPrompt(article) {
  return `Article publié par ${article.source} :
TITRE D'ORIGINE : ${article.title}
TEXTE :
${article.content.slice(0, MAX_CHARS)}

Cet article fait la Une de l'édition du matin. Rédige "texte" : un article de Une d'environ 120 mots en français,
qui présente le projet, les personnes ou studios impliqués, et ce qui le rend remarquable — uniquement d'après le texte.`;
}

async function ask(model, prompt, schema) {
  const started = Date.now();
  const response = await fetch(OLLAMA, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: schema,
      options: { temperature: 0.3, num_ctx: 8192 },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  const seconds = (Date.now() - started) / 1000;
  if (!response.ok) return { error: `HTTP ${response.status}: ${await response.text()}`, seconds };
  const data = await response.json();
  try {
    return { value: JSON.parse(data.message.content), seconds };
  } catch {
    return { error: `JSON illisible : ${data.message.content.slice(0, 200)}`, seconds };
  }
}

const db = createClient({ url: "file:data/plomb.db" });
const articles = [];
for (const source of SOURCES) {
  const { rows } = await db.execute({
    sql: `select p.title, p.url, p.content, s.display_name as source from posts p join sources s on s.id = p.source_id
          where s.display_name = ? and length(p.content) > 800 order by coalesce(p.published_at, p.discovered_at) desc limit 1`,
    args: [source],
  });
  if (rows[0]) articles.push(rows[0]);
}
console.log(`${articles.length} articles`);

const results = {};
for (const model of MODELS) {
  results[model] = [];
  // Warm-up: loading the model in memory is not counted.
  await ask(model, "Réponds {\"texte\": \"ok\"}", leadSchema);
  for (const article of articles) {
    const summary = await ask(model, summaryPrompt(article), summarySchema);
    const lead = await ask(model, leadPrompt(article), leadSchema);
    results[model].push({ summary, lead });
    console.log(`${model} · ${article.source} · ${summary.seconds.toFixed(1)} s + ${lead.seconds.toFixed(1)} s`);
  }
}

const date = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" });
const lines = [
  "# Comparatif des IA locales — Rédacteur en Chef",
  "",
  `Réalisé le ${date} sur le Mac d'Izenn (M1 Pro, 16 Go), avec Ollama. Même consigne pour toutes les IA,`,
  `5 vrais articles relevés par Plomb (texte limité à ${MAX_CHARS} caractères).`,
  "",
  "## En bref",
  "",
  "| IA | Taille | Temps moyen par article (résumé + Une) | Réponses illisibles |",
  "|---|---|---|---|",
];
const SIZES = { "ministral-3:14b": "9,1 Go (Mistral AI)", "gemma4:12b": "7,7 Go (Google)", "gemma4:e4b": "9,5 Go (Google, « edge »)" };
for (const model of MODELS) {
  const runs = results[model];
  const average = runs.reduce((sum, run) => sum + run.summary.seconds + run.lead.seconds, 0) / runs.length;
  const errors = runs.filter((run) => run.summary.error || run.lead.error).length;
  lines.push(`| ${model} | ${SIZES[model]} | ${average.toFixed(0)} s | ${errors} / ${runs.length} |`);
}
lines.push("", "Pour une édition de 50 articles, compter environ 50 × le temps « résumé » + 3 × le temps « Une ».", "");

articles.forEach((article, index) => {
  lines.push(`## ${index + 1}. ${article.title}`, "", `Source : ${article.source} — [article original](${article.url})`, "");
  for (const model of MODELS) {
    const { summary, lead } = results[model][index];
    lines.push(`### ${model}`, "");
    if (summary.error) lines.push(`⚠ ${summary.error}`, "");
    else {
      const s = summary.value;
      lines.push(
        `**${s.titre}**`,
        "",
        s.resume,
        "",
        `*Thème : ${s.theme} · Importance : ${s.importance}/10 — ${s.raison}* · ${summary.seconds.toFixed(1)} s`,
        "",
      );
    }
    lines.push(lead.error ? `⚠ Une : ${lead.error}` : `> **Version Une** (${lead.seconds.toFixed(1)} s) : ${lead.value.texte}`, "");
  }
});

await writeFile(new URL("../docs/comparatif-ia.md", import.meta.url), lines.join("\n"));
console.log("→ docs/comparatif-ia.md");
