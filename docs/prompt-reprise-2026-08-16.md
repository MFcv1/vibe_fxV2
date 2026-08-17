# Prompt de reprise — 2026-08-16 (synchro Lightroom terminée : les imports sont débloqués)

À copier tel quel dans un chat neuf, contexte à zéro.

```
Projet : /Users/matthis/Desktop/mes projets mac/vibe_fxV2

LIS, DANS CET ORDRE, ET RIEN D'AUTRE :
  1. AGENTS.md                            regles de travail, rituel de fin de phase
  2. todo.md                              l'etat du chantier actif
  3. docs/lightroom/1-procedure.md        la procedure d'import, clic par clic
  4. docs/lightroom/4-synchro-effets.md   ce que chaque effet vaut, et pourquoi
  5. map.md                               seulement la zone que tu touches
NE LIS PAS les archives (docs/archive-*.md) sauf si tu travailles dedans.


OU ON EN EST

Le chantier « synchroniser nos effets avec Lightroom » est TERMINE, sauf deux
points nommes plus bas. Un preset Lightroom se capture en deux morceaux : la
COULEUR par mire Hald (exacte au 1/255), et tout ce qui depend des pixels
VOISINS ou de la POSITION, qui se recopie a la main dans `spatialFilters`.
Ce second morceau est desormais a l'echelle de Lightroom : le nombre releve
dans son panneau se recopie TEL QUEL, sans conversion.

Aligne et mesure :
  GRAIN      x1,00 sur toute la plage tonale, a 15 / 50 / 100
  VIGNETAGE  2,4/255 d'ecart. Multiplie en lumiere LINEAIRE, rayon elliptique
  NETTETE    echelle 0-150, dosage saturant. Verifiee SUR PHOTO : x0,986 a 40
  CLARTE     dosage deja bon, rayon corrige (2,5 % -> 11 % du petit cote)
  TEXTURE    branchee le 16/08, cote POSITIF seulement :
             x1,176 / 1,120 / 1,096 contre ses x1,175 / 1,120 / 1,096

Valide a l'oeil et sur photo reelle :
  - `powlisher-showcase` revalide sur 4 photos, avec le VRAI moteur.
    Grain 8 et relief 14 gardes, vignetage monte de 3 a 8.
  - `cn17` compare a Lightroom sur une vraie photo (plage, ciel, roche) :
    1,73/255 d'ecart moyen -> « identique a l'oeil ».
  - `cn11` et `cn17` portent maintenant `sharpness: 40`. C'est la nettete que
    Lightroom pose PAR DEFAUT sur toute photo ; notre moteur n'en a aucune, donc
    sans elle le meme preset rendait 1,40x plus mou que chez lui.

Gates au moment ou je m'arrete : lint (0 erreur, 5 warnings preexistants),
build, test:vision-preset (67 verifications), test:vision-filters,
test:vibeos-vision — tous verts.


TA MISSION, DANS CET ORDRE

1. IMPORTER D'AUTRES PRESETS LIGHTROOM. C'est debloque, c'est la suite.
   Familles paysage (LN01-LN08), architecture urbaine (UA01-UA04), voyage,
   cinema, film. Methode : docs/lightroom/1-procedure.md, sans sauter d'etape.

   A CHAQUE import, DEMANDER a Matthis les panneaux Effets ET Detail (l'agent ne
   peut pas les lire), remettre le grain a 0 avant d'exporter la mire, puis
   passer les valeurs relevees : --grain --vignette --clarity --texture
   --sharpness --dehaze. Le nombre se recopie TEL QUEL.

   Deux pieges rendent un preset non capturable sans que rien ne le signale :
   un reglage « Auto » non nul, et un panneau Masquage non vide.

2. TEXTURE NEGATIVE. Il manque 2 exports Lightroom : Texture -50 et -100 sur la
   mire C (dossiers `texture-moins50` / `texture-moins100` dans
   ~/Desktop/vibefx-lightroom/ETAPE-3/mire-C/). Ceux qui s'y trouvent sont le
   POSITIF exporte deux fois — verifie deux fois, ils donnent exactement les
   memes 1,175 / 1,120 / 1,096. Tant que ce n'est pas mesure, la borne basse
   reste a 0 et l'import REFUSE un --texture negatif.

3. VOILE. Ne le mesure PAS sur mire : Lightroom l'estime a partir du CONTENU de
   l'image, donc sur une mire quasi uniforme on ne capture que la part globale.
   Cas a part, a traiter sur photo reelle.

4. GRAIN TAILLE 40. CN17 met le sous-reglage Taille a 40 ; tout est calibre pour
   la valeur par defaut 25. A mesurer seulement si l'aspect du grain d'un preset
   importe ne colle pas.


CE QUI T'EVITERA DE REFAIRE LES MEMES ERREURS

  - REIMPORTER UN PRESET SANS LE BON `--lisser` REECRIT SA LUT EN SILENCE.
    `cn17` exige `--lisser 1` (capturee avec son grain 15, donc bruitee), `cn11`
    exige de ne PAS lisser. Les commandes exactes sont dans 1-procedure.md.
    Controle apres tout reimport : `git diff` sur le fichier du preset — la ligne
    `LUT_BASE64` ne doit PAS apparaitre.
  - NE JAMAIS mesurer un effet spatial sur la mire Hald. Ses pastilles de 4x4 px
    font baver les voisins : c'est ce qui avait produit un faux « x8 » sur le
    grain, la ou le vrai ecart etait x2,66.
  - CHERCHER LA LOI, PAS UN COEFFICIENT. A chaque fois, le facteur d'echelle
    n'etait pas le vrai probleme : le grain etait une CLOCHE la ou il pose un
    PLAT, le vignetage multipliait en sRVB la ou il multiplie en LINEAIRE, la
    clarte avait un rayon 4x trop petit, la nettete montait lineairement la ou
    la sienne SATURE, la texture demandait DEUX rayons la ou un seul ne peut pas
    reproduire sa decroissance lente.
  - SE MEFIER DE L'INSTRUMENT AUTANT QUE DU MOTEUR. La raideur du bord doux se
    lisait comme un maximum de difference pixel a pixel, donc comme un maximum
    de BRUIT : 2,00 sur la mire de reference la ou la transition vaut 1,26.
    Quand un chiffre surprend, demande-toi si c'est le moteur ou l'instrument.
  - UNE PLANCHE DE LUT NE MONTRE PAS LES EFFETS. `planche-presets.mjs` ne rend
    que la couleur. Pour juger grain, vignetage, relief ou texture, c'est
    `planche-showcase.mjs`, qui lance le vrai moteur dans un Chromium.
  - TOUTE VALEUR DEJA ECRITE EST A CONVERTIR quand une echelle bouge : presets,
    ambiances du Studio, et src/features/vibefx-studio/data/constants.jsx.
  - Le bruit s'ajoute EN QUADRATURE : le grain seul vaut sqrt(total^2 - base^2).


LIGHTROOM N'EST PAS PILOTABLE

Tu ne peux ni lire ses panneaux ni exporter a sa place. Il faut DEMANDER a
Matthis. Le materiel est sur son bureau, dans ~/Desktop/vibefx-lightroom/ : un
dossier d'export par valeur de curseur, pour que le nom du fichier n'ait aucune
importance. Reglages d'export a rappeler a chaque fois :
PNG / Taille reelle / sRVB / Nettete de sortie « Aucun ».

COMMENT LUI PARLER — il l'a demande explicitement, et c'est important :
UNE SEULE etape a la fois, en deux ou trois phrases, DANS LE CHAT. Pas de pave,
pas de tableau, pas de consignes ecrites dans un fichier qu'il faudrait aller
ouvrir. Il repond « c'est bon » et on passe a la suivante. Verifie toi-meme que
le fichier est bien arrive avant d'enchainer. Si tu lui fabriques une planche a
regarder, ouvre-la pour lui (`open <fichier>`) : lui donner un chemin ne suffit
pas.


INTERDITS

  - Jamais supprimer ni remplacer un preset de docs/presets-valides.md.
    Un variant s'AJOUTE a cote.
  - Jamais de Tailwind dans le nouveau code : CSS Modules + tokens --vo-*.
  - Jamais reecrire un moteur existant : on l'importe, ou on l'extrait.
  - Aucun deploiement sans demande explicite.
  - Ne pas editer a la main les fichiers de src/features/vibefx-studio/utils/presets/
    (generes par l'import).

RITUEL DE FIN DE PHASE : gates (lint, build, test:vision-preset,
test:vision-filters, test:vibeos-vision), mise a jour de todo.md — qui doit
RESTER COURT — et de map.md avec une entree de journal datee, rapport honnete de
ce qui marche et de ce qui est laisse de cote, puis dans le chat le recap en
langage simple et le prompt de reprise complet.

Echecs preexistants, hors chantier : smoke-vibecut-media-safety.spec.cjs (3) et
test:vibecut-export-local-mp4 — fixtures manquantes, chemins Windows d'origine.
```
