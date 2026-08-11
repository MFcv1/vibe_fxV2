/*
 * Recupere le corpus de photos qui a servi a reconstruire le preset `powlisher`.
 *
 *   node scripts/fetch-powlisher-corpus.mjs [dossier]
 *
 * Pourquoi un script plutot que les fichiers dans le depot: ces photos ne sont
 * pas les notres. Les embarquer dans un depot destine a devenir un produit
 * public serait une redistribution. Ici on garde la RECETTE (les identifiants de
 * tweets, publics, et la facon de les lire) et chacun refait le telechargement
 * en local, dans un dossier ignore par git.
 *
 * La source: x.com renvoie 402 aux robots, mais l'API publique de syndication
 * (`cdn.syndication.twimg.com/tweet-result`) sert le JSON d'un tweet sans
 * authentification. On y lit les URL des medias, qu'on retelecharge en
 * RESOLUTION D'ORIGINE via `?name=orig` — indispensable: les variantes
 * redimensionnees sont reechantillonnees, donc inutilisables pour mesurer une
 * colorimetrie.
 *
 * Le detail des mesures faites sur ces images:
 * docs/audit-preset-powlisher-2026-08-11.md
 *
 * Les images atterrissent dans docs/lightroom/corpus-powlisher/, dont seul le
 * README est versionne.
 */

import fs from 'node:fs';
import path from 'node:path';

/*
 * Les tweets, dans l'ordre du tableau de l'audit. Les 19 premieres images
 * forment le corpus de reference; les 8 dernieres n'ont servi qu'a etablir la
 * filiation du look (il y nomme son preset), pas a mesurer.
 */
/*
 * `attendu` verrouille la numerotation: l'audit cite les images par leur numero
 * (« img12 (helico) », « img13 (avion) », « img16 (Marrakech) »), donc l'ordre
 * ET le compte doivent etre reproduits a l'identique, sinon les mesures ne
 * renvoient plus aux bonnes photos. Le script previent si le compte change.
 *
 * `citation` : ne suivre le tweet CITE que la ou le corpus d'origine l'a fait.
 * Plusieurs de ces tweets en citent un autre qui porte d'autres photos — les
 * ramasser gonflerait le corpus et decalerait toute la numerotation.
 */
const TWEETS = [
    ['2036584871699558738', 'Sony A7R3 / nostalgie', 'reference', 4, false],
    ['2036584883842122240', 'dont la Lamborghini', 'reference', 3, false],
    ['2036584893828694093', 'portraits / NYC Vessel', 'reference', 3, false],
    ['2036584904557826543', 'dont helico Biarritz', 'reference', 2, false],
    ['2042671123788070968', 'prise d\'avion (Paris, iPhone 17 Pro)', 'reference', 1, false],
    ['2014712191803404484', 'interieur WeWork New York', 'reference', 2, false],
    ['2014086419535319150', 'Marrakech (via le tweet cite)', 'reference', 4, true],
    ['1988657267739406751', 'il nomme son preset : Lightroom « Cinema 2 »', 'filiation', 8, true],

    /*
     * AJOUTS 2026-08-12, demandes par le porteur du projet pour combler le trou
     * du corpus d'origine: il n'y avait que 3 ou 4 vrais paysages avec du ciel,
     * alors que c'est precisement l'usage de l'app (mer, calanque, terrasse).
     * Numerotes a partir de 28: les numeros 1-27 restent figes sur le corpus
     * d'origine, sinon les mesures de l'audit ne renverraient plus aux bonnes
     * photos.
     */
    ['2004212061937799207', 'nuit / ville', 'reference', 4, false],
    ['2004052932464115850', 'ville (Sony A7R V)', 'reference', 2, false],
    ['2036322282742661179', 'moto (Sony A7R V)', 'reference', 1, false],
];

/*
 * Le tri fait a la main par le porteur du projet, reinscrit ici pour qu'un
 * `fetch` refasse EXACTEMENT le dossier au lieu de tout ramener.
 *
 * - 04 et 09: portraits studio/interieur, ecartes pour recentrer le corpus sur
 *   l'architecture, le paysage et la voiture.
 * - 20 a 27 (role `filiation`): captures d'ecran de Lightroom mobile et station
 *   service de nuit. Elles servaient a montrer d'ou vient le look, pas a
 *   mesurer une couleur — le chrome sombre de l'interface fausse toute mesure.
 *
 * `--tout` les recupere quand meme.
 */
const EXCLUS = new Set([4, 9]);
const ROLES_EXCLUS = new Set(['filiation']);
const tout = process.argv.includes('--tout');

