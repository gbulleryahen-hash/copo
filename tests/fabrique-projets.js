// Fabrique les projets de test ciblés (tests/projets/*.copo), chacun centré sur une famille de réglages.
// À relancer seulement pour ajouter ou modifier un de ces projets :  node tests/fabrique-projets.js
// (exemple.copo et exemple-rotatif.copo sont les projets d'exemple de COPO, figés tels quels.)
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const K4 = 0.5522847498307936; // poignées de Bézier d'un quart de cercle
const N = (x, y, i = null, o = null, sm = false) => ({ x, y, i, o, sm });
const rect = (id, x, y, w, h, layer = 'l1') => ({ id, nodes: [N(x, y), N(x + w, y), N(x + w, y + h), N(x, y + h)], closed: true, layer, g: null });
const cercle = (id, cx, cy, r, layer = 'l1') => {
  const k = K4 * r;
  return {
    id, closed: true, layer, g: null,
    nodes: [N(cx + r, cy, [0, -k], [0, k], true), N(cx, cy + r, [k, 0], [-k, 0], true), N(cx - r, cy, [0, k], [0, -k], true), N(cx, cy - r, [-k, 0], [k, 0], true)],
  };
};
const ligne = (id, pts, layer = 'l1') => ({ id, nodes: pts.map(([x, y]) => N(x, y)), closed: false, layer, g: null });

const OUTILS = [
  { id: 't1', num: 1, name: 'Fraise droite 3,175 mm', type: 'flat', dia: 3.175, flutes: 2, angle: 90, rpm: 18000, feed: 1200, plunge: 300, pass: 1.5, over: 40 },
  { id: 't2', num: 2, name: 'Fraise droite 6 mm', type: 'flat', dia: 6, flutes: 2, angle: 90, rpm: 18000, feed: 2000, plunge: 500, pass: 3, over: 40 },
  { id: 't3', num: 3, name: 'Fraise V 90° Ø12', type: 'v', dia: 12, flutes: 2, angle: 90, rpm: 18000, feed: 1500, plunge: 500, pass: 3, over: 20 },
  { id: 't5', num: 5, name: 'Fraise hémisphérique 3 mm', type: 'ball', dia: 3, flutes: 2, angle: 90, rpm: 18000, feed: 1000, plunge: 300, pass: 1, over: 50 },
  { id: 't6', num: 6, name: 'Foret 6 mm', type: 'drill', dia: 6, flutes: 2, angle: 118, rpm: 8000, feed: 1000, plunge: 400, pass: 3, over: 0 },
];

// réglages d'un parcours créé par le formulaire Parcours avec ses valeurs par défaut
const P_DEF = {
  side: 'out', depth: 6, pass: '', allow: 0, finish: 'last', dir: 'climb', entry: 'plunge', rlEntry: 'plunge', rampLen: '', arcR: 5, vstep: 0.1,
  clrTools: [], clrTool: '', clrExt: false, vstart: 0, zrel: 1, peck: 0, dwell: 0, openSide: 'on', tabs: false, proj: false, tabN: 4, tabL: 8, tabH: 2,
  tabShape: 'rect', tabMode: 'auto', tabPts: null, strategy: 'rings', rasterAng: 0, rest: false, roughTool: '', restFrom: '', restTool: '', restDia: 0,
  helixPitch: '', helixD: '', helixHoles: true, thSide: 'in', thPitch: 1.25, thD: 0, thHand: 'R', thPasses: 2,
};
let n = 0;
const tp = (name, type, toolId, shapeIds, p, face = 1) => ({ id: 'tp' + (++n), name, nameAuto: false, type, toolId, shapeIds, relIds: [], p: { ...P_DEF, ...p }, visible: true, face });

const projet = (nom, stock, shapes, tps, layers) => ({
  meta: { name: nom, material: 'Test' },
  stock: { offX: 0, offY: 0, originXY: 'bl', originZ: 'top', mat: 'softwood', ...stock },
  shapes, tools: OUTILS, tps,
  layers: layers || [{ id: 'l1', name: 'Calque 1', visible: true, locked: false }],
  layerActive: 'l1', guides: { x: [], y: [] }, dims: [], images: [],
});

