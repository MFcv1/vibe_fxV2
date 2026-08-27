/*
 * La recette complete d'un SOUS-ENSEMBLE de ses photos, mesuree comme l'a ete
 * `powlisher-cine` — mais sur le tas qu'on lui donne au lieu du corpus entier.
 *
 *   node scripts/mesurer-variante.mjs --famille mer
 *   node scripts/mesurer-variante.mjs --liste <fichier.json> --nom doux
 *
 * `powlisher-cine` a ete tire du corpus entier par quatre mesures: transport de
 * tonalite, etalonnage des gris, rotation des teintes par secteur, chroma par
 * bande. Chacune vivait dans un script different, et aucun ne savait travailler
 * sur autre chose que « tout ». Pour fabriquer des variantes il faut pouvoir
 * poser exactement les memes questions a un tas plus petit — une famille de
 * sujet, ou un pole de l'axe de developpement. C'est ce que fait ce script.
 *
 * LE TAS D'EN FACE EST APPARIE PAR SUJET. C'est la precaution qui rend la mesure
 * honnete: si le sous-ensemble contient 30 % d'interieurs, le tas neutre auquel
 * on le compare en contient 30 % aussi. Sans ca, comparer un pole riche en
 * scenes de nuit a un tas neutre moyen mesurerait la nuit, pas le traitement.
 *
 * Les angles de rotation sont pris famille par famille puis medianes, et remis
 * a zero quand les familles ne s'accordent pas (mediane inferieure a la
 * dispersion). Un secteur ou les familles se contredisent ne dit rien du
 * traitement: il dit ce qu'il y a dans le cadre.
 *
 * LES BANDES SONT DES RANGS, PAS DES NIVEAUX. C'est la correction du 2026-08-27,
 * et elle vient d'un preset rate: `powlisher-cine-doux` saturait les murs ocres
 * d'une cour marocaine jusqu'au rouge. La cause n'etait pas le preset, c'etait
 * la mesure. Comparer « sa bande L 66-101 » a « leur bande L 66-101 » compare
 * deux contenus differents: ses photos sont plus sombres, donc sa bande haute ne
 * contient que quelques speculaires — souvent un couchant — la ou celle du tas
 * neutre contient tout le ciel et les murs blancs. Le rapport de chroma sortait
 * a 2,1 alors qu'il ne mesurait qu'un changement de contenu.
 *
 * On decoupe donc chaque tas a SES PROPRES tiers de luminosite. Le tiers clair
 * de l'un est compare au tiers clair de l'autre, quelles que soient les valeurs
 * absolues. C'est exactement le principe de l'appariement de quantiles deja
 * utilise pour la courbe de tonalite, applique a la couleur.
 *
 * Entree/sortie hors depot: ~/Desktop/powlisher-biblio/.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const BIBLIO = path.join(os.homedir(), 'Desktop', 'powlisher-biblio');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const COTE = 384;          // les moyennes de teinte ne bougent pas en dessous
const CHROMA_MIN = 12;     // au-dela: le pixel est colore, il a une teinte
const GRIS_MAX = 12;       // en deca: le pixel est un gris, il porte l'etalonnage
const SECTEURS = 12;       // 30 degres chacun
const BANDES = ['ombres', 'medians', 'clairs'];   // des TIERS DE PIXELS, pas des tranches de L
/* La bande des REFLETS: les 10 % de pixels les plus lumineux. Elle chevauche le
 * tiers clair et c'est voulu — un tiers, c'est trop large pour decrire ce que
 * devient une source de lumiere. Le tiers clair d'une photo contient un mur au
 * soleil; ses 10 % du haut contiennent la lampe. Les deux ne portent pas la
 * meme teinte, et un preset qui ne connait que le tiers rate justement ce qui
 * fait le rendu. */
const PART_REFLETS = 0.10;

