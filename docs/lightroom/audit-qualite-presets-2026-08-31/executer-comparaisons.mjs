import { execFile } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const auditRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(auditRoot, '../../..');
const outputVariant = process.env.AUDIT_OUTPUT_VARIANT?.trim();
const outputRoot = outputVariant ? path.join(auditRoot, outputVariant) : auditRoot;

const sourceByPreset = {
  ua02: 'telephone-architecture-37134.jpg', ua01: 'telephone-architecture-37134.jpg',
  ar07: 'unsplash-auto-tqR4EzIwtLM.jpg', ar04: 'unsplash-auto-tqR4EzIwtLM.jpg',
  tm10: 'reflex-paysage-IMG_0349.JPG', tm05: 'reflex-paysage-IMG_0349.JPG',
  cn10: 'reflex-paysage-IMG_0349.JPG', cn09: 'reflex-paysage-IMG_0349.JPG',
  cn16: 'reflex-paysage-IMG_0349.JPG', cn15: 'reflex-paysage-IMG_0349.JPG',
  cn14: 'reflex-paysage-IMG_0349.JPG', cn18: 'reflex-paysage-IMG_0349.JPG',
  sm05: 'reflex-paysage-IMG_0349.JPG', sm06: 'reflex-paysage-IMG_0349.JPG',
  ft11: 'telephone-architecture-37134.jpg', ft05: 'telephone-architecture-37134.jpg',
  wn02: 'reflex-paysage-IMG_0349.JPG', wn01: 'reflex-paysage-IMG_0349.JPG',
  'film-or-riche': 'telephone-chat-37131.jpg',
  'film-braise-puissante': 'telephone-chat-37131.jpg',
  bw01: 'telephone-chat-37131.jpg', bw10: 'telephone-chat-37131.jpg',
  bw04: 'telephone-chat-37131.jpg', bw05: 'telephone-chat-37131.jpg',
  ln01: 'reflex-paysage-IMG_0349.JPG', ln06: 'reflex-paysage-IMG_0349.JPG',
  pe05: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', pe10: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  pg08: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', pg01: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  pb12: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', pb10: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  pl11: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', pl01: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  'pd04-orange': 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  'pd01-rouge': 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  pm10: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', pm01: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  sp05: 'reflex-paysage-IMG_0349.JPG', sp11: 'reflex-paysage-IMG_0349.JPG',
  lf01: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg', lf04: 'unsplash-portrait-groupe-q1jHh0MWTFk.jpg',
  vn04: 'unsplash-auto-tqR4EzIwtLM.jpg', vn03: 'unsplash-auto-tqR4EzIwtLM.jpg',
  vn05: 'unsplash-auto-tqR4EzIwtLM.jpg', vn09: 'unsplash-auto-tqR4EzIwtLM.jpg',
  tr08: 'reflex-paysage-IMG_0349.JPG', tr03: 'reflex-paysage-IMG_0349.JPG',
  tr13: 'reflex-paysage-IMG_0349.JPG', tr18: 'reflex-paysage-IMG_0349.JPG',
};

const summaries = [];
const requested = new Set(process.argv.slice(2));
const entries = Object.entries(sourceByPreset).filter(([presetId]) => requested.size === 0 || requested.has(presetId));
for (const [presetId, sourceName] of entries) {
  const referenceDir = path.join(auditRoot, 'lightroom', presetId);
  const referenceFiles = await readdir(referenceDir);
  const reference = path.join(referenceDir, referenceFiles.find((name) => /\.png$/i.test(name)));
  const source = path.join(auditRoot, 'sources', sourceName);
  const outputDir = path.join(outputRoot, 'vibefx', presetId);
  const comparisonDir = path.join(outputRoot, 'comparaisons', presetId);
  await mkdir(outputDir, { recursive: true });
  await mkdir(comparisonDir, { recursive: true });

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      path.join(projectRoot, 'scripts/compare-preset-vs-lightroom.mjs'),
      source,
      reference,
      presetId,
      '--sortie', path.join(outputDir, 'rendu.png'),
      '--planche', path.join(comparisonDir, 'planche.png'),
    ],
    { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 },
  );
  const log = `${stdout}${stderr ? `\n${stderr}` : ''}`;
  await writeFile(path.join(comparisonDir, 'resultat.txt'), log);
  const read = (pattern) => Number(log.match(pattern)?.[1]);
  summaries.push({
    presetId,
    source: sourceName,
    mean: read(/moyen\s+([\d.]+)\/255/),
    median: read(/median\s+([\d.]+)\/255/),
    p90: read(/90e centile\s+([\d.]+)\/255/),
    p99: read(/99e centile\s+([\d.]+)\/255/),
    maximum: read(/max\s+([\d.]+)\/255/),
    presetEffect: read(/effet du preset\s+([\d.]+)\/255/),
    reproducedPercent: read(/reproduit\s+([\d.]+)\s*%/),
    verdict: log.match(/VERDICT:\s*(.+)/)?.[1]?.trim() ?? null,
  });
  console.log(`${presetId}: ${summaries.at(-1).mean}/255 — ${summaries.at(-1).verdict}`);
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, requested.size === 0 ? 'resultats-comparaisons.json' : 'resultats-comparaisons-extension.json'),
  `${JSON.stringify(summaries, null, 2)}\n`,
);
