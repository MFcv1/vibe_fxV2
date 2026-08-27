/*
 * Le portrait chiffre de CHAQUE famille, chez lui et en face.
 *
 *   node scripts/mesurer-familles.mjs [--refaire]
 *
 * `profil-corpus.mjs` sort un vecteur par PHOTO. `variantes.mjs` demande en
 * combien de presets une famille se coupe. Il manquait la question la plus
 * simple des deux: pour une famille donnee, de combien son developpement
 * s'ecarte-t-il du tas neutre des memes sujets ? C'est ce que ce script mesure,
 * variable par variable, en medianes — donc insensible aux quelques photos
 * extremes que chaque famille contient.
 *
 * Il profile le tas neutre une fois et met le resultat en cache
 * (`profils-neutre.json`), parce que 480 photos coutent une minute et que les
 * chiffres, eux, ne bougent plus.
 *
 * Les mesures vivent hors depot: ~/Desktop/powlisher-biblio/.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { profil } from './profil-corpus.mjs';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const CACHE = path.join(BIBLIO, 'profils-neutre.json');
const refaire = process.argv.includes('--refaire');

/* `profils-par-sujet.json` date du 24 aout et lui manque la moitie des
 * variables (lumiere, reflets, texture, ajoutees depuis). On reprofile les deux
 * tas avec le MEME code, sinon les ecarts compareraient deux instruments. */
const familles = fs.readdirSync(path.join(BIBLIO, 'par-sujet'))
    .filter((f) => fs.statSync(path.join(BIBLIO, 'par-sujet', f)).isDirectory()).sort();

async function profilerTas(racine, cache) {
    if (!refaire && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
    const tas = {};
    for (const fam of familles) {
        const d = path.join(racine, fam);
        if (!fs.existsSync(d)) continue;
        const fichiers = fs.readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
        tas[fam] = [];
        for (const f of fichiers) {
            try { tas[fam].push(await profil(path.join(d, f))); } catch { /* illisible */ }
        }
        process.stderr.write(`${path.basename(racine)}/${fam}: ${tas[fam].length}\n`);
    }
    fs.writeFileSync(cache, JSON.stringify(tas));
    return tas;
}

const lui = await profilerTas(path.join(BIBLIO, 'par-sujet'), path.join(BIBLIO, 'profils-lui.json'));

let neutre;
if (!refaire && fs.existsSync(CACHE)) {
    neutre = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
} else {
    neutre = {};
    for (const fam of Object.keys(lui)) {
        const d = path.join(BIBLIO, 'neutre', fam);
        if (!fs.existsSync(d)) continue;
        const fichiers = fs.readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
        neutre[fam] = [];
        for (const f of fichiers) {
            try { neutre[fam].push(await profil(path.join(d, f))); } catch { /* illisible */ }
        }
        process.stderr.write(`${fam}: ${neutre[fam].length}\n`);
    }
    fs.writeFileSync(CACHE, JSON.stringify(neutre));
}

const mediane = (xs) => {
    const t = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!t.length) return NaN;
    return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
};

const VARS = {
    pied: (p) => p.pied,
    median: (p) => p.median,
    pointBlanc: (p) => p.pointBlanc,
    contraste: (p) => p.p95 - p.p05,
    chroma: (p) => p.chromaMoy,
    lumiereA: (p) => p.lumiereA,
    lumiereB: (p) => p.lumiereB,
    refletA: (p) => p.refletA,
    refletB: (p) => p.refletB,
    refletLuma: (p) => p.refletLuma,
    ombresA: (p) => p.ombresA,
    ombresB: (p) => p.ombresB,
    mediansA: (p) => p.mediansA,
    mediansB: (p) => p.mediansB,
    hautesA: (p) => p.hautesA,
    hautesB: (p) => p.hautesB,
    cielTeinte: (p) => (p.cielPart > 3 ? p.cielTeinte : NaN),
    texture: (p) => p.texture,
};

const noms = Object.keys(VARS);
const fams = Object.keys(lui).filter((f) => neutre[f]);

const out = {};
for (const fam of fams) {
    out[fam] = { n: lui[fam].length, nNeutre: neutre[fam].length };
    for (const v of noms) {
        const a = mediane(lui[fam].map(VARS[v]));
        const b = mediane(neutre[fam].map(VARS[v]));
        out[fam][v] = { lui: +a.toFixed(2), neutre: +b.toFixed(2), ecart: +(a - b).toFixed(2) };
    }
}
fs.writeFileSync(path.join(BIBLIO, 'familles.json'), JSON.stringify(out, null, 1));

const pad = (s, n) => String(s).padStart(n);
console.log(pad('', 12) + fams.map((f) => pad(f.slice(0, 9), 10)).join(''));
for (const v of noms) {
    console.log(pad(v, 12) + fams.map((f) => pad(out[f][v].lui, 10)).join(''));
    console.log(pad('  ecart', 12) + fams.map((f) => pad(out[f][v].ecart, 10)).join(''));
}
console.log(`\n-> ${path.join(BIBLIO, 'familles.json')}`);
