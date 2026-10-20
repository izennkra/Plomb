# Tâches : brique `depeches`

## Tâche 1 : Colonne `posts.images`
**Description :** Liste JSON des adresses d'images de l'article (image principale en premier). Migration.
**Critères :**
- [ ] Une galerie s'enregistre et se relit telle quelle
- [ ] Les anciens articles (sans galerie) restent valides
**Vérification :** `npm test` + `npm run db:migrate` · **Dépendances :** aucune · **Taille :** XS
**Fichiers :** `src/db/schema.ts`, `drizzle/*`, `tests/db/schema.test.ts`

## Tâche 2 : Galerie d'un article (page)
**Description :** `findArticleImages(html, pageUrl, mainImage)` : toutes les adresses d'images de la page (balises et données),
gardées si même dossier propre à l'article ou même nom de base que l'image principale ; doublons de taille retirés ; 12 max. `readArticle` renvoie `images`.
**Critères :**
- [ ] The Brand Identity → 8, It's Nice That → 12, Brand New → 2, D&AD → 1
- [ ] Aucune image d'un autre article
**Vérification :** `npm test` sur copies figées · **Dépendances :** 1 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/images.ts`, `src/modules/aspiration-web/article.ts`, `tests/aspiration-web/images.test.ts`

## Tâche 3 : Galerie d'un article de flux RSS
**Description :** `parseFeed` renvoie `images` : image du flux + images du contenu, sans pictos ni pixels de suivi.
**Critères :**
- [ ] Findings → plusieurs images pour le 1er article ; aucun fichier audio
**Vérification :** `npm test` · **Dépendances :** 1 · **Taille :** S
**Fichiers :** `src/modules/aspiration-web/feed.ts`, `tests/aspiration-web/feed.test.ts`

## Tâche 4 : Enregistrer les galeries + compléter les anciennes
**Description :** Le relevé enregistre `images`. Bouton temporaire « Compléter les galeries » sur la page Sources : relit poliment les articles sans galerie.
**Critères :**
- [ ] Un nouvel article relevé a sa galerie
- [ ] Après le bouton, les articles existants ont leur galerie
**Vérification :** `npm test` + essai réel · **Dépendances :** 2, 3 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/refresh-source.ts`, `src/modules/depeches/complete-galleries.ts`, `src/app/actions.ts`, `src/app/page.tsx`, tests

## Checkpoint 1
- [ ] Galeries réelles vérifiées — point avec Izenn

## Tâche 5 : Requête du flux
**Description :** `listFeed(db, userId, { type?, sourceId?, now })` : publications des sources suivies, 7 derniers jours (date de publication sinon découverte), tri du plus récent, dédoublonnées par adresse ; « avant l'abonnement » seulement si date de publication connue et récente (réglage) ; filtres.
**Critères :**
- [ ] Tri et fenêtre de 7 jours corrects ; un article de deux sources n'apparaît qu'une fois
- [ ] Règle « avant l'abonnement » respectée (dont : sans date → caché)
- [ ] Filtres par type et par source
**Vérification :** `npm test` · **Dépendances :** 1 · **Taille :** M
**Fichiers :** `src/modules/depeches/settings.ts`, `src/modules/depeches/list-feed.ts`, `tests/depeches/list-feed.test.ts`

## Tâche 6 : Conservation 7 jours
**Description :** `purgeOldPosts(db, now)` supprime les publications de plus de 7 jours ; appelée à chaque relevé. Les adresses restent « déjà vues ».
**Critères :**
- [ ] Publication de 8 jours supprimée, de 6 jours gardée
- [ ] Une publication supprimée ne revient pas au relevé suivant
**Vérification :** `npm test` · **Dépendances :** 5 · **Taille :** S
**Fichiers :** `src/modules/depeches/purge.ts`, `src/modules/aspiration-web/refresh-source.ts`, `tests/depeches/purge.test.ts`

## Tâche 7 : Page Sources sur `/sources`
**Description :** La page actuelle déplacée sur `/sources` ; navigation « Dépêches · Sources ».
**Critères :**
- [ ] Ajouter / retirer / relever fonctionne sur `/sources`
**Vérification :** test manuel · **Dépendances :** aucune · **Taille :** S
**Fichiers :** `src/app/sources/page.tsx`, `src/app/layout.tsx`, `src/app/actions.ts`

## Tâche 8 : Cartes de la Salle de Dépêches
**Description :** Page `/` : une carte par publication — carrousel d'images (flèches, clavier), titre, résumé, date relative, source, « En savoir plus » (nouvel onglet vers le média).
**Critères :**
- [ ] Les cartes s'affichent triées par date
- [ ] Le carrousel fait défiler les images de l'article
- [ ] « En savoir plus » ouvre l'article
**Vérification :** test manuel · **Dépendances :** 5, 7 · **Taille :** M
**Fichiers :** `src/app/page.tsx`, `src/app/components/post-card.tsx`, `src/app/components/carousel.tsx`, `src/app/globals.css`

## Tâche 9 : Image en grand + filtres
**Description :** Clic sur une image → affichage plein écran (flèches, Échap pour fermer). Filtres par type et par source, gardés dans l'adresse.
**Critères :**
- [ ] Image en grand utilisable à la souris et au clavier
- [ ] Filtres fonctionnels, adresse partageable
**Vérification :** test manuel · **Dépendances :** 8 · **Taille :** M
**Fichiers :** `src/app/components/lightbox.tsx`, `src/app/components/filters.tsx`, `src/app/page.tsx`

## Checkpoint final
- [ ] Critères de succès de SPEC-depeches.md cochés
- [ ] `/review`, push, proposition de pull request
