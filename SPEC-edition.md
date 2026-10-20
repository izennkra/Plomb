# Spec : edition (l'IA Rédacteur en Chef)

Brique 4 de [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Dépend de [depeches](SPEC-depeches.md). Statut : **terminée le 2026-10-20** (éditions réelles préparées et validées par Izenn).

## Objectif
Chaque matin, une **édition personnelle** du journal Plomb : l'IA lit tout ce qui est arrivé depuis l'édition précédente,
le **hiérarchise** et le **rédige en français** (langue réglable), avec une **Une** et la suite de l'actualité.
On la lit, puis on referme le journal.

Cette brique fabrique l'édition (à la demande, via un bouton) et prépare l'e-mail ; le déclenchement automatique
(préparation à 8h00, publication et e-mail à 9h00) arrive avec la brique `planification`.

### Récits utilisateur
- Je clique « Préparer l'édition » → quelques minutes plus tard, l'édition du jour est prête.
- J'ouvre la page **Journal** : en haut la **Une** (1 article majeur, texte plus développé, grande image) et **2 articles
  secondaires** ; ensuite le reste de l'actualité, du plus important au moins important.
- Chaque article : un titre et un résumé **rédigés par l'IA en français**, ses images, la source, « En savoir plus » → l'article original.
- Je marque une source comme **favorite** (page Sources) → ses articles sont **mis en valeur** visuellement
  (surlignage ou couleur de carte ; repère provisoire, le vrai design viendra de Figma). Ils n'ont **aucun avantage
  de classement** : un article favori peut faire la Une si le sujet est fort, ou se retrouver en bas du journal.
- Je retrouve les éditions des 7 derniers jours.
- Je choisis la **fréquence** de mon journal (page Journal) : **chaque jour**, **tous les 3 jours**, ou **jours choisis**
  (je coche les jours de la semaine). Il paraît toujours à **9h00** et couvre tout ce qui est arrivé depuis le précédent
  (24 h pour un journal quotidien, 3 jours pour un journal tous les 3 jours, du vendredi au lundi pour lun/mer/ven…).
  La page indique la prochaine parution.
- J'ai un aperçu de l'**e-mail** de l'édition (« Votre journal du 21 octobre est prêt » + un extrait de la Une + lien vers le journal).

## Contenu d'une édition
- **Articles retenus** : tous les articles **nouveaux** (jamais ceux d'avant l'abonnement) arrivés depuis l'édition
  précédente, jusqu'à **8h00** (1 h avant la publication de 9h00). Première édition : les dernières 24 h.
  Un article **daté** doit aussi avoir été **publié** dans cette période (marge de 12 h pour les découvertes tardives) :
  un vieil article qui réapparaît sur un site n'est pas une nouveauté. Un article sans date n'est retenu que s'il est
  apparu après l'abonnement. (Correction après l'édition test du 20/10 qui contenait des articles du 14 juillet et du 14 septembre.)
- **Hiérarchie éditoriale** (ce qui fait qu'un article atterrit en Une) :
  1. **Grille de critères** notée par l'IA de 1 à 5 : **notoriété du sujet** (marque mondiale vs commerce local),
     **ampleur du projet** (refonte complète vs détail), **renommée des auteurs** (studio/agence reconnu),
     **portée culturelle** (fait débat, change les pratiques), **qualité / originalité**. La note finale est calculée
     par Plomb avec des poids (notoriété et ampleur pèsent le plus). Consigne calibrée par des exemples
     (« refonte de Coca-Cola : notoriété 5 » ; « café de quartier : notoriété 1 »).
  2. **Écho médiatique** : un même sujet couvert par plusieurs sources dans la période = gros sujet → bonus ;
     il n'apparaît **qu'une fois**, avec la mention « couvert par N médias ».
  3. **Conférence de rédaction** : l'IA compare côte à côte les ~8 meilleurs candidats et choisit la Une (1 + 2) ;
     le reste suit par note. Si sa réponse est inutilisable, on garde l'ordre des notes.
  4. **Sources favorites** : aucun bonus de classement, seulement une mise en valeur visuelle.
- **Rédaction** : pour chaque article, un titre et un résumé de 2–3 phrases (Une : un texte plus développé, ~120 mots),
  à partir du texte complet de l'article (si le flux RSS n'en donne qu'un extrait, la page de l'article est lue). Ton : journal, factuel, sans inventer. Langue : français par défaut.
- **Thème** : l'IA attribue aussi une étiquette de thème provisoire (Identité, Typographie, Packaging, Édition,
  Digital & motion, Illustration & photo, Culture & métier). Elle n'est **pas encore affichée en rubriques** :
  ce choix sera fait au moment de l'UX, mais la donnée sera prête.
- **Journée sans nouveauté** : l'édition le dit simplement (« Pas de nouvelles de vos sources depuis hier »).

## Choix de l'IA (première tâche de la brique)
Souhait : une IA **installée sur le Mac**, sans coût par utilisation. Le Mac d'Izenn (M1 Pro, 16 Go, 61 Go libres)
peut faire tourner des modèles de taille moyenne via **Ollama** (logiciel gratuit qui fait tourner des IA en local).

