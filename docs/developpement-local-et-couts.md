# Developpement local et maitrise des couts cloud

## But

Ce protocole reduit les builds, revisions, images, secrets et jobs payants sans
modifier l'architecture de Vibe_fx V2. La regle par defaut est : **le local est
la boucle de developpement ; le cloud est une validation de lot ou une release**.

Il s'applique a tout humain et tout agent qui travaille dans ce depot.

## Regles non negociables

1. Aucun deploiement sans demande explicite de l'utilisateur.
2. Une autorisation de deploiement vaut pour un seul lot coherent et un seul
   environnement. Elle ne reste pas ouverte pour toute la session.
3. « Deploie regulierement en staging » signifie : terminer et verifier le lot
   en local, puis faire un seul rollout staging au jalon utile. Cela ne signifie
   jamais deployer apres chaque micro-correction.
4. Ne jamais deployer « pour voir si ca marche » si `localhost`, un test cible,
   un build local ou les emulateurs Firebase peuvent donner la reponse.
5. Ne deployer que les services reellement modifies. Un `firebase deploy` sans
   `--only` est interdit hors release multi-service explicitement auditee.
6. Aucun nettoyage, suppression, desactivation de job, secret, revision ou
   artefact cloud sans inventaire, apercu et accord explicite de l'utilisateur.

## Boucle de travail par defaut

### 1. Explorer et corriger en local

- Lancer l'application avec `npm run dev` et travailler sur `localhost`.
- Utiliser les donnees mockees ou locales lorsque le parcours le permet.
- Pour Auth, Firestore, Storage et Functions, utiliser `npm run emulators`.
- Lancer seulement les tests lies aux fichiers modifies pendant l'iteration.
- Faire autant de modifications et de commits locaux que necessaire : un commit
  local ne coute rien sur Google Cloud.

Attention : tout produit Firebase non emule reste susceptible de joindre la
ressource live. Avant un test local Firebase, verifier que chaque service touche
est bien raccorde a son emulateur.

### 2. Fermer un lot local

Avant d'envisager le cloud :

- relire le diff et verifier qu'il ne contient que le lot attendu ;
- lancer les tests cibles et le lint adapte ;
- lancer `npm run build` une fois quand le lot touche Next.js ou avant un vrai
  rollout App Hosting ;
- lancer `npm run functions:lint` si `functions/` change ;
- utiliser `npm run verify:local` seulement a la fin d'une tranche importante,
  pas apres chaque petite retouche.

Une erreur locale se corrige localement. Elle n'autorise pas un rollout d'essai.

### 3. Valider dans le cloud seulement si necessaire

Un staging est utile pour les comportements impossibles a prouver localement :
domaine/OAuth reel, IAM, secrets, integration avec un fournisseur externe,
configuration App Hosting ou Cloud Run, comportement reseau et smoke final.

Par defaut : **zero deploiement pendant l'exploration, un deploiement a la fin
du lot, puis une seule verification live**. Si cette verification revele un
bug, regrouper toutes les corrections localement avant le rollout suivant.

## Matrice de decision

| Changement | Verification normale | Deploiement eventuel |
| --- | --- | --- |
| UI, CSS, texte, logique React | `npm run dev`, test navigateur cible | App Hosting une fois le lot fini |
| Route ou rendu Next.js | localhost, test de route, `npm run build` | App Hosting si validation SSR/live requise |
| Firestore/Storage Rules | emulateurs et tests de rules | rules seulement |
| Une ou quelques Functions | emulateurs, tests cibles, lint Functions | fonctions nommees seulement si l'outil le permet |
| Ensemble du backend Firebase | emulateurs + gates de fin de lot | `npm run firebase:deploy:backend` uniquement si tout a change |
| Renderer `render-service/` | renderer et fixtures en local | Cloud Run seulement si le renderer a change |
| Documentation, tests ou scripts locaux | lecture/test local | aucun rollout applicatif |

Les scripts gardes du projet doivent etre preferes aux commandes improvisees :
ils verifient notamment la cible Firebase. Le script
`npm run firebase:deploy:functions` deploie actuellement toutes les Functions ;
il ne doit donc pas etre utilise pour une correction isolee quand un deploiement
nomme plus restreint est possible.

