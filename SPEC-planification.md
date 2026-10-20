# Spec : planification (mise en ligne + journal automatique)

Brique 5 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [edition](SPEC-edition.md). Statut : **validée le 2026-10-20** (solution gratuite).

## Objectif
Le journal doit arriver **quoi qu'il se passe** : Mac fermé, éteint ou cassé, Izenn à la salle de sport —
à 10h00, le journal de 9h00 est déjà là (dans l'app et dans sa boîte mail). Plus rien à lancer à la main.

Pour cela, Plomb quitte le Mac : il tourne sur un **serveur toujours allumé**, avec une **IA en ligne**.

### Récits utilisateur
- Le matin, je reçois à **9h00** l'e-mail « Votre journal du … est prêt » avec un extrait de la Une, sans avoir rien fait.
- J'ouvre Plomb depuis **n'importe quel ordinateur ou téléphone** (adresse web) : le journal, les dépêches et mes sources sont là.
- Les dépêches arrivent toutes seules au fil de la journée (relevé automatique des sources).
- Si le journal n'a pas pu être préparé, je reçois un e-mail qui me le dit (au lieu d'un silence).
- Personne d'autre que moi ne peut ouvrir mon Plomb (mot de passe), en attendant les comptes abonnés (brique 7).

## Architecture retenue : solution gratuite
| Besoin | Service | Coût |
|---|---|---|
| L'app en ligne | **Vercel** (offre Hobby) | Gratuit — **usage personnel non commercial** : à revoir quand Plomb aura des abonnés payants (offre Pro ~20 $/mois ou autre hébergeur) |
| Base de données | **Turso** (même moteur que la base actuelle : presque aucun changement de code) | Gratuit (5 Go, sans carte bancaire) |
| Horloge | **cron-job.org** : appelle Plomb toutes les 15 minutes (précis à la minute) | Gratuit |
| IA en ligne | **Mistral Small** | ~1 € par mois (journal quotidien de 50 articles) |
| E-mail | **Resend** | Gratuit jusqu'à 100 e-mails/jour |

Contraintes : chaque appel de Vercel dure **5 minutes maximum** → le relevé travaille par tranches et reprend là où il
s'est arrêté ; la rédaction des articles par Mistral se fait plusieurs à la fois pour tenir dans le temps.
L'horloge de Vercel (offre gratuite : une fois par jour, ± 59 min) n'est pas utilisée.

## Fonctionnement automatique (fuseau Europe/Paris)
- Toutes les **15 minutes**, l'horloge appelle Plomb (adresse secrète protégée par un jeton), qui fait ce qu'il y a à faire :
- **Relevé** des sources web (chaque source au plus toutes les 30 minutes, les plus anciennes d'abord, par tranches).
- **8h00** : si c'est un jour de parution (fréquence choisie), préparation de l'édition par Mistral en ligne.
- **9h00** : publication (le journal du jour s'affiche à partir de 9h00, la veille reste affichée avant) + **envoi de l'e-mail**.
- **Rattrapage** : si le serveur a redémarré pendant ce temps (mise à jour, panne courte), il rattrape dès qu'il repart :
  édition pas encore préparée → il la prépare ; e-mail pas encore envoyé → il l'envoie (jamais deux fois).
- **Alerte** : si la préparation échoue, e-mail « Votre journal n'a pas pu être préparé » avec la raison.
- Nettoyage (publications de plus de 7 jours) à chaque relevé, comme aujourd'hui.

## Sécurité
- App protégée par un **mot de passe** (réglage du serveur) : toutes les pages et actions.
- Clés (Mistral, Resend) et mot de passe stockés dans les **réglages secrets de Railway**, jamais dans le code ni sur GitHub.
- Les protections existantes restent (adresses internes refusées, robots.txt, politesse).
- Avant d'ouvrir à d'autres personnes : verrouiller le contrôle d'adresse à la connexion (suivi de la brique 2).

## Ce qu'Izenn devra faire (guidé pas à pas)
1. Créer un compte **Vercel** (connexion avec GitHub) — offre Hobby.
2. Créer un compte **Turso** (connexion avec GitHub).
3. Créer un compte **Mistral** (console.mistral.ai), ajouter un moyen de paiement, créer une **clé API**.
4. Créer un compte **Resend** avec son adresse e-mail.
5. Créer un compte **cron-job.org**.
6. Coller les clés, jetons et le mot de passe choisi dans les réglages secrets (Vercel, et `.env.local` sur le Mac pour les tests).
Je ne peux ni créer ces comptes, ni saisir de clés ou de mots de passe à sa place.

## Données
- Les **sources** actuelles (9) sont transférées sur le serveur ; les articles seront relevés à nouveau par le serveur
  (premier relevé = « avant l'abonnement », comme d'habitude). Le Mac redevient un simple outil de développement.

## Tech Stack (ajouts)
- Rédacteur **Mistral** (même interface `Redacteur` : on garde Ollama pour le développement local si besoin).
- Horloge : une adresse `/api/horloge` protégée par un jeton secret, appelée par cron-job.org toutes les 15 minutes.
- Base : Turso via `@libsql/client` (déjà utilisé) — seule l'adresse change, plus un jeton d'accès.
- `resend` (envoi d'e-mails) ; protection par mot de passe via le middleware de Next.js.

## Testing Strategy
- Rédacteur Mistral testé avec un faux serveur (comme Ollama).
- Horloge testée avec une **fausse heure** : jours de parution, 8h00, 9h00, rattrapage, pas de double envoi.
- E-mail testé avec un faux envoyeur ; mot de passe testé (accès refusé sans).
- Vérification réelle : un matin, Mac fermé, l'e-mail arrive à 9h00.

## Boundaries
- Toujours : clés uniquement dans les réglages secrets ; tester avant chaque déploiement.
- Demander d'abord : tout ce qui coûte de l'argent au-delà de ce qui est annoncé ici.
- Jamais : clé ou mot de passe dans le code ou sur GitHub ; envoyer un e-mail deux fois pour la même édition.

## Success Criteria
- [ ] Plomb est accessible en ligne, protégé par mot de passe
- [ ] Le journal est préparé par Mistral en ligne à 8h00 selon la fréquence, publié et envoyé par e-mail à 9h00
- [ ] Ça fonctionne Mac éteint (vérifié en réel un matin)
- [ ] Rattrapage après redémarrage, jamais de double e-mail
- [ ] E-mail d'alerte si la préparation échoue
- [ ] Relevé automatique des sources (chaque source toutes les 30 minutes environ), par tranches de moins de 5 minutes
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. Le journal doit arriver quoi qu'il arrive au Mac → mise en ligne.
2. IA : **Mistral en ligne** (plus d'Ollama pour le journal).

3. Hébergement **gratuit** : Vercel + Turso + cron-job.org (+ Mistral ~1 €/mois, Resend gratuit).
4. Sources actuelles transférées sur le serveur (proposé ; à confirmer).

## Open Questions
- Aucune.
