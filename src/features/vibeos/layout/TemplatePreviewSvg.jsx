"use client";

import React from 'react';

/*
 * Apercu schematique fidele d'un template: memes coordonnees normalisees que le
 * moteur (zones custom) ou silhouettes des modeles integres. Rendu SVG leger -
 * pas de canvas - pour pouvoir en afficher des dizaines dans le sheet.
 */

/* Silhouettes des modeles integres (memes proportions que layoutRenderer). */
const BUILTIN_ZONES = {
    minimal: [{ x: 0.06, y: 0.06, w: 0.88, h: 0.88 }],
    polaroid: [{ x: 0.1, y: 0.07, w: 0.8, h: 0.72 }],
    pip: [
        { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
        { x: 0.58, y: 0.58, w: 0.34, h: 0.34 },
    ],
    split: [
        { x: 0.04, y: 0.04, w: 0.45, h: 0.92 },
        { x: 0.51, y: 0.04, w: 0.45, h: 0.92 },
    ],
    filmstrip: [
        { x: 0.08, y: 0.05, w: 0.84, h: 0.28 },
        { x: 0.08, y: 0.36, w: 0.84, h: 0.28 },
        { x: 0.08, y: 0.67, w: 0.84, h: 0.28 },
    ],
    mosaic: [
        { x: 0.04, y: 0.04, w: 0.6, h: 0.92 },
        { x: 0.66, y: 0.04, w: 0.3, h: 0.45 },
        { x: 0.66, y: 0.51, w: 0.3, h: 0.45 },
    ],
    grid4: [
        { x: 0.04, y: 0.04, w: 0.45, h: 0.45 },
        { x: 0.51, y: 0.04, w: 0.45, h: 0.45 },
        { x: 0.04, y: 0.51, w: 0.45, h: 0.45 },
        { x: 0.51, y: 0.51, w: 0.45, h: 0.45 },
    ],
    cinema: [{ x: 0.02, y: 0.3, w: 0.96, h: 0.4 }],
};

export function getBuiltinZones(templateId) {
    return BUILTIN_ZONES[templateId] || BUILTIN_ZONES.minimal;
}

export default function TemplatePreviewSvg({
    ratio = 4 / 5,
    zones = null,
    builtinId = null,
    texts = [],
    bgColor = 'var(--vo-surface-3)',
    width = '100%',
}) {
    const viewW = 100;
    const viewH = Math.round(100 / ratio);
    const drawZones = zones || getBuiltinZones(builtinId || 'minimal');

    return (
        <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            style={{ width, display: 'block' }}
            role="img"
            aria-hidden="true"
        >
            <rect x="0" y="0" width={viewW} height={viewH} rx="4" fill={bgColor} />
            {/* Vignettes de 44px dans le panneau: sous 20% d'opacite, le
                decoupage de la grille ne se lit plus. */}
            {drawZones.map((zone, index) => (
                <rect
                    key={zone.id || index}
                    x={zone.x * viewW + 1.2}
                    y={zone.y * viewH + 1.2}
                    width={Math.max(2, zone.w * viewW - 2.4)}
                    height={Math.max(2, zone.h * viewH - 2.4)}
                    rx="2"
                    fill="rgba(255,255,255,0.2)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="0.7"
                />
            ))}
            {texts.slice(0, 4).map((text, index) => {
                const w = Math.min(46, Math.max(14, (text.content?.length || 6) * 2.4 * ((text.scale ?? 100) / 100)));
                return (
                    <rect
                        key={index}
                        x={text.x * viewW - w / 2}
                        y={text.y * viewH - 1.6}
                        width={w}
                        height={3.2}
                        rx="1.6"
                        fill={text.color && text.color !== '#ffffff' ? text.color : 'rgba(255,255,255,0.75)'}
                    />
                );
            })}
        </svg>
    );
}
