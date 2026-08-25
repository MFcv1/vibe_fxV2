/*
 * Constitue un tas de photos NEUTRES, une famille de sujet a la fois.
 *
 *   node scripts/moissonner-neutre.mjs [--par 40] [--sortie <dossier>]
 *
 * A quoi sert ce tas: on ne voit que les SORTIES du photographe, jamais ses
 * fichiers de depart. Une densite de couleurs seule dit ou il POSE ses teintes,
 * pas d'ou il les a bougees. En comparant sa densite a celle d'un tas qui
 * montre les memes sujets sans porter son traitement, on obtient la DIRECTION
 * du deplacement — et c'est ca, la recette.
 *
 * « Neutre » ne veut pas dire « non retouche », ce qui serait introuvable. Ca
 * veut dire NON CORRELE a son traitement: des centaines de photos par des
 * centaines de personnes differentes, dont les retouches individuelles
 * s'annulent en moyenne. L'heterogeneite du tas est ici une qualite.
 *
 * Source: l'API de Wikimedia Commons. Sans cle, recherche par sujet, et assez
 * permissive pour un lot de plusieurs centaines d'images. Deux sources ont ete
 * essayees avant: Unsplash — celle que le projet prefere d'habitude — exige une
 * cle d'API, et Openverse coupe a 429 des la premiere famille en anonyme.
 *
 * IMPORTANT: une requete par famille, avec le MEME sujet que la famille en
 * face. Comparer ses bords de mer a des photos de bureaux mesurerait le decor
 * et pas le developpement; c'est exactement l'erreur que le tri par sujet
 * permet d'eviter.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Les requetes sont calquees sur ce que montrent VRAIMENT ses familles, pas sur
 * le nom de la famille: sa « mer » est une cote atlantique a l'heure doree, pas
 * un lagon tropical. */
const REQUETES = {
    aerien: 'aerial view from airplane window city',
    architecture: 'modern building facade city skyline',
    auto: 'sports car parked street',
    avion: 'aircraft cabin',
    interieur: 'restaurant interior',
    mer: 'beach coast sea',
    moto: 'motorcycle parked road',
    paysage: 'countryside landscape hills trees',
    /* `portrait person outdoors natural light` et `nightclub bar party neon`
     * n'ont rendu que 2 et 1 photos: Commons indexe par sujet documentaire, pas
     * par intention photographique. Les requetes courtes marchent mieux. */
    portrait: 'portrait woman',
    rue: 'street photography city people',
    soiree: 'party crowd',
    'ville-nuit': 'city street night neon lights',
};

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PAR = Number(opt('par', 40));
const sortie = opt('sortie', path.join(os.homedir(), 'Desktop', 'powlisher-biblio', 'neutre'));

const UA = 'vibe-fx-preset-research/1.0 (mesure de couleur locale, aucune redistribution)';
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(sortie, { recursive: true });
const journal = {};

for (const [famille, requete] of Object.entries(REQUETES)) {
    const dossier = path.join(sortie, famille);
    fs.mkdirSync(dossier, { recursive: true });
    const deja = fs.readdirSync(dossier).filter((f) => /\.jpe?g$/i.test(f)).length;
    if (deja >= PAR) { console.log(`${famille}: deja ${deja}`); continue; }

    let pris = deja, page = 1, vus = 0;
    while (pris < PAR && page <= 4) {
        let json;
        try {
            /* `iiurlwidth` demande une vignette de 1600 px: les originaux de
             * Commons montent a 50 Mpx et pesent des dizaines de Mo, pour une
             * mesure qui travaille de toute facon en 512. */
            const r = await fetch(
                'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
                + '&generator=search&gsrnamespace=6&gsrlimit=50'
                + `&gsroffset=${(page - 1) * 50}`
                + `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${requete}`)}`
                + '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600',
                { headers: { 'User-Agent': UA } },
            );
            if (!r.ok) throw new Error(`http ${r.status}`);
            json = await r.json();
        } catch (e) {
            console.error(`${famille} page ${page}: ${e.message}`);
            break;
        }
        const pages = Object.values(json?.query?.pages || {});
        for (const it of pages) {
            if (pris >= PAR) break;
            vus += 1;
            const info = it.imageinfo?.[0];
            if (!info || info.mime !== 'image/jpeg') continue;
            const url = info.thumburl || info.url;
            if (!url) continue;
            const cible = path.join(dossier, `${String(it.pageid)}.jpg`);
            if (fs.existsSync(cible)) continue;
            try {
                const rp = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
                if (!rp.ok) continue;
                const buf = Buffer.from(await rp.arrayBuffer());
                if (buf.length < 40000) continue;   // vignette: inexploitable pour la mesure
                fs.writeFileSync(cible, buf);
                pris += 1;
                process.stderr.write('.');
            } catch { /* une image morte ne doit pas arreter la moisson */ }
            await dodo(120);
        }
        page += 1;
        await dodo(300);
    }
    journal[famille] = { requete, photos: pris, candidatsVus: vus };
    process.stderr.write(`\n${famille}: ${pris}\n`);
}

fs.writeFileSync(path.join(sortie, 'journal.json'), JSON.stringify(journal, null, 1));
console.log(`\n-> ${sortie}`);
for (const [f, j] of Object.entries(journal)) console.log(`  ${String(j.photos).padStart(3)}  ${f}`);
