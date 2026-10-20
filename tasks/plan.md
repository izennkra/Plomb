# Plan d'implémentation : brique `planification` (mise en ligne, journal automatique)

Spec : [SPEC-planification.md](../SPEC-planification.md) · Tâches détaillées : [todo.md](todo.md)
Plans précédents (briques 1 à 4) : terminés et fusionnés (pull requests #1 à #4).

## Vue d'ensemble
D'abord ce qui se teste sur le Mac (rédacteur Mistral, horloge, e-mail, mot de passe, base Turso), puis la mise en ligne
guidée (comptes, réglages, horloge), et enfin la vérification en réel : un matin, Mac fermé, le journal arrive.

## Décisions d'architecture
- **Une seule « horloge »** : `/api/horloge`, appelée toutes les 15 min, décide quoi faire selon l'heure de Paris
  (relever, préparer, publier, envoyer) et **rattrape** ce qui a été manqué. Idempotente : la rappeler deux fois ne fait rien de plus.
- **Budget de temps** par appel (~4 min sur 5) : le relevé s'arrête proprement et reprend au prochain appel.
- **Rédaction en parallèle** (4 articles à la fois) avec Mistral pour tenir dans le temps.
- **Publication à 9h00** : l'édition du jour n'est affichée qu'à partir de 9h00 ; e-mail envoyé une seule fois (date d'envoi enregistrée).
- **Même code partout** : en local, la base reste le fichier SQLite et l'IA peut rester Ollama ; en ligne, Turso et Mistral (réglages).

## Liste des tâches

### Phase 1 : Préparer le code
- [ ] Tâche 1 : Rédacteur Mistral en ligne (+ rédaction en parallèle)
- [ ] Tâche 2 : Horloge `/api/horloge` (relevé par tranches, 8h00, 9h00, rattrapage, jeton secret)
- [ ] Tâche 3 : E-mail via Resend (envoi unique à 9h00, alerte en cas d'échec)
- [ ] Tâche 4 : Mot de passe sur toute l'app
- [ ] Tâche 5 : Base Turso (adresse + jeton, migrations embarquées)

### Checkpoint 1
- [ ] Tout fonctionne en local avec Mistral en ligne (clé dans `.env.local`) — point avec Izenn

### Phase 2 : Mise en ligne (guidée)
- [ ] Tâche 6 : Comptes et réglages (Vercel, Turso, Resend, cron-job.org) + déploiement
- [ ] Tâche 7 : Transfert des sources

### Checkpoint final
- [ ] Un matin, Mac fermé : e-mail reçu à 9h00, journal en ligne
- [ ] `/review`, push, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| Un appel dépasse 5 min | Moyen | Budget de temps, reprise au prochain appel, rédaction en parallèle |
| cron-job.org en panne un matin | Moyen | Rattrapage au premier appel suivant ; e-mail d'alerte si rien à 9h30 |
| Un site bloque les adresses de Vercel | Faible | Statut d'erreur visible par source (déjà en place) |
| Usage commercial interdit sur l'offre gratuite de Vercel | Élevé (plus tard) | À revoir avant les abonnés payants (brique 7) |

## Questions ouvertes
- Aucune.