## Git et App Hosting

Avec les rollouts automatiques, chaque push sur la branche live peut creer un
Cloud Build, une image Artifact Registry et une revision. Jusqu'a verification
contraire dans Firebase, traiter `master` comme une branche de deploiement.

- Travailler sur une branche de feature ou conserver les commits localement
  pendant les iterations.
- Ne pousser/merger sur la branche live que lorsqu'un lot est pret.
- Ne pas utiliser la branche live comme bouton « preview ».
- Pour les fichiers sans effet applicatif (`docs/`, certains tests ou assets de
  travail), configurer les *Ignored Paths* App Hosting plutot que payer un build
  inutile. Toute modification de ces reglages demande un controle des chemins
  requis et un accord explicite.
- Si le besoin de staging devient frequent, preferer une branche/backend staging
  clairement separe plutot que multiplier les rollouts de production. Sa
  creation est une decision d'infrastructure, pas une action implicite.

## Declaration obligatoire avant un deploiement

Avant d'executer une commande cloud, l'agent indique brievement :

- la cible exacte : projet, environnement, region si pertinente ;
- le service deploye et les fichiers qui le justifient ;
- pourquoi le local ne suffit pas ;
- la commande ou le mecanisme prevu ;
- le nombre de rollouts attendu, normalement un.

Si la cible n'est pas certaine, le deploiement s'arrete. La cible ne doit jamais
etre deduite d'un ancien projet, d'un onglet de console ou d'une variable vide.

## Habitudes qui evitent les depenses inutiles

- Grouper les retouches UI et les correctifs avant de demander « staging ».
- Demander plutot : « travaille en local, prepare un lot staging, puis fais un
  seul rollout quand tous les gates sont verts ».
- Ne pas relancer un deploiement echoue avant d'avoir lu son log et corrige sa
  cause localement.
- Ne pas redeployer Functions, Rules ou renderer s'ils n'ont pas change.
- Ne pas utiliser `gcloud run deploy --source` comme boucle de test : il ajoute
  un build et des artefacts a chaque essai.
- Ne pas creer une nouvelle version de secret pour une valeur inchangee.
- Ne pas creer un Scheduler job sans fonction, frequence, proprietaire et
  condition de suppression documentes.
- Ne pas lancer de smoke live couteux plusieurs fois avec les memes entrees.

## Hygiene periodique, sans suppression automatique

Une fois par mois, ou apres une forte phase de deploiement, faire un inventaire
en lecture seule :

- nombre de rollouts App Hosting et de builds Cloud Build ;
- revisions Cloud Run/Functions creees ;
- taille et anciennete des images Artifact Registry ;
- jobs Cloud Scheduler actifs et leur utilite ;
- secrets et versions actives ;
- services/projets sans trafic mais encore factures.

L'inventaire produit une liste : **garder / verifier / candidat au nettoyage**.
Il ne supprime rien. Une politique de retention Artifact Registry peut ensuite
etre proposee avec un dry-run et des exceptions pour les versions a conserver.
Pour les artefacts de deploiement Functions, Firebase CLI sait aussi definir une
retention ; cette politique doit etre approuvee avant activation.

## Definition d'un deploiement propre

Un deploiement est termine quand :

- les gates locales etaient vertes avant le cloud ;
- seul le perimetre necessaire a ete deploye ;
- le rollout attendu a fini sans relance aveugle ;
- l'URL ou le parcours concerne a ete verifie une fois ;
- le commit, l'environnement, les services et les incidents sont notes dans le
  compte rendu ;
- aucune ressource temporaire payante n'a ete laissee sans proprietaire.

## Sources officielles

- [Firebase App Hosting - rollouts et declencheurs](https://firebase.google.com/docs/app-hosting/rollouts)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Firebase Functions - deploiement cible et artefacts](https://firebase.google.com/docs/functions/manage-functions)
- [Artifact Registry - politiques de nettoyage](https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy-overview)
