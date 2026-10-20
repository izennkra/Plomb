# Plan d'implémentation : brique `aspiration-web`

Spec : [SPEC-aspiration-web.md](../SPEC-aspiration-web.md) · Tâches détaillées : [todo.md](todo.md)
Plan précédent (brique `sources`) : terminé et fusionné (pull request #1).

## Vue d'ensemble
On sécurise d'abord l'accès réseau, puis on construit la cascade pièce par pièce, chacune testée sur des copies
figées des vrais sites d'Izenn : flux RSS → repérage des liens d'articles → lecture d'un article → relevé complet d'une source → interface.

## Décisions d'architecture
- **Un seul point d'accès réseau** (`src/modules/fetching/`) : toutes les requêtes passent par lui (blocage des adresses
  internes, taille max, délai, robots.txt, pause entre deux pages d'un même site). La vérification de la brique 1 l'utilise aussi.
- **Copies figées des vrais sites** dans `tests/fixtures/` : les tests ne dépendent pas d'internet et restent reproductibles.
  Un script permet de les rafraîchir quand un site change de structure.
- **Chaque niveau de la cascade renvoie le même format** (« article candidat ») : le relevé ne sait pas d'où vient l'article.
- **Méthode mémorisée par source** : on retente d'abord la méthode qui a marché la dernière fois.

## Liste des tâches

### Phase 1 : Fondations
- [x] Tâche 1 : Accès réseau sécurisé (adresses internes bloquées, taille, délai, redirections vérifiées)
- [x] Tâche 2 : Politesse (robots.txt + pause entre deux pages d'un même site)
- [x] Tâche 3 : Base de données (table `posts` + infos de relevé sur `sources`)

### Checkpoint 1
- [x] Tests OK ; la brique 1 marche toujours (ajout d'une source dans le navigateur)

### Phase 2 : La cascade
- [x] Tâche 4 : Copies figées des 6 sites (+ un article de chacun)
- [ ] Tâche 5 : Niveau 1 — trouver et lire un flux RSS/Atom
- [ ] Tâche 6 : Niveau 2a — repérer les liens d'articles dans une page (piège Brand New inclus)
- [ ] Tâche 7 : Niveau 2b — lire un article (OpenGraph, date, texte complet)

### Checkpoint 2
- [ ] Les 6 sites donnent des articles corrects sur leurs copies figées — point avec Izenn

### Phase 3 : Relevé et interface
- [ ] Tâche 8 : Relever une source (cascade, doublons, limite de 20, marqueur « antérieur », statut)
- [ ] Tâche 9 : Interface — relevé après l'ajout, bouton « Relever maintenant », statut et derniers articles

### Checkpoint final
- [ ] Tous les critères de succès de la spec cochés, testés sur les vrais sites
- [ ] `/review`, push de la branche, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| Le repérage des liens d'articles se trompe sur un site (catégories, menus) | Élevé | Règles testées sur les 6 vrais sites ; un site raté est marqué « illisible » plutôt que de produire des faux articles |
| Un site change de structure | Moyen | Copies figées rafraîchissables par script ; statut d'erreur visible par source |
| Un site bloque Plomb (anti-robot) | Moyen | Statut « bloqué » visible ; ces sites seront candidats au niveau 3 / service tiers |
| Relevé lent (20 articles × 1 s de pause) | Faible | Normal pour un premier relevé ; ensuite seuls les nouveaux articles sont ouverts |

## Questions ouvertes
- Aucune.
