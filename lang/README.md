# Langues de l'interface COPO / COPO interface languages

**FR** — Les textes de COPO sont écrits en français dans `index.html` ; l'anglais y est intégré (`I18N_EN`).
Les autres langues sont des dictionnaires dans ce dossier, chargés seulement quand on les choisit dans la liste des langues.
Un texte absent d'un dictionnaire s'affiche en anglais.

Ajouter une langue :
1. créer `lang/xx.js` sur le modèle de `zh.js` : `COPO_LANG('xx', { I18N: { "texte français": "traduction", … }, GL: { … }, SNAP: { … } });`
   - `I18N` : texte français exact (ou morceau de texte) → traduction ; garder les `{n}`, `{d}`… tels quels ;
   - `GL` (facultatif) : glossaire des bulles d'aide des termes techniques (terme français en minuscules → explication) ;
   - `SNAP` (facultatif) : étiquettes d'accrochage (`end`, `mid`, `int`, `cen`, `tan`, `ext`, `on`, `org`, `hor`, `ver`, `ang`, `stk`, `gd`) ;
2. ajouter une ligne dans `COPO_LANGS` (dans `index.html`) : `{ k: 'xx', name: 'Nom de la langue', short: 'XX', ok: 'message de confirmation', file: 'lang/xx.js', html: 'xx' }`
   (`plur: false` si la langue n'a pas de pluriel en « (s) »).

Textes à traduire : dans la console du navigateur, `copoLangMissing('xx')` donne la liste des textes pas encore traduits.

**EN** — COPO texts are written in French in `index.html`; English is built in (`I18N_EN`).
Other languages are dictionaries in this folder, loaded only when chosen from the language list.
A text missing from a dictionary is shown in English.

To add a language: create `lang/xx.js` like `zh.js` (`I18N`: exact French text or part of it → translation, keep `{n}`… placeholders; optional `GL` glossary and `SNAP` labels), then add one line to `COPO_LANGS` in `index.html`.
To list untranslated texts: run `copoLangMissing('xx')` in the browser console.

| Langue / Language | Fichier / File | Traduction / Translation |
|---|---|---|
| 中文（简体） | `zh.js` | [ker0491](https://github.com/ker0491) (PR #18), GPLv3 |
