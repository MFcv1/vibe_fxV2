import { NextResponse } from 'next/server';
import catalogue from '@/features/vibeos/soundtrack/data/catalogueCc.json';

/*
 * Catalogue maison sous licence CC BY 4.0 (voir scripts/moisson-musique-cc.mjs).
 *
 * Pourquoi un catalogue embarque plutot qu'une API musique: aucune API gratuite
 * n'autorise l'usage commercial. Une licence CC-BY, si - et elle est
 * irrevocable. Le JSON est donc servi depuis le build: pas d'appel sortant, pas
 * de quota, pas de conditions qui changent.
 *
 * L'attribution est obligatoire: chaque piste renvoyee porte son champ
 * `attribution`, et l'interface doit l'afficher.
 */

const MAX_RESULTATS = 60;

const sansAccent = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function GET(request) {
    const params = request.nextUrl.searchParams;
    const categorie = params.get('categorie') || '';
    const q = sansAccent(params.get('q') || '').trim();

    let pistes = catalogue.pistes;

    if (categorie) {
        pistes = pistes.filter((p) => p.categories.includes(categorie));
    }

    if (q) {
        const mots = q.split(/\s+/).filter(Boolean);
        pistes = pistes.filter((p) => {
            const foin = sansAccent([
                p.titre, p.artiste, ...p.genres, ...p.ambiances, ...p.instruments,
            ].join(' '));
            return mots.every((mot) => foin.includes(mot));
        });
    }

    return NextResponse.json({
        source: catalogue.source,
        categories: catalogue.categories,
        total: pistes.length,
        pistes: pistes.slice(0, MAX_RESULTATS),
    });
}
