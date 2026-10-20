# Tâches : brique `sources`

## Tâche 1 : Mettre en place le projet
**Description :** Créer le squelette Next.js 15 + TypeScript, configurer Vitest, ESLint et les scripts npm de la spec. Ignorer `data/` et `.env*` dans git.
**Critères :**
- [x] `npm run dev` affiche une page « Plomb »
- [x] `npm test` lance Vitest (un test d'exemple passe)
- [x] `npm run lint` et `npm run typecheck` passent
**Dépendances :** aucune · **Taille :** M
**Fichiers :** `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/app/page.tsx`, `.gitignore`

## Tâche 2 : Reconnaître et normaliser une URL
**Description :** Fonction pure `parseSourceUrl(input)` qui renvoie type, nom affiché, URL normalisée et clé unique — ou un message d'erreur en français. Écrite en TDD (tests d'abord).
**Critères :**
- [x] Tous les exemples du tableau de la spec sont reconnus
- [x] www, majuscules, paramètres de suivi et `/` final n'influencent pas la clé
- [x] URL invalide et pages non-profil → message clair
**Vérification :** `npm test`
**Dépendances :** 1 · **Taille :** S
**Fichiers :** `src/modules/sources/parse-url.ts`, `tests/sources/parse-url.test.ts`

## Checkpoint 1
- [x] Tests, lint, typecheck OK — point avec Izenn

## Tâche 3 : Créer la base de données
**Description :** Schéma Drizzle (`sources`, `users`, `subscriptions`), migration, connexion SQLite dans `data/plomb.db`, utilisateur par défaut.
**Critères :**
- [ ] `npm run db:migrate` crée la base
- [ ] La clé unique d'une source est protégée par la base (pas de doublon possible)
**Vérification :** `npm test` (test sur base en mémoire)
**Dépendances :** 1 · **Taille :** M
**Fichiers :** `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `tests/db/schema.test.ts`

## Tâche 4 : Vérifier qu'un site web répond
**Description :** Fonction `checkWebsite(url)` : contacte le site (10 s max, redirections suivies), renvoie l'adresse finale ou une erreur claire.
**Critères :**
- [ ] Site OK → accepté, adresse finale renvoyée
- [ ] 404 / 500 / délai dépassé / domaine inexistant → refus avec message clair
- [ ] Redirection → l'adresse finale est utilisée
**Vérification :** `npm test` avec faux serveur local
**Dépendances :** 2 · **Taille :** S
**Fichiers :** `src/modules/sources/check-website.ts`, `tests/sources/check-website.test.ts`

## Tâche 5 : Ajouter une source
**Description :** Service `addSource(userId, input)` : reconnaît l'URL, vérifie le site si c'est du web, enregistre la source si elle n'existe pas encore, puis abonne l'utilisateur.
**Critères :**
- [ ] Même source écrite de 2 façons → 1 seule ligne en base
- [ ] Deux utilisateurs suivent la même source → 1 source, 2 abonnements
- [ ] Erreurs de reconnaissance et de vérification remontées telles quelles
**Vérification :** `npm test`
**Dépendances :** 2, 3, 4 · **Taille :** M
**Fichiers :** `src/modules/sources/add-source.ts`, `tests/sources/add-source.test.ts`

## Checkpoint 2
- [ ] Tous les tests passent — point avec Izenn

## Tâche 6 : Page Sources — ajouter et lister
**Description :** Page avec un champ « Coller une URL », un bouton Ajouter, le message d'erreur éventuel et la liste des sources suivies (type + nom).
**Critères :**
- [ ] Ajouter une URL valide la fait apparaître dans la liste
- [ ] Une erreur s'affiche en français sous le champ
**Vérification :** test manuel dans le navigateur
**Dépendances :** 5 · **Taille :** M
**Fichiers :** `src/app/page.tsx`, `src/app/actions.ts`, `src/modules/sources/list-sources.ts`

## Tâche 7 : Retirer une source
**Description :** Service `unsubscribe(userId, sourceId)` + bouton « Retirer » sur la page. La source reste en base si un autre utilisateur la suit.
**Critères :**
- [ ] La source disparaît de ma liste
- [ ] Elle n'est pas supprimée si quelqu'un d'autre la suit
**Vérification :** `npm test` + test manuel
**Dépendances :** 6 · **Taille :** S
**Fichiers :** `src/modules/sources/unsubscribe.ts`, `tests/sources/unsubscribe.test.ts`, `src/app/page.tsx`, `src/app/actions.ts`

## Checkpoint final
- [ ] Tous les critères de succès de SPEC-sources.md cochés
- [ ] `/review`, push de la branche, proposition de pull request
