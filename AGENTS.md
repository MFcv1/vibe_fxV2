# AGENTS.md - Vibe_fx V2

## Priorite de lecture

Tout agent IA doit lire ces fichiers dans cet ordre avant de modifier le projet :

1. `AGENTS.md` - regles de travail, contraintes et liens vers les docs.
2. `docs/developpement-local-et-couts.md` - boucle locale obligatoire, autorisation de deploiement, perimetres cloud et hygiene des ressources payantes.
3. `plan.md` - plan de la reconstruction VibeCut en cours : diagnostic, architecture, direction artistique detaillee, phases et rituel de fin de phase.
4. `todo.md` - etat d'avancement de cette reconstruction, bugs connus et prompt de relance.
5. `map.md` - carte vivante du projet, a tenir a jour.
6. `seo.md` - strategie SEO Google, gates de validation et sources officielles.
7. `MEGAPROMPT.md` - prompt maitre de conception pour lancer la vraie construction.
8. Les skills utiles dans `.agents/skills/`, surtout `cyber-neon`, `dark-ui`, `technical-ui` et `motion`.

## Intention produit

Vibe_fx V2 est un nouveau projet independant, cree dans `C:\Users\matth\Travail\vibe_fxV2`, a partir de l'analyse de `C:\Users\matth\Desktop\jardin de chawi` sans modifier le projet source.

Le produit cible est un outil web public permettant :

- de creer et modifier des images sociales dans une page "mise en page" ;
- d'importer le rendu vers une page publication ;
- de finaliser titre, caption, image, formats sociaux et statut ;
- de publier sur le site et vers Instagram/Facebook via Meta OAuth ;
- de limiter le stockage de donnees au strict necessaire au depart.

## Regles de modification

- Ne jamais modifier le projet source `C:\Users\matth\Desktop\jardin de chawi`.
- Ne pas toucher aux dossiers `node_modules/`, `.next/`, `.git/`, `dist/`.
- Mettre a jour `map.md` a chaque creation, suppression, renommage, deplacement ou modification structurelle.
- Les images statiques vont dans `public/assets/`.
- Les uploads utilisateurs doivent passer par Firebase Storage.
- Les secrets Meta/Firebase ne doivent jamais etre hardcodes.
- Les parcours OAuth, publication reseaux, chiffrement token et anti-doublon restent cote serveur Firebase Functions.
- Les pages publiques doivent etre indexables ; les surfaces studio/app privees doivent etre `noindex`.
- **Ne jamais supprimer ni remplacer un preset de [docs/presets-valides.md](docs/presets-valides.md).**
  Ils ont ete regardes et valides sur de vraies photos. Un nouveau variant
  s'AJOUTE a cote ; il ne prend jamais la place d'un preset valide, meme s'il est
  cense faire mieux. Ce fichier dit aussi ce qu'un preset doit passer pour y
  entrer — et pourquoi les mesures seules ne suffisent pas.
- **Juger un preset a l'oeil avant de le livrer**, sur des photos PEU RETOUCHEES
  (Unsplash est la bonne source ; les photos d'un corpus de reference sont deja
  des edits finis, les repasser dans un preset etale deux fois le meme
  traitement). `node scripts/planche-presets.mjs <photo...>` fabrique la planche
  a regarder.

## Rituel de fin de phase (reconstruction VibeCut)

A la fin de chaque grande phase et de chaque module livre, avant de passer a la suite :

- Verifier : `npm run lint`, `npm run build`, la suite de tests du nouveau front et les suites impactees.
- Mettre a jour `todo.md` (fait, reste, bugs trouves et corriges, problemes connus).
- Mettre a jour `plan.md` (phase marquee terminee, phases suivantes ajustees).
- Mettre a jour `map.md` (arborescence + entree de journal datee).
- Ecrire un prompt de relance en fin de `todo.md` pour repartir dans un chat neuf sans rien relire.
- Rapporter honnetement ce qui marche, ce qui est laisse de cote et pourquoi, et les echecs de tests preexistants.

### Cloture de phase dans le chat

A la fin de CHAQUE phase ou tranche livree, le dernier message du chat contient
**un recap en langage simple** : ce qui marche et se teste tout de suite (URL
locale + commande), ce qui a ete laisse de cote et pourquoi, les bugs trouves et
corriges en route, les echecs de tests preexistants. Court, sans jargon en tete.