const PROJETS = {
  // stratégies de poche, îlot, entrées, surépaisseur et passe de finition
  poches: projet('Poches', { w: 300, h: 200, t: 18 }, [
    rect('p1', 20, 20, 80, 60), rect('p2', 120, 20, 80, 60), rect('p3', 220, 20, 60, 60),
    rect('p4', 20, 110, 120, 70), cercle('ilot', 80, 145, 15), rect('p5', 170, 110, 110, 70),
  ], [
    tp('Anneaux, rampe', 'pocket', 't2', ['p1'], { depth: 6, strategy: 'rings', entry: 'rampzz' }),
    tp('Balayage 30°', 'pocket', 't2', ['p2'], { depth: 4, strategy: 'raster', rasterAng: 30 }),
    tp('Zigzag', 'pocket', 't2', ['p3'], { depth: 3, strategy: 'zigzag' }),
    tp('Anneaux vers l’intérieur, îlot, hélice', 'pocket', 't2', ['p4', 'ilot'], { depth: 5, strategy: 'ringsIn', entry: 'helix' }),
    tp('Surépaisseur et finition, opposition', 'pocket', 't1', ['p5'], { depth: 4, allow: 0.3, finish: 'last', dir: 'conv' }),
  ]),
  // profils : côtés, ponts, entrées, surépaisseur, ligne ouverte
  profils: projet('Profils', { w: 300, h: 200, t: 12 }, [
    rect('r1', 20, 20, 100, 70), cercle('c1', 200, 55, 35), rect('r2', 20, 120, 100, 60), cercle('c2', 200, 150, 30),
    ligne('l1', [[250, 20], [280, 60], [250, 100], [280, 140]]),
  ], [
    tp('Extérieur, ponts', 'profile', 't2', ['r1'], { side: 'out', depth: 12, tabs: true, tabN: 4, tabL: 8, tabH: 2 }),
    tp('Intérieur, entrée en arc', 'profile', 't2', ['c1'], { side: 'in', depth: 6, entry: 'arc', arcR: 5 }),
    tp('Sur la ligne, rampe continue', 'profile', 't1', ['r2'], { side: 'on', depth: 3, entry: 'ramp', rampLen: 20 }),
    tp('Extérieur, surépaisseur et finition', 'profile', 't2', ['c2'], { side: 'out', depth: 8, allow: 0.5, finish: 'last' }),
    tp('Ligne ouverte, à gauche', 'profile', 't1', ['l1'], { side: 'on', openSide: 'left', depth: 2 }),
  ]),
  // perçages : d'un trait, débourrage, temporisation, trous en hélice à la fraise
  percages: projet('Perçages', { w: 200, h: 100, t: 18 }, [
    cercle('h1', 30, 30, 3), cercle('h2', 60, 30, 3), cercle('h3', 90, 30, 3),
    cercle('h4', 30, 70, 3), cercle('h5', 60, 70, 3),
    cercle('h6', 140, 50, 10), cercle('h7', 175, 50, 6),
  ], [
    tp('Foret, d’un trait', 'drill', 't6', ['h1', 'h2', 'h3'], { depth: 10 }),
    tp('Foret, débourrage et temporisation', 'drill', 't6', ['h4', 'h5'], { depth: 18, peck: 4, dwell: 0.5 }),
    tp('Fraise, trous en hélice', 'drill', 't2', ['h6', 'h7'], { depth: 8, helixHoles: true, helixPitch: 1 }),
  ]),
  // double face : un calque usiné sur la face retournée
  'double-face': projet('Double face', { w: 200, h: 120, t: 18, flip: 'x' }, [
    rect('a1', 20, 20, 60, 40), cercle('a2', 140, 60, 20, 'f2'), rect('a3', 100, 20, 80, 80),
  ], [
    tp('Face 1, poche', 'pocket', 't2', ['a1'], { depth: 5 }),
    tp('Face 2, poche', 'pocket', 't2', ['a2'], { depth: 4 }, 2),
    tp('Face 1, V-carving', 'vcarve', 't3', ['a3'], { depth: 3 }),
  ], [{ id: 'l1', name: 'Calque 1', visible: true, locked: false }, { id: 'f2', name: 'Face 2', visible: true, locked: false, face: 2 }]),
};

const dir = path.join(__dirname, 'projets');
for (const [nom, o] of Object.entries(PROJETS)) {
  fs.writeFileSync(path.join(dir, nom + '.copo'), JSON.stringify(o, null, 1) + '\n');
  console.log(nom + '.copo :', o.tps.length, 'parcours');
}