const srgbToLin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function lab(r, g, b) {
    const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* Un accumulateur par tas. Tout est range PAR NIVEAU DE L (101 casiers), et les
 * trois bandes ne sont formees qu'a la fin, une fois qu'on sait ou tombent les
 * tiers de CE tas. Une seule passe pixel malgre tout. */
const NIV = 101;
function neufAcc() {
    return {
        luma: new Float64Array(256),
        n: new Float64Array(NIV),
        grisN: new Float64Array(NIV),
        grisA: new Float64Array(NIV),
        grisB: new Float64Array(NIV),
        chromaS: new Float64Array(NIV),
        /* teinte: somme vectorielle ponderee par la chroma, par secteur ET par
         * niveau. La moyenne d'angles se fait en vecteurs, jamais en degres: la
         * moyenne de 350 et 10 n'est pas 180. */
        teinteX: Array.from({ length: NIV }, () => new Float64Array(SECTEURS)),
        teinteY: Array.from({ length: NIV }, () => new Float64Array(SECTEURS)),
        teinteC: Array.from({ length: NIV }, () => new Float64Array(SECTEURS)),
        teinteN: Array.from({ length: NIV }, () => new Float64Array(SECTEURS)),
    };
}

/* Les deux seuils de L qui coupent CE tas en trois tiers de pixels, plus celui
 * qui isole ses reflets. */
function tiersDe(acc) {
    const total = acc.n.reduce((a, b) => a + b, 0) || 1;
    const seuils = [];
    let cumul = 0;
    let reflets = NIV - 1;
    for (let L = 0; L < NIV; L += 1) {
        cumul += acc.n[L];
        while (seuils.length < 2 && cumul / total >= (seuils.length + 1) / 3) seuils.push(L);
        if (reflets === NIV - 1 && cumul / total >= 1 - PART_REFLETS) reflets = L;
    }
    while (seuils.length < 2) seuils.push(NIV - 1);
    return [...seuils, reflets];
}

/* Replie les 101 niveaux en trois bandes, selon les seuils du tas. */
function replier(acc) {
    const [s1, s2, sR] = tiersDe(acc);
    const bande = (L) => (L <= s1 ? 0 : L <= s2 ? 1 : 2);
    const out = {
        seuils: [s1, s2, sR],
        reflets: { n: 0, a: 0, b: 0 },
        gris: [0, 1, 2].map(() => ({ n: 0, a: 0, b: 0 })),
        chroma: [0, 1, 2].map(() => ({ n: 0, c: 0 })),
        teinte: [0, 1, 2].map(() => Array.from({ length: SECTEURS }, () => ({ x: 0, y: 0, c: 0, n: 0 }))),
    };
    for (let L = 0; L < NIV; L += 1) {
        if (L >= sR) { out.reflets.n += acc.grisN[L]; out.reflets.a += acc.grisA[L]; out.reflets.b += acc.grisB[L]; }
        const k = bande(L);
        out.gris[k].n += acc.grisN[L]; out.gris[k].a += acc.grisA[L]; out.gris[k].b += acc.grisB[L];
        out.chroma[k].n += acc.n[L]; out.chroma[k].c += acc.chromaS[L];
        for (let s = 0; s < SECTEURS; s += 1) {
            out.teinte[k][s].x += acc.teinteX[L][s];
            out.teinte[k][s].y += acc.teinteY[L][s];
            out.teinte[k][s].c += acc.teinteC[L][s];
            out.teinte[k][s].n += acc.teinteN[L][s];
        }
    }
    return out;
}

async function avaler(acc, fichier) {
    const { data } = await sharp(fichier).rotate()
        .resize(COTE, COTE, { fit: 'inside', withoutEnlargement: true })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        acc.luma[y] += 1;
        const [L, A, B] = lab(r, g, b);
        const k = Math.max(0, Math.min(NIV - 1, Math.round(L)));
        const c = Math.hypot(A, B);
        acc.n[k] += 1; acc.chromaS[k] += c;
        if (L >= 4 && L <= 97 && c <= GRIS_MAX) {
            acc.grisN[k] += 1; acc.grisA[k] += A; acc.grisB[k] += B;
        }
        if (c >= CHROMA_MIN) {
            let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
            const s = Math.min(SECTEURS - 1, Math.floor(h / (360 / SECTEURS)));
            acc.teinteX[k][s] += c * Math.cos(h * Math.PI / 180);
            acc.teinteY[k][s] += c * Math.sin(h * Math.PI / 180);
            acc.teinteC[k][s] += c;
            acc.teinteN[k][s] += 1;
        }
    }
}

