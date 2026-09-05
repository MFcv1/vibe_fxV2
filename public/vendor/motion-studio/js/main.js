/*
 * Motion Studio — assemblage de l'application.
 *
 * L'etat est une seule structure serialisable : c'est ce qui rend l'annulation,
 * la reprise et l'export triviaux. Le rendu n'en depend que par la fonction
 * `Stage.render(template, state, t, size)`, la meme pour l'apercu, les vignettes
 * du catalogue et l'export.
 */

import QuadRenderer from './engine/gl.js';
import MediaPool from './engine/media.js';
import Stage, { FRAMES } from './engine/stage.js';
import { resolve as resolveTracks, toggle as toggleKey } from './engine/keyframes.js';
import { byId, defaultParams } from './templates/index.js';
import Catalogue from './ui/catalogue.js';
import Inspector from './ui/inspector.js';
import { el } from './ui/dom.js';
import {
    availableFormats, exportSize, encodeMp4, recordWebm, download, hasWebCodecs, pickCodec,
    targetBitrate,
} from './export.js';

const $ = (id) => document.getElementById(id);
const MAX_PREVIEW = 1400;

function initialState(template) {
    return {
        templateId: template.id,
        frame: '1:1',
        slotCount: template.slots,
        loop: template.loop,
        params: defaultParams(template),
        background: {
            mode: 'color', color: '#0e0e10', color2: '#2a2f3a', angle: 90, image: null, imageId: 0,
        },
        textLayers: [],
        logo: null,
        // L'ombre est active par defaut, et discrete : sans elle les cartes
        // flottent sans poids et la scene se lit comme un collage a plat.
        shadow: {
            enabled: true, x: 0, y: 3, spread: 7, opacity: 26,
        },
        /*
         * Finition. Les trois reglages qui font passer le rendu de la
         * diapositive a la video : le flou de mouvement lisse le deplacement,
         * le vignetage recentre le regard, le grain casse la proprete
         * numerique. Actives par defaut, dosages sobres.
         */
        finish: { motionBlur: 45, vignette: 26, grain: 10 },
        // Pistes d'animation : une entree par reglage anime.
        tracks: {},
    };
}

// Libelle lisible d'une piste, pour le tiroir des keyframes.
function trackLabel(template, key) {
    const [scope, name] = [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)];
    if (scope === 'bg') return name === 'color2' ? 'Fond — arrivee' : 'Fond — couleur';
    const p = template.params.find((entry) => entry.k === name);
    return p ? p.label : name;
}

class App {
    constructor() {
        this.canvas = $('stage');
        this.renderer = new QuadRenderer(this.canvas);
        this.media = new MediaPool(this.renderer);
        this.stage = new Stage(this.renderer, this.media);

        this.template = byId('showcase-stream');
        this.state = initialState(this.template);
        this.media.setSlotCount(this.state.slotCount);

        this.playing = true;
        this.time = 0;
        this.lastTs = 0;
        this.previews = new Map();
        // Cadence de reference du flou de mouvement : celle de l'ecran en
        // apercu, celle demandee pendant un export.
        this.renderFps = 60;
        this.history = [];
        this.future = [];
        this.exporting = false;

        this.inspector = new Inspector($('inspector'), this);
        this.catalogue = new Catalogue($('catalogue'), (id) => this.setTemplate(id));
        this.catalogue.setActive(this.template.id);

        this.bindTransport();
        this.bindExport();
        this.inspector.render();
        this.renderTracks();
        this.layout();
        new ResizeObserver(() => this.layout()).observe($('stage-frame').parentElement);
        requestAnimationFrame((ts) => this.frame(ts));
    }

    /* ---------- boucle ---------- */