**Le prompt de reprise ne s'ecrit dans le chat QUE si l'utilisateur l'a demande
AU DEBUT de la session** ("je veux un prompt de reprise a la fin"). Sinon, jamais
— ni en entier, ni en resume, ni "veux-tu que je te le donne ?".

Raison : ca coute plusieurs milliers de tokens par fin de reponse, pour un texte
que l'utilisateur ne recopie que lorsqu'il ouvre vraiment un chat neuf.

Regle actuelle :

- l'agent ECRIT le fichier `docs/prompt-reprise-<date>.md` et met a jour le lien
  dans `todo.md` — ca, ca reste obligatoire a chaque fin de lot ;
- il ne colle le texte complet dans le chat que si la demande a ete faite au
  debut de la session, ou si l'utilisateur le reclame explicitement ;
- sinon il ne mentionne meme pas son existence.

Le contenu du fichier ne change pas : chemin absolu du projet, ordre de lecture
des docs (et ce qu'il ne faut PAS lire), etat du livre, etat des gates, mission
suivante ordonnee, interdits, rituel de fin de phase.

### Economie de contexte et de quota

Le projet est gros ; le budget de contexte est la vraie contrainte. Regles :

- **Lire par extraits, pas par fichiers entiers.** `map.md` fait des milliers de
  lignes : n'en lire que la zone touchee (`grep -n`, `sed -n '<a>,<b>p'`). Idem
  pour les gros fichiers de code.
- **Ne jamais ouvrir une archive** (`docs/archive-*`, `docs/prompt-reprise-*`)
  sauf si on travaille exactement dans la zone concernee.
- **Ne pas relire un fichier qu'on vient d'ecrire** pour verifier : l'outil
  d'edition aurait echoue.
- **Ne pas lancer de sous-agent** sauf demande explicite de l'utilisateur : un
  sous-agent repart de zero et repaie tout le contexte.
- **Gates cibles, pas tous les gates.** Ne jouer que les suites touchees par le
  changement ; `npm run build` et les smokes navigateur sont lents et chers,
  les garder pour une fin de lot reelle.
- **Aucun deploiement** sans demande explicite (voir plus bas : ca coute de
  l'argent reel, pas seulement du contexte).
- **Ecrire court.** Pas de recapitulatif de ce qui vient d'etre dit, pas de
  reformulation du plan a chaque message, pas de tableau decoratif.

### `todo.md` doit rester court

C'est le fichier que tout agent relit en debut de session. Il ne porte QUE le
chantier ACTIF. Des qu'un lot est livre et clos, son detail part dans
`docs/archive-<chantier>-<date>.md`, et `todo.md` n'en garde qu'une ligne de
tableau plus un lien.

Si `todo.md` depasse ~200 lignes, c'est qu'il y a de l'archivage a faire : le
faire AVANT d'ajouter le lot suivant. Le but n'est pas la coquetterie, c'est le
cout : chaque ligne inutile est relue a chaque session, par chaque agent.

## Discipline de deploiement et couts

Les deploiements Firebase App Hosting, Cloud Run et Functions peuvent declencher Cloud Build, Artifact Registry et des couts de build/deploiement. Les agents doivent donc eviter les rollouts excessifs.

Le protocole obligatoire et sa matrice de decision sont dans
[`docs/developpement-local-et-couts.md`](docs/developpement-local-et-couts.md).
Une demande comme « deploie regulierement en staging » autorise un deploiement
par lot coherent termine, pas un rollout apres chaque correction. Tout nouveau
deploiement dans le meme lot doit avoir une raison explicite que le local ne
permet pas de verifier.

- Developper et verifier en local d'abord : `npm run dev`, tests smoke, lint et build local.
- Ne deployer que lorsqu'un lot coherent de changements est pret ou quand l'utilisateur demande explicitement une mise en hosting.
- Grouper les petites corrections au lieu d'enchainer des rollouts successifs.
- Avant tout deploy hosting, executer au minimum les gates adaptes au changement : `npm run lint`, `npm run build`, tests smoke concernes, et `npm --prefix functions run lint` si Functions change.
- Eviter `gcloud run deploy --source` pour des tests frequents du renderer : le deploy depuis source utilise Cloud Build/buildpacks et peut ajouter des couts de build.
- Pour `render-service/`, redeployer seulement quand le renderer change vraiment ; si plusieurs essais sont necessaires, preferer construire une image versionnee une fois puis redeployer cette image.
- Ne jamais deployer pour "voir si ca marche" quand une verification locale ou un test cible peut attraper le probleme.
- Apres un deploy, verifier l'URL live et noter le commit/rollout dans la reponse utilisateur.

## Telemetry couts cible

Le backoffice doit distinguer trois sources, sans afficher des zeros trompeurs :

- Estimation live interne : ecrite a chaque job/export depuis le serveur, basee sur duree reelle, CPU/memoire configurees, requetes, taille output et statut. C'est la source temps quasi reel pour detecter surcharge et abus.
- Usage Cloud Run/Monitoring : source operationnelle pour confirmer activite, latence, instances, erreurs et requetes, mais pas une facture euro instantanee.
- Facture Google officielle : Cloud Billing Export BigQuery, differree et sujette aux free tiers/credits/arrondis. Elle sert a comparer et calibrer l'estimation interne, pas a piloter le temps reel.

Pour Vibe_CUT, chaque export serveur doit creer/mettre a jour un `videoExportJobs/{jobId}` avec `startedAt`, `endedAt`, duree rendu, service Cloud Run, region, CPU, memoire, input/output bytes, statut, estimation brute, user/dev et metadonnees video. Les tests directs K1 qui appellent Cloud Run hors workflow doivent aussi produire un evenement de telemetry ou etre clairement marques comme "hors jobs Firestore".

## Architecture cible choisie

Choix principal : Next.js App Router + Firebase App Hosting.

Raison : le besoin de referencement maximal exclut un SPA pur pour les pages marketing et ressources SEO. Next.js permet SSG/SSR/metadata/sitemap/robots/structured data, tandis que l'editeur image reste un client component isole. Firebase App Hosting supporte officiellement Next.js et s'integre a Auth, Firestore, Storage, Functions et Secret Manager.

## Design system cible

Etat reel constate le 2026-09-03. L'application a ete entierement redessinee en
direction **Apple OS epure** : sombre, sobre, typo systeme, cartes arrondies,
accent indigo `#5b7cfa`, tres peu de bordures. Les skills `cyber-neon`,
`dark-ui` et `technical-ui` ne decrivent plus l'app ; ne pas s'en servir comme
reference pour une surface produit.

Toutes les surfaces de creation sont concernees : Bibliotheque, Layout, Studio,
Vision, Soundtrack, VibeCut.

Deux jeux de tokens font autorite, volontairement separes et jamais melanges :

- **VibeOS** (`/creer/*` : Bibliotheque, Layout, Studio, Vision, Soundtrack).
  Tokens `--vo-*` dans `src/features/vibeos/styles/vibeos.css`, charge une seule
  fois par `src/app/creer/layout.js`. Primitives partagees dans
  `src/features/vibeos/primitives/` (Button, IconButton, Segmented, Card, Sheet,
  Slider, Tile, Badge, Toast...). Toute nouvelle UI VibeOS passe par ces
  primitives et ces tokens, pas par du CSS ad hoc.
- **VibeCut** (`/video/*`). Tokens `--vc-*` dans
  `src/features/vibecut/styles/vibecut.css`, tout scope sous `.vibecut`, plus
  `src/features/vibecut/primitives/`. Meme direction et meme accent que VibeOS,
  mais jeu independant : cette surface est isolee et ne charge ni `vibeos.css`
  ni le bundle Tailwind statique de `/studio`.

Deux surfaces ne sont pas encore alignees, et c'est connu :

- `/publier` utilise `src/features/publications/publications.css` plus les CSS
  importes de `vibefx-layout`.
- Les pages publiques et marketing utilisent `src/app/globals.css`, avec ses
  tokens `--vf-*` (violet `#9b5cff`, cyan `#00e5ff`) herites de la direction
  precedente.

Contraintes qui restent :

- Ne pas reprendre la pate graphique de Jardin de Chawi.
- Ne pas casser la structure responsive deja validee ; changer les tokens et
  l'UI, pas l'ergonomie.
- Ne pas melanger les prefixes `--vo-`, `--vc-` et `--vf-` dans un meme fichier.

## Code importe a auditer avant construction

Etat reel constate le 2026-09-03, par grep des imports depuis `src/app/` et
`src/features/vibeos/`. Lire cette section avant de partir chercher un ecran
dans un dossier `vibefx-*`.

**L'app vivante est `src/features/vibeos/`.** Les ecrans montes par
`src/app/creer/*` sont `vibeos/library/LibraryScreen.jsx`,
`vibeos/layout/LayoutScreen.jsx` (avec `layout/useLayoutEditor.js`),
`vibeos/studio/StudioScreen.jsx`, `vibeos/vision/VisionScreen.jsx`,
`vibeos/soundtrack/SoundtrackScreen.jsx`, `vibeos/home/HomeScreen.jsx`. La
video vit dans `src/features/vibecut/`, montee par `src/app/video/*`.

Les dossiers `vibefx-*` sont du code importe du projet source. Ils ne sont plus
des UI vivantes, mais ils ne sont pas morts pour autant :

- `src/features/vibefx-layout/` : **n'est plus la page mise en page**. Il n'en
  reste que deux usages reels : `data/themedTemplates` (importe par
  `vibeos/layout/TemplateSheet.jsx`) et ses deux feuilles
  `vibefx-tailwind.css` / `vibefx-layout.css`, chargees par
  `src/app/publier/layout.js`. Tout le reste du dossier est de la reference non
  branchee : ne pas y chercher le comportement de l'ecran Layout.
- `src/features/vibefx-studio/` : pas d'UI vivante non plus, mais ses **moteurs
  sont utilises tous les jours** par VibeOS et VibeCut. Ne pas le supprimer.
  Reellement importes : `hooks/` (`useCanvasRenderer`, `useCanvasEvents`,
  `useExport`, `useImageUpload`, `useLayoutState`, `useLayoutHelpers`,
  `useStudioFilters`), `data/constants` (FORMATS, TEMPLATES, presets),
  `engine/` (`layoutRenderer`, `studioRenderer`), `utils/` (`customLayout`,
  `socialExport`, `visionMetrics`, `visionRecommendation`, `visionPresets`,
  `visionColorScience`), `soundtrack/` (`data`, `hooks`, `services`, via
  `vibeos/soundtrack/useVibeOsSoundtrack.js`) et `video/` (`data`, `engine`,
  `export`, `model`, `store`, `utils`, consomme par les adapters VibeCut).
- `src/features/vibefx-shared/` : un seul usage, `utils/smoothBlur`, pilote par
  `vibeos/shared/SmoothBlurSheet.jsx`.
- `src/features/publications/PublicationsManager.jsx` : vivant, monte par
  `/publier` (studio publications + import depuis la mise en page + boutons
  Meta).
- `functions/` : base Functions copiee, a reduire au strict necessaire Vibe_fx V2 avant deploy.
- `public/assets/vibefx/demo-astronaut.png` : image demo.

Regle pratique : une UI se modifie dans `vibeos/` ou `vibecut/` ; un moteur de
rendu, d'export ou de son se modifie dans `vibefx-studio/`, en sachant que le
changement touche plusieurs ecrans a la fois.

Important : le moteur publication/Firebase du projet source est une base a conserver. Les prochains agents doivent porter et generaliser la logique deja faite dans Jardin de Chawi : publication manager, route mise en page vers publication, uploads Storage, callables Meta OAuth, locks anti-doublon, statuts plateforme et regles Firestore/Storage. Il ne faut pas reconstruire cette logique de zero sauf si une partie est explicitement invalide pour le modele multi-utilisateur Vibe_fx V2.

## Gates avant toute vraie implementation

- Lire `MEGAPROMPT.md` et suivre son ordre.
- Faire un audit des imports existants.
- Decouper `PublicationsManager.jsx` en modules propres avant d'ajouter des features.
- Extraire les fonctions Firebase inutiles au produit Vibe_fx V2.
- Verifier `npm run lint`, `npm run build`, et `npm --prefix functions run lint`.
- Valider SEO : metadata, canonical, sitemap, robots, structured data, rendu HTML sans JS pour pages publiques.
