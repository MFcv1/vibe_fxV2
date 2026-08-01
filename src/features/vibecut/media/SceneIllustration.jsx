"use client";

import React, { useId } from 'react';

/*
 * Illustrations de scene, 100 % SVG inline.
 * Servent partout ou il faut representer un media sans en avoir un vrai:
 * maquettes des modes, vignettes de mouvement/transition, cartes de scene avant
 * que la miniature reelle soit extraite.
 * Aucun asset externe, aucune requete reseau, rendu identique en SSR et client.
 */

export const SCENE_VARIANTS = ['mountain', 'city', 'beach', 'forest', 'portrait', 'product'];

export function getSceneVariant(index = 0) {
    const safeIndex = Math.abs(Math.round(Number(index) || 0));
    return SCENE_VARIANTS[safeIndex % SCENE_VARIANTS.length];
}

export function getSceneVariantForKey(key = '') {
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
        hash = (hash * 31 + key.charCodeAt(index)) % 997;
    }
    return getSceneVariant(hash);
}

function Mountain({ uid }) {
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2b3b57" />
                    <stop offset="55%" stopColor="#6d6a76" />
                    <stop offset="100%" stopColor="#c08d67" />
                </linearGradient>
                <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#54556b" />
                    <stop offset="100%" stopColor="#2b3040" />
                </linearGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-sky)`} />
            <circle cx="112" cy="52" r="11" fill="#f0b880" opacity="0.85" />
            <path d="M0 62 L34 34 L58 62 Z" fill="#4a4f63" />
            <path d="M40 62 L78 26 L112 62 Z" fill="#3a3f52" />
            <path d="M66 26 L78 26 L86 36 L72 36 Z" fill="#8a90a3" opacity="0.7" />
            <path d="M96 62 L128 40 L160 62 Z" fill="#454a5d" />
            <rect y="62" width="160" height="38" fill={`url(#${uid}-water)`} />
            <ellipse cx="112" cy="70" rx="9" ry="3" fill="#e0a878" opacity="0.4" />
            <rect y="72" width="160" height="1" fill="#ffffff" opacity="0.07" />
            <rect y="82" width="160" height="1" fill="#ffffff" opacity="0.05" />
        </>
    );
}

function City({ uid }) {
    const buildings = [
        { x: 6, y: 48, w: 18, h: 52 },
        { x: 27, y: 34, w: 14, h: 66 },
        { x: 44, y: 54, w: 20, h: 46 },
        { x: 67, y: 24, w: 16, h: 76 },
        { x: 86, y: 44, w: 22, h: 56 },
        { x: 111, y: 32, w: 15, h: 68 },
        { x: 129, y: 50, w: 25, h: 50 },
    ];
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22283c" />
                    <stop offset="60%" stopColor="#4c4257" />
                    <stop offset="100%" stopColor="#a4715f" />
                </linearGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-sky)`} />
            <circle cx="38" cy="60" r="8" fill="#f2c08c" opacity="0.7" />
            {buildings.map((building, index) => (
                <g key={index}>
                    <rect {...{ x: building.x, y: building.y, width: building.w, height: building.h }} fill={index % 2 ? '#1e2231' : '#262b3c'} />
                    {Array.from({ length: 3 }).map((_, row) => (
                        <rect
                            key={row}
                            x={building.x + 3}
                            y={building.y + 6 + row * 10}
                            width={building.w - 6}
                            height="2.5"
                            fill="#f0c98a"
                            opacity={0.16 + ((index + row) % 3) * 0.12}
                        />
                    ))}
                </g>
            ))}
            <rect y="92" width="160" height="8" fill="#141824" />
        </>
    );
}

function Beach({ uid }) {
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a6c86" />
                    <stop offset="60%" stopColor="#e0a074" />
                    <stop offset="100%" stopColor="#f2c48d" />
                </linearGradient>
                <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3f6478" />
                    <stop offset="100%" stopColor="#2e4a5c" />
                </linearGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-sky)`} />
            <circle cx="80" cy="54" r="13" fill="#ffd9a3" opacity="0.9" />
            <rect y="56" width="160" height="26" fill={`url(#${uid}-sea)`} />
            <ellipse cx="80" cy="60" rx="16" ry="2.5" fill="#ffd2a0" opacity="0.45" />
            <rect x="20" y="66" width="46" height="1.4" rx="0.7" fill="#ffffff" opacity="0.18" />
            <rect x="92" y="72" width="52" height="1.4" rx="0.7" fill="#ffffff" opacity="0.14" />
            <path d="M0 82 Q40 76 80 82 T160 80 L160 100 L0 100 Z" fill="#c39a72" />
            <path d="M0 88 Q52 84 104 90 T160 88 L160 100 L0 100 Z" fill="#a67f5d" />
        </>
    );
}

