/*
 * Range un lot de photos par SUJET.
 *
 *   node scripts/categoriser.mjs planches --source <dossier> [--par 30]
 *   node scripts/categoriser.mjs ranger  --labels <fichier> [--deplacer]
 *
 * Deux temps, et c'est volontaire.
 *
 * `planches` fabrique des planches contact ou CHAQUE vignette porte son numero.
 * `ranger` relit un fichier de lignes « numero categorie » et classe les
 * fichiers correspondants.
 *
 * Pourquoi passer par l'oeil plutot que par une regle automatique: reconnaitre
 * « une moto », « une facade », « un bord de mer » a partir de statistiques de
 * couleur ne marche pas — une Lamborghini jaune au coucher de soleil et une
 * facade ocre rendent les memes chiffres. Le detour par la planche numerotee
 * coute une lecture par planche et donne un classement juste.
 *
 * Le tri par sujet est INDEPENDANT du tri par rendu (`grouper-corpus.mjs`).
 * Les deux servent a des choses differentes: le sujet donne les declinaisons a
 * construire, le rendu dit quelles photos ne portent pas le meme developpement.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const mode = args[0];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const racine = opt('racine', path.join(os.homedir(), 'Desktop', 'powlisher-biblio'));
const source = opt('source', path.join(racine, 'retenues'));
const dossierPlanches = opt('planches', path.join(racine, 'planches-numerotees'));
const cheminIndex = path.join(dossierPlanches, 'index.json');

if (mode === 'planches') {
    const PAR = Number(opt('par', 30));
    const COLS = Number(opt('cols', 8)), VIGN = Number(opt('vign', 280));

    const fichiers = fs.readdirSync(source).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
    if (!fichiers.length) { console.error(`Rien dans ${source}`); process.exit(1); }

    fs.rmSync(dossierPlanches, { recursive: true, force: true });
    fs.mkdirSync(dossierPlanches, { recursive: true });

    const index = fichiers.map((f, i) => ({ n: i + 1, fichier: f }));
    fs.writeFileSync(cheminIndex, JSON.stringify({ source, index }, null, 1));

    /* Le numero est incruste sur la vignette, pas seulement en legende: sur une
     * planche de 30, compter les cases de tete pour retrouver la 17e est la
     * meilleure facon de decaler tout le classement. */
    const etiquette = (n) => Buffer.from(
        `<svg width="${VIGN}" height="${VIGN}" xmlns="http://www.w3.org/2000/svg">
           <rect x="4" y="4" width="${n > 99 ? 62 : 50}" height="34" rx="6" fill="#000" opacity="0.72"/>
           <text x="14" y="30" font-family="Helvetica,Arial" font-size="26" font-weight="bold" fill="#fff">${n}</text>
         </svg>`);

    for (let p = 0; p * PAR < fichiers.length; p += 1) {
        const lot = index.slice(p * PAR, (p + 1) * PAR);
        const lignes = Math.ceil(lot.length / COLS);
        const tuiles = [];
        for (const [i, it] of lot.entries()) {
            const left = (i % COLS) * VIGN, top = Math.floor(i / COLS) * VIGN;
            const vignette = await sharp(path.join(source, it.fichier)).rotate()
                .resize(VIGN, VIGN, { fit: 'cover' })
                .composite([{ input: etiquette(it.n), top: 0, left: 0 }])
                .jpeg({ quality: 86 }).toBuffer();
            tuiles.push({ input: vignette, left, top });
        }
        const nom = `planche-${String(p + 1).padStart(2, '0')}.jpg`;
        await sharp({ create: { width: COLS * VIGN, height: lignes * VIGN, channels: 3, background: '#111' } })
            .composite(tuiles).jpeg({ quality: 88 }).toFile(path.join(dossierPlanches, nom));
        console.log(`${nom}  ${lot[0].n}-${lot[lot.length - 1].n}`);
    }
    console.log(`\n${fichiers.length} photos, ${Math.ceil(fichiers.length / PAR)} planches -> ${dossierPlanches}`);

} else if (mode === 'ranger') {
    const cheminLabels = opt('labels', path.join(racine, 'labels.txt'));
    const deplacer = args.includes('--deplacer');
    const { source: src, index } = JSON.parse(fs.readFileSync(cheminIndex, 'utf8'));
    const parNumero = new Map(index.map((it) => [it.n, it.fichier]));

    const labels = new Map();
    for (const ligne of fs.readFileSync(cheminLabels, 'utf8').split('\n')) {
        const m = ligne.trim().match(/^(\d+)\s*[=: ]\s*([a-z0-9\-]+)$/i);
        if (m) labels.set(Number(m[1]), m[2].toLowerCase());
    }

    const cible = path.join(racine, 'par-sujet');
    fs.rmSync(cible, { recursive: true, force: true });

    const compte = {};
    const orphelins = [];
    for (const { n, fichier } of index) {
        const cat = labels.get(n);
        if (!cat) { orphelins.push(n); continue; }
        const dossier = path.join(cible, cat);
        fs.mkdirSync(dossier, { recursive: true });
        const de = path.join(src, fichier), vers = path.join(dossier, fichier);
        if (deplacer) fs.renameSync(de, vers); else fs.copyFileSync(de, vers);
        compte[cat] = (compte[cat] || 0) + 1;
    }

    console.log(`\n${index.length} photos indexees, ${labels.size} classees`);
    for (const [cat, n] of Object.entries(compte).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(4)}  ${cat}`);
    }
    if (orphelins.length) console.log(`\nsans etiquette (${orphelins.length}) : ${orphelins.slice(0, 40).join(' ')}${orphelins.length > 40 ? ' ...' : ''}`);
    console.log(`\n-> ${cible}`);

} else {
    console.error('Usage: node scripts/categoriser.mjs planches|ranger [options]');
    process.exit(1);
}