/*
 * Le corpus comprenait aussi 50 frames extraites d'une video ou il montre ses
 * reglages Lightroom (tweet 2069450546025754646, 1 image / 0,25 s). Elles n'ont
 * servi qu'a LIRE ses curseurs a l'ecran, pas a mesurer des couleurs — le chrome
 * sombre de l'interface fausse toute mesure globale. Ce script ne les recupere
 * pas: il faudrait rejouer une extraction video, et elles n'apportent rien a la
 * colorimetrie.
 */

const outputDir = process.argv.find((a) => !a.startsWith('--') && a.endsWith('corpus-powlisher'))
    || 'docs/lightroom/corpus-powlisher';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

fs.mkdirSync(outputDir, { recursive: true });

let index = 0;
let failures = 0;
let ignores = 0;
const manifest = [];

for (const [id, sujet, role, attendu, citation] of TWEETS) {
    const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a`;
    let tweet;
    try {
        const response = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        tweet = await response.json();
    } catch (error) {
        console.error(`  ECHEC tweet ${id} (${sujet}) : ${error.message}`);
        failures += 1;
        continue;
    }

    /*
     * Les medias vivent a trois endroits selon le tweet: `mediaDetails`,
     * `photos`, ou — cas de Marrakech — dans le tweet CITE, quand l'auteur
     * republie ses propres photos en les commentant.
     */
    const collect = (node) => {
        if (!node) return [];
        if (node.mediaDetails?.length) return node.mediaDetails;
        return (node.photos || []).map((p) => ({ media_url_https: p.url, type: 'photo' }));
    };
    const medias = citation
        ? [...collect(tweet), ...collect(tweet.quoted_tweet)]
        : collect(tweet);

    /* Une meme image peut apparaitre dans le tweet ET dans sa citation. */
    const seen = new Set();
    const photos = medias.filter((m) => {
        if (m.type !== 'photo' || !m.media_url_https) return false;
        if (seen.has(m.media_url_https)) return false;
        seen.add(m.media_url_https);
        return true;
    });
    if (!photos.length) {
        console.error(`  aucun media dans le tweet ${id} (${sujet})`);
        failures += 1;
        continue;
    }
    if (photos.length !== attendu) {
        console.error(
            `  ATTENTION tweet ${id} (${sujet}) : ${photos.length} image(s) au lieu de ${attendu}.`
            + '\n  La numerotation ne correspondra plus a celle de l\'audit.',
        );
        failures += 1;
    }

    for (const media of photos) {
        index += 1;
        /* Numerotation figee: on incremente TOUJOURS, meme sur une image ecartee. */
        if (!tout && (EXCLUS.has(index) || ROLES_EXCLUS.has(role))) {
            ignores += 1;
            continue;
        }
        /* `?name=orig` = resolution d'origine. Toute autre variante est reechantillonnee. */
        const base = media.media_url_https.replace(/\.(jpg|jpeg|png)$/i, '');
        const ext = (media.media_url_https.match(/\.(jpg|jpeg|png)$/i) || ['.jpg'])[0];
        const source = `${base}${ext}?name=orig`;
        const name = `img${String(index).padStart(2, '0')}-${role}.jpg`;
        const target = path.join(outputDir, name);

        try {
            const response = await fetch(source, { headers: { 'User-Agent': UA } });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(target, bytes);
            manifest.push({ name, tweet: id, sujet, role, octets: bytes.length });
            console.log(`  ${name.padEnd(26)} ${(bytes.length / 1024).toFixed(0).padStart(5)} ko   ${sujet}`);
        } catch (error) {
            console.error(`  ECHEC ${name} : ${error.message}`);
            failures += 1;
        }
    }
}

fs.writeFileSync(
    path.join(outputDir, 'manifeste.json'),
    `${JSON.stringify({ recupere: new Date().toISOString(), images: manifest }, null, 2)}\n`,
    'utf8',
);

console.log(`\n${manifest.length} image(s) dans ${outputDir}/`);
if (ignores) console.log(`${ignores} ecartee(s) par le tri du corpus (--tout pour les avoir).`);
if (failures) {
    console.log(
        `${failures} echec(s). Si tout echoue, c'est que l'API de syndication a change ou`
        + '\nque les tweets ont ete supprimes — le corpus n\'est alors plus recuperable, et'
        + '\nles mesures de docs/audit-preset-powlisher-2026-08-11.md font foi.',
    );
}
console.log('Ce dossier est ignore par git: ces photos ne sont pas les notres.\n');
