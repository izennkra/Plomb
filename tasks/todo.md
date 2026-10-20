# Tâches : brique `planification`

## Tâche 1 : Rédacteur IA en ligne (Mistral, puis Claude Haiku 5.5 retenu)
**Description :** `createMistralRedacteur` (même interface que Ollama) : API Mistral, réponse JSON vérifiée, 2 essais ; choix par réglage (`PLOMB_AI_PROVIDER=mistral`). La fabrication de l'édition rédige 4 articles à la fois.
**Critères :**
- [ ] Mêmes réponses vérifiées que pour Ollama (titre, résumé, thème, sujet, 5 critères, Une, conférence)
- [ ] Erreurs claires (clé invalide, quota) ; rédaction en parallèle
**Vérification :** `npm test` (faux serveur Mistral) + une vraie édition avec la clé d'Izenn · **Dépendances :** aucune · **Taille :** M

## Tâche 2 : Horloge
**Description :** `/api/horloge` (jeton secret) : relève les sources dues (les plus anciennes d'abord, budget ~4 min), prépare l'édition à 8h00 les jours de parution, la publie et envoie l'e-mail à 9h00 ; rattrapage ; ne refait jamais deux fois.
**Critères :**
- [x] Fausse heure : rien avant 8h00 ; édition à 8h00 ; publication + e-mail à 9h00 ; rattrapage à 10h si manqué
- [x] Jour sans parution : pas d'édition ; jeton absent ou faux : refusé
**Vérification :** `npm test` · **Dépendances :** 1 · **Taille :** L → découpée (relevé par tranches / planning du journal)

## Tâche 3 : E-mail
**Description :** Envoi via Resend (date d'envoi enregistrée, jamais deux fois) ; e-mail d'alerte si la préparation échoue.
**Critères :**
- [x] Un seul envoi par édition ; alerte en cas d'échec
**Vérification :** `npm test` (faux envoyeur) + vrai e-mail reçu · **Dépendances :** 2 · **Taille :** S

## Tâche 4 : Mot de passe
**Description :** Middleware : toutes les pages et actions demandent le mot de passe (cookie de session signé) ; l'horloge passe avec son propre jeton.
**Critères :**
- [x] Sans mot de passe : page de connexion ; avec : accès ; l'horloge fonctionne sans mot de passe mais avec jeton
**Vérification :** `npm test` + essai manuel · **Dépendances :** aucune · **Taille :** S

## Tâche 5 : Base Turso
**Description :** Connexion par adresse + jeton (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`), migrations incluses dans l'app en ligne.
**Critères :**
- [x] En local : fichier SQLite inchangé ; en ligne : Turso
**Vérification :** `npm test` + connexion réelle à Turso · **Dépendances :** aucune · **Taille :** S

## Checkpoint 1
- [ ] Tout fonctionne en local avec Claude en ligne — point avec Izenn

## Tâche 6 : Mise en ligne guidée
**Description :** Izenn crée les comptes ; je prépare les réglages, le déploiement Vercel, l'horloge cron-job.org.
**Critères :**
- [ ] Plomb en ligne, protégé, horloge active
**Vérification :** ouverture de l'adresse en ligne · **Dépendances :** 1–5 · **Taille :** M

## Tâche 7 : Transfert des sources
**Description :** Les 9 sources actuelles ajoutées sur le serveur (et leurs favoris), premier relevé en ligne.
**Critères :**
- [x] Les 20 sources en ligne (favoris et fréquence compris ; ancienne entrée YouTube « site » écartée)
- [ ] Premier relevé en ligne
**Vérification :** page Sources en ligne · **Dépendances :** 6 · **Taille :** S

## Checkpoint final
- [ ] Un matin, Mac fermé : e-mail à 9h00, journal en ligne
- [ ] `/review`, push, proposition de pull request
