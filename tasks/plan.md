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
- [x] Tâche 5 : Niveau 1 — trouver et lire un flux RSS/Atom
- [x] Tâche 6 : Niveau 2a — repérer les liens d'articles dans une page (piège Brand New inclus)
- [x] Tâche 7 : Niveau 2b — lire un article (OpenGraph, date, texte complet)

### Checkpoint 2
- [x] Les 6 sites donnent des articles corrects sur leurs copies figées — point avec Izenn

### Phase 3 : Relevé et interface
- [x] Tâche 8 : Relever une source (cascade, doublons, limite de 20, marqueur « antérieur », statut)
- [x] Tâche 9 : Interface — relevé après l'ajout, bouton « Relever maintenant », statut et derniers articles

### Checkpoint final
- [x] Tous les critères de succès de la spec cochés, testés sur les vrais sites
- [x] `/review`, push de la branche, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| Le repérage des liens d'articles se trompe sur un site (catégories, menus) | Élevé | Règles testées sur les 6 vrais sites ; un site raté est marqué « illisible » plutôt que de produire des faux articles |
| Un site change de structure | Moyen | Copies figées rafraîchissables par script ; statut d'erreur visible par source |
| Un site bloque Plomb (anti-robot) | Moyen | Statut « bloqué » visible ; ces sites seront candidats au niveau 3 / service tiers |
| Relevé lent (20 articles × 1 s de pause) | Faible | Normal pour un premier relevé ; ensuite seuls les nouveaux articles sont ouverts |

## Review (fin de brique)
- Trouvé et corrigé pendant les tests sur vrais sites : flux global hors rubrique (Brand New), anciens articles
  comptés comme nouveautés au 2e relevé (D&AD), port oublié dans les adresses, noms de sources ambigus.
- **Suivis à prévoir :**
  - Sécurité : la vérification des adresses internes se fait avant la connexion ; un site malveillant pourrait
    changer son adresse IP entre les deux (« DNS rebinding »). Risque faible en local ; à verrouiller avant la mise en ligne
    (forcer la connexion sur l'IP vérifiée).
  - Transparence : Plomb respecte les règles robots.txt sous le nom « PlombBot », mais se présente aux sites comme un
    navigateur. Avant la mise en ligne, décider s'il s'identifie clairement (certains sites risquent alors de le bloquer).
  - Un même article peut appartenir à deux sources (the-brandidentity.com et /features) : la brique `depeches`
    devra l'afficher une seule fois.
  - Relevé de The Brand Identity lent (pages de 3 Mo) : acceptable, à surveiller avec la `planification`.

## Questions ouvertes
- Aucune.
