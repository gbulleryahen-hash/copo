// Tests de non-régression du G-code de COPO.
//
//   node tests/verifier-gcode.js            compare le G-code produit au G-code attendu (tests/attendus/)
//   node tests/verifier-gcode.js --maj      réécrit le G-code attendu (après un changement voulu du G-code)
//   node tests/verifier-gcode.js poches     limite aux projets dont le nom contient « poches »
//   node tests/verifier-gcode.js poches --voir   ouvre COPO dans une fenêtre Chrome, dans les mêmes
//                                       conditions que le test (navigateur vierge), avec le projet chargé
//
// Pour chaque projet de tests/projets/ et chaque post-processeur de la liste CAS ci-dessous :
//   1. COPO est ouvert dans Chrome sans fenêtre, le projet est ouvert comme un .copo ;
//   2. les parcours sont calculés comme dans l'application (tpRecalcThen), le G-code est produit ;
//   3. les parcours sont recalculés de force en tâche de fond (le « travailleur ») : le G-code doit être identique ;
//   4. le G-code est comparé au fichier attendu, ligne par ligne.
// Chrome ou Edge doit être installé ; sinon, indiquez son chemin dans la variable COPO_CHROME.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer-core');

const RACINE = path.resolve(__dirname, '..');
const PROJETS = path.join(__dirname, 'projets');
const ATTENDUS = path.join(__dirname, 'attendus');

const INTEGRES = ['grbl', 'grblhal', 'grblm', 'carbide', 'onefinity', 'linuxcnc', 'mach3', 'uccnc', 'masso'];
const VECTRIC = ['vpu:mach_atc_mm', 'vpu:sb_mm', 'vpu:haas_mm']; // post-processeurs Vectric de formats très différents
// projet → post-processeurs à tester
const CAS = {
  exemple: [...INTEGRES, ...VECTRIC],
  'exemple-rotatif': ['grbl', 'mach3'],
  poches: ['grbl'],
  profils: ['grbl', 'linuxcnc'],
  percages: ['grbl', 'grblhal', 'linuxcnc', 'mach3'], // les cycles G81/G82/G83 dépendent du post-processeur
  'double-face': ['grbl'],
};
// heure figée pendant la production du G-code (certains post-processeurs Vectric écrivent la date)
const HEURE_FIXE = '2026-01-01T12:00:00';

