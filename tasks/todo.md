# Tâches : brique `aspiration-web`

## Tâche 1 : Accès réseau sécurisé
**Description :** Fonction `safeFetch(url)` utilisée par tout Plomb : résout l'adresse et refuse les adresses internes (loopback, réseaux privés, link-local, adresses du cloud), suit les redirections une par une en revérifiant chacune (5 max), 10 s max, 5 Mo max. `checkWebsite` (brique 1) l'utilise.
**Critères :**
- [x] 127.0.0.1, localhost, 10.x, 192.168.x, 169.254.169.254, ::1 refusés avec un message clair
- [x] Une redirection vers une adresse interne est refusée
- [x] Réponse trop grosse ou trop lente → erreur claire
**Vérification :** `npm test`
**Dépendances :** aucune · **Taille :** M
**Fichiers :** `src/modules/fetching/safe-fetch.ts`, `src/modules/fetching/ip.ts`, `src/modules/sources/check-website.ts`, `tests/fetching/*.test.ts`

## Tâche 2 : Politesse
**Description :** Lire et mettre en cache le robots.txt de chaque site ; refuser une page interdite. Pause d'au moins 1 s entre deux requêtes vers un même site.
**Critères :**
- [x] Une page interdite par robots.txt n'est pas demandée
- [x] robots.txt absent ou en erreur → tout est autorisé
- [x] Deux requêtes vers un même site sont espacées d'au moins 1 s
**Vérification :** `npm test`
**Dépendances :** 1 · **Taille :** S
**Fichiers :** `src/modules/fetching/robots.ts`, `src/modules/fetching/polite-fetch.ts`, `tests/fetching/robots.test.ts`

## Tâche 3 : Base de données
**Description :** Table `posts` (source, adresse unique, titre, résumé, image, date de publication, date de découverte, texte complet, méthode, marqueur « antérieur ») et colonnes de relevé sur `sources` (méthode, flux, date/statut/message du dernier relevé). Migration.
**Critères :**
- [x] Une même adresse d'article ne peut pas être enregistrée deux fois
- [x] Supprimer une source supprime ses articles
**Vérification :** `npm test` + `npm run db:migrate`
**Dépendances :** aucune · **Taille :** S
**Fichiers :** `src/db/schema.ts`, `drizzle/*`, `tests/db/schema.test.ts`

## Checkpoint 1
- [x] Tests OK ; ajout d'une source toujours fonctionnel dans le navigateur

## Tâche 4 : Copies figées des sites
**Description :** Script qui télécharge la page de chaque site de test et un article de chacun dans `tests/fixtures/`, plus les flux RSS de Findings et OFF Brand.
**Critères :**
- [x] 6 pages de liste + articles + 2 flux enregistrés
- [x] Le script peut être relancé pour rafraîchir les copies
**Vérification :** fichiers présents, taille raisonnable
**Dépendances :** aucune · **Taille :** S
**Fichiers :** `scripts/capture-fixtures.ts`, `tests/fixtures/*`

## Tâche 5 : Niveau 1 — flux RSS/Atom
**Description :** `discoverFeed(html, pageUrl)` (balises `<link rel="alternate">` puis adresses courantes) et `readFeed(xml)` → articles candidats. Ignorer les flux de podcast et les « faux flux » HTML.
**Critères :**
- [x] Findings et OFF Brand → flux trouvé, articles avec titre, lien, date, image si présente
- [x] Brand New → le flux podcast est ignoré
- [x] the-brandidentity.com/feed (page HTML) → pas considéré comme un flux
**Vérification :** `npm test` sur copies figées
**Dépendances :** 4 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/feed.ts`, `tests/aspiration-web/feed.test.ts`

## Tâche 6 : Niveau 2a — liens d'articles
**Description :** `findArticleLinks(html, pageUrl)` : liens du même site, regroupés par famille d'adresse, en écartant catégories, tags, auteurs, pages de menu ; renvoie les liens dans l'ordre de la page.
**Critères :**
- [x] the-brandidentity.com/features → ≥ 10 liens `/project/…`
- [x] itsnicethat.com → ≥ 10 liens `/articles/…`
- [x] Brand New → ≥ 10 liens d'articles, **aucun** lien `/category/…`
- [x] D&AD → entrées de l'archive reconnues
**Vérification :** `npm test` sur copies figées
**Dépendances :** 4 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/article-links.ts`, `tests/aspiration-web/article-links.test.ts`

## Tâche 7 : Niveau 2b — lire un article
**Description :** `readArticle(html, url)` : titre (sans le suffixe « — Nom du site »), résumé, image OpenGraph, date (`article:published_time` ou JSON-LD), texte complet via Readability.
**Critères :**
- [ ] Article The Brand Identity → titre propre, résumé, image HD, pas de date (null)
- [ ] Article avec date → date lue correctement
- [ ] Page sans titre exploitable → rejetée
**Vérification :** `npm test` sur copies figées
**Dépendances :** 4 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/article.ts`, `tests/aspiration-web/article.test.ts`

## Checkpoint 2
- [ ] Les 6 sites donnent des articles corrects sur leurs copies figées — point avec Izenn

## Tâche 8 : Relever une source
**Description :** `refreshSource(db, sourceId)` : méthode mémorisée d'abord, sinon cascade ; n'ouvre que les articles inconnus ; 20 max ; premier relevé marqué « antérieur » ; enregistre méthode, flux et statut sur la source. Relevé de toutes les sources web (une erreur n'arrête pas les autres).
**Critères :**
- [ ] Premier relevé → articles marqués « antérieurs » ; deuxième relevé → seuls les nouveaux, non marqués
- [ ] Aucun doublon
- [ ] Site en erreur → statut d'erreur clair, les autres sources sont relevées
**Vérification :** `npm test` (faux site local qui publie un nouvel article entre deux relevés)
**Dépendances :** 1, 2, 3, 5, 6, 7 · **Taille :** M
**Fichiers :** `src/modules/aspiration-web/refresh-source.ts`, `tests/aspiration-web/refresh-source.test.ts`

## Tâche 9 : Interface
**Description :** Relevé lancé juste après l'ajout d'une source web ; bouton « Relever maintenant » ; pour chaque source : statut du dernier relevé et ses derniers articles (vignette, titre, lien). Instagram/X/LinkedIn affichés « en attente ».
**Critères :**
- [ ] Ajouter the-brandidentity.com/features → ses articles apparaissent
- [ ] « Relever maintenant » fonctionne et met à jour les statuts
**Vérification :** test manuel sur les 6 vrais sites
**Dépendances :** 8 · **Taille :** M
**Fichiers :** `src/app/page.tsx`, `src/app/actions.ts`, `src/modules/aspiration-web/list-posts.ts`

## Checkpoint final
- [ ] Tous les critères de succès de SPEC-aspiration-web.md cochés
- [ ] `/review`, push de la branche, proposition de pull request
