# Spec : interface (design V1 de Plomb)

Brique 7 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md), sur le moteur terminé. Statut : **en attente de validation**.
Maquettes d'Izenn (2026-10-20) : [Journal](docs/design/maquette-journal.png) · [Dépêches](docs/design/maquette-depeches.png) ·
[Sources](docs/design/maquette-sources.png) · logo [logo-plomb.svg](docs/design/logo-plomb.svg).

## Objectif
Habiller Plomb avec le design d'Izenn : un outil **brutaliste**, **intuitif**, aux **animations minimales et légères**.
Trois écrans (Journal, Dépêches, Sources), une barre d'onglets en bas, le logo en haut. Rien d'autre à l'écran
que le contenu.

## Système de design (lu dans les maquettes)
| Élément | Valeur |
|---|---|
| Fond | gris clair `#EAEAEA` |
| Panneaux / cartes | gris moyen `#A8A8A8`, texte blanc |
| Onglet inactif | gris `#BDBDBD`, texte gris clair |
| Actif / contraste | noir `#000`, texte blanc |
| Accent | orange `#F08F35` (la Une du journal) |
| Surfaces de contenu | blanc `#FFF` (fenêtres du journal) |
| Arrondis | ~6 px partout, jamais plus |
| Typographie | **ABC Diatype Compressed** (Regular et Light), une seule famille, tailles très contrastées |
| Logo | le SVG « Plomb » en lettres dans des blocs noirs, centré en haut |

