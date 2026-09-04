/*
 * Le catalogue : une vignette animee par template.
 *
 * Un contexte WebGL par vignette epuiserait la limite du navigateur (une
 * quinzaine) des qu'on passera aux 62 templates. On rend donc toutes les
 * vignettes dans UN seul canvas WebGL partage, a tour de role, puis on recopie
 * le resultat dans le petit canvas 2D de chaque tuile. Les tuiles hors ecran
 * sont ignorees.
 */

import { el } from './dom.js';
import QuadRenderer from '../engine/gl.js';
import MediaPool from '../engine/media.js';
import Stage from '../engine/stage.js';
import { TEMPLATES, CATEGORIES, defaultParams } from '../templates/index.js';

const SIZE = 168;
const PER_FRAME = 3; // vignettes rafraichies a chaque tour de boucle

const THUMB_STATE = {
    frame: '1:1',
    background: {
        mode: 'color', color: '#1c1c20', color2: '#1c1c20', angle: 90, image: null,
    },
    textLayers: [],
    logo: null,
    shadow: {
        enabled: false, x: 0, y: 0, spread: 0, opacity: 0,
    },
};

export default class Catalogue {
    constructor(root, onPick) {
        this.root = root;
        this.onPick = onPick;
        this.tiles = new Map();
        this.collapsed = {};
        this.cursor = 0;
        this.activeId = null;

        const glCanvas = document.createElement('canvas');
        glCanvas.width = SIZE;
        glCanvas.height = SIZE;
        this.glCanvas = glCanvas;
        try {
            this.renderer = new QuadRenderer(glCanvas);
            this.media = new MediaPool(this.renderer, true);
            this.stage = new Stage(this.renderer, this.media);
        } catch (err) {
            this.renderer = null;
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                const tile = this.tiles.get(e.target.dataset.id);
                if (tile) tile.visible = e.isIntersecting;
            });
        }, { root: this.root, rootMargin: '120px' });

        this.build();
    }

    build() {
        this.root.replaceChildren(...CATEGORIES.map((cat) => {
            const items = TEMPLATES.filter((t) => t.category === cat.id);
            const grid = el('div.cat-grid');
            items.forEach((tpl) => grid.append(this.tile(tpl)));
            const head = el('button.cat-head', {
                type: 'button',
                'aria-expanded': 'true',
                onclick: () => {
                    grid.hidden = !grid.hidden;
                    head.setAttribute('aria-expanded', String(!grid.hidden));
                    this.collapsed[cat.id] = grid.hidden;
                },
            }, [
                el('span', { text: `${cat.label} · ${items.length}` }),
                el('span.chev', { text: '⌄', 'aria-hidden': 'true' }),
            ]);
            // On restitue l'etat plie d'une famille quand le catalogue est
            // reconstruit, sinon tout se rouvrirait dans le dos de l'utilisateur.
            if (this.collapsed[cat.id]) {
                grid.hidden = true;
                head.setAttribute('aria-expanded', 'false');
            }
            return el('div.cat-section', {}, [head, grid]);
        }));
    }

    tile(tpl) {
        const canvas = el('canvas', { width: SIZE, height: SIZE });
        const node = el('button.tile', {
            type: 'button',
            'data-id': tpl.id,
            'aria-pressed': 'false',
            title: tpl.name,
            onclick: () => this.onPick(tpl.id),
        }, [canvas, el('span.tile-name', { text: tpl.name })]);

        this.tiles.set(tpl.id, {
            tpl,
            node,
            ctx: canvas.getContext('2d'),
            visible: true,
            params: defaultParams(tpl),
        });
        this.observer.observe(node);
        return node;
    }

    setActive(id) {
        this.activeId = id;
        this.tiles.forEach((tile, key) => {
            tile.node.setAttribute('aria-pressed', String(key === id));
        });
    }

    /* Appelee a chaque image de la boucle principale. */
    tick(elapsed) {
        if (!this.renderer) return;
        const list = [...this.tiles.values()].filter((t) => t.visible);
        if (!list.length) return;
        for (let k = 0; k < PER_FRAME; k += 1) {
            const tile = list[this.cursor % list.length];
            this.cursor += 1;
            const loop = tile.tpl.loop || 12;
            const t = (elapsed / loop) % 1;
            this.media.setSlotCount(tile.tpl.slots);
            try {
                this.stage.render(tile.tpl, {
                    ...THUMB_STATE, params: tile.params, slotCount: tile.tpl.slots,
                }, t, [SIZE, SIZE]);
                tile.ctx.clearRect(0, 0, SIZE, SIZE);
                tile.ctx.drawImage(this.glCanvas, 0, 0);
            } catch (err) {
                tile.visible = false; // une vignette cassee ne bloque pas les autres
            }
        }
    }
}
