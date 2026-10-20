# Spec : aspiration-sociale (YouTube, Instagram, X, LinkedIn)

Brique 6 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md), faite **avant la mise en ligne** (demande d'Izenn, 2026-10-20).
Dépend de [sources](SPEC-sources.md) et [aspiration-web](SPEC-aspiration-web.md). Statut : **en attente de validation**.

## Objectif
Suivre aussi des **chaînes YouTube** et des **comptes Instagram, X et LinkedIn** : leurs nouvelles publications arrivent
dans la Salle de Dépêches et le journal, comme les articles des sites. Objectif de coût : **0 €**.

### Récits utilisateur
- Je colle `https://www.youtube.com/@itsnicethat` → chaque nouvelle vidéo apparaît (miniature, titre, description, lien).
- Je colle `instagram.com/mouthwash.studio` → chaque nouveau post apparaît, avec **toutes les images du carrousel**.
- Je colle `x.com/studiobakers` ou `linkedin.com/company/pentagram` → leurs nouveaux posts apparaissent.
- Dans le journal, l'IA rédige un titre et un résumé à partir de la légende du post ; « En savoir plus » ouvre le post.
- Les images restent visibles même après expiration des liens d'Instagram/LinkedIn (copie dans le stockage de Plomb).

## Méthodes retenues (comparatif du 2026-10-20)
| Plateforme | Méthode | Coût | Notes |
|---|---|---|---|
| YouTube | **Flux RSS officiel** de la chaîne (`feeds/videos.xml?channel_id=…`) | 0 € | Testé sur @itsnicethat (vidéo du jour, date, miniature) |
| Instagram | **Apify** — `apify/instagram-post-scraper` | 0 € dans le crédit gratuit (5 $/mois) | ~2,70 $ / 1 000 posts ; filtre « posts plus récents que » |
| X | **Apify** (scraper de tweets) | 0 € dans le crédit gratuit | L'API officielle n'a plus d'offre gratuite en lecture |
| LinkedIn | **Apify** (scraper de posts de page / profil) | 0 € dans le crédit gratuit | ~2–4 $ / 1 000 posts ; 50 posts max par passage en gratuit |

Écartés : API officielle d'Instagram (Business Discovery — gratuite mais longue à mettre en place, possible plus tard),
lecture directe d'Instagram/X/LinkedIn depuis le serveur (bloquée), API X (payante), API LinkedIn (réservée aux partenaires).

**Crédit gratuit Apify** : 5 $/mois, **sans carte bancaire** ; une fois épuisé, Apify est bloqué jusqu'au mois suivant —
**aucune facture possible**. Garde-fou Plomb : plus de demande à Apify quand ~4 $ ont été utilisés dans le mois.
Les conditions d'utilisation d'Instagram/X/LinkedIn interdisent en principe la récupération automatique : zone grise assumée
pour un usage **strictement personnel** (Plomb ne sera jamais vendu : Izenn, 2026-10-20).

## Fonctionnement
- **YouTube** : traité comme un site à flux RSS (relevé à chaque passage de l'horloge, toutes les 30 min au plus) ;
  la chaîne est reconnue à l'ajout (adresse `@nom`, `/channel/…`, `/c/…`, `/user/…`) et son flux mémorisé.
- **X / LinkedIn** : relevés **4 fois par jour, à 7h30, 11h30, 15h30 et 19h30** (Paris) ; **Instagram 2 fois par jour,
  à 7h30 et 15h30** — 7h30 pour être dans le journal de 8h00. **Une seule demande par réseau** pour tous les comptes (X facture au moins 20 tweets par demande :
  regrouper divise la facture par le nombre de comptes).
  Plomb lance les demandes à Apify, puis récupère les résultats au passage suivant de l'horloge (15 min plus tard) :
  aucune attente dans la limite de 5 minutes.
- Seuls les posts **plus récents que le dernier relevé** sont demandés (premier relevé : 3 derniers posts, marqués
  « avant l'abonnement » comme pour les sites).
- **Images** : dès l'arrivée d'un post Instagram ou LinkedIn, **tout le carrousel** (jusqu'à 20 slides, qualité d'origine)
  est copié **dans la base de Plomb** (Turso en ligne : 5 Go gratuits, aucune limite de nombre de dépôts) et servi par Plomb
  à `/media/…` ; supprimé avec les posts au bout de 7 jours. Les images de X ne sont pas copiées (elles n'expirent pas).
  (Vercel Blob, d'abord prévu, limitait à ~2 000 dépôts par mois : abandonné.)
- Les règles existantes s'appliquent : doublons, 7 jours, date de publication, journal, écho médiatique, favoris.

## Modèle de données
- `sources.type` : + `youtube`.
- Table `social_runs` : demande Apify en cours par source (identifiant, lancée à, statut) — pour récupérer les résultats au passage suivant.
- Suivi de la consommation Apify du mois (garde-fou).

## Tech Stack (ajouts)
- Apify par son API HTTP (clé `APIFY_TOKEN`), sans bibliothèque si possible.
- Copies d'images dans la base (table `media`), servies par Plomb : aucun service de stockage en plus.

## Testing Strategy
- Copies figées d'un flux YouTube et de réponses Apify (Instagram, X, LinkedIn) ; faux serveur Apify (lancer / statut / résultats).
- Horloge : 7h30 et 17h30 lancent, le passage suivant récupère ; garde-fou de crédit ; pas de doublon.
- Essai réel : @itsnicethat (YouTube), @mouthwash.studio (Instagram), un compte X, une page LinkedIn.

## Boundaries
- Toujours : ne demander que les posts récents ; s'arrêter avant d'épuiser le crédit gratuit.
- Demander d'abord : toute option payante (Apify payant, API X…).
- Jamais : se connecter aux comptes d'Izenn sur ces réseaux ; contourner les protections des plateformes depuis le serveur.

## Success Criteria
- [ ] Une chaîne YouTube s'ajoute par son adresse `@nom` et ses nouvelles vidéos apparaissent
- [ ] Instagram : nouveaux posts avec toutes les images du carrousel (copiées), images toujours visibles après expiration
- [ ] X et LinkedIn : nouveaux posts
- [ ] Relevés sociaux 4 fois par jour (7h30, 11h30, 15h30, 19h30), Instagram 2 fois (7h30, 15h30), une demande par réseau, résultats récupérés au passage suivant, jamais de doublon
- [ ] Consommation Apify suivie ; arrêt avant ~4 $ dans le mois ; 0 € facturé
- [ ] Les posts sociaux entrent dans la Salle de Dépêches et le journal (titre et résumé rédigés par l'IA)
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. Faire fonctionner YouTube, Instagram, X, LinkedIn **avant** la mise en ligne, à **0 €** si possible.
2. Instagram : **Apify** pour commencer (API officielle Meta possible plus tard).
3. X et LinkedIn : **Apify**, dans le même crédit gratuit, avec garde-fou.
4. Réseaux sociaux vérifiés ~~2 fois~~ **4 fois par jour** (7h30, 11h30, 15h30, 19h30) — Izenn, 2026-10-20 ;
   YouTube comme les sites, **jamais via Apify** (son flux RSS est gratuit).
5. Le `robots.txt` de YouTube interdit `/feeds/videos.xml` aux robots : pour le flux d'une chaîne suivie, Plomb se
   comporte en **lecteur de flux** (règle robots.txt non appliquée, rythme poli conservé). Ailleurs, robots.txt reste respecté.
   (Alternative non retenue : API officielle YouTube, gratuite, avec une clé Google Cloud.)
6. **Instagram 2 fois par jour** (7h30, 15h30) : mesuré le 20/10, Apify facture même une réponse vide (~0,27 centime
   par compte et par vérification) ; X et LinkedIn restent à 4 fois (vérification vide : 0 $ pour X).

## Résultats réels (2026-10-20)
- YouTube @itsnicethat : 15 vidéos lues (3 de moins de 7 jours affichées), miniature et description.
- Instagram @naomikolsteren : 3 posts, 7–8 images copiées par post, carrousel dans la Salle de Dépêches.
- X @studiobakers et LinkedIn Pentagram : réponses réelles lues correctement (tests sur copies).
- Coût Apify de la journée d'essais : **0,027 $** sur 5 $ gratuits.
- Robots Apify retenus : `apify/instagram-post-scraper` (0,0017 $/post), `kaitoeasyapi/…-cheapest` pour X
  (0,00025 $/tweet, 20 tweets minimum par demande), `harvestapi/linkedin-company-posts` / `-profile-posts` (0,002 $/post).

## Open Questions
- Aucune.
