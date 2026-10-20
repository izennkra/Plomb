# Spec : depeches (Salle de Dépêches)

Brique 3 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [aspiration-web](SPEC-aspiration-web.md). Statut : **en attente de validation**.

## Objectif
Un **flux unique**, trié par date (le plus récent en haut), où arrivent les publications de toutes les sources suivies.
Chaque publication est une **carte** pensée pour un designer : les images d'abord, le titre, un résumé court, la date,
la source, et « En savoir plus » qui ouvre **directement l'article sur le site du média** (plus tard : le post Instagram / X).

Le flux couvre **les 7 derniers jours** : c'est une liste continue, toujours triée par date. Pas de défilement infini :
au-delà d'une semaine, les publications sont supprimées.

### Récits utilisateur
- J'ouvre Plomb → je vois les dépêches de la semaine, la plus récente en haut, chacune sous forme de carte datée.
- Sur une carte, je fais défiler les **images de l'article** (carrousel), puis je clique une image pour la voir **en grand**.
- « En savoir plus » → j'ouvre l'article sur le site du média (nouvel onglet).
- Je **filtre** par type de média (Sites web, et plus tard Instagram / X) ou par source (ex. seulement Brand New).
- Un article suivi via deux sources (the-brandidentity.com et /features) n'apparaît **qu'une fois**.
- La gestion des sources (ajout, retrait, relevé) passe sur une page **Sources** séparée.

## Ce qu'on a constaté : images des articles (20 octobre 2026)
| Site | Images de l'article trouvées | Comment les reconnaître |
|---|---|---|
| the-brandidentity.com | 8 | même **dossier** que l'image principale (`/uploads/articles/2026/10/<article>/…`) |
| itsnicethat.com | 12 (dont GIF) | même **nom de base** que l'image principale (`studio-herrstrom-…-1.png`, `-2.png`…) |
| underconsideration.com/brandnew | 2 | même nom de base (`hard_rock_bet_casino_…`) |
| dandad.org/insights | 1 | image principale seulement (les autres images de la page sont d'autres articles) |
| Flux RSS (Findings…) | jusqu'à 13 | images contenues dans l'article du flux |

L'outil de Mozilla (Readability) **supprime** la plupart de ces images : il faut une règle propre à Plomb.
Les images des autres articles de la page (« à lire aussi ») sont **exclues**. Au maximum 12 images par article.

## Fonctionnement
- **Galerie d'images** : à la lecture d'un article (brique 2), Plomb garde l'image principale + les images de la même famille
  (même dossier propre à l'article, ou même nom de base), sans doublons de taille. Pour un flux RSS : les images du contenu
  (hors pictos / boutons / pixels de suivi). Les articles déjà relevés n'ont qu'une image : une commande permet de
  **compléter leurs galeries** (relecture polie des pages).
- **Flux** : toutes les publications des sources suivies des **7 derniers jours**, dédoublonnées par adresse, triées par date
  (date de publication, sinon date de découverte). Chaque carte affiche sa date (« il y a 2 h », « lundi 19 octobre »).
- **Articles d'avant l'abonnement** (trouvés au premier relevé d'une source) : affichés seulement s'ils sont récents —
  **3 jours** en temps normal, **7 jours pendant la phase de test** (un réglage). Sans date de publication connue
  (ex. Brand New), on ne connaît pas leur âge : ils ne sont **pas** affichés.
- **Conservation** : les publications de plus de 7 jours sont supprimées automatiquement à chaque relevé
  (les adresses restent mémorisées comme « déjà vues », pour ne jamais revenir comme nouveautés).
- **Filtres** dans l'adresse de la page (`?source=5`, `?type=web`) pour pouvoir les garder en favori.
- **Pages** : `/` = Salle de Dépêches, `/sources` = gestion des sources (la page actuelle déplacée).

## Tech Stack
Inchangée. Aucune nouvelle dépendance prévue : carrousel et affichage en grand faits maison (HTML/CSS + un peu de React),
le vrai design viendra de Figma.

## Commands
Inchangées, plus : `npm run posts:galleries` (compléter les galeries des articles déjà relevés).

## Project Structure
```
src/modules/aspiration-web/images.ts   → galerie d'images d'un article (page ou flux)
src/modules/depeches/                  → requête du flux (tri, jours, filtres, dédoublonnage)
src/app/page.tsx                       → Salle de Dépêches
src/app/sources/page.tsx               → gestion des sources
src/app/components/                    → carte, carrousel, affichage en grand
scripts/complete-galleries.ts          → compléter les galeries existantes
```

## Modèle de données
- `posts.images` : liste ordonnée des adresses d'images de l'article (l'image principale en premier).

## Code Style
Comme les briques précédentes. Composants React petits, sans librairie d'interface.

## Testing Strategy
- Galerie : tests sur les copies figées des 4 sites + flux (nombres attendus du tableau ci-dessus, aucune image d'un autre article).
- Flux : tri par date, fenêtre de 7 jours, filtres, dédoublonnage entre sources, règle des articles d'avant l'abonnement.
- Conservation : suppression au-delà de 7 jours, adresses toujours « déjà vues ».
- Interface : test manuel dans le navigateur (carrousel, image en grand, filtres, « En savoir plus »).

## Boundaries
- Toujours : renvoyer vers l'article original ; afficher les images depuis le site du média (pas de copie pour les sites web).
- Demander d'abord : ajouter une librairie d'interface (carrousel, etc.).
- Jamais : afficher le texte complet d'un article ; défilement infini.

## Success Criteria
- [ ] The Brand Identity → 8 images, It's Nice That → 12, Brand New → 2, aucune image d'un autre article
- [ ] Le flux mélange toutes les sources des 7 derniers jours, trié par date, chaque carte datée
- [ ] Articles d'avant l'abonnement : affichés seulement s'ils sont récents (réglage 7 j en test, 3 j ensuite), jamais sans date
- [ ] Les publications de plus de 7 jours sont supprimées et ne reviennent pas
- [ ] « En savoir plus » ouvre l'article sur le site du média
- [ ] Un article suivi via deux sources n'apparaît qu'une fois
- [ ] Carrousel + affichage en grand fonctionnent (souris et clavier)
- [ ] Filtres par type et par source fonctionnent et se retrouvent dans l'adresse
- [ ] La page Sources fonctionne comme avant, à sa nouvelle adresse
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. « En savoir plus » renvoie **directement à la source** (article du média, plus tard post Instagram / X).
2. Les publications sont gardées **7 jours** ; le flux est une liste continue triée par date (pas de groupement par jour).
3. Articles d'avant l'abonnement : visibles s'ils ont **moins de 3 jours** ; **7 jours pendant les tests**.
4. Plus tard (autre brique) : **enregistrer un article** → il n'est plus supprimé au bout de 7 jours.

## Open Questions
- Aucune.
