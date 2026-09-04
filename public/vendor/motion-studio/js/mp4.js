/*
 * Muxer MP4 minimal, juste ce qu'il faut pour emballer un flux H.264 sorti de
 * WebCodecs : une seule piste video, toutes les images de meme duree.
 *
 * Le fichier est ecrit dans l'ordre ftyp / mdat / moov. On accumule d'abord les
 * images encodees, ce qui donne la taille du mdat, donc les offsets absolus que
 * la table stco doit contenir ; le moov est ecrit ensuite, une fois ces offsets
 * connus.
 */

const enc = new TextEncoder();

function u32(v) {
    return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
}
function u16(v) {
    return [(v >>> 8) & 255, v & 255];
}

/*
 * Aplatit les morceaux d'une boite en une simple liste d'octets.
 *
 * `Array.prototype.flat()` ne suffit PAS ici : il aplatit les tableaux ordinaires
 * mais laisse un `Uint8Array` intact, compte pour un seul element. Les boites
 * construites a partir de texte encode (`ftyp`, `hdlr`) sortaient donc tronquees
 * — un `ftyp` de 17 octets au lieu de 32. Chrome les lisait quand meme, mais
 * AVFoundation, donc QuickTime et l'apercu du Finder, les refusait.
 */
function bytes(parts, out = []) {
    for (const part of parts) {
        if (typeof part === 'number') out.push(part & 255);
        else if (Array.isArray(part) || ArrayBuffer.isView(part)) bytes(part, out);
        else throw new Error(`mp4: morceau de boite inattendu (${typeof part})`);
    }
    return out;
}

function box(type, ...parts) {
    const payload = bytes(parts);
    const size = 8 + payload.length;
    return [...u32(size), ...enc.encode(type), ...payload];
}

function fullBox(type, version, flags, ...parts) {
    return box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], parts);
}

const MATRIX = [
    ...u32(0x00010000), ...u32(0), ...u32(0),
    ...u32(0), ...u32(0x00010000), ...u32(0),
    ...u32(0), ...u32(0), ...u32(0x40000000),
];

function avc1(width, height, description) {
    return box('avc1',
        [0, 0, 0, 0, 0, 0], u16(1),            // reserved + data_reference_index
        u16(0), u16(0), [...u32(0), ...u32(0), ...u32(0)],
        u16(width), u16(height),
        u32(0x00480000), u32(0x00480000),
        u32(0), u16(1),
        new Array(32).fill(0),                  // compressorname
        u16(0x0018), [0xff, 0xff],
        box('avcC', [...description]));
}

/*
 * `samples` : [{ data: Uint8Array, key: boolean }], toutes de meme duree.
 */
export function buildMp4({
    samples, width, height, fps, description,
}) {
    const count = samples.length;
    const mdatPayload = samples.reduce((n, s) => n + s.data.length, 0);
    const ftyp = box('ftyp',
        enc.encode('isom'), u32(0x200),
        enc.encode('isom'), enc.encode('iso2'), enc.encode('avc1'), enc.encode('mp41'));

    // Offset de la premiere image : apres ftyp et l'entete du mdat.
    const mdatHeader = 8;
    const firstOffset = ftyp.length + mdatHeader;

    const offsets = [];
    let running = firstOffset;
    samples.forEach((s) => { offsets.push(running); running += s.data.length; });

    const movieTimescale = 1000;
    const movieDuration = Math.round((count / fps) * movieTimescale);
    const keyIndexes = [];
    samples.forEach((s, i) => { if (s.key) keyIndexes.push(i + 1); });

    const stbl = box('stbl',
        fullBox('stsd', 0, 0, u32(1), avc1(width, height, description)),
        fullBox('stts', 0, 0, u32(1), u32(count), u32(1)),
        fullBox('stss', 0, 0, u32(keyIndexes.length), keyIndexes.flatMap(u32)),
        fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
        fullBox('stsz', 0, 0, u32(0), u32(count), samples.flatMap((s) => u32(s.data.length))),
        fullBox('stco', 0, 0, u32(count), offsets.flatMap(u32)));

    const minf = box('minf',
        fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
        box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
        stbl);

    const mdia = box('mdia',
        fullBox('mdhd', 0, 0, u32(0), u32(0), u32(fps), u32(count), u16(0x55c4), u16(0)),
        fullBox('hdlr', 0, 0, u32(0), enc.encode('vide'), u32(0), u32(0), u32(0),
            [...enc.encode('VideoHandler'), 0]),
        minf);

    const trak = box('trak',
        fullBox('tkhd', 0, 3,
            u32(0), u32(0), u32(1), u32(0), u32(movieDuration),
            u32(0), u32(0), u16(0), u16(0), u16(0), u16(0),
            MATRIX, u32(width << 16), u32(height << 16)),
        mdia);

    const moov = box('moov',
        fullBox('mvhd', 0, 0,
            u32(0), u32(0), u32(movieTimescale), u32(movieDuration),
            u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0),
            MATRIX, new Array(24).fill(0), u32(2)),
        trak);

    const out = new Uint8Array(ftyp.length + mdatHeader + mdatPayload + moov.length);
    let p = 0;
    out.set(ftyp, p); p += ftyp.length;
    out.set([...u32(mdatHeader + mdatPayload), ...enc.encode('mdat')], p); p += mdatHeader;
    samples.forEach((s) => { out.set(s.data, p); p += s.data.length; });
    out.set(moov, p);
    return new Blob([out], { type: 'video/mp4' });
}
