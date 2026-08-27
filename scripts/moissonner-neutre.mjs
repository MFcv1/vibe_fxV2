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
    /* LES FAMILLES DE COUCHANT (2026-08-27 ter). Elles ne sont pas la pour
     * elargir le tas neutre: elles sont la parce que sans elles, ses couchants
     * seraient apparies a des plages de midi et a des campagnes de plein jour.
     * On mesurerait alors « couchant contre midi » — c'est-a-dire la scene — et
     * pas son traitement. Trois sujets plutot qu'un seul: l'accord entre
     * familles est la seule chose qui distingue un angle mesure d'un angle de
     * bruit, et il n'existe pas dans une famille unique. */
    'coucher-mer': ['sunset sea beach', 'sunset coast', 'sunset ocean', 'sunrise beach', 'dusk sea', 'sunset harbour', 'sunset lake', 'sunset bay', 'sunset pier', 'sunrise sea'],
    'coucher-paysage': ['sunset landscape', 'sunset field', 'sunset countryside', 'sunset hills', 'sunset trees', 'sunset meadow', 'sunrise landscape', 'dusk landscape'],
    'coucher-ville': ['sunset city', 'sunset skyline', 'sunset town', 'dusk city', 'sunrise city'],
    'heure-bleue': ['blue hour city', 'blue hour', 'twilight city', 'dusk town'],
};

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PAR = Number(opt('par', 40));
const sortie = opt('sortie', path.join(os.homedir(), 'Desktop', 'powlisher-biblio', 'neutre'));

/* UN FILTRE SUR LE TITRE, pour les familles de couchant seulement.
 *
 * Commons indexe par LIEU, pas par heure: `sunset landscape` rend des rizieres
 * de plein midi photographiees dans une vallee dont le nom contient le mot. Une
 * planche l'a montre le 2026-08-27 ter — pres de la moitie de `coucher-paysage`
 * etait du plein jour. Un tas neutre a moitie diurne rend n'importe quel preset
 * « rechauffant »: c'est l'erreur du decor, prise par l'autre bout.
 *
 * On exige donc que l'auteur ait LUI-MEME nomme l'heure dans le titre du
 * fichier. C'est une donnee de SCENE, ecrite avant nous et sans rapport avec ce
 * qu'on mesure. Filtrer sur les pixels — « garder les photos assez chaudes » —
 * serait au contraire biaiser le tas vers la reponse cherchee, et c'est
 * exactement l'erreur symetrique.
 */
/* ET UN FILTRE NEGATIF, contre les OEUVRES D'ART. Commons est aussi un fonds de
 * musee: « sunset » y titre des centaines de toiles, de gravures et
 * d'aquarelles. Une planche en a montre cinq dans `coucher-paysage`. Une
 * peinture n'a jamais ete developpee — elle n'a ni capteur, ni courbe, ni
 * balance des blancs — et la faire entrer dans une moyenne de couleur ne mesure
 * plus une photographie du tout. C'est le seul cas ou le rejet ne porte ni sur
 * le sujet ni sur le traitement, mais sur la NATURE de l'image. */
const PAS_UNE_PRISE_DE_VUE = /painting|paintings|oil on canvas|canvas|gem\u00e4lde|gemalde|peinture|tableau|pintura|dipinto|watercolo|aquarell|drawing|dessin|sketch|engraving|etching|lithograph|woodcut|illustration|poster|artwork|museum|mus\u00e9e|museo|galerie|gallery|1[0-8]\d{2}|18\d{2}/i;

const FILTRE_TITRE = {
    'coucher-mer': /sunset|sunrise|dusk|sundown|coucher|atardecer|puesta|tramonto|sonnenunterg|abendrot|zonsonderg|solnedg/i,
    'coucher-paysage': /sunset|sunrise|dusk|sundown|coucher|atardecer|puesta|tramonto|sonnenunterg|abendrot|zonsonderg|solnedg/i,
    'coucher-ville': /sunset|sunrise|dusk|sundown|coucher|atardecer|puesta|tramonto|sonnenunterg|abendrot|zonsonderg|solnedg/i,
    'heure-bleue': /blue hour|blaue stunde|heure bleue|twilight|dusk|dammerung|d\u00e4mmerung|crepuscul/i,
};

