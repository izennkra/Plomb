# Plan d'implémentation : brique `aspiration-sociale` (YouTube, Instagram, X, LinkedIn)

Spec : [SPEC-aspiration-sociale.md](../SPEC-aspiration-sociale.md) · Tâches : [todo-sociale.md](todo-sociale.md)
En parallèle : la mise en ligne ([plan.md](plan.md)) reprend après cette brique (tâches 6–7 restantes).

## Vue d'ensemble
YouTube d'abord (gratuit, sans compte), puis le socle Apify commun (lancer une demande, récupérer les résultats,
garde-fou de crédit), puis Instagram, X, LinkedIn un par un, la copie des images, et l'horloge 7h30 / 17h30.

## Décisions d'architecture
- **YouTube = un flux RSS** : réutilise la lecture de flux existante (nouveau type de source, flux trouvé à l'ajout).
- **Apify en deux temps** : l'horloge lance les demandes (7h30, 17h30) et récupère les résultats au passage suivant —
  jamais d'attente qui risquerait la limite de 5 minutes.
- **Un « lecteur » par plateforme** (Instagram, X, LinkedIn) qui transforme la réponse d'Apify en articles Plomb
  (même format que les sites : titre, résumé, images, date, texte, lien).
- **Stockage d'images interchangeable** : Vercel Blob en ligne, dossier local sur le Mac.
- **Garde-fou** : consommation du mois lue chez Apify avant chaque demande ; arrêt à ~4 $.

## Liste des tâches

### Phase 1 : YouTube
- [ ] Tâche 1 : Reconnaître une chaîne YouTube (`@nom`, `/channel/…`…) et trouver son flux
- [ ] Tâche 2 : Lire les vidéos (miniature, description) et les relever comme un site

### Checkpoint 1
- [ ] @itsnicethat dans Plomb : ses vidéos dans la Salle de Dépêches — point avec Izenn

### Phase 2 : Socle Apify
- [ ] Tâche 3 : Client Apify (lancer, statut, résultats, consommation du mois) + table `social_runs`
- [ ] Tâche 4 : Copie des images (Vercel Blob / dossier local), supprimées avec les posts

### Phase 3 : Plateformes
- [ ] Tâche 5 : Instagram (posts, carrousels, légende)
- [ ] Tâche 6 : X (tweets, images)
- [ ] Tâche 7 : LinkedIn (posts de page et de profil)

### Phase 4 : Horloge
- [ ] Tâche 8 : Relevés sociaux à 7h30 et 17h30, récupération au passage suivant, garde-fou

### Checkpoint final
- [ ] Essai réel sur un compte de chaque plateforme ; consommation Apify vérifiée (0 € facturé)
- [ ] `/review`, push, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| Un « scraper » Apify change ou casse | Moyen | Un lecteur par plateforme, isolé ; statut d'erreur par source ; scraper remplaçable |
| Crédit gratuit dépassé | Faible | Garde-fou à ~4 $ ; au pire Apify bloqué jusqu'au mois suivant, sans facture |
| Chaîne YouTube introuvable (adresse inhabituelle) | Faible | Plusieurs formes d'adresse reconnues ; message clair sinon |
| Conditions d'utilisation des réseaux | Moyen (plus tard) | Usage personnel ; API officielle Meta possible avant les abonnés payants |

## Questions ouvertes
- Aucune.
