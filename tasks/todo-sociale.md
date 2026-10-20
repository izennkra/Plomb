# Tâches : brique `aspiration-sociale`

## Tâche 1 : Chaîne YouTube
**Description :** `parseSourceUrl` reconnaît youtube.com/@nom, /channel/UC…, /c/nom, /user/nom (et youtu.be ? non : vidéo, refusée) ; à l'ajout, Plomb lit la page de la chaîne pour trouver son identifiant et son flux.
**Critères :** [x] @itsnicethat → type youtube, nom @itsnicethat, flux trouvé · [x] lien de vidéo → message clair
**Vérification :** `npm test` (copie figée de la page) · **Taille :** S

## Tâche 2 : Vidéos YouTube
**Description :** Lecture du flux YouTube (titre, lien, date, miniature en grand, description) ; relève comme les sites (horloge, doublons, 7 jours).
**Critères :** [x] vidéos avec miniature et description · [x] nouvelle vidéo = nouveauté
**Vérification :** `npm test` + essai réel · **Taille :** M

## Checkpoint 1
- [x] @itsnicethat dans Plomb — point avec Izenn

## Tâche 3 : Socle Apify
**Description :** Client HTTP Apify (lancer un « acteur », lire son statut et ses résultats, consommation du mois) ; table `social_runs`.
**Critères :** [x] faux serveur Apify : lancer → en cours → résultats · [x] garde-fou : refus au-delà de ~4 $
**Vérification :** `npm test` · **Taille :** M

## Tâche 4 : Copie des images
**Description :** Stockage (Vercel Blob en ligne, `data/media/` en local) ; images des posts sociaux copiées à l'arrivée ; supprimées avec les posts.
**Critères :** [x] adresse d'image stable après copie · [x] suppression au bout de 7 jours
**Vérification :** `npm test` · **Taille :** M

## Tâche 5 : Instagram
**Description :** Lecteur Instagram : légende → texte, images du carrousel, date, lien du post.
**Critères :** [x] copie figée d'une réponse Apify → posts corrects, carrousels complets
**Vérification :** `npm test` + essai réel @mouthwash.studio · **Taille :** M

## Tâche 6 : X
**Description :** Lecteur X : texte, images, date, lien ; retweets ignorés.
**Critères :** [x] copie figée → posts corrects · **Vérification :** `npm test` + essai réel · **Taille :** S

## Tâche 7 : LinkedIn
**Description :** Lecteur LinkedIn : texte, images, date, lien (page entreprise et profil).
**Critères :** [x] copie figée → posts corrects · **Vérification :** `npm test` + essai réel · **Taille :** S

## Tâche 8 : Horloge sociale
**Description :** 7h30 et 17h30 : lancer les demandes des sources sociales dues ; passage suivant : récupérer, enregistrer, copier les images ; garde-fou de crédit.
**Critères :** [x] fausse heure : lancement à 7h30, récupération à 7h45 · [x] pas de doublon · [x] crédit dépassé → rien de lancé, statut clair
**Vérification :** `npm test` · **Taille :** M

## Checkpoint final
- [x] Essai réel YouTube et Instagram ; X et LinkedIn lus sur de vraies réponses ; 0 € facturé (0,04 $ de crédit gratuit utilisé)
- [ ] Essai réel X et LinkedIn avec les comptes d'Izenn (« Relever maintenant »)
- [x] Relecture (résultats illisibles ne bloquent plus le relevé), build de production vérifié
- [x] Instagram 2 fois par jour, X et LinkedIn 4 fois (coût mesuré)
- [x] Push, pull request préparée
