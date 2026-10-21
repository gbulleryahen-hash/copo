# COPO — FAO 2D pour CNC / 2D CAM for CNC

**FR** — COPO est un logiciel de dessin vectoriel et de parcours d'outils (profil, poche, V-carving, perçage) qui fonctionne entièrement dans le navigateur, en français ou en anglais.
**EN** — COPO is a vector drawing and toolpath program (profile, pocket, V-carving, drilling) that runs entirely in the browser, in French or English.

- **Utiliser COPO / Use COPO :** `index.html` (page GitHub Pages de ce dépôt / this repository's GitHub Pages site)
- **Mode d'emploi / User guide :** `guide.html` · PDF : `COPO-mode-emploi-FR.pdf`, `COPO-user-guide-EN.pdf`

## Fonctions / Features
- Dessin : rectangle, ellipse, polygone/étoile, arc, plume (Bézier), texte (aussi sur une courbe), nœuds, chanfreins, congés, dégagements dogbone et T-bone, ajuster, couper, joindre, booléens, réseau, calques, repères, cotes, images de référence, vectorisation d'image (contours), import/export SVG, import DXF (calques, blocs, splines)
- Usinage : profil (extérieur, intérieur, sur la ligne, gauche/droite des lignes ouvertes), poche en anneaux ou en balayage, reprise de matière, V-carving par axe médian, perçage (débourrage, hélice)
- Entrées en rampe aller-retour, rampe continue, arc, arc en rampe, hélice ; surépaisseur et passe de finition ; ponts d'attache automatiques ou manuels
- Imbrication des pièces sur le panneau, usinage double face, aperçu 3D de l'usinage avec trajectoires en 3D
- Lutherie : générateur de touche de guitare (diapason, largeurs, frettes non traversantes, repères) et incrustation en V (inlay : poche femelle et pièce mâle)
- Une soixantaine de polices à trait unique fournies (Hershey, EMS, Cutlings, Relief SingleLine, Routed Gothic), import de polices SVG ; catalogue avec aperçu : `fonts/apercu-polices.html`
- G-code : GRBL, GRBL changement manuel (G53 + pause), Carbide Motion, Onefinity, LinuxCNC, Mach3/4, UCCNC, MASSO, post-processeur personnalisé ; arcs G2/G3
- Fiche de gamme imprimable : vues 2D des faces, vues dimétriques de la simulation, origine, outils, parcours, vitesses, points de vigilance, liste de contrôle
- Unités en millimètres ou en pouces (fractions possibles), avances en mm/min, mm/s ou in/min, G-code G21 ou G20
- Interface en français et en anglais (boutons FR / EN en haut à droite)

## Usage hors ligne / Offline use
Téléchargez le dossier complet (« Code › Download ZIP »), décompressez-le et ouvrez `index.html` : tout est fourni, rien à installer.
Download the whole folder (“Code › Download ZIP”), unzip it and open `index.html`: everything is included, nothing to install.

- `lib/` : bibliothèques de calcul (`clipper.js`, `opentype.min.js`, `d3-delaunay.js`) et polices de l'interface (`lib/fonts`) / calculation libraries and interface fonts
- `fonts/` : polices à trait unique et leur catalogue / single-line fonts and their catalogue

Vérifiez toujours le G-code par un passage à vide avant d'usiner. / Always check the G-code with a dry run before cutting.

## Licence / License
Copyright (C) 2026 g.bulleryahen

COPO est un logiciel libre : vous pouvez le redistribuer et/ou le modifier selon les termes de la **GNU General Public License version 3** publiée par la Free Software Foundation. Il est distribué sans aucune garantie. Voir le fichier [`LICENSE`](LICENSE).

COPO is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License version 3** as published by the Free Software Foundation. It comes with no warranty. See the [`LICENSE`](LICENSE) file.

Bibliothèques tierces / Third-party libraries, fournies dans / bundled in `lib/` (voir / see `lib/LICENCES.txt`) :
- Clipper 6.4.2 — Angus Johnson — Boost Software License 1.0
- opentype.js 1.3.4 — MIT License
- d3-delaunay 6.0.4 et / and delaunator 5.0.1 — ISC License ; robust-predicates 3.0.2 — Unlicense

Polices à trait unique / Single-line fonts, dans / in `fonts/trait-unique` (regroupées par / collected by https://github.com/msurguy/cnc-text-tool) : EMS, Cutlings, Relief SingleLine, Shriinivas, Routed Gothic — SIL Open Font License 1.1 ; Hershey — licence Hershey (attribution au Dr A. V. Hershey, U.S. National Bureau of Standards). Voir / see `fonts/trait-unique/LICENCES.txt`.

Polices de l'interface / Interface fonts, dans / in `lib/fonts` : Source Sans 3 (Adobe), JetBrains Mono (JetBrains), Barlow Condensed (Jeremy Tribby) — SIL Open Font License 1.1, voir / see `lib/fonts/OFL-*.txt`.
