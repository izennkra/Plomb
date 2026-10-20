# Plan d'implémentation : brique `sources`

Spec : [SPEC-sources.md](../SPEC-sources.md) · Tâches détaillées : [todo.md](todo.md)

## Vue d'ensemble
On met en place le projet Next.js, puis on construit la brique en petites étapes testées :
reconnaissance des URL → base de données → vérification des sites → ajout d'une source → page Sources → retrait.

## Décisions d'architecture
- **Logique séparée de l'interface** : toute la logique vit dans `src/modules/sources/` et se teste sans navigateur.
  La page Next.js ne fait qu'appeler ces fonctions.
- **Drizzle ORM** : le même code de base de données fonctionnera avec SQLite (local) et Supabase/Postgres (plus tard).
- **Vérification réseau injectable** : la fonction qui contacte les sites est passée en paramètre, pour la tester avec un faux serveur local.
- **Un utilisateur par défaut** créé automatiquement (pas de connexion), mais la table `subscriptions` est déjà prête pour plusieurs utilisateurs.

## Liste des tâches

### Phase 1 : Fondations
- [x] Tâche 1 : Mettre en place le projet (Next.js, TypeScript, Vitest, lint)
- [x] Tâche 2 : Reconnaître et normaliser une URL

### Checkpoint 1
- [x] Tests, lint et typecheck passent ; la page d'accueil s'affiche

### Phase 2 : Moteur
- [x] Tâche 3 : Créer la base de données (sources, users, subscriptions)
- [x] Tâche 4 : Vérifier qu'un site web répond
- [x] Tâche 5 : Ajouter une source (reconnaissance + vérification + enregistrement sans doublon)

### Checkpoint 2
- [x] Tous les tests passent, y compris les cas de doublons et de sites en erreur

### Phase 3 : Interface minimale
- [x] Tâche 6 : Page Sources — ajouter et lister
- [x] Tâche 7 : Retirer une source

### Checkpoint final
- [x] Tous les critères de succès de la spec sont cochés
- [x] Review (`/review`), push de la branche, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| `better-sqlite3` ne s'installe pas avec Node 26 (module compilé) | Moyen | **Appliqué** : `@libsql/client` utilisé dès la tâche 3 |
| Certains sites bloquent les robots (erreur 403) alors qu'ils existent | Moyen | Envoyer un en-tête navigateur classique ; traiter 403 comme « existe mais protégé » et accepter la source |
| Règles d'URL des réseaux sociaux qui changent | Faible | Règles regroupées dans un seul fichier, couvertes par des tests |

## Review (fin de brique)
- Corrigé : une erreur au démarrage de la base n'est plus gardée en mémoire (nouvel essai à la requête suivante).
- Corrigé : test d'exemple de la tâche 1 supprimé (remplacé par les vrais tests).
- **À faire avant la mise en ligne** (sécurité) : la vérification des sites contacte n'importe quelle adresse,
  y compris celles du réseau interne du serveur (ex. 127.0.0.1, 192.168.x.x). Sans danger en local, mais à bloquer
  avant d'héberger Plomb pour d'autres utilisateurs. À traiter dans la brique `aspiration-web`, qui contactera aussi les sites.

## Questions ouvertes
- Aucune pour l'instant.
