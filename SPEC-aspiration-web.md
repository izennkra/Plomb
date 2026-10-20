# Spec : aspiration-web

Brique 2 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [sources](SPEC-sources.md). Statut : **en attente de validation**.

## Objectif
Pour chaque source de type **site web**, récupérer ses publications récentes (titre, lien, résumé, image, date)
et les enregistrer **une seule fois**, pour qu'elles puissent ensuite alimenter la Salle de Dépêches (brique 3)
et l'IA Rédacteur en Chef (brique 4).

Instagram, X et LinkedIn ne sont **pas** concernés (brique `aspiration-sociale`) : ils restent « en attente ».

### Ce qu'on a constaté sur les sources d'Izenn (20 octobre 2026)
| Site | Niveau | Ce qu'on trouve |
|---|---|---|
| findings.mouthwash.studio | 1 — RSS ✅ | flux `/feed` complet |
| offbrandkoto.substack.com | 1 — RSS ✅ | flux `/feed` complet (Substack) |
| the-brandidentity.com/features | 2 — page | ~20 liens `/project/…` ; chaque article a titre, résumé et image HD (OpenGraph), **pas de date** |
| itsnicethat.com | 2 — page | flux RSS interdit aux robots ; ~60 liens `/articles/…` |
| underconsideration.com/brandnew | 2 — page | seul flux annoncé = podcast (à ignorer) ; articles `/brandnew/archives/….php` **mélangés à 44 liens de catégories** (cas piège) |
| dandad.org/work/d-ad-awards-archive | 2 — page | archive des prix : liens `/work/d-ad-awards-archive/…` ; publie rarement |

→ Le **niveau 2** de la cascade (lire la page) n'est pas un cas rare : c'est le cas principal pour les médias design.

### Récits utilisateur
- J'ajoute `the-brandidentity.com/features` → quelques secondes plus tard, je vois ses ~20 derniers articles (titre, image, résumé, lien).
- J'ajoute un blog/Substack qui a un flux RSS → mêmes informations, plus la date de publication.
- Je clique « Relever maintenant » → seuls les **nouveaux** articles sont ajoutés, jamais de doublon.
- Pour chaque source, je vois si le dernier relevé a marché (« 18 articles · relevé à 10:42 ») ou non (« Impossible de lire ce site : … »).

## Fonctionnement : la cascade
1. **Niveau 1 — Flux RSS/Atom** : chercher un flux annoncé dans la page (`<link rel="alternate">`), sinon essayer les adresses
   courantes (`/feed`, `/rss.xml`, `/atom.xml`, `/index.xml`). Un flux n'est accepté que s'il contient vraiment du RSS/Atom
   (certains sites renvoient une page HTML à la place, comme the-brandidentity.com/feed).
