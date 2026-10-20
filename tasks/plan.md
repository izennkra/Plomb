# Plan d'implémentation : brique `depeches` (Salle de Dépêches)

Spec : [SPEC-depeches.md](../SPEC-depeches.md) · Tâches détaillées : [todo.md](todo.md)
Plans précédents (`sources`, `aspiration-web`) : terminés et fusionnés (pull requests #1 et #2).

## Vue d'ensemble
D'abord les **galeries d'images** (c'est la donnée qui manque), puis la **requête du flux** (règles de date, filtres,
dédoublonnage, conservation 7 jours), enfin l'**interface** : page Sources déplacée, cartes avec carrousel, image en grand, filtres.

## Décisions d'architecture
- **Galerie = liste d'adresses** dans `posts.images` (JSON), image principale en premier. Les images restent sur le site du média.
- **Règle de famille d'images** (même dossier propre à l'article, ou même nom de base que l'image principale) :
  site-agnostique, testée sur les copies figées.
- **Requête du flux en SQL** (fenêtre, tri, filtres) + dédoublonnage par adresse : rapide et testable sans navigateur.
- **Réglages** regroupés dans un seul fichier (`FEED_DAYS = 7`, `BACKFILL_MAX_AGE_DAYS = 7` en test → 3 ensuite).
- **Carrousel et image en grand faits maison** (pas de librairie) ; le design viendra de Figma.

## Liste des tâches

### Phase 1 : Galeries d'images
- [x] Tâche 1 : Colonne `posts.images` (migration)
- [x] Tâche 2 : Galerie d'un article lu sur sa page (règle de famille)
- [x] Tâche 3 : Galerie d'un article de flux RSS
- [x] Tâche 4 : Enregistrer les galeries au relevé + bouton « Compléter les galeries »

### Checkpoint 1
- [x] Galeries réelles vérifiées sur les 6 sources — point avec Izenn

### Phase 2 : Le flux
- [x] Tâche 5 : Requête du flux (7 jours, tri, dédoublonnage, règle « avant l'abonnement », filtres)
- [x] Tâche 6 : Suppression des publications de plus de 7 jours à chaque relevé

### Phase 3 : Interface
- [x] Tâche 7 : Page Sources déplacée sur `/sources` + navigation
- [x] Tâche 8 : Salle de Dépêches — cartes (carrousel, titre, résumé, date, source, « En savoir plus »)
- [ ] Tâche 9 : Image en grand + filtres par type et par source

### Checkpoint final
- [ ] Critères de succès de la spec cochés, testés dans le navigateur
- [ ] `/review`, push, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| La règle de famille rate des images ou en prend d'un autre article | Moyen | Tests sur 4 sites réels ; au pire la galerie se réduit à l'image principale |
| Un média bloque l'affichage de ses images depuis un autre site | Moyen | `referrerPolicy="no-referrer"` ; sinon carte sans image (titre et résumé restent) |
| Compléter 131 galeries = ~131 pages relues | Faible | Bouton temporaire, relecture polie (1 s/page), une seule fois |

## Questions ouvertes
- Aucune.