/* UN PLAFOND PAR AUTEUR. C'est la correction du 2026-08-27 ter, et elle vient
 * d'une planche: `coucher-ville` montrait VINGT vues de la meme ville depuis la
 * meme colline. Leurs identifiants Commons se suivaient — un seul televersement,
 * une seule main, une seule seance.
 *
 * Tout le tas neutre repose sur une seule hypothese: des centaines de retouches
 * INDIVIDUELLES qui s'annulent en moyenne. Vingt fichiers d'un meme auteur ne
 * s'annulent pas, ils s'additionnent, et c'est SON etalonnage qui devient le
 * zero contre lequel on mesure. Le tas cesse alors d'etre neutre sans que rien
 * ne le signale.
 *
 * On plafonne donc par televerseur. Ce critere ne regarde pas les pixels: il ne
 * peut donc pas biaiser le tas vers une couleur. Une detection par empreinte a
 * ete essayee d'abord et rejetee — sur des couchants, qui ont tous un ciel clair
 * en haut et un sol sombre en bas, elle confondait des photos sans rapport.
 */
const MAX_PAR_AUTEUR = 3;

const UA = 'vibe-fx-preset-research/1.0 (mesure de couleur locale, aucune redistribution)';
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(sortie, { recursive: true });
const journal = {};

for (const [famille, requete] of Object.entries(REQUETES)) {
    const dossier = path.join(sortie, famille);
    fs.mkdirSync(dossier, { recursive: true });
    const deja = fs.readdirSync(dossier).filter((f) => /\.jpe?g$/i.test(f)).length;
    if (deja >= PAR) { console.log(`${famille}: deja ${deja}`); continue; }

    const requetes = Array.isArray(requete) ? requete : [requete];
    /* Le filtre de titre rejette beaucoup de candidats: il faut donc plusieurs
     * requetes et plus de pages pour atteindre le meme compte. */
    let pris = deja, vus = 0;
    const parAuteur = new Map();
    for (const q of requetes) {
      if (pris >= PAR) break;
      let page = 1;
      while (pris < PAR && page <= (FILTRE_TITRE[famille] ? 8 : 4)) {
        let json;
        try {
            /* `iiurlwidth` demande une vignette de 1600 px: les originaux de
             * Commons montent a 50 Mpx et pesent des dizaines de Mo, pour une
             * mesure qui travaille de toute facon en 512. */
            const r = await fetch(
                'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
                + '&generator=search&gsrnamespace=6&gsrlimit=50'
                + `&gsroffset=${(page - 1) * 50}`
                + `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}`
                + '&prop=imageinfo&iiprop=url|mime|size|user&iiurlwidth=1600',
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
            if (FILTRE_TITRE[famille] && !FILTRE_TITRE[famille].test(String(it.title || ''))) continue;
            if (FILTRE_TITRE[famille] && PAS_UNE_PRISE_DE_VUE.test(String(it.title || ''))) continue;
            const auteur = String(info.user || `inconnu-${it.pageid}`);
            if ((parAuteur.get(auteur) || 0) >= MAX_PAR_AUTEUR) continue;
            const url = info.thumburl || info.url;
            if (!url) continue;
            const cible = path.join(dossier, `${String(it.pageid)}.jpg`);
            if (fs.existsSync(cible)) continue;
            /* Deja jugee et ECARTEE par `verifier-neutre.mjs` (carte, schema,
             * peinture). Sans ce test, chaque nouvelle moisson la retelecharge
             * et le tri se refait a l'infini. */
            if (fs.existsSync(path.join(dossier, '_ecarte', `${String(it.pageid)}.jpg`))) continue;
            try {
                const rp = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
                if (!rp.ok) continue;
                const buf = Buffer.from(await rp.arrayBuffer());
                if (buf.length < 40000) continue;   // vignette: inexploitable pour la mesure
                fs.writeFileSync(cible, buf);
                parAuteur.set(auteur, (parAuteur.get(auteur) || 0) + 1);
                pris += 1;
                process.stderr.write('.');
            } catch { /* une image morte ne doit pas arreter la moisson */ }
            await dodo(120);
        }
        page += 1;
        await dodo(300);
      }
    }
    journal[famille] = { requete, photos: pris, candidatsVus: vus, auteurs: parAuteur.size };
    process.stderr.write(`\n${famille}: ${pris}\n`);
}

fs.writeFileSync(path.join(sortie, 'journal.json'), JSON.stringify(journal, null, 1));
console.log(`\n-> ${sortie}`);
for (const [f, j] of Object.entries(journal)) console.log(`  ${String(j.photos).padStart(3)}  ${f}`);