const angleMoyen = (t) => (t.c ? (Math.atan2(t.y, t.x) * 180 / Math.PI + 360) % 360 : NaN);
const ecartAngle = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? ((a - b + 540) % 360) - 180 : NaN);
const med = (xs) => { const t = xs.filter(Number.isFinite).sort((a, b) => a - b); return t.length ? (t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2) : NaN; };

/* Appariement de quantiles entre deux histogrammes de luminance. */
function transport(hLui, hNeutre) {
    const cdf = (h) => { const s = h.reduce((a, v) => a + v, 0) || 1; let a = 0; return Array.from(h, (v) => (a += v) / s); };
    const cL = cdf(hLui), cN = cdf(hNeutre);
    const out = new Array(256);
    let j = 0;
    for (let x = 0; x < 256; x += 1) {
        const p = cN[x];
        while (j < 255 && cL[j] < p) j += 1;
        out[x] = j;
    }
    return out;
}

/* --- quel tas, et en face de quoi -------------------------------------- */
const nom = opt('nom', opt('famille', 'tout'));
let parFamille;   // { famille: [chemins] }
if (opt('famille', null)) {
    const f = opt('famille');
    parFamille = { [f]: fs.readdirSync(path.join(BIBLIO, 'par-sujet', f)).filter((x) => /\.(jpe?g|png|webp)$/i.test(x)) };
} else {
    const liste = JSON.parse(fs.readFileSync(opt('liste'), 'utf8'));
    parFamille = {};
    for (const { fam, f } of liste) (parFamille[fam] ||= []).push(f);
}

const MIN = Number(opt('min', 10));
let familles = Object.keys(parFamille)
    .filter((f) => parFamille[f].length >= MIN && fs.existsSync(path.join(BIBLIO, 'neutre', f)));

/* UNE SEULE FAMILLE: l'accord entre familles n'existe plus, et sans lui rien ne
 * distingue un angle mesure d'un angle de bruit. On le remplace par le meme test
 * a l'interieur de la famille — trois tiers tires en alternance, qui doivent
 * dire la meme chose. Un secteur ou les tiers se contredisent est du decor,
 * exactement comme un secteur ou les familles se contredisaient. */
const tiers = new Map();
if (familles.length === 1) {
    const f = familles[0];
    const tout = parFamille[f].slice().sort();
    parFamille = {};
    for (let i = 0; i < 3; i += 1) {
        const nomTiers = `${f}#${i + 1}`;
        parFamille[nomTiers] = tout.filter((_, j) => j % 3 === i);
        tiers.set(nomTiers, f);
    }
    familles = Object.keys(parFamille);
}
const dossierDe = (f) => tiers.get(f) || f;

const resultatParFamille = {};
const accLuiTout = neufAcc(), accNeutreTout = neufAcc();

