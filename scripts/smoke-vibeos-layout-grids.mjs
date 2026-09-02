/*
 * Smoke test de la bibliotheque de grilles du Layout VibeOS.
 *
 * Ce que ce test protege: une grille est publiee sur Instagram en 4:5 OU en
 * 1:1. Les deux variantes doivent donc exister, decouper la meme surface sans
 * chevauchement, tenir dans le cadre, respecter la taille minimale acceptee
 * par le moteur (8%) et surtout garder le MEME nombre de zones dans le meme
 * ordre - sinon changer de format deplacerait les photos d'une case a l'autre.
 */

import {
    DEFAULT_GRID_ID,
    FEATURED_GRID_IDS,
    GRID_CATEGORIES,
    GRID_PRESETS,
    buildGridZones,
    compileGridSpec,
    findGridPreset,
    gridPreviewZones,
    mirrorZones,
    pickGridVariant,
    rotateZoneImages,
} from '../src/features/vibeos/layout/gridLibrary.js';

const MIN_ZONE_SIZE = 0.08;
const EPS = 1e-6;
const PORTRAIT = { id: 'insta-port', ratio: 4 / 5 };
const SQUARE = { id: 'insta-sq', ratio: 1 };

let failures = 0;
const check = (condition, message) => {
    if (condition) return;
    failures += 1;
    console.error(`  ✗ ${message}`);
};

const overlap = (a, b) => (
    a.x < b.x + b.w - EPS && a.x + a.w - EPS > b.x
    && a.y < b.y + b.h - EPS && a.y + a.h - EPS > b.y
);

console.log(`Bibliotheque: ${GRID_PRESETS.length} grilles, ${GRID_CATEGORIES.length} familles`);
check(GRID_PRESETS.length >= 20, 'au moins 20 grilles proposees');
check(new Set(GRID_PRESETS.map((grid) => grid.id)).size === GRID_PRESETS.length, 'ids uniques');
check(Boolean(findGridPreset(DEFAULT_GRID_ID)), `grille par defaut ${DEFAULT_GRID_ID} presente`);
FEATURED_GRID_IDS.forEach((id) => check(Boolean(findGridPreset(id)), `grille mise en avant ${id} presente`));
GRID_PRESETS.forEach((grid) => {
    check(
        GRID_CATEGORIES.some((category) => category.id === grid.category),
        `${grid.id}: famille "${grid.category}" declaree`,
    );
    check(Boolean(grid.description), `${grid.id}: description non vide`);
    /* Un nom qui annonce un nombre doit dire la verite ("Galerie 6"). */
    const labelCount = /(\d+)\s*$/.exec(grid.label);
    check(
        !labelCount || Number(labelCount[1]) === grid.slots,
        `${grid.id}: le nom annonce ${labelCount?.[1]} images pour ${grid.slots} zones`,
    );
});

for (const grid of GRID_PRESETS) {
    const variants = ['portrait', 'square'].map((variant) => compileGridSpec(grid.specs[variant]));
    const [portrait, square] = variants;

    check(portrait.length === square.length, `${grid.id}: meme nombre de zones en 4:5 et en 1:1`);
    check(portrait.length === grid.slots, `${grid.id}: slots annonces (${grid.slots}) = zones reelles`);

    variants.forEach((zones, index) => {
        const variant = index === 0 ? '4:5' : '1:1';
        let covered = 0;
        zones.forEach((zone, zoneIndex) => {
            covered += zone.w * zone.h;
            check(
                zone.w >= MIN_ZONE_SIZE && zone.h >= MIN_ZONE_SIZE,
                `${grid.id} ${variant}: zone ${zoneIndex + 1} sous la taille minimale du moteur`,
            );
            check(
                zone.x >= -EPS && zone.y >= -EPS
                && zone.x + zone.w <= 1 + EPS && zone.y + zone.h <= 1 + EPS,
                `${grid.id} ${variant}: zone ${zoneIndex + 1} deborde du cadre`,
            );
            zones.slice(zoneIndex + 1).forEach((other, otherIndex) => {
                check(
                    !overlap(zone, other),
                    `${grid.id} ${variant}: zones ${zoneIndex + 1} et ${zoneIndex + otherIndex + 2} se chevauchent`,
                );
            });
        });
        /* Une grille couvre la surface, sauf vide editorial assume (>= 40%). */
        check(covered > 0.4, `${grid.id} ${variant}: surface couverte trop faible (${covered.toFixed(2)})`);
        check(covered <= 1 + EPS, `${grid.id} ${variant}: surface couverte > 1 (${covered.toFixed(3)})`);
    });
}

/* Changer de format garde les memes zones (memes ids, meme ordre de lecture). */
for (const grid of GRID_PRESETS) {
    const portraitZones = buildGridZones(grid, PORTRAIT);
    const squareZones = buildGridZones(grid, SQUARE);
    check(
        portraitZones.map((zone) => zone.id).join() === squareZones.map((zone) => zone.id).join(),
        `${grid.id}: ids de zones stables d'un format a l'autre`,
    );
    check(
        portraitZones.every((zone, index) => zone.imageIndex === index),
        `${grid.id}: photos affectees dans l'ordre de lecture`,
    );
    const differs = portraitZones.some((zone, index) => (
        Math.abs(zone.h - squareZones[index].h) > EPS || Math.abs(zone.w - squareZones[index].w) > EPS
    ));
    check(
        differs || grid.uniform,
        `${grid.id}: la variante carree n'est ni recomposee ni declaree "uniform"`,
    );
}

check(pickGridVariant(PORTRAIT) === 'portrait', 'le 4:5 prend la variante portrait');
check(pickGridVariant(SQUARE) === 'square', 'le 1:1 prend la variante carree');
check(pickGridVariant({ ratio: 9 / 16 }) === 'portrait', 'la story prend la variante portrait');
check(pickGridVariant({ ratio: 1.91 }) === 'square', 'le paysage prend la variante carree');

/* Variantes: miroir involutif, rotation des photos circulaire. */
const sample = buildGridZones(findGridPreset('golden'), PORTRAIT);
const mirrored = mirrorZones(sample, 'x');
check(
    mirrorZones(mirrored, 'x').every((zone, index) => Math.abs(zone.x - sample[index].x) < EPS),
    'le miroir horizontal applique deux fois revient a l\'original',
);
check(
    mirrored.every((zone, index) => Math.abs(zone.x - (1 - sample[index].x - sample[index].w)) < EPS),
    'le miroir horizontal retourne bien les abscisses',
);
const rotated = rotateZoneImages(sample, 1);
check(
    rotated.map((zone) => zone.imageIndex).join() === sample.map((_, index) => (index + 1) % sample.length).join(),
    'la rotation decale les photos d\'un cran',
);
const flipped = buildGridZones(findGridPreset('golden'), SQUARE, { flipX: true, flipY: false, shift: 2 });
check(
    flipped.every((zone) => zone.x >= -EPS && zone.x + zone.w <= 1 + EPS),
    'une grille retournee reste dans le cadre',
);
check(flipped[0].imageIndex === 2, 'le decalage des photos survit a la recompilation');

check(gridPreviewZones(findGridPreset('bento'), 'square').length === findGridPreset('bento').slots,
    'l\'apercu carre montre autant de zones que la grille');

if (failures) {
    console.error(`\n${failures} probleme(s) dans la bibliotheque de grilles.`);
    process.exit(1);
}
console.log('OK: grilles editoriales valides en 4:5 et en 1:1.');
