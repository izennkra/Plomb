# Plan d'implémentation : brique `edition` (IA Rédacteur en Chef)

Spec : [SPEC-edition.md](../SPEC-edition.md) · Tâches détaillées : [todo.md](todo.md)
Plans précédents (`sources`, `aspiration-web`, `depeches`) : terminés et fusionnés (pull requests #1 à #3).

## Vue d'ensemble
D'abord **choisir l'IA** sur de vrais articles (Izenn décide), puis construire le « rédacteur » (l'appel à l'IA),
la fabrication de l'édition (sélection, notation, Une, rédaction), et enfin la page Journal, les favoris et l'e-mail.

## Décisions d'architecture
- **IA locale via Ollama** (serveur sur le Mac, `http://127.0.0.1:11434`). Réponses demandées **au format JSON**
  (titre, résumé, thème, note d'importance) pour être lues de façon fiable.
- **Interface unique `Redacteur`** : l'IA est interchangeable ; les tests utilisent un faux rédacteur (pas d'IA, rapides).
- **Une demande par article** (résumé + thème + note), puis une demande supplémentaire pour les 3 articles de la Une
  (texte développé). Une édition de 50 articles ≈ 10–15 min sur le Mac : acceptable pour une préparation à 8h00.
- **Secours** : si l'IA échoue sur un article (2 essais), on garde le titre et le résumé du média ; l'édition se fait quand même.
- **Fabrication en arrière-plan** avec un statut (« en préparation… »), comme les relevés.

## Liste des tâches

### Phase 1 : Choisir l'IA
- [x] Tâche 1 : Comparatif de 3 IA locales sur 5 vrais articles → `docs/comparatif-ia.md`

### Checkpoint 1
- [x] Izenn choisit l'IA → Mistral (Ministral 3 14B), API en ligne si le Mac rame

### Phase 2 : Le rédacteur et l'édition
- [x] Tâche 2 : Rédacteur Ollama (JSON, essais, secours) + faux rédacteur de test
- [x] Tâche 3 : Base de données (`editions`, `edition_items`, sources favorites)
- [x] Tâche 4 : Sélection des articles d'une édition (nouveaux, jusqu'à 8h00, depuis l'édition précédente)
- [x] Tâche 5 : Fabrication (notation + bonus favoris, Une 1 + 2, rédaction, thème, journée vide)

### Checkpoint 2
- [x] Une vraie édition fabriquée sur les données d'Izenn — très satisfait ; demande : mieux hiérarchiser la Une

### Phase 2 bis : Hiérarchie éditoriale (ajout après la 1re édition)
- [x] Tâche 9 : Grille de critères + sujet principal (consigne calibrée, note calculée, favoris sans bonus)
- [x] Tâche 10 : Écho médiatique (même sujet chez plusieurs sources → un seul article, « couvert par N médias », bonus)
- [ ] Tâche 11 : Conférence de rédaction (l'IA choisit la Une parmi les ~8 meilleurs, secours = ordre des notes)

### Phase 3 : Lecture
- [x] Tâche 6 : Favoris (étoile sur la page Sources)
- [ ] Tâche 7 : Page Journal (édition du jour, 7 précédentes, bouton « Préparer l'édition »)
- [ ] Tâche 8 : E-mail de l'édition (contenu + aperçu ; envoi réel : brique `planification`)

### Checkpoint final
- [ ] Critères de succès de la spec cochés
- [ ] `/review`, push, proposition de pull request

## Risques
| Risque | Impact | Parade |
|---|---|---|
| Qualité du français ou invention de faits par une IA locale | Élevé | Comparatif sur vrais articles ; consignes strictes ; résumé basé uniquement sur le texte fourni |
| Réponse de l'IA mal formée | Moyen | Format JSON imposé, 2 essais, puis secours (texte du média) |
| Mac lent ou occupé pendant la fabrication | Moyen | Fabrication en arrière-plan ; une IA légère reste possible |
| Peu d'articles nouveaux (sources qui publient peu) | Faible | Édition courte ou « pas de nouvelles » assumée |

## Questions ouvertes
- Aucune.
