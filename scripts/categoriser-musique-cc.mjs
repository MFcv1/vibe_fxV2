#!/usr/bin/env node
/*
 * Range le catalogue CC-BY moissonne en categories pensees pour un post
 * Instagram, et fabrique une page d'ecoute locale pour trancher a l'oreille.
 *
 * Note importante sur la "qualite": ici il n'y a rien a filtrer. La
 * bibliotheque est celle d'UN compositeur professionnel, pas un depot
 * d'uploads. Le tri qualitatif est deja fait par l'artiste. Le travail restant
 * n'est donc pas de trier le bon du mauvais, c'est de RANGER - et c'est
 * exactement pour ca que cette approche bat une grosse API.
 *
 * Les categories se lisent depuis les tags poses par l'artiste (genre-*,
 * mood-*, instrumentation-*), jamais devinees.
 *
 * Usage:
 *   node scripts/categoriser-musique-cc.mjs
 *   node scripts/categoriser-musique-cc.mjs --in docs/catalogue-musique-cc.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const lireOption = (nom, defaut) => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};

const entree = lireOption('in', 'docs/catalogue-musique-cc.json');
const sortieJson = lireOption('out', 'docs/catalogue-musique-cc-categorise.json');
const sortieHtml = lireOption('html', 'docs/ecoute-catalogue-musique.html');

/*
 * Categories Insta. `ambiances` et `genres` sont des listes de tags de
 * l'artiste; une piste entre dans la categorie si elle touche au moins un tag
 * d'ambiance ET (si `genres` est renseigne) au moins un genre.
 * `exclut` sort les pistes saisonnieres des categories generalistes.
 */
const CATEGORIES = [
    {
        id: 'cinematique',
        label: 'Cinématique',
        resume: 'Grand, orchestral, ça pose une image.',
        ambiances: ['epic', 'heroic', 'triumphant', 'dramatic', 'powerful'],
        genres: ['orchestral', 'neoclassical'],
    },
    {
        id: 'voyage',
        label: 'Voyage',
        resume: 'Ça avance, ça donne envie de partir.',
        ambiances: ['adventurous', 'inspirational', 'uplifting', 'hopeful'],
        genres: [],
    },
    {
        id: 'reverie',
        label: 'Rêverie',
        resume: 'Doux, aérien, on flotte.',
        ambiances: ['peaceful', 'dreamy', 'calm', 'relaxing', 'serene'],
        genres: ['ambient', 'neoclassical'],
    },
    {
        id: 'emotion',
        label: 'Émotion',
        resume: 'Piano, cordes, ça serre un peu la gorge.',
        ambiances: ['bittersweet', 'melancholy', 'emotional', 'reflective', 'sad', 'thoughtful'],
        genres: [],
    },
    {
        id: 'nuit',
        label: 'Nuit urbaine',
        resume: 'Sombre, tendu, électronique.',
        ambiances: ['mysterious', 'dark', 'tense', 'ominous', 'suspenseful', 'brooding', 'intense', 'sinister'],
        genres: [],
    },
    {
        id: 'energie',
        label: 'Énergie',
        resume: 'Ça pulse, ça tient un montage rythmé.',
        ambiances: ['driving', 'happy', 'energetic', 'playful', 'quirky', 'comedic', 'fun'],
        genres: [],
    },
    {
        id: 'saison',
        label: 'Saisonnier',
        resume: 'Halloween et Noël, à sortir au bon moment.',
        ambiances: [],
        genres: ['halloween', 'christmas'],
        saisonnier: true,
    },
];

const SAISONNIERS = ['halloween', 'christmas'];