// ---------------------------------------------------------------- serveur local (COPO doit être servi en http)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.py': 'text/plain' };
function serveur() {
  const srv = http.createServer((req, res) => {
    const p = path.normalize(path.join(RACINE, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(RACINE)) { res.writeHead(403).end(); return; }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

function cheminChrome() {
  const c = [process.env.COPO_CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const t = c.find(p => p && fs.existsSync(p));
  if (!t) throw new Error('Chrome ou Edge introuvable : indiquez son chemin dans la variable COPO_CHROME.');
  return t;
}

// ---------------------------------------------------------------- dans la page : calcul des parcours et G-code
// (fonction exécutée dans le navigateur : elle n'utilise que les fonctions de COPO)
async function gcodeDansLaPage(txt, posts, heureFixe) {
  /* global openProjectText, tpRecalcThen, TPC, tpRunWorker, WK, gcTps, machineEff, makeGcode, VPOSTS, S */
  const machine = post => {
    const M = { ...machineEff(), post };
    if (post.startsWith('vpu:')) { M.vpText = VPOSTS[post.slice(4)]; M.vpName = post.slice(4); }
    return M;
  };
  const produire = () => {
    const VraieDate = Date, fixe = new VraieDate(heureFixe).getTime();
    globalThis.Date = class extends VraieDate {
      constructor(...a) { if (a.length) super(...a); else super(fixe); }
      static now() { return fixe; }
    };
    try {
      const tps = gcTps();
      return posts.map(p => makeGcode(tps, S.tools, S.stock, machine(p)));
    } finally { globalThis.Date = VraieDate; }
  };
  const erreurs = () => S.tps.filter(t => t.err).map(t => t.name + ' : ' + t.err);

  openProjectText(txt);
  await new Promise(ok => tpRecalcThen(ok));
  const principal = produire(), err1 = erreurs();

  // même calcul, forcé en tâche de fond : cache vidé, chaque parcours confié au travailleur
  TPC.clear();
  for (const t of S.tps) { delete t.moves; delete t._sig; }
  for (const t of S.tps) await tpRunWorker(t);
  const travailleur = WK.off ? null : produire();
  return { principal, travailleur, erreurs: err1.concat(erreurs()), wkOff: !!WK.off };
}

// ---------------------------------------------------------------- comparaison
function differences(attendu, obtenu, max = 8) {
  const a = attendu.split('\n'), b = obtenu.split('\n'), out = [];
  for (let i = 0; i < Math.max(a.length, b.length) && out.length < max; i++) {
    if (a[i] !== b[i]) out.push(`    ligne ${i + 1}\n      attendu : ${a[i] ?? '(fin du fichier)'}\n      obtenu  : ${b[i] ?? '(fin du fichier)'}`);
  }
  const n = a.filter((l, i) => l !== b[i]).length + Math.max(0, b.length - a.length);
  return { n, texte: out.join('\n') };
}
const nomFichier = (projet, post) => `${projet}__${post.replace(':', '-')}.nc`;

// --voir : une fenêtre Chrome vierge, comme pendant le test, avec le projet ouvert et l'onglet G-code affiché ;
// le post-processeur choisi est le premier de la liste CAS. S'arrête quand on ferme la fenêtre.
async function voir(projet) {
  const srv = await serveur(), url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const nav = await puppeteer.launch({ executablePath: cheminChrome(), headless: false, defaultViewport: null, args: ['--start-maximized'] });
  const [page] = await nav.pages();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('copo.welcomeOff', '1');
    localStorage.setItem('copo.lang', 'fr');
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof openProjectText === 'function');
  const txt = fs.readFileSync(path.join(PROJETS, projet + '.copo'), 'utf8'), post = CAS[projet][0];
  await page.evaluate((t, p) => {
    /* global openProjectText, tpRecalcThen, setTab, S */
    openProjectText(t);
    S.machine.post = p; // comme dans le test, sans toucher aux autres réglages de la machine
    return new Promise(ok => tpRecalcThen(() => { setTab('gcode'); ok(); }));
  }, txt, post);
  const fichier = path.join(ATTENDUS, nomFichier(projet, post));
  console.log(`COPO est ouvert avec « ${projet} » (${post}).`);
  console.log(`G-code attendu : ${path.relative(RACINE, fichier)}`);
  // le G-code affiché dans l'onglet G-code, comparé au fichier attendu
  const affiche = await page.evaluate(() => document.querySelector('#gcOut').value);
  if (fs.existsSync(fichier)) {
    const d = differences(fs.readFileSync(fichier, 'utf8'), affiche);
    console.log(d.n ? `Le G-code affiché diffère du G-code attendu (${d.n} ligne(s)) :\n${d.texte}` : 'Le G-code affiché est identique au G-code attendu.');
  }
  console.log('Fermez la fenêtre Chrome pour terminer.');
  await new Promise(ok => nav.on('disconnected', ok));
  srv.close();
}

async function main() {
  const args = process.argv.slice(2), maj = args.includes('--maj'), filtre = args.find(a => !a.startsWith('--'));
  const projets = Object.keys(CAS).filter(p => !filtre || p.includes(filtre));
  if (!projets.length) throw new Error('Aucun projet ne correspond à « ' + filtre + ' ».');
  if (args.includes('--voir')) {
    if (projets.length > 1) throw new Error('--voir : précisez un seul projet (' + projets.join(', ') + ').');
    await voir(projets[0]);
    return;
  }
  fs.mkdirSync(ATTENDUS, { recursive: true });

  const srv = await serveur(), url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const nav = await puppeteer.launch({ executablePath: cheminChrome(), headless: true });
  let echecs = 0, cas = 0;
  try {
    for (const projet of projets) {
      const page = await nav.newPage();
      const erreursPage = [];
      page.on('pageerror', e => erreursPage.push(e.message));
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('copo.welcomeOff', '1'); // pas de fenêtre d'accueil
        localStorage.setItem('copo.lang', 'fr');      // commentaires du G-code en français
      });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof openProjectText === 'function' && typeof makeGcode === 'function');
      const txt = fs.readFileSync(path.join(PROJETS, projet + '.copo'), 'utf8');
      const r = await page.evaluate(gcodeDansLaPage, txt, CAS[projet], HEURE_FIXE);
      await page.close();

      const pb = [...erreursPage.map(e => 'erreur JavaScript : ' + e), ...r.erreurs.map(e => 'parcours en erreur : ' + e)];
      if (r.wkOff) pb.push('la tâche de fond n’a pas pu démarrer : la vérification principal = tâche de fond est impossible');
      CAS[projet].forEach((post, i) => {
        cas++;
        const g = r.principal[i], fichier = path.join(ATTENDUS, nomFichier(projet, post)), msgs = [...pb];
        if (r.travailleur && r.travailleur[i] !== g) {
          const d = differences(g, r.travailleur[i]);
          msgs.push(`le calcul en tâche de fond donne un G-code différent (${d.n} ligne(s)) :\n${d.texte}`);
        }
        if (maj) {
          fs.writeFileSync(fichier, g);
        } else if (!fs.existsSync(fichier)) {
          msgs.push('pas de G-code attendu : lancez d’abord « node tests/verifier-gcode.js --maj »');
        } else {
          const d = differences(fs.readFileSync(fichier, 'utf8'), g);
          if (d.n) msgs.push(`G-code différent de ${path.relative(RACINE, fichier)} (${d.n} ligne(s)) :\n${d.texte}`);
        }
        const lignes = g.split('\n').length;
        if (msgs.length) { echecs++; console.log(`ÉCHEC  ${projet} · ${post}\n  ${msgs.join('\n  ')}`); }
        else console.log(`${maj ? 'écrit ' : 'ok    '} ${projet} · ${post} (${lignes} lignes)`);
      });
    }
  } finally {
    await nav.close();
    srv.close();
  }
  console.log(`\n${cas - echecs} / ${cas} cas ${maj ? 'écrits' : 'conformes'}${echecs ? ` — ${echecs} en échec` : ''}.`);
  process.exitCode = echecs ? 1 : 0;
}

main().catch(e => { console.error(e.message || e); process.exitCode = 2; });
