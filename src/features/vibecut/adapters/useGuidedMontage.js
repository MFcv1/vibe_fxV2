"use client";

/*
 * Adaptateur de la creation guidee.
 * Traduit un plan de montage (objet pur produit par `data/styleRecipes.js`) en
 * une seule ecriture dans le store video. Les ecrans guides ne connaissent que
 * le plan; le store reste ici.
 */

import { useCallback } from 'react';
import useVideoStore from '@/features/vibefx-studio/video/store/videoStore';

export function useGuidedMontage() {
    /*
     * `applyMontageScore` est l'action ADDITIVE introduite au lot L2: elle ecrit
     * une duree et un mouvement PAR SCENE, et une transition PAR COUPE.
     * `applyGuidedTemplate` (duree unique, transition unique) reste en place pour
     * l'ancien front jusqu'a la phase 7 et n'est plus appelee ici.
     */
    const applyMontageScore = useVideoStore((state) => state.applyMontageScore);

    /*
     * Application du plan.
     *
     * Une seule operation du store, donc une seule entree d'historique et un seul
     * recalcul de la timeline: rejouer un preset pendant que l'utilisateur change
     * d'avis reste instantane.
     *
     * Le store fusionne le look dans les filtres existants; le plan fournit
     * volontairement un look COMPLET (NEUTRAL_LOOK + patch du preset) pour qu'un
     * changement de preset efface bien la colorimetrie du precedent.
     */
    const applyPlan = useCallback((plan) => {
        if (!plan) return false;
        return applyMontageScore({
            sequencePreset: plan.sequencePreset,
            /*
             * Le mouvement part sous sa forme objet depuis le lot L3: le preset
             * SEUL ne dit plus tout, l'intensite fait partie du mouvement et doit
             * suivre jusqu'au clip, puis jusqu'au manifeste d'export.
             */
            scenes: plan.scenes.map((scene) => ({
                duration: scene.duration,
                motion: scene.motion
                    ? { preset: scene.motion, intensity: scene.motionIntensity ?? 1 }
                    : 'none',
            })),
            cuts: plan.cuts.map((cut) => ({
                index: cut.index,
                type: cut.type,
                duration: cut.duration,
                name: cut.name,
            })),
            lookPatch: plan.look,
        });
    }, [applyMontageScore]);

    return { applyPlan };
}

export default useGuidedMontage;
