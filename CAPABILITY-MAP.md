# Capability Map : Plomb

Découpage du projet en briques indépendantes. Source : [docs/brief-initial.pdf](docs/brief-initial.pdf).
Validé le 2026-10-20.

| Module id | Responsabilité | Dépend de |
|---|---|---|
| sources | Ajouter une source par URL, reconnaître son type (média, Instagram, X, LinkedIn), la stocker une seule fois (mutualisation) | — |
| aspiration-web | Récupérer les publications des sites/blogs : cascade RSS/Atom → OpenGraph + Readability → IA | sources |
| depeches | Salle de Dépêches : flux chronologique des publications, filtrable par source | aspiration-web |
| edition | IA Rédacteur en Chef : édition du matin (Une + rubriques), en français par défaut, langue réglable | depeches |
| planification | Relève des sources par lots (30–60 min) et génération de l'édition à 9h00 (Europe/Paris) | aspiration-web, edition |
| aspiration-sociale | Instagram / X / LinkedIn via service tiers (Apify, SocialData…) + cache des médias (expirent sous 48h) | sources |
| comptes-abonnement | Comptes utilisateurs et abonnement à 5 €/mois | — |
| interface | Intégration du design system Figma / animations Framer sur le moteur | tous |

Ordre de construction : sources → aspiration-web → depeches → edition → planification → aspiration-sociale → comptes-abonnement → interface

## Décisions déjà prises
- Version 1 : un seul utilisateur (Izenn), en local. Le modèle de données prévoit quand même plusieurs utilisateurs (mutualisation des sources).
- Réseaux sociaux (payants) seulement après le moteur web.
- Langue de l'édition : français par défaut, avec choix d'une autre langue (anglais, etc.).
- Souhait pour `edition` : une IA installée en local (sans coût d'API) spécialisée dans la rédaction et le résumé. À étudier au moment de cette brique (qualité vs Claude, coût d'hébergement d'un modèle local en production).
