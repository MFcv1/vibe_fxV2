/*
 * Gestion des images : chargement des fichiers deposes, cache de textures GL, et
 * fabrication des vignettes de demonstration quand les slots sont vides — pour
 * qu'on voie le mouvement des la premiere seconde, sans rien importer.
 */

import demoCard from './demoCards.js';

/*
 * Vignettes du catalogue : des aplats gris neutres. Elles servent a lire le
 * MOUVEMENT, pas le contenu — une composition chargee y serait illisible a
 * 168 pixels.
 */
function schematicCanvas(index, size = 256) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#9aa0ad';
    g.fillRect(0, 0, size, size);
    g.fillStyle = index % 2 ? '#848a97' : '#aab0bc';
    g.fillRect(0, size * 0.55, size, size * 0.45);
    return c;
}

export default class MediaPool {
    /*
     * `schematic` sert aux vignettes du catalogue : des aplats gris neutres, qui
     * donnent a lire le mouvement et pas le contenu des images.
     */
    constructor(renderer, schematic = false) {
        this.renderer = renderer;
        this.schematic = schematic;
        this.slots = [];          // { name, bitmap, tex, aspect }
        this.demo = [];           // textures de demonstration
        this.logo = null;
    }

    ensureDemo(count) {
        while (this.demo.length < count) {
            const canvas = this.schematic
                ? schematicCanvas(this.demo.length)
                : demoCard(this.demo.length);
            this.demo.push({
                tex: this.renderer.createTexture(canvas),
                aspect: 1,
                isDemo: true,
            });
        }
    }

    setSlotCount(n) {
        while (this.slots.length < n) this.slots.push(null);
        if (this.slots.length > n) {
            this.slots.slice(n).forEach((s) => s && this.renderer.destroyTexture(s.tex));
            this.slots.length = n;
        }
        this.ensureDemo(Math.max(n, 12));
    }

    async setSlot(index, file) {
        const bitmap = await createImageBitmap(file);
        const old = this.slots[index];
        if (old) this.renderer.destroyTexture(old.tex);
        this.slots[index] = {
            name: file.name || `image ${index + 1}`,
            tex: this.renderer.createTexture(bitmap),
            aspect: bitmap.width / bitmap.height,
        };
        bitmap.close?.();
        return this.slots[index];
    }

    clearSlot(index) {
        const old = this.slots[index];
        if (old) this.renderer.destroyTexture(old.tex);
        this.slots[index] = null;
    }

    clearAll() {
        this.slots.forEach((s, i) => this.clearSlot(i));
    }

    hasAny() {
        return this.slots.some(Boolean);
    }

    /*
     * Rend le media du slot `i`, en bouclant si le template demande plus de
     * cartes que de slots (Spiral Stream monte a 24 cartes pour 12 slots).
     * Un slot vide retombe sur la vignette de demonstration correspondante.
     */
    get(i) {
        const n = this.slots.length || 1;
        const idx = ((i % n) + n) % n;
        const filled = this.slots[idx];
        if (filled) return filled;
        this.ensureDemo(idx + 1);
        return this.demo[idx % this.demo.length];
    }

    /*
     * Cadrage "cover" : la carte a son propre ratio, l'image garde le sien, on
     * recentre et on rogne le debordement.
     */
    static uvCover(imageAspect, cardAspect) {
        if (!imageAspect || !cardAspect) return [0, 0, 1, 1];
        if (imageAspect > cardAspect) {
            const w = cardAspect / imageAspect;
            return [(1 - w) / 2, 0, w, 1];
        }
        const h = imageAspect / cardAspect;
        return [0, (1 - h) / 2, 1, h];
    }
}