**Comparatif sur 5 vrais articles** (résumé, Une, note d'importance, respect du français et des faits) entre :
- 2 ou 3 IA locales récentes adaptées à 16 Go (ex. familles Gemma, Qwen, Mistral — versions à jour au moment du test,
  ~5 à 10 Go chacune à télécharger) ;
Izenn choisit sur pièces (Claude n'est **pas** inclus : uniquement des IA locales). Le code passe par une **interface unique** (« rédacteur ») : on peut changer d'IA plus tard
sans toucher au reste (par ex. IA locale sur le Mac, autre solution une fois Plomb en ligne).

## Modèle de données
- `editions` : date, période couverte, statut (en préparation / prête / erreur), IA utilisée, langue.
- `edition_items` : édition, article, rang, place (une / secondaire / suite), titre et résumé rédigés, thème, note d'importance,
  notes par critère, sujet principal, autres médias qui couvrent le sujet.
- `subscriptions.favorite` : source favorite (par utilisateur).
- `users.edition_frequency` + `users.edition_weekdays` : fréquence du journal.

## Tech Stack
- **Ollama** (application Mac) + appel HTTP local depuis Plomb (pas de librairie nécessaire).
- E-mail : rendu HTML de l'e-mail + aperçu dans l'app ; **envoi réel dans la brique `planification`**.

## Project Structure
```
src/modules/edition/redacteur/   → interface unique + Ollama : prompts, lecture des réponses
src/modules/edition/             → sélection des articles, notation, Une, fabrication et stockage de l'édition
src/modules/edition/email.ts     → contenu de l'e-mail (HTML + texte)
src/app/journal/                 → page Journal (édition du jour + 7 précédentes)
```

## Testing Strategy
- La logique (sélection 8h00, bonus favoris, Une 1+2, journée vide) testée avec un **faux rédacteur** (réponses fixes) : rapide, sans IA.
- Lecture des réponses de l'IA : réponses mal formées gérées (nouvel essai, puis résumé d'origine du média en secours).
- Comparatif réel des IA locales fait le 2026-10-20 (document retiré depuis, avec l'IA locale).
- Page Journal et aperçu e-mail : test manuel.

## Boundaries
- Toujours : l'IA ne rédige qu'à partir du texte de l'article (pas d'invention) ; lien vers l'article original.
- Demander d'abord : télécharger les modèles (taille annoncée), utiliser une clé API payante.
- Jamais : publier le texte complet d'un article ; mettre une clé API dans git.

## Success Criteria
- [x] Comparatif des IA réalisé sur 5 vrais articles, choix d'Izenn noté
- [x] « Préparer l'édition » produit une édition : Une (1 + 2), suite classée par importance, résumés en français
- [x] Seuls les articles nouveaux arrivés jusqu'à 8h00 depuis l'édition précédente sont retenus
- [x] La Une revient aux sujets forts : un grand sujet passe devant un petit, quelle que soit la source
- [x] Un sujet couvert par plusieurs sources n'apparaît qu'une fois, avec « couvert par N médias », et gagne en importance
- [x] Les sources favorites sont mises en valeur, sans avantage de classement
- [x] Les 7 dernières éditions restent consultables
- [x] Aperçu de l'e-mail de l'édition
- [x] Fréquence réglable (chaque jour / tous les 3 jours / jours choisis) ; la page indique la prochaine parution
- [x] Si l'IA échoue sur un article, l'édition se fait quand même (résumé du média en secours)
- [x] `npm test`, `npm run lint`, `npm run typecheck` passent

## Décisions (Izenn, 2026-10-20)
1. Articles : tout ce qui est nouveau jusqu'à 1 h avant le journal de 9h00.
2. La Une : 1 article majeur + 2 secondaires.
3. Importance : les gros sujets prennent plus de place (ex. refonte de Coca-Cola en Une, pas le café matcha du coin) :
   grille de critères + écho médiatique + conférence de rédaction (2026-10-20, après la 1re édition test).
4. Rubriques : à décider au moment de l'UX (étiquette de thème préparée en attendant).
5. Emplacement du journal dans l'app (page principale ou notification + page dédiée) : à décider au moment de l'UX ;
   page `/journal` en attendant.
6. Un **e-mail** est envoyé à 9h00 avec un extrait du journal (envoi : brique `planification`).

7. Comparatif : **IA locales uniquement** (pas de Claude) ; téléchargement de 2–3 modèles accepté.
9. **Favoris** : mise en valeur visuelle uniquement, **aucun bonus de classement** (Izenn, 2026-10-20).
11. **Fréquence** : chaque jour / tous les 3 jours / jours choisis, toujours à 9h00 (Izenn, 2026-10-20).
12. **Journal automatique même Mac fermé** : nécessite la mise en ligne (serveur + base Supabase + **Mistral en ligne**)
    → brique `planification`, juste après celle-ci.
10. Première édition test jugée très satisfaisante (texte, rythme du Mac) : **pas d'API pour l'instant**.
8. ~~IA retenue : Mistral (Ministral 3 14B), en local~~ → remplacée par **Claude Haiku 5.5 en ligne** (brique planification) ;
   IA locale, Mistral et le comparatif **supprimés du projet et du Mac** (grand ménage, Izenn, 2026-10-20).
   Si le Mac rame à chaque journal du matin → **IA en ligne** (API payante, choisie selon le prix).
   Protections du Mac : modèle déchargé 30 s après la rédaction ; en mode test, 10 articles maximum.

## Open Questions
- Aucune.
