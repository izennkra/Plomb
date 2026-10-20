# Plomb — règles de travail

## Communication
- Je ne suis pas développeur : explique simplement ce que tu fais, en français, sans jargon (ou en expliquant les termes techniques).
- Avant une étape importante, dis en une phrase ce que tu vas faire et pourquoi.

## Git et GitHub
- Travaille sur une branche par fonctionnalité (ex. `feature/page-contact`), jamais directement sur `main`.
- Fais un commit clair après chaque étape qui fonctionne (message court qui dit ce qui a changé).
- À la fin de chaque tâche, push la branche sur GitHub et propose-moi d'ouvrir une pull request.

## Méthode (Agent Skills, dans `.claude/skills/`)
- Spec avant de coder : utilise `/spec` (skill `spec-driven-development`) pour écrire la spécification, et fais-la valider avant d'écrire du code.
- Découpe le travail : `/plan` (skill `planning-and-task-breakdown`).
- Tests : `/test` (skill `test-driven-development`) — chaque fonctionnalité doit être testée.
- Review : `/review` (skill `code-review-and-quality`) avant de proposer la pull request.
- Autres commandes disponibles : `/build`, `/code-simplify`, `/constraints`, `/ship`, `/webperf`.
