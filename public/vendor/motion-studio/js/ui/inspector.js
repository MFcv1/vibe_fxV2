/*
 * L'inspecteur : sections fixes (cadre, medias, duree, texte, logo) puis le bloc
 * de reglages propre au template courant, lu dans son schema `params`.
 *
 * Les sliders modifient l'etat sans reconstruire le panneau — sinon on perdrait
 * le curseur en plein glissement. Seuls les changements de structure (template,
 * nombre de slots, ajout d'un calque) declenchent un rendu complet.
 */

import { el, segmented, pickFile } from './dom.js';
import { trackKey, hasKeyAt } from '../engine/keyframes.js';
import { FRAMES, CARD_RATIOS, CARD_RATIOS_FRAME } from '../engine/stage.js';
import { EASING_LABELS } from '../engine/math.js';

const LOOPS = [5, 10, 15, 20, 30];
const FONTS = [
    ['-apple-system, system-ui, sans-serif', 'Systeme'],
    ['Georgia, "Times New Roman", serif', 'Serif'],
    ['"SF Mono", ui-monospace, Menlo, monospace', 'Mono'],
];

export default class Inspector {
    /*
     * Le losange qui rend un reglage animable. Il pose ou retire un point a
     * l'instant courant ; c'est la seule facon d'ouvrir une piste, comme dans
     * l'editeur de reference.
     */
    keyButton(scope, name, getValue) {
        const { app } = this;
        const key = trackKey(scope, name);
        const on = hasKeyAt(app.state.tracks, key, app.time);
        return el('button.kf-btn', {
            type: 'button',
            text: '◇',
            title: on ? 'Retirer le point a cet instant' : 'Animer ce reglage a cet instant',
            'aria-label': `Animer ${name}`,
            'aria-pressed': String(on),
            onclick: (e) => { e.preventDefault(); app.toggleKey(key, getValue()); },
        });
    }

    constructor(root, app) {
        this.root = root;
        this.app = app;
    }

    render() {
        const { app } = this;
        const s = app.state;
        const tpl = app.template;
        this.root.replaceChildren(
            this.frameSection(s),
            this.mediaSection(s),
            this.timingSection(s),
            this.textSection(s),
            this.logoSection(s),
            this.templateSection(tpl, s),
            ...(tpl.params.some((p) => p.t === 'shadow') ? [this.shadowSection(s)] : []),
            el('div.section', {}, [
                el('button.btn.wide', {
                    type: 'button',
                    text: 'Reinitialiser les reglages',
                    onclick: () => app.resetParams(),
                }),
            ]),
        );
    }

    frameSection(s) {
        return el('div.section', {}, [
            el('p.section-title', { text: 'Cadre' }),
            el('div.frame-grid', {}, FRAMES.map(([label, ratio]) => el('button.frame-btn', {
                type: 'button',
                'aria-pressed': s.frame === label,
                onclick: () => this.app.setFrame(label),
            }, [
                el('div.frame-shape', { style: { height: `${Math.round(22 / ratio)}px` } }),
                el('span', { text: label }),
            ]))),
        ]);
    }

    mediaSection(s) {
        const { app } = this;
        const slots = el('div.slots');
        for (let i = 0; i < s.slotCount; i += 1) slots.append(this.slotRow(i));

        return el('div.section', {}, [
            el('p.section-title', { text: `Medias · ${s.slotCount} emplacements` }),
            el('div.count-row', {}, [
                el('label', { text: "Nombre d'images" }),
                el('div.stepper', {}, [
                    el('button', { type: 'button', text: '−', onclick: () => app.setSlotCount(s.slotCount - 1) }),
                    el('span.val', { text: String(s.slotCount) }),
                    el('button', { type: 'button', text: '+', onclick: () => app.setSlotCount(s.slotCount + 1) }),
                ]),
            ]),
            slots,
            el('button.btn.wide', {
                type: 'button',
                text: 'Vider les images',
                style: { marginTop: '10px' },
                onclick: () => app.clearMedia(),
            }),
        ]);
    }

    slotRow(index) {
        const { app } = this;
        const filled = app.media.slots[index];
        const thumb = el('div.slot-thumb', {}, [
            filled
                ? el('img', { src: app.slotPreview(index), alt: '' })
                : el('span', { text: '+' }),
        ]);

        const row = el('div.slot', {
            draggable: true,
            onclick: () => pickFile('image/*', (file) => app.setSlot(index, file)),
            ondragstart: (e) => {
                e.dataTransfer.setData('text/ms-slot', String(index));
                e.dataTransfer.effectAllowed = 'move';
            },
            ondragover: (e) => { e.preventDefault(); row.classList.add('over'); },
            ondragleave: () => row.classList.remove('over'),
            ondrop: (e) => {
                e.preventDefault();
                row.classList.remove('over');
                const from = e.dataTransfer.getData('text/ms-slot');
                if (from !== '') { app.moveSlot(Number(from), index); return; }
                const file = e.dataTransfer.files?.[0];
                if (file) app.setSlot(index, file);
            },
        }, [
            el('span.slot-grip', { text: '⠿', 'aria-hidden': 'true' }),
            thumb,
            el('div.slot-meta', {}, [
                el('strong', { text: `Emplacement ${index + 1}` }),
                el('small', { text: filled ? filled.name : 'Depose une image ou clique' }),
            ]),
            filled
                ? el('button.link-btn.slot-clear', {
                    type: 'button',
                    text: 'Retirer',
                    onclick: (e) => { e.stopPropagation(); app.clearSlot(index); },
                })
                : null,
        ]);
        return row;
    }