function Forest({ uid }) {
    const row = (baseY, count, height, fill, opacity) => (
        Array.from({ length: count }).map((_, index) => {
            const step = 160 / count;
            const x = index * step + step / 2;
            return (
                <path
                    key={index}
                    d={`M${x - step * 0.42} ${baseY} L${x} ${baseY - height} L${x + step * 0.42} ${baseY} Z`}
                    fill={fill}
                    opacity={opacity}
                />
            );
        })
    );
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-mist`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#48584f" />
                    <stop offset="70%" stopColor="#7d8a72" />
                    <stop offset="100%" stopColor="#95a087" />
                </linearGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-mist)`} />
            {row(70, 9, 26, '#3f4d43', 0.45)}
            {row(84, 7, 34, '#2f3a33', 0.7)}
            {row(100, 6, 40, '#212a24', 0.95)}
        </>
    );
}

function Portrait({ uid }) {
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4a3f52" />
                    <stop offset="100%" stopColor="#7d6a70" />
                </linearGradient>
                <radialGradient id={`${uid}-rim`} cx="0.7" cy="0.3" r="0.7">
                    <stop offset="0%" stopColor="#ffd7b0" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ffd7b0" stopOpacity="0" />
                </radialGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-bg)`} />
            <circle cx="126" cy="26" r="13" fill="#ffffff" opacity="0.09" />
            <circle cx="146" cy="52" r="9" fill="#ffffff" opacity="0.07" />
            <circle cx="24" cy="22" r="16" fill="#ffffff" opacity="0.05" />
            <rect width="160" height="100" fill={`url(#${uid}-rim)`} />
            <path d="M44 100 Q52 66 80 64 Q108 66 116 100 Z" fill="#2f2733" />
            <circle cx="80" cy="46" r="19" fill="#372e3b" />
            <path d="M80 27 a19 19 0 0 1 17 11 a19 19 0 0 1 -34 0 a19 19 0 0 1 17 -11 Z" fill="#2a2330" />
        </>
    );
}

function Product({ uid }) {
    return (
        <>
            <defs>
                <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3a3a42" />
                    <stop offset="62%" stopColor="#54545e" />
                    <stop offset="100%" stopColor="#2c2c33" />
                </linearGradient>
                <linearGradient id={`${uid}-bottle`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d9cfc2" />
                    <stop offset="45%" stopColor="#f1eae0" />
                    <stop offset="100%" stopColor="#b7ac9d" />
                </linearGradient>
            </defs>
            <rect width="160" height="100" fill={`url(#${uid}-sweep)`} />
            <ellipse cx="80" cy="86" rx="34" ry="6" fill="#1c1c21" opacity="0.55" />
            <rect x="66" y="34" width="28" height="52" rx="7" fill={`url(#${uid}-bottle)`} />
            <rect x="74" y="26" width="12" height="10" rx="3" fill="#9c9184" />
            <rect x="70" y="52" width="20" height="14" rx="2" fill="#8a8f7d" opacity="0.55" />
            <ellipse cx="80" cy="34" rx="14" ry="3.4" fill="#ffffff" opacity="0.35" />
            <rect x="108" y="60" width="18" height="26" rx="4" fill="#6f6a62" opacity="0.6" />
            <ellipse cx="117" cy="60" rx="9" ry="2.4" fill="#8e887e" opacity="0.6" />
        </>
    );
}

const SCENES = {
    mountain: Mountain,
    city: City,
    beach: Beach,
    forest: Forest,
    portrait: Portrait,
    product: Product,
};

export default function SceneIllustration({ variant = 'mountain', className, style }) {
    const uid = useId().replace(/:/g, '');
    const Scene = SCENES[variant] || Mountain;
    return (
        <svg
            className={className}
            style={style}
            viewBox="0 0 160 100"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
        >
            <Scene uid={uid} />
        </svg>
    );
}