    layout() {
        const wrap = $('stage-frame').parentElement;
        const ratio = FRAMES.find(([l]) => l === this.state.frame)[1];
        const availW = wrap.clientWidth - 44;
        const availH = wrap.clientHeight - 44;
        let w = availW;
        let h = w / ratio;
        if (h > availH) { h = availH; w = h * ratio; }
        const frame = $('stage-frame');
        frame.style.width = `${Math.round(w)}px`;
        frame.style.height = `${Math.round(h)}px`;
        this.canvas.style.width = `${Math.round(w)}px`;
        this.canvas.style.height = `${Math.round(h)}px`;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = Math.min(dpr, MAX_PREVIEW / Math.max(w, h));
        this.previewSize = [Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))];
    }

    frame(ts) {
        const dt = this.lastTs ? (ts - this.lastTs) / 1000 : 0;
        this.lastTs = ts;
        if (this.playing && !this.exporting) {
            this.time = (this.time + dt / this.state.loop) % 1;
            $('scrub').value = String(Math.round(this.time * 1000));
        }
        if (!this.exporting) {
            this.draw(this.time);
            $('time').textContent = `${(this.time * this.state.loop).toFixed(1)}s / ${this.state.loop.toFixed(1)}s`;
            this.catalogue.tick(ts / 1000);
            // La tete de lecture du tiroir suit sans reconstruire les pistes.
            if (!$('keys-body').hidden) {
                const left = `${this.time * 100}%`;
                document.querySelectorAll('.track-playhead').forEach((n) => { n.style.left = left; });
            }
        }
        requestAnimationFrame((t) => this.frame(t));
    }

    draw(t, size) {
        try {
            // Les reglages animes sont resolus ici, donc l'apercu et l'export
            // passent tous les deux par le meme etat effectif.
            const state = resolveTracks(this.state, t - Math.floor(t));
            this.stage.render(this.template, state, t, size || this.previewSize, this.renderFps);
            $('status').textContent = '';
        } catch (err) {
            $('status').textContent = `Rendu impossible : ${err.message}`;
        }
    }

    /* ---------- historique ---------- */

    snapshot() {
        const { background, ...rest } = this.state;
        return JSON.stringify({
            ...rest,
            background: { ...background, image: null },
        });
    }

    commit() {
        const snap = this.snapshot();
        if (this.history[this.history.length - 1] === snap) return;
        this.history.push(snap);
        if (this.history.length > 60) this.history.shift();
        this.future.length = 0;
        this.syncHistoryButtons();
    }

    restore(snap) {
        const parsed = JSON.parse(snap);
        const image = this.state.background.image;
        const logoBitmap = this.state.logo?.bitmap;
        this.state = parsed;
        this.state.background.image = image;
        if (this.state.logo && logoBitmap) this.state.logo.bitmap = logoBitmap;
        this.template = byId(this.state.templateId);
        this.media.setSlotCount(this.state.slotCount);
        this.catalogue.setActive(this.template.id);
        this.inspector.render();
        this.renderTracks();
        this.layout();
    }

    undo() {
        if (this.history.length < 2) return;
        this.future.push(this.history.pop());
        this.restore(this.history[this.history.length - 1]);
        this.syncHistoryButtons();
    }

    redo() {
        const snap = this.future.pop();
        if (!snap) return;
        this.history.push(snap);
        this.restore(snap);
        this.syncHistoryButtons();
    }

    syncHistoryButtons() {
        $('undo').disabled = this.history.length < 2;
        $('redo').disabled = this.future.length === 0;
    }

    /* ---------- mutations ---------- */

    setTemplate(id) {
        if (id === this.template.id) return;
        this.template = byId(id);
        this.state.templateId = id;
        this.state.params = defaultParams(this.template);
        this.state.slotCount = this.template.slots;
        this.state.loop = this.template.loop;
        // Les pistes portent sur des reglages qui n'existent plus.
        this.state.tracks = {};
        this.media.setSlotCount(this.state.slotCount);
        this.catalogue.setActive(id);
        this.inspector.render();
        this.commit();
    }

    setParam(key, value, rerender = true) {
        this.state.params[key] = value;
        if (rerender) { this.inspector.render(); this.commit(); }
    }

    resetParams() {
        const fresh = initialState(this.template);
        this.state.params = defaultParams(this.template);
        this.state.shadow = fresh.shadow;
        this.state.finish = fresh.finish;
        this.state.tracks = {};
        this.inspector.render();
        this.commit();
    }

    setFrame(label) {
        this.state.frame = label;
        this.layout();
        if (!$('export-modal').hidden) this.syncExportSummary();
        this.inspector.render();
        this.commit();
    }

    setLoop(value, rerender = true) {
        this.state.loop = value;
        this.renderTracks();
        if (rerender) { this.inspector.render(); this.commit(); }
    }

    setSlotCount(n) {
        const next = Math.max(1, Math.min(24, n));
        if (next === this.state.slotCount) return;
        this.state.slotCount = next;
        this.media.setSlotCount(next);
        this.inspector.render();
        this.commit();
    }

    async setSlot(index, file) {
        await this.media.setSlot(index, file);
        this.previews.get(index) && URL.revokeObjectURL(this.previews.get(index));
        this.previews.set(index, URL.createObjectURL(file));
        this.inspector.render();
    }

    slotPreview(index) {
        return this.previews.get(index) || '';
    }

    clearSlot(index) {
        this.media.clearSlot(index);
        const url = this.previews.get(index);
        if (url) { URL.revokeObjectURL(url); this.previews.delete(index); }
        this.inspector.render();
    }

    clearMedia() {
        this.media.clearAll();
        this.previews.forEach((url) => URL.revokeObjectURL(url));
        this.previews.clear();
        this.inspector.render();
    }

    moveSlot(from, to) {
        if (from === to) return;
        const { slots } = this.media;
        const [moved] = slots.splice(from, 1);
        slots.splice(to, 0, moved);
        const urls = [...this.previews.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
        const list = new Array(this.state.slotCount).fill(null);
        this.previews.forEach((v, k) => { list[k] = v; });
        const [mv] = list.splice(from, 1);
        list.splice(to, 0, mv);
        this.previews.clear();
        list.forEach((v, i) => { if (v) this.previews.set(i, v); });
        void urls;
        this.inspector.render();
    }

    setBackground(patch, rerender = true) {
        Object.assign(this.state.background, patch);
        if (rerender) { this.inspector.render(); this.commit(); }
    }

    async setBackgroundImage(file) {
        const bitmap = await createImageBitmap(file);
        this.state.background.image = bitmap;
        this.state.background.imageId = Date.now();
        this.inspector.render();
    }

    addText() {
        this.state.textLayers.push({
            text: 'Ton texte',
            font: '-apple-system, system-ui, sans-serif',
            weight: 600,
            size: 8,
            color: '#ffffff',
            align: 'center',
            x: 50,
            y: 50,
            rotate: 0,
            opacity: 1,
        });
        this.inspector.render();
        this.commit();
    }

    updateText(index, patch) {
        Object.assign(this.state.textLayers[index], patch);
    }

    removeText(index) {
        this.state.textLayers.splice(index, 1);
        this.inspector.render();
        this.commit();
    }

    async setLogo(file) {
        if (!file) { this.state.logo = null; this.inspector.render(); this.commit(); return; }
        if (file.size > 5 * 1024 * 1024) {
            $('status').textContent = 'Logo trop lourd (5 Mo maximum).';
            return;
        }
        const bitmap = await createImageBitmap(file);
        this.state.logo = {
            bitmap, id: Date.now(), size: 14, x: 50, y: 88, opacity: 1,
        };
        this.inspector.render();
        this.commit();
    }

    updateLogo(patch) {
        Object.assign(this.state.logo, patch);
    }

    setShadow(patch, rerender = true) {
        Object.assign(this.state.shadow, patch);
        if (rerender) { this.inspector.render(); this.commit(); }
    }

    setFinish(patch, rerender = true) {
        Object.assign(this.state.finish, patch);
        if (rerender) { this.inspector.render(); this.commit(); }
    }

    /* ---------- pistes d'animation ---------- */

    toggleKey(key, value) {
        this.state.tracks = toggleKey(this.state.tracks || {}, key, this.time, value);
        this.inspector.render();
        this.renderTracks();
        this.commit();
    }

    clearTrack(key) {
        const next = { ...this.state.tracks };
        delete next[key];
        this.state.tracks = next;
        this.inspector.render();
        this.renderTracks();
        this.commit();
    }

    /*
     * Le tiroir : une regle temporelle, puis une ligne par reglage anime. Les
     * losanges sont cliquables pour se placer dessus.
     */
    renderTracks() {
        const tracks = this.state.tracks || {};
        const keys = Object.keys(tracks);
        $('keys-summary').textContent = keys.length
            ? `Keyframes · ${keys.length} piste${keys.length > 1 ? 's' : ''}`
            : 'Keyframes';

        const ruler = $('keys-ruler');
        ruler.replaceChildren();
        const stepSec = this.state.loop <= 8 ? 1 : this.state.loop <= 20 ? 2 : 5;
        for (let sec = 0; sec <= this.state.loop; sec += stepSec) {
            ruler.append(el('span', {
                text: `${sec}s`,
                style: { left: `${(sec / this.state.loop) * 100}%` },
            }));
        }

        const body = $('keys-tracks');
        if (!keys.length) {
            body.replaceChildren(el('p.keys-empty', {
                text: "Aucun point pour l'instant — clique le ◇ a cote d'un reglage ou d'une couleur pour l'animer.",
            }));
            return;
        }
        body.replaceChildren(...keys.map((key) => {
            const lane = el('div.track-lane', {}, [
                el('div.track-playhead', { style: { left: `${this.time * 100}%` } }),
                ...tracks[key].map((k) => el('button.kf', {
                    type: 'button',
                    title: `${(k.t * this.state.loop).toFixed(1)}s`,
                    'aria-label': `Aller a ${(k.t * this.state.loop).toFixed(1)} seconde`,
                    style: { left: `${k.t * 100}%` },
                    onclick: () => {
                        this.time = k.t;
                        this.playing = false;
                        $('play').textContent = '▶';
                        $('scrub').value = String(Math.round(k.t * 1000));
                        this.inspector.render();
                        this.renderTracks();
                    },
                })),
            ]);
            return el('div.track', {}, [
                el('span.track-name', { text: trackLabel(this.template, key) }),
                lane,
                el('button.kf-btn.track-del', {
                    type: 'button',
                    text: '×',
                    title: 'Supprimer cette piste',
                    'aria-label': 'Supprimer cette piste',
                    onclick: () => this.clearTrack(key),
                }),
            ]);
        }));
    }

    /* ---------- transport et export ---------- */

    bindTransport() {
        $('keys-toggle').addEventListener('click', () => {
            const body = $('keys-body');
            body.hidden = !body.hidden;
            $('keys-toggle').setAttribute('aria-expanded', String(!body.hidden));
            this.layout();
        });
        $('play').addEventListener('click', () => {
            this.playing = !this.playing;
            $('play').textContent = this.playing ? '❚❚' : '▶';
        });
        $('rewind').addEventListener('click', () => { this.time = 0; });
        $('scrub').addEventListener('input', (e) => {
            this.time = Number(e.target.value) / 1000;
            this.playing = false;
            $('play').textContent = '▶';
            // Le losange d'un reglage indique s'il porte un point A CET INSTANT :
            // deplacer la tete de lecture doit donc rafraichir l'inspecteur.
            this.inspector.render();
            this.renderTracks();
        });
        $('undo').addEventListener('click', () => this.undo());
        $('redo').addEventListener('click', () => this.redo());
        this.commit();
        window.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select')) return;
            if (e.key === ' ') { e.preventDefault(); $('play').click(); }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.redo(); else this.undo();
            }
        });
    }

    bindExport() {
        const formats = availableFormats();
        const select = $('export-format');
        select.replaceChildren(...formats.map(([kind, label, ext, mime]) => {
            const opt = document.createElement('option');
            opt.value = [kind, ext, mime || ''].join('|');
            opt.textContent = label;
            return opt;
        }));
        $('export-note').textContent = formats.length === 0
            ? "Ce navigateur ne sait pas encoder de video. Ouvre Motion dans Chrome, Edge ou Safari 17 et plus."
            : hasWebCodecs()
                ? "Le MP4 est encode image par image, aussi vite que la machine le permet : aucune image sautee, quelle que soit la definition."
                : "Ce navigateur n'a pas WebCodecs : l'export passe par un enregistrement en temps reel, qui dure autant que la boucle et peut sauter des images.";
        $('export-go').disabled = formats.length === 0;

        $('export-open').addEventListener('click', () => {
            $('export-modal').hidden = false;
            this.syncExportSummary();
            this.probeResolutions();
        });
        ['export-res', 'export-fps', 'export-format', 'export-loops'].forEach((id) => {
            $(id).addEventListener('change', () => {
                this.syncExportSummary();
                if (id !== 'export-loops') this.probeResolutions();
            });
        });
        $('export-cancel').addEventListener('click', () => {
            this.abort?.abort();
            $('export-modal').hidden = true;
        });
        $('export-go').addEventListener('click', () => this.runExport());
    }

    /*
     * Le recapitulatif de la modale : definition reelle, duree finale, debit et
     * poids attendu. Il annonce le debit qui sera vraiment utilise, pas une
     * estimation decorative.
     */
    syncExportSummary() {
        const ratio = FRAMES.find(([l]) => l === this.state.frame)[1];
        const [w, h] = exportSize(ratio, Number($('export-res').value));
        const fps = Number($('export-fps').value);
        const loops = Number($('export-loops').value);
        const seconds = this.state.loop * loops;
        const bits = targetBitrate(w, h, fps);
        const mb = Math.round((bits * seconds) / 8 / 1e6);
        $('export-summary').textContent = `${w}×${h} · ${seconds.toFixed(1)}s · ${Math.round(bits / 1e6)} Mbps · ~${mb} Mo max`;

        const empty = this.media.slots.filter((slot) => !slot).length;
        const warn = $('export-warning');
        warn.hidden = empty === 0;
        if (empty) {
            warn.textContent = empty === this.state.slotCount
                ? `Aucune image importee : les ${empty} emplacements sortiront avec les vignettes de demonstration.`
                : `${empty} emplacement${empty > 1 ? 's' : ''} sur ${this.state.slotCount} ${empty > 1 ? 'sont vides' : 'est vide'} — ${empty > 1 ? 'ils sortiront' : 'il sortira'} avec les vignettes de demonstration.`;
        }
    }

    /*
     * Toutes les machines n'encodent pas la 4K ou la 8K. On demande au
     * navigateur avant d'ouvrir le choix, plutot que de le laisser echouer une
     * fois l'export lance.
     */
    async probeResolutions() {
        if (!hasWebCodecs() || $('export-format').value.split('|')[0] !== 'mp4') return;
        const fps = Number($('export-fps').value);
        const ratio = FRAMES.find(([l]) => l === this.state.frame)[1];
        const options = [...$('export-res').options];
        await Promise.all(options.map(async (opt) => {
            const [w, h] = exportSize(ratio, Number(opt.value));
            const codec = await pickCodec(w, h, fps);
            opt.disabled = !codec;
            const label = opt.textContent.replace(/ — non supporte.*$/, '');
            opt.textContent = codec ? label : `${label} — non supporte ici`;
        }));
        const current = $('export-res').selectedOptions[0];
        if (current?.disabled) {
            const fallback = options.filter((o) => !o.disabled).pop();
            if (fallback) $('export-res').value = fallback.value;
        }
    }

    async runExport() {
        const [kind, ext, mime] = $('export-format').value.split('|');
        const fps = Number($('export-fps').value);
        const short = Number($('export-res').value);
        const loops = Number($('export-loops').value);
        const ratio = FRAMES.find(([l]) => l === this.state.frame)[1];
        const size = exportSize(ratio, short);

        this.exporting = true;
        this.abort = new AbortController();
        $('export-go').disabled = true;
        $('export-progress').hidden = false;

        this.renderFps = fps;
        const common = {
            canvas: this.canvas,
            duration: this.state.loop,
            fps,
            loops,
            signal: this.abort.signal,
            drawFrame: (t) => this.draw(t, size),
            onProgress: (p) => { $('export-bar').style.width = `${Math.round(p * 100)}%`; },
        };

        try {
            const { blob, exact } = kind === 'mp4'
                ? await encodeMp4({ ...common, width: size[0], height: size[1] })
                : await recordWebm({ ...common, mime });
            download(blob, `motion-${this.template.id}-${short}p.${ext}`);
            $('status').textContent = exact
                ? 'Export termine.'
                : "Export termine, mais la machine n'a pas suivi : des images ont pu sauter. Essaie une definition plus basse.";
        } catch (err) {
            $('status').textContent = `Export impossible : ${err.message}`;
        } finally {
            this.exporting = false;
            this.renderFps = 60;
            $('export-go').disabled = false;
            $('export-progress').hidden = true;
            $('export-bar').style.width = '0';
            $('export-modal').hidden = true;
            this.layout();
        }
    }
}

try {
    window.motionApp = new App();
} catch (err) {
    document.body.innerHTML = `<div style="padding:40px;font:14px -apple-system,system-ui,sans-serif;color:#f2f2f4">
      <strong>Motion n'a pas pu demarrer.</strong><br />${err.message}
      <p style="color:#9a9aa4">Le moteur a besoin de WebGL2.</p></div>`;
}
