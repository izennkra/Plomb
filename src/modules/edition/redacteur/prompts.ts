import { THEMES } from "@/db/schema";
import type { ArticleInput } from "./types";

/** Text of the article given to the AI: enough to understand, short enough to stay fast. */
const MAX_CHARS = 6000;

export const SYSTEM_PROMPT = `Tu es le rédacteur en chef de Plomb, un journal de veille quotidien pour designers et créatifs.
Tu écris en français, dans un ton de journal : clair, factuel, élégant, sans superlatifs publicitaires.
Tu t'appuies UNIQUEMENT sur le texte de l'article fourni : n'invente aucun fait, nom, chiffre ou citation.
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
- "importance" : une note de 1 à 10 de l'intérêt pour un designer (ampleur du projet, originalité, qualité du travail).
  Sois exigeant et étale tes notes : 5 = actualité ordinaire, 7 = projet notable, 9 ou 10 = exceptionnel (rare).`;
}

export function leadPrompt(article: ArticleInput): string {
  return `${articleBlock(article)}

Cet article fait la Une de l'édition du matin. Rédige "texte" : un article de Une de 100 à 130 mots en français,
en un ou deux paragraphes, qui présente le projet, les personnes ou studios impliqués, et ce qui le rend remarquable —
uniquement d'après le texte. Sans titre (il est déjà écrit), sans Markdown, sans lien ni signature.`;
}

export const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    titre: { type: "string" },
    resume: { type: "string" },
    theme: { type: "string", enum: [...THEMES] },
    importance: { type: "integer", minimum: 1, maximum: 10 },
  },
  required: ["titre", "resume", "theme", "importance"],
} as const;

export const LEAD_SCHEMA = {
  type: "object",
  properties: { texte: { type: "string" } },
  required: ["texte"],
} as const;