Règles brutalistes : aplats, pas d'ombres, pas de dégradés décoratifs (le fondu des maquettes ne sert qu'à indiquer que
le texte continue), contrastes francs, survol = inversion de couleurs **instantanée** (pas d'animation).

## Écrans

### Barre d'onglets (toutes les pages)
- En bas, pleine largeur, trois onglets égaux : **Journal · Dépêches · Sources** (l'actif en noir).
- Raccourcis clavier **1 / 2 / 3** ; sur téléphone, la barre reste en bas, sous le pouce.
- Le logo en haut ramène au Journal. L'ancien en-tête disparaît.

### Journal
- **La Une = grand bloc orange** : son titre en très grand (noir), l'étiquette « Édition N°25, 20 OCT 2026 » en noir.
  Un clic sur le bloc déplie le texte de Une (≈120 mots), son image et « En savoir plus ».
- **Les fenêtres grises** (« New » sur la maquette) = les 2 articles secondaires puis la suite de l'actualité,
  posées sur une **grille de journal** : rapports de tailles différents selon l'importance, toujours alignés à la
  grille (référence complémentaire d'Izenn à venir). Chaque fenêtre : une barre de titre grise (la source ou le
  thème) et un panneau blanc (image, titre, résumé).
- Sources favorites : barre de titre **noire** au lieu de grise (repérable sans avantage de classement).
- « Couvert par 3 médias » en petite étiquette noire dans la barre de titre.
- Navigation entre éditions : **← →** (flèches à l'écran et au clavier) ; réglages de fréquence et « Préparer
  l'édition » rangés derrière un petit lien « Réglages ».
- Journée sans nouvelles : le bloc orange le dit (« Pas de nouvelles de vos sources depuis hier »).

### Dépêches
- **Une colonne de cartes centrée** : la carte au centre est nette, celles du dessus et du dessous s'effacent
  (comme sur la maquette). On fait défiler, la carte suivante vient se caler au centre (défilement « aimanté »).
- Carte : titre, ligne source · date, carrousel d'images (glisser ou flèches ← →), texte qui s'efface, « En savoir plus ».
- Clavier : **↑ ↓** carte précédente / suivante, **← →** images, **Entrée** ouvre l'article.
- Filtres en petites étiquettes en haut : Tout · Sites · YouTube · Instagram · X · LinkedIn ; filtre par source
  depuis la page Sources.
- Compteur discret « 12 / 87 ». Repère **Nouveau** sur les dépêches arrivées depuis la dernière visite.

### Sources
- **Bande grise centrée de tuiles carrées** : logo ou photo de la source, étiquette de plateforme
  (Inst · Ytb · Media · X.com · In). Plusieurs rangées quand il y en a beaucoup (20 aujourd'hui).
- **Tuile « + »** : un clic la transforme en champ « Collez un lien » ; Entrée ajoute la source (la tuile apparaît).
- **Clic sur une tuile** : petit panneau en dessous — nom, état du dernier relevé (ou l'erreur en clair),
  ★ favori, « Voir ses dépêches », « Retirer ». Une source en erreur a un point orange sur sa tuile.
- « Relever maintenant » en petit, sous la bande.
- **Nouveau côté moteur** : récupérer l'image de chaque source (icône du site, photo du compte Instagram / X /
  LinkedIn / YouTube, déjà présente dans les réponses d'Apify ou la page de la chaîne). Sans image : tuile noire
  avec les initiales en Diatype (brutal et toujours lisible).

### Connexion
- Fond gris, logo, un seul champ « Mot de passe » et un bouton noir.

## Animations (minimales, légères)
1. **Logo à l'ouverture** : les 5 blocs apparaissent l'un après l'autre (≈40 ms d'écart), une seule fois.
2. **Changement d'onglet** : fondu court (150 ms) du contenu ; l'onglet noir glisse vers le nouvel onglet.
3. **Dépêches** : la carte qui arrive au centre devient nette, les autres s'effacent, au rythme du défilement.
4. **Journal** : la Une se déplie en place (pas de nouvelle page).
5. **Sources** : la tuile « + » devient un champ ; une nouvelle source apparaît par un fondu.
6. Survols : inversion instantanée, sans transition. Tout est coupé si l'ordinateur demande « réduire les animations ».

## Propositions d'amélioration (à valider)
- **Repère « Nouveau »** (l'étiquette « New » de la maquette) sur ce qui est arrivé depuis la dernière visite.
- **Raccourcis clavier** partout, pour un usage rapide.
- **E-mail du matin** aux couleurs de Plomb (bloc orange de la Une, logo).
- **Favicon** : le bloc « P » du logo.

## Tech Stack
- Uniquement du CSS et de petits composants React : **aucune bibliothèque d'animation** (léger, rapide).
- Police chargée par Next.js depuis le projet (fichiers de la police dans `src/app/fonts/`).
- Le moteur (relevé, édition, horloge) ne change pas, sauf l'ajout des images de sources.

## Testing Strategy
- Logique ajoutée (images de sources, repère « Nouveau », numéro d'édition) : tests automatiques.
- Écrans : vérification dans le navigateur à chaque étape, ordinateur et téléphone, captures envoyées à Izenn.
- Accessibilité : navigation au clavier, contrastes vérifiés, « réduire les animations » respecté.

## Boundaries
- Toujours : rester fidèle aux maquettes ; garder chaque écran utilisable au clavier et sur téléphone.
- Demander d'abord : tout écart visible par rapport aux maquettes (au-delà des propositions ci-dessus).
- Jamais : modifier les couleurs des maquettes (gris exact conservé, décision d'Izenn).

## Success Criteria
- [ ] Les trois écrans reprennent les maquettes (couleurs, police, logo, barre d'onglets)
- [ ] Dépêches : défilement aimanté, carte centrale nette, carrousel, clavier
- [ ] Journal : Une orange dépliable, fenêtres secondaires et suite, navigation entre éditions
- [ ] Sources : tuiles avec images, ajout par la tuile « + », panneau de source
- [ ] Animations légères, coupées si « réduire les animations »
- [ ] Ordinateur et téléphone
- [ ] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. **Police : ABC Diatype Compressed.** Izenn a acheté la licence (le créateur est un ami) ; les fichiers installés
   sur le Mac sont utilisés tels quels.
2. **Journal : grille de journal**, tailles selon l'importance, alignées à la grille ; référence complémentaire à venir.
3. **Gris exact des maquettes** conservé (texte blanc sur `#A8A8A8`).

## Open Questions
- Référence de grille du Journal (pièce jointe annoncée par Izenn).
