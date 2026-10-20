# Spec : planification (mise en ligne + journal automatique)

Brique 5 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [edition](SPEC-edition.md). Statut : **en attente de validation**.

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

## Architecture proposée
| Besoin | Solution | Coût estimé |
|---|---|---|
| Serveur toujours allumé | **Railway** (un seul service : l'app Plomb + son horloge interne) | Offre Hobby 5 $/mois, 5 $ d'usage inclus ; un petit serveur comme Plomb devrait rester proche de ce montant |
| Base de données | **SQLite sur un disque Railway** (le même fonctionnement qu'aujourd'hui, aucun changement de code) | ~0,15 $/Go/mois, inclus dans les 5 $ |
| IA en ligne | **Mistral en ligne** (Mistral Small, même famille que l'IA validée) | De l'ordre de 0,15–0,20 $ / million de mots-unités lus et 0,60 $ écrits ⇒ **~1 € par mois** pour un journal quotidien de 50 articles (à confirmer sur la page officielle à la création du compte) |
| E-mail | **Resend** (service d'envoi d'e-mails) | Gratuit jusqu'à 100 e-mails/jour |

**Pourquoi pas Supabase maintenant ?** Prévu dans le document initial, il sera utile pour les images Instagram (brique 6)
et les comptes abonnés (brique 7). Pour la mise en ligne, garder la base actuelle sur le disque du serveur évite de
réécrire la base et un compte de plus. La question sera rouverte aux briques 6–7.

## Fonctionnement automatique (fuseau Europe/Paris)
- **Relevé** des sources web toutes les **30 minutes**.
- **8h00** : si c'est un jour de parution (fréquence choisie), préparation de l'édition par Mistral en ligne.
- **9h00** : publication (le journal du jour s'affiche) + **envoi de l'e-mail**.
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
1. Créer un compte **Railway** (connexion avec GitHub) et choisir l'offre Hobby.
2. Créer un compte **Mistral** (console.mistral.ai), ajouter un moyen de paiement, créer une **clé API**.
3. Créer un compte **Resend** avec son adresse e-mail.
4. Coller les clés et le mot de passe choisi dans les réglages secrets de Railway (je lui dis exactement où).
Je ne peux ni créer ces comptes, ni saisir de clés ou de mots de passe à sa place.

## Données
- Les **sources** actuelles (9) sont transférées sur le serveur ; les articles seront relevés à nouveau par le serveur
  (premier relevé = « avant l'abonnement », comme d'habitude). Le Mac redevient un simple outil de développement.

## Tech Stack (ajouts)
- Rédacteur **Mistral** (même interface `Redacteur` : on garde Ollama pour le développement local si besoin).
- Horloge interne : démarrée avec le serveur (`instrumentation` de Next.js), sans service externe.
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
- [ ] Relevé automatique des sources toutes les 30 minutes
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. Le journal doit arriver quoi qu'il arrive au Mac → mise en ligne.
2. IA : **Mistral en ligne** (plus d'Ollama pour le journal).

## Open Questions
1. Architecture proposée (Railway + base actuelle + Mistral + Resend) : OK ?
2. Transférer les 9 sources actuelles (oui proposé) ?
