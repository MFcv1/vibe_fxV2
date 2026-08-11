/*
 * Hald CLUT — capturer EXACTEMENT ce que fait un editeur externe.
 *
 * Le principe, qui est un classique de l'etalonnage:
 * une image Hald CLUT contient une fois chaque couleur d'une grille reguliere
 * de l'espace RVB. Si on la fait passer telle quelle dans Lightroom avec un
 * preset applique, l'image qui ressort donne, pour chaque couleur d'entree, la
 * couleur de sortie correspondante. **L'image resultante EST la table de
 * conversion du preset.**
 *
 * On n'approxime donc rien: pas besoin de reimplementer le moteur d'Adobe, ni
 * de deviner comment il enchaine exposition, courbe, melangeur et etalonnage.
 * On mesure le resultat, exactement comme on a mesure les photos de @powl_d,
 * mais cette fois avec une couverture complete et une entree connue.
 *
 * Limite a connaitre, et elle est nette: une Hald CLUT ne capture que ce qui
 * est une fonction PIXEL A PIXEL. Tout ce qui depend des pixels voisins ou de
 * la position dans l'image — clarte, texture, nettete, reduction de bruit,
 * grain, vignetage — n'y laisse aucune trace. Ces reglages-la sont recuperes
 * separement en lisant le `.xmp` (voir `xmpPreset.js`).
 *
 * Niveau 8 = cube de 64 couleurs par axe, dans une image de 512x512.
 * (64^3 = 262144 = 512^2.)
 */

/* Taille du cube pour un niveau Hald donne: cube = level^2. */
export const haldCubeSize = (level) => level * level;

/* Cote de l'image carree pour un niveau donne: cube^3 pixels au total. */
export function haldImageSize(level) {
    const cube = haldCubeSize(level);
    return Math.round(Math.sqrt(cube * cube * cube));
}

/*
 * Genere l'image Hald CLUT « neutre »: la table identite.
 * Renvoie un buffer RGB (3 octets par pixel), pret pour sharp.
 *
 * L'ordre est celui de la convention Hald, et c'est le meme que celui de nos
 * LUT (`lut3d.js`): le rouge varie le plus vite, puis le vert, puis le bleu.
 */
export function buildHaldIdentity(level = 8) {
    const cube = haldCubeSize(level);
    const last = cube - 1;
    const total = cube * cube * cube;
    const data = new Uint8Array(total * 3);
    let i = 0;
    for (let b = 0; b < cube; b += 1) {
        for (let g = 0; g < cube; g += 1) {
            for (let r = 0; r < cube; r += 1) {
                data[i] = Math.round((r / last) * 255);
                data[i + 1] = Math.round((g / last) * 255);
                data[i + 2] = Math.round((b / last) * 255);
                i += 3;
            }
        }
    }
    return { data, size: haldImageSize(level), cube };
}

/*
 * Lit une Hald CLUT traitee et la reechantillonne vers une LUT 3D de la taille
 * utilisee par le moteur (33 par defaut).
 *
 * `pixels` : buffer RGB (3 octets/pixel) de l'image traitee.
 * `level`  : le niveau Hald de l'image d'origine (8 par defaut).
 *
 * On reechantillonne par interpolation trilineaire plutot que par simple
 * decimation: le cube source (64) n'est pas un multiple du cube cible (33), et
 * prendre le point le plus proche introduirait un biais visible dans les
 * degrades.
 */
export function haldToLut3d(pixels, level = 8, targetSize = 33) {
    const cube = haldCubeSize(level);
    const expected = cube * cube * cube * 3;
    if (pixels.length !== expected) {
        throw new Error(
            `Hald CLUT invalide: ${pixels.length} octets pour un niveau ${level}, `
            + `${expected} attendus (image ${haldImageSize(level)}x${haldImageSize(level)}).`,
        );
    }

    const sampleSource = (r, g, b, out) => {
        /* Coordonnees continues dans le cube source. */
        const last = cube - 1;
        const fr = r * last;
        const fg = g * last;
        const fb = b * last;
        let r0 = Math.min(last - 1, Math.max(0, Math.floor(fr)));
        let g0 = Math.min(last - 1, Math.max(0, Math.floor(fg)));
        let b0 = Math.min(last - 1, Math.max(0, Math.floor(fb)));
        if (last === 0) { r0 = 0; g0 = 0; b0 = 0; }
        const dr = fr - r0;
        const dg = fg - g0;
        const db = fb - b0;
        out[0] = 0; out[1] = 0; out[2] = 0;
        for (let ob = 0; ob <= 1; ob += 1) {
            for (let og = 0; og <= 1; og += 1) {
                for (let or = 0; or <= 1; or += 1) {
                    const w = (or ? dr : 1 - dr) * (og ? dg : 1 - dg) * (ob ? db : 1 - db);
                    if (w === 0) continue;
                    const index = (((b0 + ob) * cube + (g0 + og)) * cube + (r0 + or)) * 3;
                    out[0] += pixels[index] * w;
                    out[1] += pixels[index + 1] * w;
                    out[2] += pixels[index + 2] * w;
                }
            }
        }
    };

    const targetLast = targetSize - 1;
    const lut = new Uint8ClampedArray(targetSize * targetSize * targetSize * 3);
    const sample = [0, 0, 0];
    let i = 0;
    for (let b = 0; b < targetSize; b += 1) {
        for (let g = 0; g < targetSize; g += 1) {
            for (let r = 0; r < targetSize; r += 1) {
                sampleSource(r / targetLast, g / targetLast, b / targetLast, sample);
                lut[i] = sample[0];
                lut[i + 1] = sample[1];
                lut[i + 2] = sample[2];
                i += 3;
            }
        }
    }
    return lut;
}

/*
 * Mesure a quel point une Hald CLUT traitee s'ecarte de l'identite.
 * Sert de garde-fou a l'import: si l'ecart est nul, c'est que l'export a ete
 * fait sans appliquer le preset — erreur facile a commettre et impossible a
 * voir a l'œil sur une Hald CLUT.
 */
export function measureHaldDeviation(pixels, level = 8) {
    const identity = buildHaldIdentity(level).data;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < pixels.length; i += 1) {
        const delta = Math.abs(pixels[i] - identity[i]);
        sum += delta;
        if (delta > max) max = delta;
    }
    return { mean: sum / pixels.length, max };
}

/* Encodage/decodage base64 d'une LUT, pour la stocker dans un module JS. */
export function lutToBase64(lut) {
    return Buffer.from(lut.buffer, lut.byteOffset, lut.length).toString('base64');
}

export function lutFromBase64(text) {
    const buffer = typeof Buffer !== 'undefined'
        ? Buffer.from(text, 'base64')
        : Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.length);
}
