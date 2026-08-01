/*
 * Horloge de playhead.
 *
 * Pendant la lecture, le store n'est mis a jour que toutes les ~90 ms: c'est
 * volontaire (chaque ecriture re-rend le storyboard et l'inspecteur), mais un
 * curseur qui bouge 11 fois par seconde se voit immediatement.
 *
 * Cette horloge transporte le temps a la cadence reelle du moteur, hors de React.
 * Les composants qui doivent bouger a 60 fps (curseur, timecode) s'y abonnent et
 * ecrivent directement dans le DOM, sans provoquer de rendu.
 */

let currentTime = 0;
const listeners = new Set();

export function setPlayheadTime(time) {
    const value = Number(time);
    if (!Number.isFinite(value) || value === currentTime) return;
    currentTime = value;
    listeners.forEach((listener) => listener(value));
}

export function getPlayheadTime() {
    return currentTime;
}

export function subscribePlayhead(listener) {
    listeners.add(listener);
    listener(currentTime);
    return () => listeners.delete(listener);
}
