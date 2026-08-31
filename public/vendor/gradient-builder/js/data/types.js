/*
 * Les 28 types de degrade, ranges par famille.
 * L'onglet "Popular" est une selection transverse, pas une famille.
 */

export const TYPE_NAMES = {
  FLOW: 'Flow', SKY: 'Sky', AURORA: 'Aurora', AIR: 'Mesh', LINEAR: 'Linear', RING: 'Rings',
  BARS: 'Bars', COLS: 'Columns', PIXEL: 'Pixel', GLASSY: 'Glassy', STRIPE: 'Stripes',
  GLINT: 'Glint', MIST: 'Mist', SMESH: 'Still', CUBE: 'Blocks', PRISM: 'Prism', WAVE: 'Waves',
  LINE: 'Lines', ANGULAR: 'Conic', CNOISE: 'Noise', RETRO: 'Retro', SKYLINE: 'Skyline',
  CIRCLE: 'Radial', ARCH: 'Arch', SHAPES: 'Forms', BEEHIVE: 'Beehive', BALLS: 'Balls', IOS: 'iOS',
};

export const FAMILIES = [
  { label: 'Fields', types: ['FLOW', 'SKY', 'AURORA', 'AIR', 'SMESH', 'RETRO', 'IOS'] },
  { label: 'Strips', types: ['LINEAR', 'STRIPE', 'BARS', 'COLS', 'PRISM', 'WAVE', 'LINE'] },
  { label: 'Objects', types: ['GLASSY', 'RING', 'PIXEL', 'CUBE', 'BEEHIVE', 'BALLS', 'CIRCLE', 'ANGULAR'] },
  { label: 'Scenes', types: ['SHAPES', 'GLINT', 'MIST', 'SKYLINE'] },
];

export const POPULAR = ['FLOW', 'SKY', 'AURORA', 'AIR', 'SHAPES', 'LINE', 'BARS', 'COLS'];

export const DOCK = [{ label: 'Popular', types: POPULAR }, ...FAMILIES];

export const ALL_TYPES = FAMILIES.flatMap((f) => f.types);

export const familyOf = (type) =>
  (POPULAR.includes(type) ? 'Popular' : (FAMILIES.find((f) => f.types.includes(type))?.label ?? FAMILIES[0].label));

/* Icones de famille du dock (24x24, trait courant). */
export const FAMILY_ICONS = {
  Popular: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  Fields: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  Strips: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  Objects: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8"/>',
  Scenes: '<path d="M3 19h18"/><path d="M6.5 19 12 6l5.5 13"/>',
};
