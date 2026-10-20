# Spec : edition (l'IA Rédacteur en Chef)

Brique 4 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [depeches](SPEC-depeches.md). Statut : **validée le 2026-10-20**.

## Objectif
Chaque matin, une **édition personnelle** du journal Plomb : l'IA lit tout ce qui est arrivé depuis l'édition précédente,
le **hiérarchise** et le **rédige en français** (langue réglable), avec une **Une** et la suite de l'actualité.
On la lit, puis on referme le journal.

Cette brique fabrique l'édition (à la demande, via un bouton) et prépare l'e-mail ; le déclenchement automatique
(préparation à 8h00, publication et e-mail à 9h00) arrive avec la brique `planification`.

### Récits utilisateur
- Je clique « Préparer l'édition » → quelques minutes plus tard, l'édition du jour est prête.
- J'ouvre la page **Journal** : en haut la **Une** (1 article majeur, texte plus développé, grande image) et **2 articles
  secondaires** ; ensuite le reste de l'actualité, du plus important au moins important.
- Chaque article : un titre et un résumé **rédigés par l'IA en français**, ses images, la source, « En savoir plus » → l'article original.
- Je marque une source comme **favorite** (page Sources) → ses articles passent en priorité dans le journal et sont
  **mis en valeur** (repère visuel provisoire, le vrai design viendra de Figma).
- Je retrouve les éditions des 7 derniers jours.
- J'ai un aperçu de l'**e-mail** de l'édition (« Votre journal du 21 octobre est prêt » + un extrait de la Une + lien vers le journal).

## Contenu d'une édition
- **Articles retenus** : tous les articles **nouveaux** (jamais ceux d'avant l'abonnement) arrivés depuis l'édition
  précédente, jusqu'à **8h00** (1 h avant la publication de 9h00). Première édition : les dernières 24 h.
- **Importance** : l'IA note chaque article (intérêt pour un designer, ampleur du projet, qualité visuelle) ;
  les articles des **sources favorites** reçoivent un bonus. La Une = les 3 plus importants (1 majeur + 2 secondaires).
- **Rédaction** : pour chaque article, un titre et un résumé de 2–3 phrases (Une : un texte plus développé, ~120 mots),
  à partir du texte complet de l'article (si le flux RSS n'en donne qu'un extrait, la page de l'article est lue). Ton : journal, factuel, sans inventer. Langue : français par défaut.
- **Thème** : l'IA attribue aussi une étiquette de thème provisoire (Identité, Typographie, Packaging, Édition,
  Digital & motion, Illustration & photo, Culture & métier). Elle n'est **pas encore affichée en rubriques** :
  ce choix sera fait au moment de l'UX, mais la donnée sera prête.
- **Journée sans nouveauté** : l'édition le dit simplement (« Pas de nouvelles de vos sources depuis hier »).

## Choix de l'IA (première tâche de la brique)
Souhait : une IA **installée sur le Mac**, sans coût par utilisation. Le Mac d'Izenn (M1 Pro, 16 Go, 61 Go libres)
peut faire tourner des modèles de taille moyenne via **Ollama** (logiciel gratuit qui fait tourner des IA en local).

**Comparatif sur 5 vrais articles** (résumé, Une, note d'importance, respect du français et des faits) entre :
- 2 ou 3 IA locales récentes adaptées à 16 Go (ex. familles Gemma, Qwen, Mistral — versions à jour au moment du test,
  ~5 à 10 Go chacune à télécharger) ;
Izenn choisit sur pièces (Claude n'est **pas** inclus : uniquement des IA locales). Le code passe par une **interface unique** (« rédacteur ») : on peut changer d'IA plus tard
sans toucher au reste (par ex. IA locale sur le Mac, autre solution une fois Plomb en ligne).

## Modèle de données
- `editions` : date, période couverte, statut (en préparation / prête / erreur), IA utilisée, langue.
- `edition_items` : édition, article, rang, place (une / secondaire / suite), titre et résumé rédigés, thème, note d'importance.
- `subscriptions.favorite` : source favorite (par utilisateur).

## Tech Stack
- **Ollama** (application Mac) + appel HTTP local depuis Plomb (pas de librairie nécessaire).
- E-mail : rendu HTML de l'e-mail + aperçu dans l'app ; **envoi réel dans la brique `planification`**.

## Project Structure
```
src/modules/edition/redacteur/   → interface unique + Ollama : prompts, lecture des réponses
src/modules/edition/             → sélection des articles, notation, Une, fabrication et stockage de l'édition
src/modules/edition/email.ts     → contenu de l'e-mail (HTML + texte)
src/app/journal/                 → page Journal (édition du jour + 7 précédentes)
scripts/compare-ai.ts            → comparatif des IA sur 5 articles (résultats dans docs/)
```

## Testing Strategy
- La logique (sélection 8h00, bonus favoris, Une 1+2, journée vide) testée avec un **faux rédacteur** (réponses fixes) : rapide, sans IA.
- Lecture des réponses de l'IA : réponses mal formées gérées (nouvel essai, puis résumé d'origine du média en secours).
- Comparatif réel des IA documenté dans `docs/comparatif-ia.md`.
- Page Journal et aperçu e-mail : test manuel.

## Boundaries
- Toujours : l'IA ne rédige qu'à partir du texte de l'article (pas d'invention) ; lien vers l'article original.
- Demander d'abord : télécharger les modèles (taille annoncée), utiliser une clé API payante.
- Jamais : publier le texte complet d'un article ; mettre une clé API dans git.

## Success Criteria
- [ ] Comparatif des IA réalisé sur 5 vrais articles, choix d'Izenn noté
- [ ] « Préparer l'édition » produit une édition : Une (1 + 2), suite classée par importance, résumés en français
- [ ] Seuls les articles nouveaux arrivés jusqu'à 8h00 depuis l'édition précédente sont retenus
- [ ] Les sources favorites passent en priorité et sont mises en valeur
- [ ] Les 7 dernières éditions restent consultables
- [ ] Aperçu de l'e-mail de l'édition
- [ ] Si l'IA échoue sur un article, l'édition se fait quand même (résumé du média en secours)
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. Articles : tout ce qui est nouveau jusqu'à 1 h avant le journal de 9h00.
2. La Une : 1 article majeur + 2 secondaires.
3. Importance : les gros sujets prennent plus de place ; **sources favorites** prioritaires et mises en valeur.
4. Rubriques : à décider au moment de l'UX (étiquette de thème préparée en attendant).
5. Emplacement du journal dans l'app (page principale ou notification + page dédiée) : à décider au moment de l'UX ;
   page `/journal` en attendant.
6. Un **e-mail** est envoyé à 9h00 avec un extrait du journal (envoi : brique `planification`).

7. Comparatif : **IA locales uniquement** (pas de Claude) ; téléchargement de 2–3 modèles accepté.
8. **IA retenue : Mistral (Ministral 3 14B), en local** — voir [docs/comparatif-ia.md](docs/comparatif-ia.md).
   Si le Mac rame à chaque journal du matin → **IA en ligne** (API payante, choisie selon le prix).
   Protections du Mac : modèle déchargé 30 s après la rédaction ; en mode test, 10 articles maximum.

## Open Questions
- Aucune.
