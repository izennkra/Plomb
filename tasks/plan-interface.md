# Plan : brique `interface` (design V1)

Spec : [SPEC-interface.md](../SPEC-interface.md). Une tâche = une étape vérifiée dans le navigateur, puis un commit.

## Tâche 1 : Fondations
Police Diatype Compressed, couleurs, logo SVG (apparition des blocs), barre d'onglets en bas (onglet noir qui glisse,
raccourcis 1/2/3), fondu entre les pages, page de connexion. Les anciennes pages restent lisibles dans le nouveau cadre.
**Vérification :** captures ordinateur + téléphone · **Taille :** M

## Tâche 2 : Dépêches
Colonne centrée, défilement aimanté, carte centrale nette / voisines effacées, carrousel, ↑ ↓ ← → Entrée,
filtres en étiquettes, compteur « 12 / 87 ».
**Vérification :** navigateur, clavier, téléphone · **Taille :** M

## Tâche 3 : Journal
Une orange dépliable avec numéro d'édition, fenêtres sur une grille de 12 colonnes (tailles selon l'importance,
placement « au plus haut » comme la référence d'Izenn), ← → entre éditions, panneau Réglages.
**Vérification :** tests du placement + navigateur · **Taille :** L

## Tâche 4 : Sources
Images des sources (moteur : colonne `image_url`, icône des sites, photo YouTube / X / LinkedIn copiée), tuiles,
tuile « + » qui devient un champ, panneau de source (état, favori, dépêches, retirer), « Relever maintenant ».
**Vérification :** tests moteur + navigateur · **Taille :** L

## Tâche 5 : Finitions ✓
Repère « Nouveau », e-mail aux couleurs de Plomb, favicon, « réduire les animations », relecture, pull request.
**Vérification :** `npm test`, `lint`, `typecheck`, build · **Taille :** M
