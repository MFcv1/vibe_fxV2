#!/usr/bin/env node
/*
 * Moisson d'une bibliotheque musicale sous licence Creative Commons BY 4.0.
 *
 * Pourquoi ce script existe: aucune API musique gratuite n'autorise l'usage
 * commercial (Jamendo facture, Openverse se reserve le droit de facturer, FMA
 * et ccMixter ont ferme leur API, Pixabay interdit la redistribution). Une
 * licence CC-BY, elle, est IRREVOCABLE et autorise explicitement l'usage
 * commercial ET la redistribution. On constitue donc un catalogue maison une
 * fois, qu'on heberge ensuite soi-meme: plus aucune dependance a l'execution.
 *
 * Contrepartie unique de CC-BY: le credit. Chaque piste moissonnee porte donc
 * son attribution complete, non negociable, jusqu'a l'interface.
 *
 * Politesse: on s'identifie, on respecte robots.txt (verifie: /library/ est
 * autorise) et on espace les requetes. Ce script ne contourne rien.
 *
 * Usage:
 *   node scripts/moisson-musique-cc.mjs                 # tout le catalogue
 *   node scripts/moisson-musique-cc.mjs --pages 3       # test sur 3 pages
 *   node scripts/moisson-musique-cc.mjs --out chemin.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const UA = 'VibeOS-catalogue-CC/1.0 (constitution d\'un catalogue CC-BY credite; contact via scottbuckley.com.au/about/contact/)';
const DELAI_MS = 900;
const TIMEOUT_MS = 30000;

const SOURCE = {
    id: 'scott-buckley',
    artiste: 'Scott Buckley',
    site: 'https://www.scottbuckley.com.au/',
    soutien: 'https://www.patreon.com/scottbuckley',
    base: 'https://www.scottbuckley.com.au/library/',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    usageCommercial: true,
    attributionRequise: true,
};

const args = process.argv.slice(2);
const lireOption = (nom, defaut) => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};

const maxPages = Number(lireOption('pages', '0')) || Infinity;
const sortie = lireOption('out', 'docs/catalogue-musique-cc.json');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (v = '') => String(v)
    .replace(/&#8216;|&#8217;|&#039;|&#x27;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

async function recuperer(url) {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_MS);
    try {
        const reponse = await fetch(url, {
            headers: { 'user-agent': UA, accept: 'text/html' },
            signal: controleur.signal,
        });
        if (reponse.status === 404) return null;
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur ${url}`);
        return await reponse.text();
    } finally {
        clearTimeout(minuteur);
    }
}

/* Chaque piste est un <article> dont la classe porte la taxonomie posee par
   l'artiste lui-meme: genre-*, mood-*, instrumentation-*. C'est la matiere
   premiere des categories, et elle vaut mieux que n'importe quel classement
   automatique. */
function extrairePistes(html) {
    const pistes = [];
    const blocs = html.split('<article ').slice(1);

    for (const bloc of blocs) {
        const classes = bloc.match(/^id="post-(\d+)"\s+class="([^"]+)"/);
        if (!classes) continue;
        const [, id, listeClasses] = classes;

        const mp3 = bloc.match(/mp3:\s*"(https?:\/\/[^"]+\.mp3)"/)?.[1]
            || bloc.match(/(https?:\/\/[^"'\s]+\.mp3)/)?.[1];
        if (!mp3) continue;

        const lien = bloc.match(/<h2 class="post-title[^"]*">\s*<a href="([^"]+)"/)?.[1] || '';
        const titre = decode(bloc.match(/<h2 class="post-title[^"]*">\s*<a[^>]*>([^<]+)<\/a>/)?.[1] || '');
        const date = decode(bloc.match(/fa-clock-o"><\/i>([^<]+)</)?.[1] || '');
        const pochette = bloc.match(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i)?.[1] || '';

        /* WordPress suffixe les slugs en collision (`genre-pop-2`). Ce `-2`
           n'est pas une information musicale, on l'enleve. */
        const marques = (prefixe) => [...new Set(listeClasses
            .split(/\s+/)
            .filter((c) => c.startsWith(`${prefixe}-`))
            .map((c) => c.slice(prefixe.length + 1).replace(/-\d+$/, ''))
            .filter(Boolean))];

        if (!titre) continue;

        pistes.push({
            id: `sb-${id}`,
            titre,
            artiste: SOURCE.artiste,
            page: lien,
            audioUrl: mp3,
            pochetteUrl: pochette,
            publieLe: date,
            genres: marques('genre'),
            ambiances: marques('mood'),
            instruments: marques('instrumentation'),
            licence: SOURCE.licence,
            licenceUrl: SOURCE.licenceUrl,
            usageCommercial: SOURCE.usageCommercial,
            attribution: `${titre} — ${SOURCE.artiste} (${SOURCE.site}), sous licence ${SOURCE.licence}`,
        });
    }

    return pistes;
}

async function main() {
    console.log(`Moisson: ${SOURCE.artiste} — ${SOURCE.licence}`);
    console.log(`Source : ${SOURCE.base}`);
    console.log(maxPages === Infinity ? 'Etendue: catalogue complet' : `Etendue: ${maxPages} page(s) (test)`);
    console.log('');

    const toutes = [];
    const vues = new Set();
    let page = 1;

    while (page <= maxPages) {
        const url = page === 1 ? SOURCE.base : `${SOURCE.base}page/${page}/`;
        let html;
        try {
            html = await recuperer(url);
        } catch (error) {
            console.error(`  page ${page}: ${error.message} — on s'arrete la.`);
            break;
        }
        if (!html) {
            console.log(`  page ${page}: 404, fin du catalogue.`);
            break;
        }

        const pistes = extrairePistes(html).filter((p) => {
            if (vues.has(p.id)) return false;
            vues.add(p.id);
            return true;
        });

        if (!pistes.length) {
            console.log(`  page ${page}: aucune piste, fin du catalogue.`);
            break;
        }

        toutes.push(...pistes);
        console.log(`  page ${page}: ${pistes.length} pistes (total ${toutes.length})`);
        page += 1;
        if (page <= maxPages) await pause(DELAI_MS);
    }

    const compter = (champ) => {
        const compte = new Map();
        for (const p of toutes) for (const v of p[champ]) compte.set(v, (compte.get(v) || 0) + 1);
        return [...compte.entries()].sort((a, b) => b[1] - a[1]);
    };

    const catalogue = {
        genereLe: new Date().toISOString(),
        source: SOURCE,
        avertissement: 'Licence CC BY 4.0: usage commercial et redistribution autorises, attribution OBLIGATOIRE. Le champ `attribution` de chaque piste doit rester visible pour l\'utilisateur final.',
        nombrePistes: toutes.length,
        taxonomie: {
            genres: compter('genres'),
            ambiances: compter('ambiances'),
            instruments: compter('instruments'),
        },
        pistes: toutes,
    };

    const chemin = path.resolve(process.cwd(), sortie);
    await fs.mkdir(path.dirname(chemin), { recursive: true });
    await fs.writeFile(chemin, JSON.stringify(catalogue, null, 2), 'utf8');

    console.log('');
    console.log(`${toutes.length} pistes ecrites dans ${sortie}`);
    console.log('');
    console.log('Genres les plus frequents :');
    catalogue.taxonomie.genres.slice(0, 12).forEach(([g, n]) => console.log(`  ${String(n).padStart(4)}  ${g}`));
    console.log('');
    console.log('Ambiances les plus frequentes :');
    catalogue.taxonomie.ambiances.slice(0, 12).forEach(([m, n]) => console.log(`  ${String(n).padStart(4)}  ${m}`));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
