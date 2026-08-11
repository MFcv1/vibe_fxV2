/*
 * LUT 3D — moteur de rendu des presets Vision.
 *
 * Pourquoi une LUT plutot qu'un calcul par pixel:
 * un preset serieux enchaine une courbe maitre, un virage split par luminance,
 * un remappage teinte/saturation/luminance par bande, puis une desaturation des
 * hautes lumieres. Fait pixel par pixel, ca coute 60 a 100 operations, et le
 * cout grimpe a chaque reglage qu'on ajoute au preset.
 *
 * Ici la fonction du preset est evaluee UNE FOIS sur une grille 33x33x33 (35937
 * points), puis le rendu se contente d'une interpolation trilineaire: ~30
 * operations par pixel, et surtout un cout CONSTANT quelle que soit la
 * complexite du preset. Ajouter un preset ne coute donc rien au rendu.
 *
 * 33 est la taille des .cube standard: c'est visuellement sans perte sur des
 * transformations lisses, a condition que la fonction du preset le soit - d'ou
 * la ponderation par la saturation cote `visionPresets.js`, qui evite toute
 * discontinuite autour de l'axe des gris (ou la teinte n'est pas definie).
 */

export const LUT_SIZE = 33;

/*
 * Evalue `transform` sur toute la grille et renvoie la table.
 * Ordre d'indexation: R varie le plus vite, puis G, puis B.
 */
export function buildLut3d(transform, size = LUT_SIZE) {
    const last = size - 1;
    const lut = new Uint8ClampedArray(size * size * size * 3);
    const input = [0, 0, 0];
    let i = 0;
    for (let b = 0; b < size; b += 1) {
        for (let g = 0; g < size; g += 1) {
            for (let r = 0; r < size; r += 1) {
                input[0] = r / last;
                input[1] = g / last;
                input[2] = b / last;
                const out = transform(input);
                lut[i] = out[0] * 255;
                lut[i + 1] = out[1] * 255;
                lut[i + 2] = out[2] * 255;
                i += 3;
            }
        }
    }
    return lut;
}

/*
 * Applique la LUT a un buffer RGBA en place, par interpolation trilineaire.
 *
 * `amount` (0..1) melange lineairement avec la couleur d'origine. On le gere ici
 * plutot que par un canvas supplementaire: une passe de moins, et pas de
 * `getImageData` en plus.
 */
export function applyLut3dToData(data, lut, size = LUT_SIZE, amount = 1) {
    if (!lut || amount <= 0) return;
    const last = size - 1;
    const scale = last / 255;
    const strideG = size * 3;
    const strideB = size * size * 3;
    const blend = amount >= 1 ? 1 : amount;

    for (let i = 0; i < data.length; i += 4) {
        const rf = data[i] * scale;
        const gf = data[i + 1] * scale;
        const bf = data[i + 2] * scale;

        let r0 = rf | 0;
        let g0 = gf | 0;
        let b0 = bf | 0;
        if (r0 >= last) r0 = last - 1;
        if (g0 >= last) g0 = last - 1;
        if (b0 >= last) b0 = last - 1;
        /* Grille de taille 1: rien a interpoler. */
        if (r0 < 0) r0 = 0;
        if (g0 < 0) g0 = 0;
        if (b0 < 0) b0 = 0;

        const dr = rf - r0;
        const dg = gf - g0;
        const db = bf - b0;

        const base = (b0 * size * size + g0 * size + r0) * 3;
        const i000 = base;
        const i100 = base + 3;
        const i010 = base + strideG;
        const i110 = base + strideG + 3;
        const i001 = base + strideB;
        const i101 = base + strideB + 3;
        const i011 = base + strideB + strideG;
        const i111 = base + strideB + strideG + 3;

        const w000 = (1 - dr) * (1 - dg) * (1 - db);
        const w100 = dr * (1 - dg) * (1 - db);
        const w010 = (1 - dr) * dg * (1 - db);
        const w110 = dr * dg * (1 - db);
        const w001 = (1 - dr) * (1 - dg) * db;
        const w101 = dr * (1 - dg) * db;
        const w011 = (1 - dr) * dg * db;
        const w111 = dr * dg * db;

        for (let c = 0; c < 3; c += 1) {
            const value = lut[i000 + c] * w000 + lut[i100 + c] * w100
                + lut[i010 + c] * w010 + lut[i110 + c] * w110
                + lut[i001 + c] * w001 + lut[i101 + c] * w101
                + lut[i011 + c] * w011 + lut[i111 + c] * w111;
            data[i + c] = blend === 1 ? value : data[i + c] + (value - data[i + c]) * blend;
        }
    }
}

/* Variante canvas: une seule paire getImageData/putImageData. */
export function applyLut3d(ctx, w, h, lut, size = LUT_SIZE, amount = 1) {
    if (!lut || amount <= 0 || !w || !h) return;
    const imageData = ctx.getImageData(0, 0, w, h);
    applyLut3dToData(imageData.data, lut, size, amount);
    ctx.putImageData(imageData, 0, 0);
}