    timingSection(s) {
        const { app } = this;
        const value = el('span.val', { text: `${s.loop}s` });
        const range = el('input', {
            type: 'range', min: 2, max: 60, step: 1, value: s.loop,
            oninput: (e) => {
                const v = Number(e.target.value);
                value.textContent = `${v}s`;
                app.setLoop(v, false);
            },
        });
        return el('div.section', {}, [
            el('p.section-title', { text: 'Duree' }),
            el('div.slider-row', {}, [
                el('div.slider-head', {}, [el('label', { text: 'Duree de boucle' }), value]),
                segmented(LOOPS.map((v) => [v, `${v}s`]), s.loop, (v) => app.setLoop(Number(v))),
                range,
            ]),
        ]);
    }

    textSection(s) {
        const { app } = this;
        return el('div.section', {}, [
            el('p.section-title', { text: 'Texte' }),
            ...s.textLayers.map((layer, i) => this.textLayer(layer, i)),
            el('button.btn.wide', { type: 'button', text: '+ Ajouter un texte', onclick: () => app.addText() }),
        ]);
    }

    textLayer(layer, i) {
        const { app } = this;
        const upd = (k) => (e) => app.updateText(i, { [k]: e.target.value });
        const updNum = (k) => (e) => app.updateText(i, { [k]: Number(e.target.value) });
        return el('div.text-layer', {}, [
            el('textarea', { value: layer.text, placeholder: 'Ton texte', oninput: upd('text') }),
            el('div.grid2', {}, [
                el('select', {
                    onchange: upd('font'),
                }, FONTS.map(([v, l]) => el('option', { value: v, text: l, selected: layer.font === v }))),
                el('select', {
                    onchange: upd('align'),
                }, [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']]
                    .map(([v, l]) => el('option', { value: v, text: l, selected: layer.align === v }))),
            ]),
            this.miniSlider('Taille', layer.size, 1, 30, 0.5, updNum('size'), '%'),
            this.miniSlider('X', layer.x, 0, 100, 0.5, updNum('x'), '%'),
            this.miniSlider('Y', layer.y, 0, 100, 0.5, updNum('y'), '%'),
            this.miniSlider('Rotation', layer.rotate, -90, 90, 1, updNum('rotate'), '°'),
            this.miniSlider('Opacite', layer.opacity * 100, 0, 100, 1,
                (e) => app.updateText(i, { opacity: Number(e.target.value) / 100 }), '%'),
            el('div.row', {}, [
                el('label', { text: 'Couleur' }),
                el('input', { type: 'color', value: layer.color, oninput: upd('color') }),
            ]),
            el('button.link-btn', { type: 'button', text: 'Supprimer ce texte', onclick: () => app.removeText(i) }),
        ]);
    }

    miniSlider(label, value, min, max, step, oninput, unit = '') {
        const out = el('span.val', { text: `${Math.round(value * 10) / 10}${unit}` });
        return el('div.slider-row', {}, [
            el('div.slider-head', {}, [el('label', { text: label }), out]),
            el('input', {
                type: 'range',
                min,
                max,
                step,
                value,
                oninput: (e) => {
                    out.textContent = `${Math.round(Number(e.target.value) * 10) / 10}${unit}`;
                    oninput(e);
                },
            }),
        ]);
    }

    logoSection(s) {
        const { app } = this;
        if (!s.logo) {
            return el('div.section', {}, [
                el('p.section-title', { text: 'Logo' }),
                el('button.btn.wide', {
                    type: 'button',
                    text: 'Televerser un logo (5 Mo max)',
                    onclick: () => pickFile('image/*', (file) => app.setLogo(file)),
                }),
            ]);
        }
        return el('div.section', {}, [
            el('p.section-title', { text: 'Logo' }),
            this.miniSlider('Taille', s.logo.size, 2, 60, 0.5, (e) => app.updateLogo({ size: Number(e.target.value) }), '%'),
            this.miniSlider('X', s.logo.x, 0, 100, 0.5, (e) => app.updateLogo({ x: Number(e.target.value) }), '%'),
            this.miniSlider('Y', s.logo.y, 0, 100, 0.5, (e) => app.updateLogo({ y: Number(e.target.value) }), '%'),
            this.miniSlider('Opacite', s.logo.opacity * 100, 0, 100, 1,
                (e) => app.updateLogo({ opacity: Number(e.target.value) / 100 }), '%'),
            el('button.link-btn', { type: 'button', text: 'Retirer le logo', onclick: () => app.setLogo(null) }),
        ]);
    }

    templateSection(tpl, s) {
        const { app } = this;
        const bg = s.background;
        const nodes = [
            el('p.section-title', { text: tpl.name }),
            segmented([['color', 'Couleur'], ['gradient', 'Degrade'], ['image', 'Image']], bg.mode,
                (v) => app.setBackground({ mode: v })),
            el('div.row', { style: { marginTop: '10px' } }, [
                el('label', { text: bg.mode === 'gradient' ? 'Depart' : 'Couleur' }),
                this.keyButton('bg', 'color', () => this.app.state.background.color),
                el('input', { type: 'color', value: bg.color, oninput: (e) => app.setBackground({ color: e.target.value }, false) }),
            ]),
        ];
        if (bg.mode === 'gradient') {
            nodes.push(el('div.row', {}, [
                el('label', { text: 'Arrivee' }),
                this.keyButton('bg', 'color2', () => this.app.state.background.color2),
                el('input', { type: 'color', value: bg.color2, oninput: (e) => app.setBackground({ color2: e.target.value }, false) }),
            ]));
            nodes.push(this.miniSlider('Angle', bg.angle, 0, 360, 1,
                (e) => app.setBackground({ angle: Number(e.target.value) }, false), '°'));
        }
        if (bg.mode === 'image') {
            nodes.push(el('button.btn.wide', {
                type: 'button',
                style: { marginTop: '10px' },
                text: bg.image ? "Changer l'image de fond" : 'Choisir une image de fond',
                onclick: () => pickFile('image/*', (file) => app.setBackgroundImage(file)),
            }));
        }

        tpl.params.forEach((p) => {
            if (p.hidden || p.t === 'shadow') return;
            nodes.push(this.paramControl(p, s.params));
        });
        return el('div.section', {}, nodes.filter(Boolean));
    }

    paramControl(p, params) {
        const { app } = this;
        if (p.t === 'section') return el('p.section-title', { text: p.label, style: { marginTop: '16px' } });

        if (p.t === 'slider') {
            const dec = p.dec || 0;
            const fmt = (v) => `${Number(v).toFixed(dec)}${p.unit || ''}`;
            const out = el('span.val', { text: fmt(params[p.k]) });
            return el('div.slider-row', {}, [
                el('div.slider-head', {}, [
                    el('label', { text: p.label }),
                    out,
                    this.keyButton('p', p.k, () => this.app.state.params[p.k]),
                ]),
                el('input', {
                    type: 'range',
                    min: p.min,
                    max: p.max,
                    step: p.step,
                    value: params[p.k],
                    oninput: (e) => {
                        const v = Number(e.target.value);
                        out.textContent = fmt(v);
                        app.setParam(p.k, v, false);
                    },
                    onchange: () => app.commit(),
                }),
            ]);
        }

        const options = p.t === 'ratio' ? (p.frame ? CARD_RATIOS_FRAME : CARD_RATIOS)
            : p.t === 'easing' ? EASING_LABELS
                : p.options;
        return el('div.slider-row', {}, [
            el('div.slider-head', {}, [el('label', { text: p.label })]),
            segmented(options, params[p.k], (v) => app.setParam(p.k, v)),
        ]);
    }

    shadowSection(s) {
        const { app } = this;
        const sh = s.shadow;
        return el('div.section', {}, [
            el('p.section-title', { text: 'Ombre' }),
            el('div.row', {}, [
                el('label', { text: 'Activer' }),
                el('input', {
                    type: 'checkbox',
                    checked: sh.enabled,
                    onchange: (e) => app.setShadow({ enabled: e.target.checked }),
                }),
            ]),
            ...(sh.enabled ? [
                this.miniSlider('Decalage X', sh.x, -30, 30, 0.5, (e) => app.setShadow({ x: Number(e.target.value) }, false), '%'),
                this.miniSlider('Decalage Y', sh.y, -30, 30, 0.5, (e) => app.setShadow({ y: Number(e.target.value) }, false), '%'),
                this.miniSlider('Etalement', sh.spread, 0, 40, 0.5, (e) => app.setShadow({ spread: Number(e.target.value) }, false), '%'),
                this.miniSlider('Opacite', sh.opacity, 0, 100, 1, (e) => app.setShadow({ opacity: Number(e.target.value) }, false), '%'),
            ] : []),
        ]);
    }
}
