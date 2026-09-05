/*
 * La scene : elle assemble une image a partir d'un template, de reglages, du
 * pool de medias et d'un temps. Elle est volontairement pure — meme entree, meme
 * pixel — parce que les trois usages en dependent : apercu, vignettes du
 * catalogue et export image par image doivent passer par ce meme chemin.
 */

import {
    perspective, lookAt, multiply, clamp,
} from './math.js';
import MediaPool from './media.js';

export const FRAMES = [
    ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['4:5', 4 / 5], ['3:4', 3 / 4], ['9:16', 9 / 16],
];

export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const NDC_QUAD = [[-1, 1, 0], [1, 1, 0], [1, -1, 0], [-1, -1, 0]];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export default class Stage {
    constructor(renderer, media) {
        this.renderer = renderer;
        this.media = media;
        this.bgCanvas = document.createElement('canvas');
        this.bgTex = null;
        this.bgKey = '';
        this.overlayCanvas = document.createElement('canvas');
        this.overlayTex = null;
        this.overlayKey = '';
    }

    /* Le fond : couleur unie, degrade ou image, compose en 2D puis televerse. */
    syncBackground(bg, w, h) {
        const key = `${bg.mode}|${bg.color}|${bg.color2}|${bg.angle}|${bg.imageId || ''}|${w}x${h}`;
        if (key === this.bgKey && this.bgTex) return;
        this.bgKey = key;
        const c = this.bgCanvas;
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = bg.color;
        g.fillRect(0, 0, w, h);
        if (bg.mode === 'gradient') {
            const a = (bg.angle * Math.PI) / 180;
            const r = Math.hypot(w, h) / 2;
            const cx = w / 2; const cy = h / 2;
            const grad = g.createLinearGradient(
                cx - Math.cos(a) * r, cy - Math.sin(a) * r,
                cx + Math.cos(a) * r, cy + Math.sin(a) * r,
            );
            grad.addColorStop(0, bg.color);
            grad.addColorStop(1, bg.color2);
            g.fillStyle = grad;
            g.fillRect(0, 0, w, h);
        } else if (bg.mode === 'image' && bg.image) {
            const ia = bg.image.width / bg.image.height;
            const ca = w / h;
            let dw = w; let dh = h;
            if (ia > ca) { dw = h * ia; } else { dh = w / ia; }
            g.drawImage(bg.image, (w - dw) / 2, (h - dh) / 2, dw, dh);
        }
        if (this.bgTex) this.renderer.destroyTexture(this.bgTex);
        this.bgTex = this.renderer.createTexture(c);
    }

    /* Les calques texte et le logo, dessines a plat par-dessus la scene 3D. */
    syncOverlay(layers, logo, w, h) {
        const key = JSON.stringify(layers) + (logo ? `|logo${logo.id}` : '') + `|${w}x${h}`;
        if (key === this.overlayKey && this.overlayTex) return;
        this.overlayKey = key;
        const c = this.overlayCanvas;
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.clearRect(0, 0, w, h);

        layers.forEach((l) => {
            if (!l.text) return;
            const size = (l.size / 100) * h;
            g.font = `${l.weight} ${size}px ${l.font}`;
            g.fillStyle = l.color;
            g.textAlign = l.align;
            g.textBaseline = 'middle';
            g.globalAlpha = l.opacity;
            const x = (l.x / 100) * w;
            const y = (l.y / 100) * h;
            g.save();
            g.translate(x, y);
            if (l.rotate) g.rotate((l.rotate * Math.PI) / 180);
            const lines = String(l.text).split('\n');
            const lh = size * 1.15;
            lines.forEach((line, i) => {
                g.fillText(line, 0, (i - (lines.length - 1) / 2) * lh);
            });
            g.restore();
        });
        g.globalAlpha = 1;

        if (logo?.bitmap) {
            const lw = (logo.size / 100) * w;
            const lh = lw / (logo.bitmap.width / logo.bitmap.height);
            g.globalAlpha = logo.opacity;
            g.drawImage(logo.bitmap, (logo.x / 100) * w - lw / 2, (logo.y / 100) * h - lh / 2, lw, lh);
            g.globalAlpha = 1;
        }

        if (this.overlayTex) this.renderer.destroyTexture(this.overlayTex);
        this.overlayTex = this.renderer.createTexture(c);
    }

    /*
     * `t` est le temps normalise dans la boucle, entre 0 et 1. Le rendu ne doit
     * dependre de rien d'autre : c'est ce qui permet a l'export de rembobiner.
     */
    /*
     * `t` est le temps normalise dans la boucle, entre 0 et 1. Le rendu ne doit
     * dependre de rien d'autre : c'est ce qui permet a l'export de rembobiner.
     *
     * `fps` sert au flou de mouvement, qui a besoin de savoir ce que dure une
     * image pour etaler l'echantillonnage sur la bonne fraction de temps.
     */
    render(template, state, t, size, fps = 60) {
        const { renderer, media } = this;
        const [w, h] = size;
        renderer.resize(w, h);

        const bgRgb = hexToRgb(state.background.color);
        renderer.beginFrame(bgRgb);
        this.syncBackground(state.background, w, h);

        /*
         * Flou de mouvement : plusieurs sous-images reparties autour de
         * l'instant demande, moyennees. C'est un obturateur ouvert un certain
         * temps — ce qui separe une suite de positions nettes, qui saute a
         * l'oeil, d'un mouvement continu.
         *
         * Chaque sous-image est composee ENTIEREMENT dans une cible hors ecran,
         * opaque, avant d'etre moyennee. Baisser l'opacite carte par carte
         * directement a l'ecran serait plus court, mais melangerait les cartes
         * d'une meme sous-image entre elles : les cartes du fond
         * transparaissaient au travers de celles de devant et tout le rendu se
         * delavait.
         */
        const finish = state.finish || { motionBlur: 0, vignette: 0, grain: 0 };
        const blur = clamp(finish.motionBlur || 0, 0, 100);
        const passes = blur <= 0 ? 1 : blur > 66 ? 5 : blur > 33 ? 4 : 3;
        /*
         * Duree d'obturation, en fraction de boucle. A 100% elle vaut deux
         * images et demie, pas une seule : le flou physiquement exact d'un
         * obturateur a 180 degres est presque invisible a l'ecran, alors que
         * l'ecriture recherchee ici — celle des videos sociales — assume une
         * trainee franche.
         */
        const span = ((blur / 100) * 2.5) / Math.max(1, state.loop * fps);

        const paintFrame = (sub) => {
            if (this.bgTex) {
                renderer.setCamera(IDENTITY);
                renderer.draw({
                    p: NDC_QUAD, tex: this.bgTex, radius: 0, aspect: 1, pxScale: w,
                }, bgRgb);
            }
            this.drawScene(template, state, sub, w, w / h, bgRgb, true);
        };

        if (passes === 1) {
            paintFrame(t - Math.floor(t));
        } else {
            renderer.ensureTarget(w, h);
            for (let pass = 0; pass < passes; pass += 1) {
                const offset = ((pass / (passes - 1)) - 0.5) * span;
                let sub = t + offset;
                sub -= Math.floor(sub);
                renderer.bindTarget();
                renderer.beginFrame(bgRgb, true);
                paintFrame(sub);
                renderer.bindScreen();
                // Moyenne progressive : la sous-image k arrive a 1/(k+1), ce qui
                // laisse a chacune le meme poids au bout du compte.
                renderer.blitTarget(1 / (pass + 1));
            }
        }

        if (finish.vignette > 0) {
            renderer.setCamera(IDENTITY);
            renderer.draw({
                p: NDC_QUAD,
                finish: 1,
                finishArg: [(finish.vignette / 100) * 0.85, 0],
                aspect: w / h,
                pxScale: w,
            }, bgRgb);
        }

        this.syncOverlay(state.textLayers, state.logo, w, h);
        if (this.overlayTex && (state.textLayers.length || state.logo)) {
            renderer.setCamera(IDENTITY);
            renderer.draw({
                p: NDC_QUAD, tex: this.overlayTex, radius: 0, aspect: 1, pxScale: w,
            }, bgRgb);
        }

        if (finish.grain > 0) {
            // La graine oscille avec le temps de boucle : le grain change donc
            // d'une image a l'autre, mais retrouve son motif de depart a la fin
            // du tour et ne casse pas le raccord.
            const seed = 900 + Math.sin(t * Math.PI * 2 * 7) * 260;
            renderer.setCamera(IDENTITY);
            renderer.draw({
                p: NDC_QUAD,
                finish: 2,
                finishArg: [(finish.grain / 100) * 0.075, seed],
                aspect: 1,
                pxScale: w,
            }, bgRgb);
        }
    }

    /*
     * Une sous-image : construction de la scene, tri en profondeur, dessin.
     * `weight` est l'opacite de la passe pour la moyenne du flou de mouvement ;
     * `withShadow` limite les ombres a une seule passe, parce qu'une ombre douce
     * n'a pas besoin d'etre floutee et que ca doublerait le nombre de dessins.
     */
    drawScene(template, state, t, w, frameAspect, bgRgb, withShadow) {
        const { renderer, media } = this;
        const P = state.params;
        const ctx = {
            t: t - Math.floor(t),
            P,
            slots: state.slotCount,
            frameAspect,
            bgRgb,
            media,
            cardAspect: (ratio) => this.resolveCardAspect(ratio, 1, frameAspect),
            // Carte dont le ratio est impose par la geometrie (le tunnel, par
            // exemple, etire ses cartes le long du couloir).
            cardAt: (index, aspect) => {
                const m = media.get(index);
                return { tex: m.tex, aspect, uvRect: MediaPool.uvCover(m.aspect, aspect) };
            },
            card: (index, ratioKey) => {
                const m = media.get(index);
                const aspect = this.resolveCardAspect(ratioKey, m.aspect, frameAspect);
                return { tex: m.tex, aspect, uvRect: MediaPool.uvCover(m.aspect, aspect) };
            },
        };

        const scene = template.build(ctx);
        const cam = scene.camera;
        const fov = (cam.fov * Math.PI) / 180;
        const proj = perspective(fov, frameAspect, 0.01, 400);
        const eye = cam.eye || [0, 0, cam.dist];
        const view = lookAt(eye, cam.target || [0, 0, 0], cam.up || [0, 1, 0]);
        renderer.setCamera(multiply(proj, view));

        /*
         * Tri arriere vers avant : il n'y a pas de tampon de profondeur, et la
         * transparence des coins arrondis comme les fondus imposent un ordre
         * explicite.
         *
         * La cle est la profondeur le long de l'AXE DE VISEE, pas la distance a
         * l'oeil. Avec la distance, deux cartes dans un meme plan mais a des
         * hauteurs differentes se retrouvaient rangees l'une derriere l'autre :
         * une image revelee en bandes voyait ses bandes du haut et du bas
         * passer sous l'image posee au centre.
         */
        const target = cam.target || [0, 0, 0];
        const fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
        const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
        fwd[0] /= fl; fwd[1] /= fl; fwd[2] /= fl;

        const quads = scene.quads;
        for (let i = 0; i < quads.length; i += 1) {
            const q = quads[i];
            const p = q.p;
            const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
            const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
            const cz = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
            q._d = (cx - eye[0]) * fwd[0] + (cy - eye[1]) * fwd[1] + (cz - eye[2]) * fwd[2];
            q.pxScale = q.pxScale || w * 0.3;
        }
        quads.sort((a, b) => b._d - a._d);

        const shadow = state.shadow;
        for (let i = 0; i < quads.length; i += 1) {
            const q = quads[i];
            if (withShadow && shadow.enabled && q.castShadow !== false && !q.shadow) {
                renderer.draw(this.shadowQuad(q, shadow), bgRgb);
            }
            renderer.draw(q, bgRgb);
        }
    }

    // Une copie decalee et agrandie du quad, en noir adouci.
    shadowQuad(q, shadow) {
        const dx = shadow.x / 100;
        const dy = -shadow.y / 100;
        const grow = 1 + shadow.spread / 100;
        const p = q.p;
        const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
        const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
        const cz = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
        const scale = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]);
        return {
            p: p.map((c) => [
                cx + (c[0] - cx) * grow + dx * scale,
                cy + (c[1] - cy) * grow + dy * scale,
                cz + (c[2] - cz) * grow,
            ]),
            shadow: true,
            radius: q.radius,
            aspect: q.aspect,
            alpha: (shadow.opacity / 100) * (q.alpha === undefined ? 1 : q.alpha),
            shadowSoft: Math.max(0.015, (shadow.spread / 100) * 0.8),
            pxScale: q.pxScale,
        };
    }

    resolveCardAspect(ratioKey, imageAspect, frameAspect) {
        if (ratioKey === 'frame') return frameAspect || 1;
        if (!ratioKey || ratioKey === 'auto') return imageAspect || 1;
        const found = FRAMES.find(([label]) => label === ratioKey);
        return found ? found[1] : 1;
    }
}

export const CARD_RATIOS = [['auto', 'Auto'], ...FRAMES.map(([l]) => [l, l])];
// Certains templates cadrent leurs cartes sur le format de sortie lui-meme.
export const CARD_RATIOS_FRAME = [['frame', 'Cadre'], ...CARD_RATIOS];
export { clamp };
