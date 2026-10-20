# Capability Map : Plomb

Découpage du projet en briques indépendantes. Source : [docs/brief-initial.pdf](docs/brief-initial.pdf).
Validé le 2026-10-20.

| Module id | Responsabilité | Dépend de |
|---|---|---|
| sources | Ajouter une source par URL, reconnaître son type (média, Instagram, X, LinkedIn), la stocker une seule fois (mutualisation) | — |
| aspiration-web | Récupérer les publications des sites/blogs : cascade RSS/Atom → OpenGraph + Readability → IA | sources |
| depeches | Salle de Dépêches : flux chronologique des publications, filtrable par source | aspiration-web |
| edition | IA Rédacteur en Chef : édition du matin (Une 1 + 2, suite par importance), sources favorites, page Journal, contenu de l'e-mail ; français par défaut, langue réglable | depeches |
| planification | Relève des sources par lots (30–60 min), préparation de l'édition à 8h00, publication + **envoi de l'e-mail** à 9h00 (Europe/Paris) | aspiration-web, edition |
| aspiration-sociale | Instagram / X / LinkedIn via service tiers (Apify, SocialData…) + cache des médias (expirent sous 48h) | sources |
| comptes-abonnement | Comptes utilisateurs et abonnement à 5 €/mois | — |
| interface | Intégration du design system Figma / animations Framer sur le moteur | tous |

Ordre de construction : sources → aspiration-web → depeches → edition → planification → aspiration-sociale → comptes-abonnement → interface

## Décisions déjà prises
- Version 1 : un seul utilisateur (Izenn), en local. Le modèle de données prévoit quand même plusieurs utilisateurs (mutualisation des sources).
- Réseaux sociaux (payants) seulement après le moteur web.
- Langue de l'édition : français par défaut, avec choix d'une autre langue (anglais, etc.).
- Souhait pour `edition` : une IA installée en local (sans coût d'API) spécialisée dans la rédaction et le résumé. À étudier au moment de cette brique (qualité vs Claude, coût d'hébergement d'un modèle local en production).

## Vision UX notée pour `depeches` (Izenn, 2026-10-20)
- Un seul flux **trié par date** (le plus récent en haut), **pas** regroupé par média.
- Chaque article = une **carte** : résumé, date, « En savoir plus », lien « Lire l'article » (vers le média),
  et un **carrousel d'images** de l'article.
- **Filtres** optionnels par média / par source.
- À prévoir : Plomb ne garde aujourd'hui qu'**une** image par article → la brique `depeches` devra récupérer
  toutes les images d'un article (galerie) pour alimenter le carrousel.
- Un même article suivi via deux sources (ex. the-brandidentity.com et /features) n'apparaît qu'une fois.
- « En savoir plus » = lien direct vers la source. Publications gardées 7 jours.

## Idées pour plus tard
- **Enregistrer un article** (favoris) : un article enregistré n'est jamais supprimé au bout de 7 jours (Izenn, 2026-10-20).
