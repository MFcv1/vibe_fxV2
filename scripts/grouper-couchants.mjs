/*
 * Materialise LE GROUPE COUCHANT de son corpus, en sous-familles appariees au
 * tas neutre.
 *
 *   node scripts/grouper-couchants.mjs
 *
 * POURQUOI CE SCRIPT EXISTE. Ses 320 photos sont rangees par SUJET — `mer`,
 * `auto`, `architecture`. Ses couchants sont donc disperses: quatre dans `mer`,
 * six dans `architecture`, trois dans `auto`. Or `mesurer-variante.mjs` apparie
 * chaque famille a la famille neutre DE MEME NOM. Laisser ses couchants
 * etiquetes `mer` reviendrait a comparer son bord de mer a contre-jour a des
 * plages de midi: on mesurerait « couchant contre midi », c'est-a-dire la
 * SCENE, et le preset qui en sortirait rechaufferait tout ce qu'il touche.
 * C'est l'erreur du 2026-08-27, prise par l'autre bout.
 *
 * On refait donc le rangement par sujet A L'INTERIEUR du couchant, en face des
 * quatre familles neutres moissonnees le meme jour: `coucher-mer`,
 * `coucher-paysage`, `coucher-ville`.
 *
 * LA SELECTION EST FAITE A L'OEIL, et c'est assume. Aucun seuil ne separe
 * honnetement « couchant » de « pas couchant » sans filtrer sur la chaleur, et
 * filtrer sur la chaleur ce qu'on va ensuite mesurer en chaleur ne repond plus
 * a rien. Du cote neutre la question a ete tranchee par le titre que l'auteur a
 * lui-meme donne a sa photo; ici, ses fichiers n'ont pas de titre, donc c'est
 * l'oeil. Les deux cotes sont selectionnes sur la SCENE, et sur elle seule.
 *
 * Les index sont ceux des planches `PLANCHE-<famille>.jpg` (`ls | sort`,
 * 8 colonnes). Trois candidats ont ete retires apres coup sur planche de
 * controle: architecture[25] et architecture[33] etaient de nuit et de plein
 * jour, auto[66] un pare-brise sous ciel bleu.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const SUJET = path.join(BIBLIO, 'par-sujet');

/* famille de destination -> { famille d'origine: [index dans sa planche] } */
const GROUPES = {
    'coucher-mer': { mer: [8, 14, 20, 34] },
    'coucher-paysage': { paysage: [0, 1, 12, 13, 14], aerien: [0, 4] },
    'coucher-ville': { architecture: [8, 24, 30, 31, 32, 35], auto: [0, 18, 23], aerien: [1, 3], 'ville-nuit': [2] },
};

const liste = [];
for (const [cible, sources] of Object.entries(GROUPES)) {
    const dossier = path.join(SUJET, cible);
    fs.rmSync(dossier, { recursive: true, force: true });
    fs.mkdirSync(dossier, { recursive: true });
    for (const [origine, index] of Object.entries(sources)) {
        const f = fs.readdirSync(path.join(SUJET, origine))
            .filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).sort();
        for (const i of index) {
            if (!f[i]) { console.error(`hors borne: ${origine}[${i}]`); continue; }
            /* On COPIE plutot qu'on ne deplace: la photo reste dans sa famille
             * de sujet, ou les mesures precedentes l'attendent. */
            fs.copyFileSync(path.join(SUJET, origine, f[i]), path.join(dossier, f[i]));
            liste.push({ fam: cible, f: f[i], origine });
        }
    }
    console.log(`${cible}: ${fs.readdirSync(dossier).length}`);
}

const sortie = path.join(BIBLIO, 'couchants-lui.json');
fs.writeFileSync(sortie, JSON.stringify(liste, null, 1));
console.log(`\n${liste.length} photos -> ${sortie}`);