for (const f of familles) {
    const accL = neufAcc(), accN = neufAcc();
    for (const x of parFamille[f]) await avaler(accL, path.join(BIBLIO, 'par-sujet', dossierDe(f), x));
    /* Le tas d'en face est ECHANTILLONNE a la meme taille que le sien: sans ca
     * une famille ou il a 67 photos et le neutre 40 pese deux fois plus dans la
     * mediane finale d'un cote que de l'autre. */
    const neutres = fs.readdirSync(path.join(BIBLIO, 'neutre', dossierDe(f))).filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).sort();
    for (const x of neutres) await avaler(accN, path.join(BIBLIO, 'neutre', dossierDe(f), x));

    for (const [a, tot] of [[accL, accLuiTout], [accN, accNeutreTout]]) {
        /* Chaque famille compte pour un: on normalise avant d'additionner, sinon
         * `auto` (67 photos) dicterait le resultat. */
        const poids = 1 / (a.luma.reduce((x, v) => x + v, 0) || 1);
        for (let i = 0; i < 256; i += 1) tot.luma[i] += a.luma[i] * poids;
        for (let L = 0; L < NIV; L += 1) {
            tot.n[L] += a.n[L] * poids;
            tot.grisN[L] += a.grisN[L] * poids; tot.grisA[L] += a.grisA[L] * poids; tot.grisB[L] += a.grisB[L] * poids;
            tot.chromaS[L] += a.chromaS[L] * poids;
            for (let sc = 0; sc < SECTEURS; sc += 1) {
                tot.teinteX[L][sc] += a.teinteX[L][sc] * poids;
                tot.teinteY[L][sc] += a.teinteY[L][sc] * poids;
                tot.teinteC[L][sc] += a.teinteC[L][sc] * poids;
                tot.teinteN[L][sc] += a.teinteN[L][sc] * poids;
            }
        }
    }

    /* Chaque tas est coupe a SES tiers: le tiers clair de l'un se compare au
     * tiers clair de l'autre, meme si l'un est globalement plus sombre. */
    const rL = replier(accL), rN = replier(accN);
    resultatParFamille[f] = {
        n: parFamille[f].length,
        seuils: { lui: rL.seuils, neutre: rN.seuils },
        etalReflets: [
            rL.reflets.n && rN.reflets.n ? rL.reflets.a / rL.reflets.n - rN.reflets.a / rN.reflets.n : NaN,
            rL.reflets.n && rN.reflets.n ? rL.reflets.b / rL.reflets.n - rN.reflets.b / rN.reflets.n : NaN,
        ],
        etal: BANDES.map((_, k) => [
            rL.gris[k].n ? rL.gris[k].a / rL.gris[k].n - rN.gris[k].a / rN.gris[k].n : NaN,
            rL.gris[k].n ? rL.gris[k].b / rL.gris[k].n - rN.gris[k].b / rN.gris[k].n : NaN,
        ]),
        rot: BANDES.map((_, k) => Array.from({ length: SECTEURS }, (_2, sc) => {
            const cl = rL.teinte[k][sc].c, cn = rN.teinte[k][sc].c;
            if (cl < 1e4 || cn < 1e4) return NaN;   // secteur presque vide: rien a dire
            return ecartAngle(angleMoyen(rL.teinte[k][sc]), angleMoyen(rN.teinte[k][sc]));
        })),
        /* LE RAPPORT DE CHROMA SE PREND TEINTE PAR TEINTE, PUIS ON EN GARDE LA
         * MEDIANE. C'est la seconde correction du 2026-08-27, et elle vient du
         * meme preset rate. Le rapport pris sur TOUS les pixels d'une bande
         * repond a « sa bande claire est-elle plus coloree que la leur ? » — et
         * la reponse peut etre oui juste parce qu'il photographie des couchants
         * et eux des ciels blancs. Le rapport pris DANS CHAQUE SECTEUR de teinte
         * repond a « pour un jaune donne, le pose-t-il plus sature ? », ce qui
         * est la question qu'un preset peut executer.
         *
         * Si les douze secteurs s'accordent, il sature vraiment. Si un seul
         * secteur s'envole, c'est du decor, et la mediane l'ignore. */
        chroma: BANDES.map((_, k) => {
            const parSecteur = [];
            for (let sc = 0; sc < SECTEURS; sc += 1) {
                const a = rL.teinte[k][sc], b = rN.teinte[k][sc];
                if (a.n < 500 || b.n < 500) continue;   // secteur trop peu peuple
                parSecteur.push((a.c / a.n) / (b.c / b.n));
            }
            return parSecteur.length >= 4 ? med(parSecteur) : NaN;
        }),
        chromaBrute: BANDES.map((_, k) => (rN.chroma[k].c ? (rL.chroma[k].c / rL.chroma[k].n) / (rN.chroma[k].c / rN.chroma[k].n) : NaN)),
    };
    process.stderr.write(`${f}: ${parFamille[f].length} vs ${neutres.length}\n`);
}

