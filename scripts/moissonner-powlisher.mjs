/*
 * Telecharge en resolution d'origine toutes les photos d'une liste de posts X.
 *
 *   node scripts/moissonner-powlisher.mjs <fichier-ids> [--sortie <dossier>]
 *   pbpaste | node scripts/moissonner-powlisher.mjs - 
 *
 * Le fichier d'entree contient un identifiant de post par ligne (ou des URL
 * completes: on n'en garde que le nombre). Les doublons sont ignores.
 *
 * Source: `cdn.syndication.twimg.com/tweet-result` sert le JSON d'un post sans
 * authentification. C'est la meme porte que `fetch-powlisher-corpus.mjs`, qui
 * elle travaille sur une liste FIGEE de 15 posts choisis a la main. Ici la liste
 * est ouverte: on ratisse, on trie apres.
 *
 * `?name=orig` est indispensable: les variantes servies par defaut sont
 * reechantillonnees, et une image reechantillonnee ne se mesure pas — le
 * reechantillonnage lisse le grain, deplace les extremes et fabrique des
 * couleurs qui n'etaient pas dans l'original.
 *
 * On saute les videos (pas de colorimetrie fiable a en tirer sans decodage) et
 * on note tout dans un manifeste: texte du post, date, nombre de photos. Le
 * texte sert au tri qui suit — il dit souvent le sujet et l'appareil.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith('--')) || '-';
const iS = args.indexOf('--sortie');
const sortie = iS >= 0 ? args[iS + 1] : path.join(os.homedir(), 'Desktop', 'powlisher-biblio', 'brut');

const texte = source === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(source, 'utf8');

const ids = [...new Set(texte.match(/\d{15,25}/g) || [])];
if (!ids.length) {
    console.error('Aucun identifiant de post trouve dans l\'entree.');
    process.exit(1);
}

fs.mkdirSync(sortie, { recursive: true });
const cheminManifeste = path.join(sortie, 'manifeste.json');
const manifeste = fs.existsSync(cheminManifeste)
    ? JSON.parse(fs.readFileSync(cheminManifeste, 'utf8'))
    : { posts: {} };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

let photos = 0, videos = 0, echecs = 0, deja = 0;

for (const [i, id] of ids.entries()) {
    if (manifeste.posts[id]?.fait) { deja += 1; continue; }
    let json;
    try {
        const r = await fetch(
            `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=fr&token=x`,
            { headers: { 'User-Agent': UA } },
        );
        if (!r.ok) throw new Error(`http ${r.status}`);
        json = await r.json();
    } catch (e) {
        echecs += 1;
        manifeste.posts[id] = { erreur: String(e.message), fait: false };
        process.stderr.write('x');
        await dodo(400);
        continue;
    }

    const medias = json.mediaDetails || json.photos || [];
    const entree = {
        fait: true,
        date: json.created_at,
        auteur: json.user?.screen_name,
        texte: (json.text || '').slice(0, 280),
        likes: json.favorite_count,
        fichiers: [],
    };

    let n = 0;
    for (const m of medias) {
        const type = m.type || (m.url?.includes('video') ? 'video' : 'photo');
        if (type !== 'photo') { videos += 1; continue; }
        const base = m.media_url_https || m.url;
        if (!base) continue;
        n += 1;
        const ext = path.extname(new URL(base).pathname) || '.jpg';
        const nom = `${id}-${n}${ext}`;
        const cible = path.join(sortie, nom);
        if (!fs.existsSync(cible)) {
            const urlOrig = `${base.replace(/\.(jpg|png|webp)$/i, '')}?format=${ext.slice(1)}&name=orig`;
            try {
                const rp = await fetch(urlOrig, { headers: { 'User-Agent': UA } });
                if (!rp.ok) throw new Error(`http ${rp.status}`);
                fs.writeFileSync(cible, Buffer.from(await rp.arrayBuffer()));
            } catch (e) {
                echecs += 1;
                process.stderr.write('!');
                continue;
            }
        }
        entree.fichiers.push(nom);
        photos += 1;
    }

    manifeste.posts[id] = entree;
    process.stderr.write(entree.fichiers.length ? '.' : '_');
    if ((i + 1) % 25 === 0) {
        fs.writeFileSync(cheminManifeste, JSON.stringify(manifeste, null, 1));
        process.stderr.write(` ${i + 1}/${ids.length}\n`);
    }
    await dodo(250);
}

fs.writeFileSync(cheminManifeste, JSON.stringify(manifeste, null, 1));
console.error(`\n\n${ids.length} posts lus`);
console.log(`photos telechargees : ${photos}`);
console.log(`videos ignorees     : ${videos}`);
console.log(`posts deja faits    : ${deja}`);
console.log(`echecs              : ${echecs}`);
console.log(`\n-> ${sortie}`);
