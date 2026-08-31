import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SEED = 'vibefx-lightroom-quality-audit-2026-08-31';
const PRESETS_DIR = path.resolve('src/features/vibefx-studio/utils/presets');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const presets = fs.readdirSync(PRESETS_DIR)
    .filter((name) => name.endsWith('.js') && name !== 'index.js')
    .sort()
    .map((name) => {
        const source = fs.readFileSync(path.join(PRESETS_DIR, name), 'utf8');
        const id = source.match(/id:\s*['"`]([^'"`]+)['"`]/)?.[1];
        const declared = source.match(/collection:\s*\{[^}]*["']id["']:\s*["']([^"']+)["'][^}]*["']label["']:\s*["']([^"']+)["']/);
        const fallback = /^cn1[1-8]$/i.test(id || '')
            ? { id: 'cinema-ii', label: 'Cinéma II' }
            : null;
        const collection = declared
            ? { id: declared[1], label: declared[2] }
            : fallback;
        if (!id || !collection) throw new Error(`Métadonnées incomplètes: ${name}`);
        return { id, file: name, collection };
    });

const families = [...Map.groupBy(presets, (preset) => preset.collection.id)]
    .map(([collectionId, entries]) => ({
        collectionId,
        family: entries[0].collection.label,
        count: entries.length,
        selected: entries
            .map((entry) => ({ ...entry, draw: hash(`${SEED}\0${collectionId}\0${entry.id}`) }))
            .sort((a, b) => a.draw.localeCompare(b.draw) || a.id.localeCompare(b.id))
            .slice(0, 2)
            .map(({ id, file, draw }) => ({ id, file, draw })),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, 'fr'));

const manifest = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    method: 'SHA-256(seed\\0collectionId\\0presetId), tri croissant, deux premiers par famille',
    importedPresetCount: presets.length,
    familyCount: families.length,
    families,
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
