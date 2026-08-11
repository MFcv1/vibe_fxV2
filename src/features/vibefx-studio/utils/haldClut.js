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

/*
 * Mesure la RUGOSITE d'une Hald CLUT traitee: a quel point la table s'ecarte
 * localement d'une surface lisse (derivee seconde moyenne le long de chaque
 * axe du cube).
 *
 * A quoi ca sert: une transformation de couleur, meme brutale, reste LISSE —
 * deux couleurs voisines en entree donnent deux couleurs voisines en sortie.
 * Une rugosite elevee ne vient donc pas du look, elle vient d'un reglage qui
 * ajoute du BRUIT: le grain de Lightroom, principalement, qui perturbe chaque
 * pixel independamment. Sur une photo c'est l'effet recherche; sur une mire,
 * chaque pixel est une couleur differente, donc le grain corrompt la table.
 *
 * Ordre de grandeur mesure: ~0,1/255 pour un aller-retour sans preset,
 * ~1,7 pour un preset sans grain, ~16 pour un preset avec grain marque.
 */
export function measureHaldRoughness(pixels, level = 8) {
    const cube = haldCubeSize(level);
    const at = (r, g, b, c) => pixels[((b * cube + g) * cube + r) * 3 + c];
    let sum = 0;
    let count = 0;
    let max = 0;
    for (let b = 1; b < cube - 1; b += 1) {
        for (let g = 1; g < cube - 1; g += 1) {
            for (let r = 1; r < cube - 1; r += 1) {
                for (let c = 0; c < 3; c += 1) {
                    const d = Math.abs(
                        at(r - 1, g, b, c) - 2 * at(r, g, b, c) + at(r + 1, g, b, c),
                    );
                    sum += d;
                    count += 1;
                    if (d > max) max = d;
                }
            }
        }
    }
    return { mean: count ? sum / count : 0, max };
}

/*
 * Lisse le cube capture pour retirer ce bruit, avant d'en tirer une LUT.
 *
 * Noyau [1,2,1] applique separement sur chaque axe, `passes` fois. C'est
 * volontairement doux: a un passage, l'influence porte sur +/- une cellule du
 * cube 64, soit +/- 4 valeurs sur 255 en entree. Assez pour effacer un bruit
 * aleatoire de moyenne nulle, trop peu pour aplatir une vraie courbe — une
 * courbe de tonalite, meme raide, varie lentement a cette echelle.
 *
 * Ce qu'on perd volontairement ici (le grain) est recupere a sa vraie place,
 * en tant qu'effet spatial, via le `.xmp` -> `filters.grain`.
 */
export function smoothHaldCube(pixels, level = 8, passes = 1) {
    const cube = haldCubeSize(level);
    let src = Float32Array.from(pixels);
    let dst = new Float32Array(src.length);
    const index = (r, g, b, c) => ((b * cube + g) * cube + r) * 3 + c;

    /* Un passage = un lissage [1,2,1] sur R, puis sur G, puis sur B. */
    for (let pass = 0; pass < passes; pass += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
            for (let b = 0; b < cube; b += 1) {
                for (let g = 0; g < cube; g += 1) {
                    for (let r = 0; r < cube; r += 1) {
                        /* Voisins le long de l'axe courant, bornes aux extremites. */
                        const step = [
                            [Math.max(0, r - 1), g, b],
                            [Math.min(cube - 1, r + 1), g, b],
                        ];
                        if (axis === 1) {
                            step[0] = [r, Math.max(0, g - 1), b];
                            step[1] = [r, Math.min(cube - 1, g + 1), b];
                        } else if (axis === 2) {
                            step[0] = [r, g, Math.max(0, b - 1)];
                            step[1] = [r, g, Math.min(cube - 1, b + 1)];
                        }
                        for (let c = 0; c < 3; c += 1) {
                            dst[index(r, g, b, c)] = (
                                src[index(step[0][0], step[0][1], step[0][2], c)]
                                + 2 * src[index(r, g, b, c)]
                                + src[index(step[1][0], step[1][1], step[1][2], c)]
                            ) / 4;
                        }
                    }
                }
            }
            const swap = src;
            src = dst;
            dst = swap;
        }
    }

    const out = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < out.length; i += 1) out[i] = Math.round(src[i]);
    return out;
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
