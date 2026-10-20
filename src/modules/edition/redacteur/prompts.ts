import { THEMES } from "@/db/schema";
import type { ArticleInput, FrontPageCandidate } from "./types";

/** Text of the article given to the AI: enough to understand, short enough to stay fast. */
const MAX_CHARS = 6000;

export const SYSTEM_PROMPT = `Tu es le rédacteur en chef de Plomb, un journal de veille quotidien pour designers et créatifs.
Tu écris en français, dans un ton de journal : clair, factuel, élégant, sans superlatifs publicitaires.
Tu t'appuies UNIQUEMENT sur le texte de l'article fourni : n'invente aucun fait, nom, chiffre, date ou citation.
Tu écris du texte brut : pas de Markdown (ni gras, ni italique, ni titres, ni liens), pas de signature, pas de date ajoutée.
Tu réponds uniquement en JSON, selon le format demandé.`;

function articleBlock(article: ArticleInput): string {
  const text = article.content?.trim() || article.excerpt?.trim() || "";
  return `Article publié par ${article.sourceName} :
TITRE D'ORIGINE : ${article.title}
TEXTE :
${text.slice(0, MAX_CHARS)}`;
}

export function summaryPrompt(article: ArticleInput): string {
  return `${articleBlock(article)}

Rédige pour l'édition du matin :
- "titre" : un titre de journal en français (90 caractères max) ;
- "resume" : l'essentiel en 2 ou 3 phrases (60 mots max) ;
- "theme" : un thème parmi ${THEMES.join(", ")} ;
- "sujet" : le sujet principal en 1 à 4 mots, en général la marque, l'institution ou le studio concerné (ex. "Coca-Cola", "MoMA PS1") ;
- puis 5 critères notés de 1 à 5, pour décider de ce qui fait la Une. Sois exigeant, utilise toute l'échelle :
  - "notoriete" : notoriété du sujet. 5 = marque ou institution connue dans le monde entier (Coca-Cola, Google, les JO) ;
    3 = marque connue dans son pays ou son secteur ; 1 = commerce ou projet local (un café de quartier) ;
  - "ampleur" : ampleur du projet. 5 = refonte complète d'une identité ou d'un système ; 3 = un volet (packaging, campagne) ;
    1 = un détail ou une petite pièce ;
  - "auteurs" : renommée des auteurs. 5 = studio ou agence de référence (Pentagram, Wolff Olins…) ; 1 = inconnu ou non cité ;
  - "portee" : portée culturelle. 5 = fait débat ou change les pratiques du métier ; 1 = sans écho attendu ;
  - "qualite" : qualité et originalité du travail présenté.
Exemple de calibrage : la refonte de Coca-Cola par une grande agence ≈ notoriete 5, ampleur 5, portee 5 ;
la nouvelle identité d'un café matcha de quartier ≈ notoriete 1, ampleur 2, portee 1, même si elle est très réussie.`;
}

export function leadPrompt(article: ArticleInput): string {
  return `${articleBlock(article)}

Cet article fait la Une de l'édition du matin. Rédige "texte" : un article de Une de 100 à 130 mots en français,
en un ou deux paragraphes, qui présente le projet, les personnes ou studios impliqués, et ce qui le rend remarquable —
uniquement d'après le texte. Sans titre (il est déjà écrit), sans Markdown, sans lien ni signature.`;
}

const NOTE = { type: "integer", minimum: 1, maximum: 5 } as const;

export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string" },
    resume: { type: "string" },
    theme: { type: "string", enum: [...THEMES] },
    sujet: { type: "string" },
    notoriete: NOTE,
    ampleur: NOTE,
    auteurs: NOTE,
    portee: NOTE,
    qualite: NOTE,
  },
  required: ["titre", "resume", "theme", "sujet", "notoriete", "ampleur", "auteurs", "portee", "qualite"],
} as const;

export const LEAD_SCHEMA = {
  type: "object",
  properties: { texte: { type: "string" } },
  required: ["texte"],
} as const;

export function frontPagePrompt(candidates: FrontPageCandidate[]): string {
  const list = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.title} — ${candidate.sourceName}${candidate.coveredBy.length ? ` (aussi couvert par ${candidate.coveredBy.join(", ")})` : ""}
   Sujet : ${candidate.subject || "?"} · Note : ${candidate.importance.toFixed(1)}/10
   ${candidate.summary}`,
    )
    .join("\n");
  return `Conférence de rédaction de l'édition du matin. Voici les ${candidates.length} sujets les mieux notés :

${list}

Choisis la Une comme le ferait le rédacteur en chef d'un grand journal de design : l'événement le plus marquant pour la
profession (notoriété du sujet, ampleur, retentissement, nombre de médias qui en parlent), pas seulement le plus joli.
- "une" : le numéro du sujet qui fait la Une ;
- "secondaires" : les numéros des 2 sujets suivants (différents de la Une) ;
- "raison" : la raison de ce choix en une phrase.`;
}

export const FRONT_PAGE_SCHEMA = {
  type: "object",
  properties: {
    une: { type: "integer" },
    secondaires: { type: "array", items: { type: "integer" } },
    raison: { type: "string" },
  },
  required: ["une", "secondaires", "raison"],
} as const;
