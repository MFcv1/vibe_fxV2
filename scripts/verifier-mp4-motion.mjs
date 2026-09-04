/*
 * Verifie la structure du fichier MP4 produit par Motion Studio.
 *
 * Ce script existe a cause d'un bug qui a coute cher : les boites construites a
 * partir de texte encode sortaient tronquees (un `ftyp` de 17 octets au lieu de
 * 32). Chrome et ffmpeg lisaient le fichier quand meme ; QuickTime et l'apercu
 * du Finder le refusaient. Un test qui se contente d'ouvrir la video dans un
 * navigateur ne voit donc RIEN. Celui-ci verifie les tailles reelles.
 *
 *   node scripts/verifier-mp4-motion.mjs
 */

import { buildMp4 } from '../public/vendor/motion-studio/js/mp4.js';

// Tailles attendues des boites de taille fixe, d'apres ISO/IEC 14496-12 et -15.
const EXPECTED = {
    ftyp: 32,   // 8 + marque + version + 4 marques compatibles
    mvhd: 108,  // 8 + 4 (version/flags) + 96
    tkhd: 92,   // 8 + 4 + 80
    mdhd: 32,   // 8 + 4 + 20
    hdlr: 45,   // 8 + 4 + 4 + 4 + 12 + "VideoHandler\0"
    vmhd: 20,
    dref: 28,
    stts: 24,
    stsc: 28,
    avcC: null, // depend de l'en-tete H.264
};

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf']);

function walk(buf, off, end, depth, found, problems) {
    while (off + 8 <= end) {
        const size = buf.readUInt32BE(off);
        const type = buf.toString('latin1', off + 4, off + 8);
        if (size < 8 || off + size > end) {
            problems.push(`boite ${type} de taille ${size} a l'octet ${off} : deborde`);
            return;
        }
        found.set(type, size);
        if (CONTAINERS.has(type)) walk(buf, off + 8, off + size, depth + 1, found, problems);
        if (type === 'stsd') walk(buf, off + 16, off + size, depth + 1, found, problems);
        if (type === 'avc1') walk(buf, off + 8 + 78, off + size, depth + 1, found, problems);
        off += size;
    }
}

async function main() {
    const fps = 30;
    const count = 12;
    // Faux echantillons : la structure du conteneur ne depend pas de leur
    // contenu, seulement de leur taille et de leur nombre.
    const samples = Array.from({ length: count }, (_, i) => ({
        data: new Uint8Array(64 + i),
        key: i % 10 === 0,
    }));
    const description = new Uint8Array([1, 100, 0, 40, 255, 225, 0, 4, 103, 100, 0, 40, 1, 0, 4, 104, 238, 60, 176]);

    const blob = buildMp4({
        samples, width: 1080, height: 1920, fps, description,
    });
    const buf = Buffer.from(await blob.arrayBuffer());

    const found = new Map();
    const problems = [];
    walk(buf, 0, buf.length, 0, found, problems);

    Object.entries(EXPECTED).forEach(([type, expected]) => {
        const actual = found.get(type);
        if (actual === undefined) problems.push(`boite ${type} absente`);
        else if (expected !== null && actual !== expected) {
            problems.push(`boite ${type} : ${actual} octets, attendu ${expected}`);
        }
    });

    // Tables de taille variable.
    const stsz = found.get('stsz');
    if (stsz !== 20 + 4 * count) problems.push(`stsz : ${stsz} octets, attendu ${20 + 4 * count}`);
    const stco = found.get('stco');
    if (stco !== 16 + 4 * count) problems.push(`stco : ${stco} octets, attendu ${16 + 4 * count}`);
    const keys = samples.filter((s) => s.key).length;
    const stss = found.get('stss');
    if (stss !== 16 + 4 * keys) problems.push(`stss : ${stss} octets, attendu ${16 + 4 * keys}`);

    // Le premier decalage de stco doit tomber pile sur le premier echantillon.
    // On ne le lit que si la structure tient debout : sur un fichier casse, cet
    // acces sortirait du tampon et masquerait le vrai diagnostic.
    if (!problems.length) {
        const ftypSize = buf.readUInt32BE(0);
        const stcoOff = buf.indexOf(Buffer.from('stco', 'latin1'));
        if (stcoOff < 0 || stcoOff + 16 > buf.length) problems.push('table stco introuvable');
        else {
            const firstOffset = buf.readUInt32BE(stcoOff + 12);
            if (firstOffset !== ftypSize + 8) {
                problems.push(`premier decalage stco : ${firstOffset}, attendu ${ftypSize + 8}`);
            }
        }
    }

    if (problems.length) {
        console.error('MP4 invalide :');
        problems.forEach((p) => console.error(`  - ${p}`));
        process.exit(1);
    }
    console.log(`MP4 valide : ${found.size} boites, ${count} echantillons, ${buf.length} octets.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