const sortie = {
    nom,
    familles: Object.fromEntries(Object.entries(resultatParFamille).map(([f, v]) => [f, v.n])),
    ton: transport(accLuiTout.luma, accNeutreTout.luma),
    etal: BANDES.map((_, k) => ({
        a: +med(familles.map((f) => resultatParFamille[f].etal[k][0])).toFixed(2),
        b: +med(familles.map((f) => resultatParFamille[f].etal[k][1])).toFixed(2),
        dispA: +med(familles.map((f) => Math.abs(resultatParFamille[f].etal[k][0] - med(familles.map((g) => resultatParFamille[g].etal[k][0]))))).toFixed(2),
        dispB: +med(familles.map((f) => Math.abs(resultatParFamille[f].etal[k][1] - med(familles.map((g) => resultatParFamille[g].etal[k][1]))))).toFixed(2),
    })),
    chroma: BANDES.map((_, k) => +med(familles.map((f) => resultatParFamille[f].chroma[k])).toFixed(3)),
    etalReflets: [0, 1].map((k) => ({
        v: +med(familles.map((f) => resultatParFamille[f].etalReflets[k])).toFixed(2),
        disp: +med(familles.map((f) => Math.abs(resultatParFamille[f].etalReflets[k]
            - med(familles.map((g) => resultatParFamille[g].etalReflets[k]))))).toFixed(2),
    })),
    rot: BANDES.map((_, k) => Array.from({ length: SECTEURS }, (_2, s) => {
        const xs = familles.map((f) => resultatParFamille[f].rot[k][s]);
        const m = med(xs);
        const disp = med(xs.map((x) => Math.abs(x - m)));
        /* Les familles se contredisent: ce secteur ne parle pas du traitement. */
        const retenu = Number.isFinite(m) && Math.abs(m) > disp;
        return { centre: s * 30 + 15, angle: +(m || 0).toFixed(2), disp: +(disp || 0).toFixed(2), retenu, n: xs.filter(Number.isFinite).length };
    })),
    parFamille: resultatParFamille,
};

const dest = path.join(BIBLIO, `variante-${nom}.json`);
fs.writeFileSync(dest, JSON.stringify(sortie, null, 1));

const pts = [0, 32, 64, 96, 128, 160, 192, 208, 224, 240, 248, 255];
console.log(`\n=== ${nom} — ${Object.values(sortie.familles).reduce((a, b) => a + b, 0)} photos, ${familles.length} familles`);
console.log('ton  ' + pts.map((p) => `${p}>${sortie.ton[p]}`).join('  '));
console.log('etal ' + sortie.etal.map((e, i) => `${['ombres', 'medians', 'clairs'][i]} a${e.a}(±${e.dispA}) b${e.b}(±${e.dispB})`).join('  ')
    + `  REFLETS a${sortie.etalReflets[0].v}(±${sortie.etalReflets[0].disp}) b${sortie.etalReflets[1].v}(±${sortie.etalReflets[1].disp})`);
console.log('chroma (teinte par teinte) ' + sortie.chroma.join(' / ')
    + '   [brute, sensible au decor: ' + BANDES.map((_, k) => +med(familles.map((f) => resultatParFamille[f].chromaBrute[k])).toFixed(2)).join(' / ') + ']');
for (let k = 0; k < 3; k += 1) {
    console.log(`rot ${['ombres ', 'medians', 'clairs '][k]} ` + sortie.rot[k]
        .map((r) => `${r.centre}:${r.retenu ? r.angle : '·'}`).join(' '));
}
console.log(`-> ${dest}`);
