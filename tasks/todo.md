# Tâches : brique `edition`

## Tâche 1 : Comparatif des IA locales
**Description :** Script qui donne les 5 mêmes vrais articles (variés : The Brand Identity, It's Nice That, Findings…) à 3 IA locales (Ministral 3 14B, Gemma 4 12B, Gemma 4 E4B) avec la consigne du rédacteur ; mesure le temps ; résultats côte à côte dans `docs/comparatif-ia.md`.
**Critères :**
- [x] 5 articles × 3 IA : titre, résumé, thème, note, texte de Une
- [x] Temps par article noté ; erreurs de format notées
**Vérification :** lecture du document par Izenn · **Dépendances :** aucune · **Taille :** M
**Fichiers :** `scripts/compare-ai.mjs`, `docs/comparatif-ia.md`

## Checkpoint 1
- [x] Izenn choisit l'IA → Mistral (Ministral 3 14B), API en ligne si le Mac rame

## Tâche 2 : Rédacteur Ollama
**Description :** Interface `Redacteur` (`summarize(article)`, `writeLead(article)`), implémentation Ollama (JSON imposé, délai max, 2 essais), faux rédacteur pour les tests.
**Critères :**
- [x] Réponse valide → titre, résumé, thème (liste fermée), note 1–10
- [x] Réponse invalide ou IA injoignable → erreur claire après 2 essais
**Vérification :** `npm test` (faux serveur Ollama local) · **Dépendances :** 1 · **Taille :** M
**Fichiers :** `src/modules/edition/redacteur/*.ts`, `tests/edition/redacteur.test.ts`

## Tâche 3 : Base de données
**Description :** Tables `editions` et `edition_items`, colonne `subscriptions.favorite`. Migration.
**Critères :**
- [x] Une édition et ses articles s'enregistrent et se relisent
- [x] Supprimer un article supprime sa ligne d'édition, pas l'édition
**Vérification :** `npm test` + `npm run db:migrate` · **Dépendances :** aucune · **Taille :** S
**Fichiers :** `src/db/schema.ts`, `drizzle/*`, `tests/db/schema.test.ts`

## Tâche 4 : Sélection des articles
**Description :** `selectEditionPosts(db, userId, { now })` : articles nouveaux (jamais « avant l'abonnement ») des sources suivies, découverts après la fin de l'édition précédente et jusqu'à 8h00 (Paris) ; première édition : 24 h.
**Critères :**
- [x] Fenêtre correcte (dont première édition), dédoublonnage par adresse
- [x] Articles d'avant l'abonnement exclus
**Vérification :** `npm test` · **Dépendances :** 3 · **Taille :** S
**Fichiers :** `src/modules/edition/select.ts`, `tests/edition/select.test.ts`

## Tâche 5 : Fabrication de l'édition
**Description :** `buildEdition(db, userId, { redacteur, now })` : rédige chaque article, note + bonus favoris, choisit la Une (1 + 2), rédige les textes de Une, classe la suite, enregistre ; secours si l'IA échoue ; édition vide assumée ; statut en préparation / prête / erreur.
**Critères :**
- [x] Une 1 + 2 = les 3 mieux notés (bonus favoris inclus)
- [x] Un échec de l'IA sur un article n'empêche pas l'édition
- [x] Journée sans nouveauté → édition « pas de nouvelles »
**Vérification :** `npm test` (faux rédacteur) · **Dépendances :** 2, 3, 4 · **Taille :** M
**Fichiers :** `src/modules/edition/build.ts`, `tests/edition/build.test.ts`

## Checkpoint 2
- [x] Vraie édition sur les données d'Izenn — très satisfait ; demande : mieux hiérarchiser la Une

## Tâche 6 : Favoris
**Description :** Étoile « favori » par source sur la page Sources (par utilisateur).
**Critères :**
- [x] Marquer / démarquer une source ; l'état est gardé
**Vérification :** test manuel + `npm test` · **Dépendances :** 3 · **Taille :** S
**Fichiers :** `src/modules/sources/favorite.ts`, `src/app/sources/page.tsx`, `src/app/actions.ts`

## Tâche 7 : Page Journal
**Description :** `/journal` : édition du jour (Une majeure, 2 secondaires, suite), repère visuel des favoris, éditions des 7 derniers jours, bouton « Préparer l'édition » avec statut. Lien dans la navigation.
**Critères :**
- [ ] Lecture de l'édition complète ; navigation entre éditions
- [ ] « Préparer l'édition » fonctionne en arrière-plan
**Vérification :** test manuel · **Dépendances :** 5, 6 · **Taille :** M
**Fichiers :** `src/app/journal/page.tsx`, `src/app/components/edition-*.tsx`, `src/modules/edition/list.ts`

## Tâche 8 : E-mail de l'édition
**Description :** Contenu de l'e-mail (« Votre journal du … est prêt », extrait de la Une, lien) en HTML + texte ; aperçu dans l'app.
**Critères :**
- [ ] Aperçu lisible ; extrait de la Une ; lien vers le journal
**Vérification :** `npm test` + aperçu manuel · **Dépendances :** 5 · **Taille :** S
**Fichiers :** `src/modules/edition/email.ts`, `src/app/journal/[id]/email/route.ts`, `tests/edition/email.test.ts`

## Tâche 9 : Grille de critères
**Description :** Le rédacteur note 5 critères (notoriété, ampleur, auteurs, portée, qualité, de 1 à 5) et nomme le sujet principal ; Plomb calcule la note sur 10 avec des poids. Consigne calibrée par des exemples. Favoris : plus de bonus.
**Critères :**
- [x] Note calculée correctement à partir des critères ; notoriété et ampleur pèsent le plus
- [x] Un article favori n'est pas avantagé dans le classement, mais reste marqué
**Vérification :** `npm test` · **Dépendances :** 5 · **Taille :** M
**Fichiers :** `src/modules/edition/redacteur/*`, `src/modules/edition/scoring.ts`, `src/modules/edition/build.ts`, `src/db/schema.ts`, tests

## Tâche 10 : Écho médiatique
**Description :** Articles au même sujet principal venant de sources différentes → regroupés en un seul (le plus riche), mention des autres médias, bonus d'importance.
**Critères :**
- [x] « Coca-Cola » chez 3 sources → 1 article, couvert par 3 médias, mieux classé
- [x] Sujets différents jamais fusionnés par erreur (noms trop courts ou génériques ignorés)
**Vérification :** `npm test` · **Dépendances :** 9 · **Taille :** M
**Fichiers :** `src/modules/edition/echo.ts`, `src/modules/edition/build.ts`, tests

## Tâche 11 : Conférence de rédaction
**Description :** Une demande de plus à l'IA : elle compare les ~8 meilleurs candidats et choisit la Une (1 + 2). Réponse invalide → ordre des notes.
**Critères :**
- [x] La Une suit le choix de l'IA quand il est valide
- [x] Réponse invalide ou erreur → la Une suit les notes
**Vérification :** `npm test` + vraie édition · **Dépendances :** 9, 10 · **Taille :** M
**Fichiers :** `src/modules/edition/redacteur/*`, `src/modules/edition/build.ts`, tests

## Checkpoint final
- [ ] Critères de succès de SPEC-edition.md cochés
- [ ] `/review`, push, proposition de pull request