const echappe = (v = '') => String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function classer(piste) {
    const estSaisonnier = piste.genres.some((g) => SAISONNIERS.includes(g));
    const retenues = [];

    for (const cat of CATEGORIES) {
        if (cat.saisonnier) {
            if (estSaisonnier) retenues.push(cat.id);
            continue;
        }
        if (estSaisonnier) continue;

        const ambianceOk = !cat.ambiances.length
            || piste.ambiances.some((a) => cat.ambiances.includes(a));
        const genreOk = !cat.genres.length
            || piste.genres.some((g) => cat.genres.includes(g));

        if (ambianceOk && genreOk) retenues.push(cat.id);
    }

    return retenues;
}

function pageEcoute(catalogue, parCategorie) {
    const source = catalogue.source;
    const sections = CATEGORIES.map((cat) => {
        const pistes = parCategorie.get(cat.id) || [];
        if (!pistes.length) return '';
        const lignes = pistes.map((p) => `
      <li class="piste" data-id="${echappe(p.id)}">
        <button class="play" data-src="${echappe(p.audioUrl)}" aria-label="Écouter ${echappe(p.titre)}">▶</button>
        <span class="infos">
          <strong>${echappe(p.titre)}</strong>
          <small>${echappe([...p.genres, ...p.ambiances].slice(0, 5).join(' · '))}</small>
        </span>
        <label class="garder"><input type="checkbox" data-keep="${echappe(p.id)}"> garder</label>
        <a class="src" href="${echappe(p.page)}" target="_blank" rel="noopener">page</a>
      </li>`).join('');
        return `
  <section>
    <h2>${echappe(cat.label)} <span class="compte">${pistes.length}</span></h2>
    <p class="resume">${echappe(cat.resume)}</p>
    <ul>${lignes}</ul>
  </section>`;
    }).join('');

    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Écoute du catalogue — ${echappe(source.artiste)}</title>
<style>
:root{color-scheme:dark;--bg:#070708;--surface:#16161a;--surface2:#1d1d22;--line:rgba(255,255,255,.075);--text:#f4f4f6;--text2:#a2a2ab;--text3:#6d6d77;--accent:#5b7cfa}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:2;padding:20px 24px;background:rgba(7,7,8,.86);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--line)}
h1{margin:0 0 4px;font-size:20px;letter-spacing:-.01em}
.meta{color:var(--text2);font-size:13px}
.meta a{color:var(--accent);text-decoration:none}
main{padding:8px 24px 120px;max-width:900px;margin:0 auto}
section{margin:28px 0}
h2{display:flex;align-items:center;gap:10px;margin:0;font-size:16px}
.compte{padding:2px 8px;border-radius:999px;background:var(--surface2);color:var(--text3);font-size:12px;font-weight:400}
.resume{margin:2px 0 12px;color:var(--text3);font-size:13px}
ul{list-style:none;margin:0;padding:0}
.piste{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:8px;border-radius:12px}
.piste:hover{background:var(--surface)}
.piste[data-playing="1"]{background:rgba(91,124,250,.14)}
.play{width:32px;height:32px;border:0;border-radius:8px;background:var(--surface2);color:var(--text);cursor:pointer;font-size:12px}
.play:hover{background:var(--accent)}
.infos{display:grid;gap:1px;min-width:0}
.infos strong{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.infos small{color:var(--text3);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.garder{display:inline-flex;align-items:center;gap:6px;color:var(--text2);font-size:12px;cursor:pointer;white-space:nowrap}
.src{color:var(--text3);font-size:12px;text-decoration:none}
.src:hover{color:var(--accent)}
footer{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;background:rgba(22,22,26,.92);backdrop-filter:blur(20px);border-top:1px solid var(--line)}
button.export{padding:8px 16px;border:0;border-radius:999px;background:var(--accent);color:#fff;font-size:13px;cursor:pointer}
#etat{color:var(--text2);font-size:13px}
</style></head><body>
<header>
  <h1>Écoute du catalogue — ${echappe(source.artiste)}</h1>
  <p class="meta">${catalogue.nombrePistes} morceaux · ${echappe(source.licence)} · usage commercial autorisé, crédit obligatoire ·
    <a href="${echappe(source.site)}" target="_blank" rel="noopener">site de l'artiste</a> ·
    <a href="${echappe(source.soutien)}" target="_blank" rel="noopener">le soutenir</a></p>
</header>
<main>${sections}</main>
<footer>
  <span id="etat">Coche « garder » sur ce que tu veux au catalogue.</span>
  <button class="export" id="exporter">Copier la sélection</button>
</footer>
<audio id="lecteur"></audio>
<script>
const lecteur = document.getElementById('lecteur');
let courant = null;
document.addEventListener('click', (e) => {
  const b = e.target.closest('.play');
  if (!b) return;
  const li = b.closest('.piste');
  if (courant === li && !lecteur.paused) { lecteur.pause(); li.dataset.playing = ''; b.textContent = '▶'; return; }
  document.querySelectorAll('.piste[data-playing="1"]').forEach(x => { x.dataset.playing=''; x.querySelector('.play').textContent='▶'; });
  lecteur.src = b.dataset.src; lecteur.play();
  courant = li; li.dataset.playing = '1'; b.textContent = '❚❚';
});
lecteur.addEventListener('ended', () => {
  if (courant) { courant.dataset.playing=''; courant.querySelector('.play').textContent='▶'; }
});
const etat = document.getElementById('etat');
const majEtat = () => {
  const n = new Set([...document.querySelectorAll('[data-keep]:checked')].map(x => x.dataset.keep)).size;
  etat.textContent = n ? n + ' morceau' + (n>1?'x':'') + ' gardé' + (n>1?'s':'') : 'Coche « garder » sur ce que tu veux au catalogue.';
};
document.addEventListener('change', (e) => {
  const id = e.target.dataset.keep;
  if (!id) return;
  document.querySelectorAll('[data-keep="' + id + '"]').forEach(x => { x.checked = e.target.checked; });
  majEtat();
});
document.getElementById('exporter').addEventListener('click', async () => {
  const ids = [...new Set([...document.querySelectorAll('[data-keep]:checked')].map(x => x.dataset.keep))];
  await navigator.clipboard.writeText(JSON.stringify(ids));
  etat.textContent = ids.length + ' identifiants copiés — colle-les dans le chat.';
});
</script></body></html>`;
}

async function main() {
    const catalogue = JSON.parse(await fs.readFile(path.resolve(process.cwd(), entree), 'utf8'));
    const parCategorie = new Map();

    for (const piste of catalogue.pistes) {
        piste.categories = classer(piste);
        for (const id of piste.categories) {
            if (!parCategorie.has(id)) parCategorie.set(id, []);
            parCategorie.get(id).push(piste);
        }
    }

    const orphelines = catalogue.pistes.filter((p) => !p.categories.length);

    const resultat = {
        ...catalogue,
        categories: CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            resume: c.resume,
            nombre: (parCategorie.get(c.id) || []).length,
        })),
        nonClassees: orphelines.length,
    };

    await fs.writeFile(path.resolve(process.cwd(), sortieJson), JSON.stringify(resultat, null, 2), 'utf8');
    await fs.writeFile(path.resolve(process.cwd(), sortieHtml), pageEcoute(catalogue, parCategorie), 'utf8');

    console.log(`${catalogue.nombrePistes} pistes rangées\n`);
    for (const c of resultat.categories) {
        console.log(`  ${String(c.nombre).padStart(4)}  ${c.label.padEnd(14)} ${c.resume}`);
    }
    console.log(`\n  ${String(orphelines.length).padStart(4)}  non classées`);
    if (orphelines.length) {
        console.log('\n  Exemples de tags non couverts :');
        const tags = new Map();
        for (const p of orphelines) for (const a of p.ambiances) tags.set(a, (tags.get(a) || 0) + 1);
        [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
            .forEach(([t, n]) => console.log(`        ${String(n).padStart(3)}  ${t}`));
    }
    console.log(`\nJSON  : ${sortieJson}`);
    console.log(`Écoute: ${sortieHtml}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
