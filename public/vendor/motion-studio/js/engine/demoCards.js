/*
 * Cartes de demonstration.
 *
 * Un emplacement vide ne doit pas afficher un aplat terne : sans contenu
 * credible, on ne voit pas ce que l'animation donnera une fois les vraies
 * photos posees. On dessine donc une petite collection editoriale — fonds
 * matieres, typographie forte, quelques motifs graphiques — dans une gamme
 * sourde qui ne vole pas la vedette au mouvement.
 *
 * Tout est trace au canvas : aucune image a charger, donc aucune latence au
 * demarrage et rien a embarquer dans le depot.
 */

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// Chaque palette : fond, matiere secondaire, encre, accent.
const PALETTES = [
    { bg: '#5c6b3d', soft: '#8b9a68', ink: '#f2efe2', accent: '#e4dfc8' },
    { bg: '#e9e4d4', soft: '#cfc7ae', ink: '#2a2c25', accent: '#8a6b3f' },
    { bg: '#1f2a33', soft: '#3c5061', ink: '#dde7ef', accent: '#8fb0c7' },
    { bg: '#d8cdb9', soft: '#b9a98c', ink: '#33302a', accent: '#a4552f' },
    { bg: '#2b352c', soft: '#4c6350', ink: '#dfe8dc', accent: '#a9c2a4' },
    { bg: '#efeae1', soft: '#d6cec0', ink: '#26241f', accent: '#5c6b3d' },
    { bg: '#33302c', soft: '#57514a', ink: '#ece6da', accent: '#c9a86a' },
    { bg: '#c3cfd6', soft: '#9aabb6', ink: '#22303a', accent: '#3d5a6c' },
];

/*
 * Fond "matiere" : des voiles flous qui evoquent une photo sans en etre une.
 *
 * Ils sont volontairement nombreux, petits et peu opaques. Quelques grosses
 * taches bien visibles, c'est ce qu'on avait au depart, et ca se lit comme un
 * degrade rate des qu'on affiche la carte en plein cadre.
 */
function haze(g, S, p, seed) {
    g.fillStyle = p.bg;
    g.fillRect(0, 0, S, S);
    g.save();
    g.globalAlpha = 0.3;
    g.filter = `blur(${Math.round(S * 0.055)}px)`;
    for (let i = 0; i < 11; i += 1) {
        const a = seed * 1.7 + i * 1.9;
        g.fillStyle = i % 3 === 0 ? p.accent : p.soft;
        g.beginPath();
        g.ellipse(
            S * (0.5 + Math.cos(a) * 0.42), S * (0.5 + Math.sin(a * 1.27) * 0.42),
            S * (0.07 + (i % 4) * 0.05), S * (0.06 + (i % 3) * 0.055),
            a, 0, Math.PI * 2,
        );
        g.fill();
    }
    g.restore();
    grain(g, S, 0.045);
}

/*
 * Un grain fin sur toute la carte. C'est lui qui empeche les aplats de sonner
 * "aplat numerique" : une surface parfaitement lisse trahit tout de suite le
 * degrade genere.
 */
function grain(g, S, amount) {
    const step = Math.max(1, Math.round(S / 320));
    g.save();
    for (let y = 0; y < S; y += step) {
        for (let x = 0; x < S; x += step) {
            const n = Math.random();
            g.globalAlpha = amount * n;
            g.fillStyle = n > 0.5 ? '#ffffff' : '#000000';
            g.fillRect(x, y, step, step);
        }
    }
    g.restore();
}

function dots(g, S, p, cells, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = p.accent;
    const step = S / (cells + 1);
    for (let y = 1; y <= cells; y += 1) {
        for (let x = 1; x <= cells; x += 1) {
            g.beginPath();
            g.arc(x * step, y * step, step * 0.34, 0, Math.PI * 2);
            g.fill();
        }
    }
    g.restore();
}

const fit = (g, text, weight, px, family = SANS) => {
    g.font = `${weight} ${px}px ${family}`;
    return g.measureText(text).width;
};

/*
 * Les douze compositions. Chacune recoit le canvas, sa taille et sa palette.
 */
