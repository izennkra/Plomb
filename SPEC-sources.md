# Spec : sources

Brique 1 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Statut : **validée le 2026-10-20**.

## Objectif
Permettre à l'utilisateur de s'abonner à une source en collant simplement son URL, sans rien configurer.
Plomb reconnaît de quel type de source il s'agit et l'enregistre **une seule fois** dans la base, même si plusieurs
utilisateurs la suivent (c'est ce qui permettra plus tard de ne relever chaque source qu'une fois).

Cette brique ne récupère **pas encore** les publications (c'est la brique `aspiration-web`). Elle gère uniquement la liste des sources.

### Récits utilisateur
- Je colle `instagram.com/mouthwash.studio` → Plomb l'ajoute comme source **Instagram**, nommée `@mouthwash.studio`.
- Je colle `https://x.com/studiobakers` → source **X**, nommée `@studiobakers`.
- Je colle `the-brandidentity.com/features` → source **Web**, nommée `the-brandidentity.com`.
- Je colle deux fois la même source écrite différemment (`https://www.instagram.com/mouthwash.studio/?hl=fr` et `instagram.com/mouthwash.studio`) → Plomb comprend que c'est la même et ne crée pas de doublon.
- Je vois la liste de mes sources et je peux me désabonner d'une source.
- Si je colle n'importe quoi (`bonjour`), Plomb affiche un message clair au lieu de planter.
- Si je colle l'adresse d'un site qui n'existe pas ou ne répond pas, Plomb me le dit et ne l'ajoute pas.

### Règles de reconnaissance
| URL collée | Type | Nom affiché | Clé unique |
|---|---|---|---|
| instagram.com/{compte} | instagram | @{compte} | instagram:{compte en minuscules} |
| x.com/{compte} ou twitter.com/{compte} | x | @{compte} | x:{compte en minuscules} |
| linkedin.com/company/{nom} ou /in/{nom} | linkedin | {nom} | linkedin:{company\|in}/{nom} |
| tout autre site http(s) | web | domaine sans www | web:{domaine}{chemin} (sans paramètres de suivi, sans / final) |

- `https://` est ajouté si absent ; `www.` et la casse du domaine sont ignorés.
- Les paramètres de suivi (`utm_*`, `hl`, `igsh`, `s`, `ref`, etc.) sont retirés.
- Les pages qui ne sont pas un profil (ex. `instagram.com/p/xyz`, `x.com/home`) sont refusées avec un message clair.

### Vérification à l'ajout
- **Sites web** : Plomb contacte le site au moment de l'ajout (10 secondes maximum, redirections suivies).
  S'il ne répond pas ou renvoie une erreur (404, 500…), la source est refusée avec un message clair.
  Si le site redirige vers une autre adresse (ex. `http` → `https`, ancien domaine → nouveau), c'est l'adresse finale qui sert de clé unique.
- **Instagram / X / LinkedIn** : ces plateformes bloquent les robots, on ne peut donc pas vérifier de façon fiable
  qu'un compte existe sans service payant. Pour l'instant on vérifie seulement le format ; la vraie vérification
  arrivera avec la brique `aspiration-sociale`.

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Base de données locale SQLite via Drizzle ORM (better-sqlite3) — même code réutilisable avec Supabase/Postgres plus tard
- Tests : Vitest
- Interface : une page minimale (champ « Coller une URL » + liste), sans design — le design viendra de Figma

## Commands
```
Installer : npm install
Lancer :    npm run dev        (http://localhost:3000)
Tests :     npm test
Vérifs :    npm run lint && npm run typecheck
Base :      npm run db:migrate
```

## Project Structure
```
src/app/              → pages Next.js (page Sources)
src/modules/sources/  → logique de la brique : reconnaissance d'URL, enregistrement
src/db/               → schéma et connexion base de données
tests/                → tests automatiques
data/                 → base SQLite locale (non versionnée)
```

## Code Style
Fonctions courtes et pures pour la logique, noms en anglais dans le code, textes affichés en français.
```ts
export function parseSourceUrl(input: string): ParsedSource | ParseError {
  const url = toUrl(input);
  if (!url) return { error: "Cette adresse n'est pas une URL valide." };
  // ...
}
```

## Modèle de données
- `sources` : id, type, nom affiché, URL normalisée, clé unique, date de création
- `users` : id (un seul utilisateur pour l'instant, créé automatiquement)
- `subscriptions` : utilisateur ↔ source (une source peut avoir plusieurs abonnés)

## Testing Strategy
- Tests unitaires sur la reconnaissance d'URL : tous les exemples de ce document + cas pièges (majuscules, www, paramètres, slash final, URL invalide, page non-profil).
- Tests de la vérification des sites avec un faux serveur local (jamais le vrai internet) : site OK, 404, délai dépassé, redirection.
- Tests d'intégration sur l'enregistrement : ajouter deux fois la même source ne crée qu'une ligne ; se désabonner ne supprime pas la source si un autre utilisateur la suit.

## Boundaries
- Toujours : lancer les tests avant chaque commit, travailler sur une branche, expliquer simplement.
- Demander d'abord : ajouter une dépendance hors de la stack ci-dessus, changer le modèle de données.
- Jamais : committer la base locale ou des clés secrètes, aller chercher le contenu des sources (c'est la brique suivante).

## Success Criteria
- [ ] Les 4 types d'URL du tableau sont reconnus, avec le bon nom et la bonne clé
- [ ] Une même source écrite de 2 façons différentes ne crée qu'une seule ligne en base
- [ ] Une URL invalide ou une page non-profil affiche un message clair en français
- [ ] Un site web qui ne répond pas ou renvoie une erreur est refusé avec un message clair
- [ ] Sur la page, je peux ajouter, voir et retirer mes sources
- [ ] `npm test`, `npm run lint` et `npm run typecheck` passent

## Décisions
1. Vérifier qu'un site web existe dès l'ajout : **oui** (voir « Vérification à l'ajout »).
2. Behance, Dribbble, Pinterest, YouTube : **plus tard**. Substack est traité comme un site web.
