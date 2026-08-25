/* La teinte posee sur ce qui devrait etre gris, par tranche de luminosite, chez
 * lui MOINS chez le tas neutre. En ecart et pas en absolu: un tas de photos
 * anciennes ou de peintures vernies a lui aussi un cast chaud, et le prendre
 * pour son geste serait une erreur. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
const BANDES = [[0, 33], [33, 66], [66, 101]];

async function mesure(dossier) {
    const fichiers = fs.readdirSync(dossier).filter((f) => /\.jpe?g$/i.test(f));
    const acc = BANDES.map(() => ({ n: 0, a: 0, b: 0 }));
    for (const f of fichiers) {
        const { data } = await sharp(path.join(dossier, f)).rotate()
            .resize(384, 384, { fit: 'inside', withoutEnlargement: true })
            .removeAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = 0; i < data.length; i += 3) {
            const [L, A, B] = lab(data[i], data[i + 1], data[i + 2]);
            if (Math.hypot(A, B) > 12) continue;      // colore: ce n'est pas un gris
            if (L < 4 || L > 97) continue;            // noir bouche / blanc: pas de teinte fiable
            for (let k = 0; k < 3; k += 1) {
                if (L >= BANDES[k][0] && L < BANDES[k][1]) { acc[k].n += 1; acc[k].a += A; acc[k].b += B; break; }
            }
        }
    }
    return acc.map((x) => (x.n ? [x.a / x.n, x.b / x.n] : null));
}

const base = `${process.env.HOME}/Desktop/powlisher-biblio`;
const med = (xs) => { const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
const familles = fs.readdirSync(`${base}/par-sujet`)
    .filter((f) => fs.statSync(`${base}/par-sujet/${f}`).isDirectory())
    .filter((f) => fs.existsSync(`${base}/neutre/${f}`)
        && fs.readdirSync(`${base}/neutre/${f}`).filter((x) => /\.jpe?g$/i.test(x)).length >= 15
        && fs.readdirSync(`${base}/par-sujet/${f}`).filter((x) => /\.jpe?g$/i.test(x)).length >= 15);

const ecarts = [[], [], []].map(() => ({ a: [], b: [] }));
console.log('famille        ombres a/b        medians a/b       clairs a/b     (lui - neutre)');
for (const f of familles) {
    const L = await mesure(`${base}/par-sujet/${f}`);
    const N = await mesure(`${base}/neutre/${f}`);
    const ligne = [];
    for (let k = 0; k < 3; k += 1) {
        if (!L[k] || !N[k]) { ligne.push('   —      '); continue; }
        const da = L[k][0] - N[k][0], db = L[k][1] - N[k][1];
        ecarts[k].a.push(da); ecarts[k].b.push(db);
        ligne.push(`${da >= 0 ? '+' : ''}${da.toFixed(1)} / ${db >= 0 ? '+' : ''}${db.toFixed(1)}`.padStart(14));
    }
    console.log(f.padEnd(14) + ligne.join(''));
}
console.log('\nMEDIANE'.padEnd(14) + [0, 1, 2].map((k) => {
    const a = med(ecarts[k].a), b = med(ecarts[k].b);
    return `${a >= 0 ? '+' : ''}${a.toFixed(1)} / ${b >= 0 ? '+' : ''}${b.toFixed(1)}`.padStart(14);
}).join(''));
fs.writeFileSync(`${base}/etalonnage.json`, JSON.stringify(
    [0, 1, 2].map((k) => ({ a: +med(ecarts[k].a).toFixed(2), b: +med(ecarts[k].b).toFixed(2) })), null, 1));