const LAYOUTS = [
    // 01 — millesime : une annee en tres grand, un mois en bas
    (g, S, p) => {
        haze(g, S, p, 1);
        g.fillStyle = p.ink;
        g.textBaseline = 'middle';
        const px = S * 0.26;
        g.font = `300 ${px}px ${SANS}`;
        g.textAlign = 'center';
        g.fillText('2026', S / 2, S * 0.42);
        g.font = `600 ${S * 0.085}px ${SANS}`;
        g.fillText('NOVEMBRE', S / 2, S * 0.66);
    },
    // 02 — chiffre-cle sur fond clair
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        g.fillStyle = p.soft;
        g.fillRect(0, S * 0.62, S, S * 0.38);
        g.fillStyle = p.ink;
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        g.font = `700 ${S * 0.34}px ${SANS}`;
        g.fillText('12K', S * 0.08, S * 0.46);
        g.font = `500 ${S * 0.062}px ${SANS}`;
        g.fillText('lectures ce mois-ci', S * 0.08, S * 0.58);
    },
    // 03 — trame de disques, le motif graphique
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        dots(g, S, p, 5, 0.9);
        grain(g, S, 0.035);
    },
    // 04 — sommaire de villes, aligne a droite
    (g, S, p) => {
        haze(g, S, p, 4);
        g.fillStyle = p.ink;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        ['LISBONNE', 'PORTO', 'FARO'].forEach((city, i) => {
            g.font = `600 ${S * 0.098}px ${SANS}`;
            g.fillText(city, S * 0.9, S * (0.3 + i * 0.2));
        });
    },
    // 05 — jour et adresse, facon plaque de rue
    (g, S, p) => {
        haze(g, S, p, 7);
        g.fillStyle = p.ink;
        g.textAlign = 'left';
        g.textBaseline = 'top';
        g.font = `700 ${S * 0.2}px ${SANS}`;
        g.fillText('JEU', S * 0.07, S * 0.07);
        g.textBaseline = 'bottom';
        g.font = `700 ${S * 0.15}px ${SANS}`;
        g.fillText('0316 AVE', S * 0.07, S * 0.93);
    },
    // 06 — pastille et signature, tres depouille
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        g.fillStyle = p.accent;
        g.beginPath(); g.arc(S / 2, S * 0.44, S * 0.19, 0, Math.PI * 2); g.fill();
        g.fillStyle = p.ink;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `500 ${S * 0.07}px ${SERIF}`;
        g.fillText('atelier', S / 2, S * 0.75);
    },
    // 07 — deux mots en capitales, calage editorial
    (g, S, p) => {
        haze(g, S, p, 11);
        g.fillStyle = p.ink;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        const px = S * 0.145;
        g.font = `700 ${px}px ${SANS}`;
        g.fillText('MATIERE', S * 0.08, S * 0.44);
        g.fillText('BRUTE', S * 0.08, S * 0.44 + px * 1.05);
    },
    // 08 — bandes horizontales, un aplat de couleur
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        g.fillStyle = p.soft;
        for (let i = 0; i < 4; i += 1) g.fillRect(0, S * (0.12 + i * 0.22), S, S * 0.11);
        g.fillStyle = p.accent;
        g.fillRect(S * 0.62, 0, S * 0.1, S);
    },
    // 09 — filet et legende, comme une page de revue
    (g, S, p) => {
        haze(g, S, p, 15);
        g.strokeStyle = p.ink;
        g.lineWidth = Math.max(1, S * 0.006);
        g.beginPath(); g.moveTo(S * 0.08, S * 0.72); g.lineTo(S * 0.92, S * 0.72); g.stroke();
        g.fillStyle = p.ink;
        g.textAlign = 'left'; g.textBaseline = 'bottom';
        g.font = `400 ${S * 0.055}px ${SERIF}`;
        g.fillText('serie courte, hiver', S * 0.08, S * 0.68);
        g.textBaseline = 'top';
        g.font = `600 ${S * 0.05}px ${SANS}`;
        g.fillText('N° 07', S * 0.08, S * 0.76);
    },
    // 10 — une lettre en tres grand, coupee par le bord
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        g.fillStyle = p.accent;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 ${S * 0.95}px ${SERIF}`;
        g.fillText('A', S * 0.5, S * 0.52);
    },
    // 11 — horizon, la plus proche d'un paysage
    (g, S, p) => {
        const grad = g.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, p.soft);
        grad.addColorStop(0.62, p.bg);
        grad.addColorStop(1, p.accent);
        g.fillStyle = grad; g.fillRect(0, 0, S, S);
        g.save(); g.globalAlpha = 0.5; g.fillStyle = p.ink;
        g.beginPath(); g.arc(S * 0.72, S * 0.3, S * 0.09, 0, Math.PI * 2); g.fill();
        g.restore();
    },
    // 12 — etiquette et compteur
    (g, S, p) => {
        g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
        g.fillStyle = p.soft;
        const w = fit(g, 'EDITION LIMITEE', 600, S * 0.055) + S * 0.09;
        g.beginPath();
        g.roundRect(S * 0.08, S * 0.1, w, S * 0.11, S * 0.055);
        g.fill();
        g.fillStyle = p.ink;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.font = `600 ${S * 0.055}px ${SANS}`;
        g.fillText('EDITION LIMITEE', S * 0.125, S * 0.157);
        g.font = `300 ${S * 0.3}px ${SANS}`;
        g.textBaseline = 'bottom';
        g.fillText('034', S * 0.08, S * 0.92);
    },
];

/*
 * Dessine la carte de demonstration numero `index`. Palette et composition
 * avancent a des rythmes differents (8 et 12), donc les combinaisons ne se
 * repetent qu'au bout de 24 cartes.
 */
export default function demoCard(index, size = 900) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const p = PALETTES[index % PALETTES.length];
    LAYOUTS[index % LAYOUTS.length](g, size, p);
    return c;
}
