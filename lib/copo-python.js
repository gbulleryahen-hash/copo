// COPO — scripts Python (.py) : le script décrit la pièce et ses usinages avec le module lib/copo.py,
// Pyodide l'exécute dans le navigateur, puis COPO ouvre le projet obtenu (dessin, parcours, vue 3D, G-code).
// Un script peut déclarer des paramètres (parametre(), choix()…) : COPO affiche alors un formulaire
// et relance le script à chaque modification.
// Chargé après le script principal d'index.html, dont il utilise les fonctions (openProjectText, arcNodes, toast…).
// Pyodide : lib/pyodide/ s'il est présent (usage hors ligne), sinon le CDN jsDelivr.
(() => {
  'use strict';
  const PYODIDE_VER = '0.26.4';
  const PY_LOCAL = 'lib/pyodide/';
  const PY_CDN = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VER + '/full/';
  // handle : fichier ouvert avec accès disque (relecture et suivi possibles) ; text : contenu sinon ;
  // vals : saisies du formulaire {nom: {v, sig}} ; mod : date du fichier lors de la dernière lecture
  const PY = { ready: null, handle: null, text: null, name: null, mod: 0, watch: null, vals: {} };
  const EN = () => typeof LANG !== 'undefined' && LANG === 'en';
  const MSG_NO_PY = 'Python n’a pas pu être chargé : il faut une connexion internet la première fois, ou le dossier lib/pyodide/ pour travailler hors ligne.';

  Object.assign(I18N_EN, {
    'Chargement de Python (la première fois, environ 10 Mo)…': 'Loading Python (about 10 MB the first time)…',
    [MSG_NO_PY]: 'Python could not be loaded: an internet connection is needed the first time, or the lib/pyodide/ folder for offline use.',
    'Ouvrez d’abord un script Python (Fichier › Ouvrir un script Python…).': 'Open a Python script first (File › Open a Python script…).',
    'Script Python': 'Python script', 'Erreur dans le script': 'Error in the script', 'Sortie du script': 'Script output',
    'Avertissements des parcours': 'Toolpath warnings', 'Relancer': 'Re-run', 'Fermer': 'Close',
    'Suivre les modifications du fichier': 'Follow changes to the file',
    'Paramètres': 'Parameters', 'Valeurs par défaut': 'Default values', 'Calcul…': 'Computing…',
    'Pièce non mise à jour :': 'Part not updated:',
    'Script « {f} » : {s} forme(s), {t} parcours.': 'Script “{f}”: {s} shape(s), {t} toolpath(s).',
  });
  const T = s => tr(s);
  const errMsg = e => (e && e.message) || T('Fichier illisible.');

  // ---------------------------------------------------------------- Pyodide
  async function loadPyodideScript() {
    if (typeof loadPyodide === 'function') return PY_LOCAL;
    try {
      await loadScript(PY_LOCAL + 'pyodide.js');
      return PY_LOCAL;
    } catch {
      await loadScript(PY_CDN + 'pyodide.js');
      return PY_CDN;
    }
  }
  // module copo : lib/copo.py en http(s) ; en file://, le navigateur interdit de le lire,
  // on prend sa copie lib/copo-py.js (chargée par une balise <script>, autorisée)
  async function copoModuleSource() {
    if (location.protocol !== 'file:') {
      try {
        const r = await fetch('lib/copo.py', { cache: 'no-cache' });
        if (r.ok) return await r.text();
      } catch { /* copie ci-dessous */ }
    }
    if (typeof window.COPO_PY_SRC !== 'string') await loadScript('lib/copo-py.js');
    return window.COPO_PY_SRC;
  }
  function loadPy() {
    if (PY.ready) return PY.ready;
    PY.ready = (async () => {
      toast(T('Chargement de Python (la première fois, environ 10 Mo)…'));
      const base = await loadPyodideScript();
      const py = await loadPyodide({ indexURL: base });
      const src = await copoModuleSource();
      py.globals.set('_copo_mod_src', src);
      py.runPython([
        'import sys, types',
        '_m = types.ModuleType("copo"); _m.__file__ = "copo.py"',
        'exec(compile(_copo_mod_src, "copo.py", "exec"), _m.__dict__)',
        'sys.modules["copo"] = _m; del _m, _copo_mod_src',
      ].join('\n'));
      return py;
    })();
    PY.ready.catch(() => { PY.ready = null; });
    return PY.ready;
  }

  // Exécute le script dans un espace de noms neuf, avec les noms du module copo déjà importés.
  // _copo_verif : erreur de verifier() (ou qui en découle), affichée dans le formulaire sans trace Python ;
  // _copo_err : trace limitée aux lignes du script ; _copo_form : paramètres et messages du formulaire.
  const RUNNER = String.raw`
import copo, traceback
copo._reset(_copo_vals)
_src_lines = _copo_src.splitlines()
_ns = {"__name__": "__main__", "__file__": _copo_nom}
for _k in copo.__all__:
    _ns[_k] = getattr(copo, _k)
_copo_res = _copo_err = _copo_verif = None
try:
    exec(compile(_copo_src, _copo_nom, "exec"), _ns)
    _copo_res = copo._resultat()
except BaseException as _e:
    _copo_verif = "\n".join(copo._erreurs()) or (str(_e) if isinstance(_e, copo.CopoErreur) and copo._E.params else None)
    _tb = [f for f in traceback.extract_tb(_e.__traceback__) if f.filename == _copo_nom]
    _where = [_copo_lbl % (f.lineno, _src_lines[f.lineno - 1].strip() if 0 < f.lineno <= len(_src_lines) else "") for f in _tb]
    _what = "".join(traceback.format_exception_only(type(_e), _e)).replace("copo.CopoErreur: ", "")
    _copo_err = "".join(_where) + _what
_copo_form = copo._formulaire()
del _ns, _src_lines
`;
  async function runPy(text, name) {
    const py = await loadPy();
    const out = [];
    py.setStdout({ batched: s => out.push(s) });
    py.setStderr({ batched: s => out.push(s) });
    py.globals.set('_copo_src', text);
    py.globals.set('_copo_nom', name);
    py.globals.set('_copo_lbl', EN() ? 'Line %d: %s\n' : 'Ligne %d : %s\n');
    py.globals.set('_copo_vals', JSON.stringify(PY.vals));
    try {
      py.runPython(RUNNER);
    } catch (e) {
      return { err: String(e?.message || e), out, form: null };
    }
    const g = k => py.globals.get(k);
    return { res: g('_copo_res'), err: g('_copo_err'), verif: g('_copo_verif'), form: JSON.parse(g('_copo_form') || 'null'), out };
  }

  // ---------------------------------------------------------------- script → projet COPO
  const fmtN = v => {
    const s = String(+(+v).toFixed(3));
    return EN() ? s : s.replace('.', ',');
  };
  function toolLabel(d) {
    const D = fmtN(d.dia), A = fmtN(d.angle || 90);
    const fr = { flat: 'Fraise droite ' + D + ' mm', v: 'Fraise V ' + A + '° Ø' + D, ball: 'Fraise hémisphérique ' + D + ' mm', drill: 'Foret ' + D + ' mm' };
    const en = { flat: 'End mill ' + D + ' mm', v: 'V-bit ' + A + '° Ø' + D, ball: 'Ball nose ' + D + ' mm', drill: 'Drill ' + D + ' mm' };
    return (EN() ? en : fr)[d.type];
  }
  const TOOL_KEYS = ['rpm', 'feed', 'plunge', 'pass', 'over', 'flutes', 'num'];
  const isToolDesc = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.type === 'string' && v.dia > 0;
  const sameTool = (t, d) => t.type === d.type && Math.abs(+t.dia - d.dia) < 0.005
    && (d.type !== 'v' || Math.abs(+t.angle - d.angle) < 0.01)
    && TOOL_KEYS.every(k => d[k] == null || +t[k] === +d[k])
    && (d.name == null || t.name === d.name);
  // outil du projet de même type, diamètre (et angle pour une V) et réglages ;
  // sinon un nouvel outil, réglé comme l'outil par défaut le plus proche
  function resolveTool(d, tools) {
    const hit = tools.find(t => sameTool(t, d));
    if (hit) return hit.id;
    const defs = DEFAULT_TOOLS(), kin = defs.filter(t => t.type === d.type), pool = kin.length ? kin : defs;
    const base = pool.reduce((a, t) => (Math.abs(t.dia - d.dia) < Math.abs(a.dia - d.dia) ? t : a), pool[0]);
    const num = d.num ?? tools.reduce((m, t) => Math.max(m, +t.num || 0), 0) + 1;
    const t = { ...base, id: uid(), num, name: d.name || toolLabel(d), type: d.type, dia: d.dia, angle: d.angle ?? base.angle };
    for (const k of TOOL_KEYS) {
      if (d[k] != null) t[k] = d[k];
    }
    tools.push(t);
    return t.id;
  }
  function roundRectNodes(x0, y0, x1, y1, r) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    if (r <= 1e-6) return rectNodes(x0, y0, x1, y1);
    const P = Math.PI, h = P / 2;
    return [...arcNodes([x1 - r, y0 + r], r, -h, h), ...arcNodes([x1 - r, y1 - r], r, 0, h), ...arcNodes([x0 + r, y1 - r], r, h, h), ...arcNodes([x0 + r, y0 + r], r, P, h)]
      .filter((n, i, A) => !i || Math.hypot(n.x - A[i - 1].x, n.y - A[i - 1].y) > 1e-9);
  }
  function shapeNodes(f) {
    const rad = Math.PI / 180;
    switch (f.kind) {
      case 'rect': return [roundRectNodes(f.x, f.y, f.x + f.w, f.y + f.h, f.r), true];
      case 'ellipse': return [ellipseNodes([f.cx, f.cy], f.rx, f.ry), true];
      case 'poly': return [polyNodes([f.cx, f.cy], f.r, f.n, f.rot * rad), true];
      case 'star': return [starNodes([f.cx, f.cy], f.r1, f.r2, f.n, f.rot * rad), true];
      case 'pts': return [nodesFromPts(f.pts), !!f.closed];
      case 'arc': return [arcNodes([f.cx, f.cy], f.r, f.a0 * rad, (f.a1 - f.a0) * rad), false];
      default: throw new Error('Forme inconnue : ' + f.kind);
    }
  }
  // réglages d'un parcours créé par le formulaire Parcours avec ses valeurs par défaut
  const P_DEF = () => ({
    side: 'out', depth: 6, pass: '', allow: 0, finish: 'last', dir: 'climb', entry: 'rampzz', rlEntry: 'rampzz', rampLen: '', arcR: 5, vstep: 0.1,
    clrTools: [], clrTool: '', clrExt: false, vstart: 0, zrel: 1, peck: 0, dwell: 0, openSide: 'on', tabs: false, proj: false, tabN: 4, tabL: 8, tabH: 2,
    tabShape: 'rect', tabMode: 'auto', tabPts: null, strategy: 'rings', rasterAng: 0, rest: false, roughTool: '', restFrom: '', restTool: '', restDia: 0,
    helixPitch: '', helixD: '', helixHoles: true, thSide: 'in', thPitch: 1.25, thD: 0, thHand: 'R', thPasses: 2,
  });
  const TP_LBL = { profile: ['Profil', 'Profile'], pocket: ['Poche', 'Pocket'], drill: ['Perçage', 'Drilling'], vcarve: ['V-carving', 'V-carving'] };
  const MAT_EXTRA = { 'médium': 'mdf', medium: 'mdf', 'contreplaqué': 'softwood', contreplaque: 'softwood', plywood: 'softwood', pmma: 'acrylic', plexiglas: 'acrylic', alu: 'alu' };
  function matKey(m) {
    if (!m) return null;
    const k = String(m).toLowerCase().trim();
    if (typeof LIB_MATS !== 'undefined' && LIB_MATS.some(x => x[0] === k)) return k;
    if (typeof VT_MAT !== 'undefined' && VT_MAT[k]) return VT_MAT[k];
    return MAT_EXTRA[k] || null;
  }
  function buildToolpath(t, ctx) {
    const p = { ...P_DEF(), ...t.p };
    for (const k of Object.keys(p)) {
      if (isToolDesc(p[k])) p[k] = resolveTool(p[k], ctx.tools);
    }
    if (t.type === 'vcarve' && p.clrTool) p.clrTools = [p.clrTool];
    const toolId = resolveTool(t.tool, ctx.tools), tool = ctx.tools.find(x => x.id === toolId);
    ctx.count[t.type] = (ctx.count[t.type] || 0) + 1;
    const face = t.shapes.every(id => ctx.faceOfShape(id) === 2) ? 2 : 1;
    const lbl = TP_LBL[t.type] ? TP_LBL[t.type][EN() ? 1 : 0] : t.type;
    const name = t.name || lbl + ' ' + ctx.count[t.type] + ' — ' + tool.name;
    return { id: uid(), name, nameAuto: false, type: t.type, toolId, shapeIds: t.shapes, relIds: [], p, visible: true, face };
  }
  function buildProject(R, fileName) {
    const layers = [{ id: 'l1', name: T('Calque 1'), visible: true, locked: false }, ...R.layers];
    const faceL = new Map(layers.map(l => [l.id, l.face === 2 ? 2 : 1]));
    const shapes = R.shapes.map(f => {
      const [nodes, closed] = shapeNodes(f);
      return { id: f.id, nodes, closed, layer: f.layer || 'l1', g: null };
    });
    const layerOfS = new Map(shapes.map(s => [s.id, s.layer]));
    const ctx = { tools: S.tools.map(t => ({ ...t })), count: {}, faceOfShape: id => faceL.get(layerOfS.get(id)) };
    const tps = R.tps.map(t => buildToolpath(t, ctx));
    const st = R.stock;
    return {
      meta: { name: R.name || fileName.replace(/\.py$/i, ''), material: R.material || '', script: fileName },
      stock: { offX: 0, offY: 0, w: st.w, h: st.h, t: st.t, originXY: st.originXY, originZ: st.originZ, mat: matKey(st.mat) || S.stock?.mat || 'softwood' },
      shapes, tools: ctx.tools, tps, layers, layerActive: 'l1', guides: { x: [], y: [] }, dims: [], images: [],
    };
  }

  // ---------------------------------------------------------------- styles des fenêtres flottantes
  const STYLE = '.py-win{position:fixed;display:flex;flex-direction:column;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 8px 24px var(--shadow);font:13px var(--f-ui)}'
    + '.py-win header{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--line);font-weight:600}.py-win header span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.py-win button{background:var(--raised);color:var(--ink);border:1px solid var(--line);border-radius:var(--r);padding:3px 10px;font:inherit;cursor:pointer}.py-win button:hover{border-color:var(--accent)}'
    + '#pyPanel{right:16px;bottom:16px;z-index:60;width:min(560px,calc(100vw - 32px));max-height:min(55vh,480px)}#pyPanel.err header span{color:var(--danger)}'
    + '#pyPanel pre{margin:0;padding:10px;overflow:auto;font:12px/1.45 var(--f-mono);white-space:pre-wrap;word-break:break-word}'
    + '#pyPanel label{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid var(--line);color:var(--muted)}'
    + '#pyForm{right:16px;top:52px;z-index:59;width:min(330px,calc(100vw - 32px));max-height:calc(100vh - 140px)}#pyForm header{cursor:pointer}'
    + '#pyForm .pf-body{overflow:auto;padding:6px 10px 8px}#pyForm.closed .pf-body,#pyForm.closed footer{display:none}'
    + '#pyForm .pf-row{display:grid;grid-template-columns:1fr 112px;align-items:center;gap:8px;padding:3px 0}#pyForm .pf-row label{color:var(--muted);line-height:1.25}'
    + '#pyForm .pf-in{display:flex;align-items:center;gap:4px}#pyForm .pf-in input[type=number],#pyForm select{width:100%;min-width:0;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:var(--r);padding:3px 6px;font:12px var(--f-mono)}'
    + '#pyForm .pf-in em{font-style:normal;color:var(--muted);font-size:11px}#pyForm .pf-ro{font:12px var(--f-mono);text-align:right}'
    + '#pyForm .pf-msg{margin:8px 0 0;display:flex;flex-direction:column;gap:4px;line-height:1.3}'
    + '#pyForm footer{display:flex;gap:6px;justify-content:space-between;align-items:center;padding:6px 10px;border-top:1px solid var(--line);color:var(--muted)}';
  let cssDone = false;
  function makeWin(id, html) {
    if (!cssDone) {
      const css = document.createElement('style');
      css.textContent = STYLE;
      document.head.appendChild(css);
      cssDone = true;
    }
    const w = document.createElement('div');
    w.id = id;
    w.className = 'py-win';
    w.dataset.notr = ''; // textes du script : pas de traduction automatique
    w.innerHTML = html;
    document.body.appendChild(w);
    return w;
  }

  // ---------------------------------------------------------------- fenêtre de sortie (erreurs, print, avertissements)
  let panel = null;
  function panelEnsure() {
    if (panel) return panel;
    panel = makeWin('pyPanel', '<header><span></span><button type="button" data-py="rerun"></button><button type="button" data-py="close"></button></header><pre></pre><label><input type="checkbox" data-py="watch" checked> <span></span></label>');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', T('Script Python'));
    panel.querySelector('[data-py=rerun]').onclick = () => { void pyRerun(); };
    panel.querySelector('[data-py=close]').onclick = () => { panel.hidden = true; };
    panel.querySelector('[data-py=watch]').onchange = e => {
      if (e.target.checked) watchStart();
      else watchStop();
    };
    return panel;
  }
  function showPanel(title, text, isErr) {
    const p = panelEnsure();
    p.querySelector('[data-py=rerun]').textContent = T('Relancer');
    p.querySelector('[data-py=close]').textContent = T('Fermer');
    p.querySelector('label span').textContent = T('Suivre les modifications du fichier');
    p.querySelector('label').hidden = !PY.handle;
    p.querySelector('[data-py=watch]').checked = !!PY.watch;
    p.classList.toggle('err', !!isErr);
    p.querySelector('header span').textContent = T(title) + (PY.name ? ' — ' + PY.name : '');
    p.querySelector('pre').textContent = text;
    p.hidden = false;
  }

  // ---------------------------------------------------------------- formulaire des paramètres (parametre(), choix()… du script)
  let form = null, formT = 0;
  const MSG_COLOR = { erreur: 'var(--danger)', avertissement: 'var(--warn)', info: 'var(--accent-text)' };
  const parseNum = s => {
    const v = Number.parseFloat(String(s).replace(',', '.').trim());
    return Number.isFinite(v) ? v : null;
  };
  function inputValue(p, el) {
    if (p.type === 'bool') return el.checked;
    if (p.type === 'choix') return el.value;
    return parseNum(el.value);
  }
  function onFormChange(e) {
    const el = e.target.closest('[data-pn]');
    const p = el && form._params.find(x => x.nom === el.dataset.pn);
    if (!p) return;
    const v = inputValue(p, el);
    if (v === null) {
      el.value = p.v;
      return;
    }
    PY.vals[p.nom] = { v, sig: p.sig };
    clearTimeout(formT);
    formT = setTimeout(() => { void pyRerun(); }, 150);
  }
  function formEnsure() {
    if (form) return form;
    form = makeWin('pyForm', '<header><span></span><button type="button" data-pf="close">×</button></header><div class="pf-body"><div class="pf-rows"></div><div class="pf-msg" aria-live="polite"></div></div><footer><button type="button" data-pf="reset"></button><span class="pf-state"></span></footer>');
    form.hidden = true;
    form.querySelector('header').onclick = e => {
      if (e.target.closest('[data-pf=close]')) form.hidden = true;
      else form.classList.toggle('closed');
    };
    form.querySelector('[data-pf=reset]').onclick = () => {
      PY.vals = {};
      void pyRerun();
    };
    form.addEventListener('change', onFormChange);
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input')) e.target.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return form;
  }
  function paramInput(p) {
    if (p.type === 'choix') {
      const sel = document.createElement('select');
      for (const o of p.options) {
        const op = document.createElement('option');
        op.value = o;
        op.textContent = o;
        sel.appendChild(op);
      }
      sel.value = p.v;
      return sel;
    }
    const inp = document.createElement('input');
    if (p.type === 'bool') {
      inp.type = 'checkbox';
      inp.checked = !!p.v;
      return inp;
    }
    inp.type = 'number';
    const step = p.type === 'int' ? 1 : 'any';
    inp.step = p.pas ?? step;
    if (p.mini != null) inp.min = p.mini;
    if (p.maxi != null) inp.max = p.maxi;
    inp.value = p.v;
    return inp;
  }
  function paramRow(p) {
    const row = document.createElement('div');
    row.className = 'pf-row';
    const lab = document.createElement('label');
    lab.textContent = p.nom;
    if (p.aide) lab.title = p.aide;
    row.appendChild(lab);
    const box = document.createElement('div');
    if (p.type === 'texte') {
      box.className = 'pf-ro';
      box.textContent = p.v;
    } else {
      box.className = 'pf-in';
      const inp = paramInput(p);
      inp.dataset.pn = p.nom;
      inp.setAttribute('aria-label', p.nom);
      box.appendChild(inp);
      if (p.unite) {
        const u = document.createElement('em');
        u.textContent = p.unite;
        box.appendChild(u);
      }
    }
    row.appendChild(box);
    return row;
  }
  function addMsg(box, color, text, bold) {
    const d = document.createElement('div');
    d.style.color = color;
    if (bold) d.style.fontWeight = '600';
    d.textContent = text;
    box.appendChild(d);
  }
  function formMessages(box, f, verif) {
    box.textContent = '';
    if (verif) { // une erreur s'affiche seule, et seulement la première : les suivantes en découlent souvent
      addMsg(box, MSG_COLOR.erreur, T('Pièce non mise à jour :'), true);
      addMsg(box, MSG_COLOR.erreur, String(verif).split('\n')[0]);
      return;
    }
    for (const [k, txt] of f.messages || []) {
      if (k !== 'erreur') addMsg(box, MSG_COLOR[k] || '', txt);
    }
  }
  function formRender(f, verif) {
    if (!f?.params?.length) {
      if (form) form.hidden = true;
      return;
    }
    const el = formEnsure(), rows = el.querySelector('.pf-rows');
    const focus = document.activeElement?.dataset?.pn;
    el._params = f.params;
    el.querySelector('header span').textContent = T('Paramètres') + ' — ' + PY.name;
    el.querySelector('[data-pf=reset]').textContent = T('Valeurs par défaut');
    el.querySelector('.pf-state').textContent = '';
    rows.replaceChildren(...f.params.map(paramRow));
    formMessages(el.querySelector('.pf-msg'), f, verif);
    el.hidden = false;
    if (focus) rows.querySelector('[data-pn="' + CSS.escape(focus) + '"]')?.focus();
  }

  // ---------------------------------------------------------------- exécution
  let running = false, again = null;
  // ouvre le projet produit par le script ; relance du même script : les vues 2D et 3D restent en place
  function openResult(proj, name, keepView) {
    if (typeof coWelClose === 'function') coWelClose(); // la fenêtre d'accueil ne doit pas masquer la pièce
    const same = keepView && S.meta?.script === name, view = { ...S.view };
    projKeep(null);
    openProjectText(JSON.stringify(proj));
    projDirty(false);
    if (same) {
      Object.assign(S.view, view);
      if (typeof RV !== 'undefined') RV.fitted = true;
      draw();
    }
    if (typeof VIEWS !== 'undefined' && !VIEWS.d3) {
      VIEWS.d3 = true;
      viewsApply();
    }
    if (!same || curTab === 'gcode') setTab('gcode');
    toast(trf('Script « {f} » : {s} forme(s), {t} parcours.', { f: name, s: proj.shapes.length, t: proj.tps.length }));
  }
  // sorties print() et avertissements des parcours, une fois ceux-ci calculés (le calcul peut se faire en tâche de fond)
  function reportAfterCompute(out) {
    const report = () => {
      const w = S.tps.filter(t => t.err).map(t => t.name + ' : ' + t.err);
      if (w.length) showPanel('Avertissements des parcours', [out, w.join('\n')].filter(Boolean).join('\n\n'), true);
      else if (out) showPanel('Sortie du script', out, false);
      else if (panel) panel.hidden = true;
    };
    if (typeof tpRecalcThen === 'function' && typeof tpLaterT !== 'undefined' && tpLaterT) tpRecalcThen(report);
    else setTimeout(report, 300);
  }
  async function pyRunOnce(text, name, keepView) {
    if (form && !form.hidden) form.querySelector('.pf-state').textContent = T('Calcul…');
    let r;
    try {
      r = await runPy(text, name);
    } catch (e) {
      console.error(e);
      toast(T(MSG_NO_PY) + (e?.message ? ' (' + e.message + ')' : '')); // la cause réelle aide à diagnostiquer
      return;
    }
    const out = r.out.join('\n').trim();
    formRender(r.form, r.verif);
    if (r.verif) {
      if (out) showPanel('Sortie du script', out, false);
      return;
    }
    if (r.err) {
      showPanel('Erreur dans le script', (out ? out + '\n\n' : '') + r.err, true);
      return;
    }
    const proj = buildProject(JSON.parse(r.res), name);
    openResult(proj, name, keepView);
    reportAfterCompute(out);
  }
  async function pyRun(text, name, keepView) {
    if (running) { // un paramètre changé pendant le calcul : on relance ensuite avec la dernière demande
      again = [text, name, keepView];
      return;
    }
    running = true;
    try {
      await pyRunOnce(text, name, keepView);
    } finally {
      running = false;
    }
    if (again) {
      const a = again;
      again = null;
      await pyRun(...a);
    }
  }

  async function readCurrent() {
    if (!PY.handle) return PY.text;
    const f = await PY.handle.getFile();
    PY.mod = f.lastModified;
    PY.name = f.name;
    return f.text();
  }
  async function pyRerun() {
    if (!PY.handle && PY.text == null) {
      toast(T('Ouvrez d’abord un script Python (Fichier › Ouvrir un script Python…).'));
      return;
    }
    try {
      await pyRun(await readCurrent(), PY.name, true);
    } catch (e) {
      toast(errMsg(e));
    }
  }
  // suivi du fichier : relance dès qu'il est enregistré (tant que le projet ouvert est celui du script)
  function watchStop() {
    clearInterval(PY.watch);
    PY.watch = null;
  }
  async function watchTick() {
    if (S.meta?.script !== PY.name) {
      watchStop();
      return;
    }
    if (document.hidden || running) return;
    try {
      const f = await PY.handle.getFile();
      if (f.lastModified === PY.mod) return;
      PY.mod = f.lastModified;
      await pyRun(await f.text(), f.name, true);
    } catch {
      watchStop();
    }
  }
  function watchStart() {
    watchStop();
    if (PY.handle) PY.watch = setInterval(() => { void watchTick(); }, 1000);
  }
  // un autre fichier repart des valeurs par défaut de ses paramètres
  function newScript(name) {
    if (name !== PY.name) PY.vals = {};
  }
  async function openHandle(h) {
    newScript(h.name);
    PY.handle = h;
    PY.text = null;
    await pyRun(await readCurrent(), PY.name);
    watchStart();
  }
  async function openFile(f) {
    watchStop();
    newScript(f.name);
    PY.handle = null;
    PY.name = f.name;
    PY.text = await f.text();
    await pyRun(PY.text, f.name);
  }

  let input = null;
  function fileInput() {
    if (input) return input;
    input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py,text/x-python';
    input.hidden = true;
    input.onchange = () => {
      const f = input.files[0];
      input.value = '';
      if (f) openFile(f).catch(e => toast(errMsg(e)));
    };
    document.body.appendChild(input);
    return input;
  }
  async function pyOpen() {
    if (!window.showOpenFilePicker || window.claude) {
      fileInput().click();
      return;
    }
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: T('Script Python'), accept: { 'text/x-python': ['.py'] } }], multiple: false });
      await openHandle(h);
    } catch (e) {
      if (e?.name !== 'AbortError') toast(errMsg(e));
    }
  }

  // glisser-déposer d'un .py sur la page (avant le gestionnaire de la zone de dessin)
  window.addEventListener('drop', e => {
    const items = [...(e.dataTransfer?.items || [])];
    const it = items.find(x => x.kind === 'file' && /\.py$/i.test(x.getAsFile()?.name || ''));
    if (!it) return;
    e.preventDefault();
    e.stopPropagation();
    const f = it.getAsFile();
    const hp = it.getAsFileSystemHandle ? it.getAsFileSystemHandle() : null; // à demander pendant l'événement
    const open = hp
      ? hp.then(h => (h?.kind === 'file' ? openHandle(h) : openFile(f)), () => openFile(f))
      : openFile(f);
    open.catch(error => toast(errMsg(error)));
  }, true);

  window.pyOpen = pyOpen;
  window.pyRerun = pyRerun;
  window.copoPython = {
    run: (text, name = 'script.py') => {
      watchStop();
      newScript(name);
      PY.handle = null;
      PY.text = text;
      PY.name = name;
      return pyRun(text, name);
    },
    openHandle, buildProject,
  };
})();