2. **Niveau 2 — Lecture de la page** : repérer dans la page de la source les liens qui ressemblent à des articles
   (même site, même « famille » d'adresse répétée au moins 3 fois, ex. `/project/…`, `/articles/…`), en écartant les pages
   de catégorie, tags, auteurs, etc. (adresses courtes du type `/category/advertising` : les articles ont des adresses longues
   et descriptives), puis ouvrir chaque
   **nouvel** article pour lire ses balises OpenGraph (titre, résumé, image) et sa date si elle existe (balises `article:published_time` ou données JSON-LD).
   Le texte complet est extrait avec Mozilla Readability (pour l'IA de la brique 4).
3. **Niveau 3 — IA** : **reporté** (voir Décisions). Les sites que les niveaux 1 et 2 ne savent pas lire sont marqués
   « illisible » : on saura ainsi combien de sites en ont vraiment besoin.

La méthode qui a marché (RSS ou page) est mémorisée par source pour aller directement au bon niveau la fois suivante.

### Règles
- **Premier relevé** : les 20 publications les plus récentes. **Relevés suivants** : uniquement les nouvelles (au plus 20).
- **Date** : la date de publication si le site la donne, sinon la date à laquelle Plomb a découvert l'article.
- **Doublons** : un article est identifié par son adresse nettoyée (même règles que les sources) — jamais enregistré deux fois.
- **Déclenchement** : automatiquement juste après l'ajout d'une source web, et via un bouton « Relever maintenant ».
  Le relevé automatique toutes les 30–60 min viendra avec la brique `planification`.

### Politesse et sécurité
- Respect du fichier `robots.txt` des sites.
- Une seule requête à la fois par site, une pause d'environ 1 seconde entre deux pages, 10 secondes max par page, 5 Mo max.
- **Sécurité (suivi de la brique 1)** : Plomb refuse de contacter les adresses internes (127.0.0.1, 192.168.x.x, 10.x.x.x,
  adresses du cloud…), y compris après une redirection. S'applique aussi à la vérification à l'ajout d'une source.
- Dans l'application, on affiche **titre, résumé, image et lien vers l'article original** — jamais le texte complet
  (il sert uniquement à l'IA). Le lecteur est toujours renvoyé vers le média.

## Tech Stack
Ajouts à la stack de la brique 1 :
- `@extractus/feed-extractor` — lire les flux RSS / Atom / JSON Feed
- `cheerio` — lire le HTML (liens, balises OpenGraph)
- `@mozilla/readability` + `linkedom` — extraire le texte principal d'un article
- `robots-parser` — lire les règles robots.txt

## Commands
Inchangées : `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run db:generate`, `npm run db:migrate`.

## Project Structure
```
src/modules/fetching/           → accès réseau sécurisé (adresses internes bloquées, taille, délai, robots.txt)
src/modules/aspiration-web/     → cascade : flux RSS, lecture de page, extraction d'article, relevé d'une source
tests/aspiration-web/           → tests avec faux sites locaux et pages HTML d'exemple
tests/fixtures/                 → copies de pages réelles (the-brandidentity, itsnicethat…) pour les tests
```

## Modèle de données
- Nouvelle table `posts` : source, adresse (unique), titre, résumé, image, date de publication (si connue),
  date de découverte, texte complet (pour l'IA), méthode (`rss` | `page`).
- Ajouts à `sources` : méthode retenue, adresse du flux trouvé, date / statut / message du dernier relevé.

## Code Style
Comme la brique 1 : fonctions courtes, logique séparée de l'interface, réseau injecté en paramètre pour les tests.

## Testing Strategy
- Tests unitaires sur des **copies figées** des pages des 6 sites ci-dessus (+ un article de chaque)
  pour que les tests ne dépendent pas d'internet.
- Faux serveur local pour : flux RSS valide, flux « déguisé » en HTML, page sans flux, robots.txt interdisant l'accès, nouveaux articles entre deux relevés.
- Tests de sécurité : adresses internes refusées, redirection vers une adresse interne refusée.
- Test manuel dans le navigateur sur les vrais sites.

## Boundaries
- Toujours : respecter robots.txt, limiter la cadence, tester avant chaque commit.
- Demander d'abord : ajouter une dépendance hors de la liste ci-dessus, utiliser une IA (niveau 3).
- Jamais : afficher le texte complet d'un article, contacter une adresse interne, relever Instagram/X/LinkedIn dans cette brique.

## Success Criteria
- [ ] the-brandidentity.com/features, itsnicethat.com et underconsideration.com/brandnew → au moins 10 articles chacun, avec titre, image et lien, **sans pages de catégorie**
- [ ] dandad.org (archive des prix) → les entrées de l'archive sont reconnues comme articles
- [ ] findings.mouthwash.studio et offbrandkoto.substack.com → articles avec date de publication (via RSS)
- [ ] Un deuxième relevé n'ajoute que les nouveaux articles (0 doublon)
- [ ] Un site illisible ou injoignable affiche un statut d'erreur clair sans bloquer les autres sources
- [ ] Les adresses internes sont refusées (ajout et relevé)
- [ ] `npm test`, `npm run lint` et `npm run typecheck` passent

## Décisions
1. Niveau 3 (IA) : **plus tard** — on mesure d'abord combien de sites restent illisibles, et on choisit l'IA (locale) avec la brique `edition`.
2. Texte complet des articles : **stocké pour l'IA**, jamais affiché.
3. Sites de test : ceux d'Izenn (tableau ci-dessus).

## Open Questions
1. D&AD : l'adresse donnée pointe vers la **page 2** de l'archive (`?page=2`). Les nouveautés sont en page 1 :
   proposition d'ajouter la source sans `?page=2`.
