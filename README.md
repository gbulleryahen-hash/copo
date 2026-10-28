# COPO — FAO 2D pour CNC / 2D CAM for CNC

**FR** — COPO est un logiciel de dessin vectoriel et de parcours d'outils (profil, poche, V-carving, perçage) qui fonctionne entièrement dans le navigateur, en français ou en anglais.
**EN** — COPO is a vector drawing and toolpath program (profile, pocket, V-carving, drilling) that runs entirely in the browser, in French or English.

- **Utiliser COPO / Use COPO :** `index.html` (page GitHub Pages de ce dépôt / this repository's GitHub Pages site)
- **Mode d'emploi / User guide :** `guide.html` · PDF : `COPO-mode-emploi-FR.pdf`, `COPO-user-guide-EN.pdf`

**Version 1.213**

## Fonctions / Features
- Dessin : rectangle, ellipse, polygone/étoile, arc, plume (Bézier), texte (aussi sur une courbe), nœuds, chanfreins, congés, dégagements dogbone et T-bone, ajuster, couper, joindre, booléens, réseau, calques, repères, cotes, images de référence, vectorisation d'image (contours), import/export SVG, import DXF (calques, blocs, splines)
- Bibliothèque d'outils façon Aspire : matériaux (bois tendre, bois dur, MDF, acrylique, PVC, aluminium, laiton), outils métriques et impériaux par type, réglages par matériau, avance par dent commentée, import des bibliothèques Aspire/VCarve (.vtdb)
- Usinage : profil (extérieur, intérieur, sur la ligne, gauche/droite des lignes ouvertes), poche en anneaux ou en balayage, reprise de matière, V-carving par axe médian, perçage (débourrage, temporisation, hélice, cycles G81/G82/G83), filetage à la fraise à fileter (intérieur, extérieur, pas, sens)
- Relief (modélisation 2,5D) : import d'images en niveaux de gris et de modèles STL, formes depuis le dessin (dôme, extrusion le long d'un vecteur, lissage entre deux rails ; profils rond, angulaire, plat, doucine), combinaison, aperçu ombré et 3D ; usinage du relief : ébauche par niveaux et finition en balayage (fraise hémisphérique ou conique à bout sphérique), limite par formes fermées
- Projets enregistrés en fichiers `.copo` ; application installable (Chrome, Edge, Brave… sous Windows, macOS, Linux) : fenêtre dédiée, hors ligne, ouverture des `.copo` par double-clic
- Profondeur de départ (D) et de coupe (C) pour tous les parcours ; pendant l'édition d'un parcours, le reste du dessin est estompé et une ligne d'état indique les vecteurs sélectionnés
- Règles d'accroche (Édition › Accroche…) : grille, repères, brut, rayon, points d'accroche sur les objets
- Entrées en rampe aller-retour, rampe continue, arc, arc en rampe, hélice ; surépaisseur et passe de finition ; ponts d'attache automatiques ou manuels
- Imbrication des pièces sur le panneau, usinage double face, aperçu 3D de l'usinage avec trajectoires en 3D
- Lutherie : générateur de touche de guitare (diapason, largeurs, frettes non traversantes, repères) et incrustation en V (inlay : poche femelle et pièce mâle) ; boîte à entures (tenons droits, dogbones, couvercle plat ou à tenons)
- Neuf familles de polices décoratives fournies (URW Chancery, Alegreya, Cinzel Decorative, Pirata One, Chicle, Comic Neue, Protest Riot, Great Vibes, Smokum)
- Une soixantaine de polices à trait unique fournies (Hershey, EMS, Cutlings, Relief SingleLine, Routed Gothic), import de polices SVG ; catalogue avec aperçu : `fonts/apercu-polices.html`
- G-code : GRBL, GRBL changement manuel (G53 + pause), Carbide Motion, Onefinity, LinuxCNC, Mach3/4, UCCNC, MASSO, post-processeur personnalisé ; arcs G2/G3
- Fiche de gamme imprimable : vues 2D des faces, vues dimétriques de la simulation, origine, outils, parcours, vitesses, points de vigilance, liste de contrôle
- Unités en millimètres ou en pouces (fractions possibles), avances en mm/min, mm/s ou in/min, G-code G21 ou G20
- Interface en français et en anglais (boutons FR / EN en haut à droite)

## Usage hors ligne / Offline use
Téléchargez le dossier complet (« Code › Download ZIP »), décompressez-le et ouvrez `index.html` : tout est fourni, rien à installer.
Download the whole folder (“Code › Download ZIP”), unzip it and open `index.html`: everything is included, nothing to install.

- `lib/` : bibliothèques de calcul (`clipper.js`, `opentype.min.js`, `d3-delaunay.js`) et polices de l'interface (`lib/fonts`) / calculation libraries and interface fonts
- `fonts/` : polices à trait unique et décoratives, catalogue / single-line and decorative fonts, catalogue

Vérifiez toujours le G-code par un passage à vide avant d'usiner. / Always check the G-code with a dry run before cutting.

## Licence / License
Copyright (C) 2026 g.bulleryahen

COPO est un logiciel libre : vous pouvez le redistribuer et/ou le modifier selon les termes de la **GNU General Public License version 3** publiée par la Free Software Foundation. Il est distribué sans aucune garantie. Voir le fichier [`LICENSE`](LICENSE).

COPO is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License version 3** as published by the Free Software Foundation. It comes with no warranty. See the [`LICENSE`](LICENSE) file.

Bibliothèques tierces / Third-party libraries, fournies dans / bundled in `lib/` (voir / see `lib/LICENCES.txt`) :
- Clipper 6.4.2 — Angus Johnson — Boost Software License 1.0
- opentype.js 1.3.4 — MIT License
- jsPDF 2.5.2 (fiche de gamme en PDF / setup sheet as PDF) — MIT License
- d3-delaunay 6.0.4 et / and delaunator 5.0.1 — ISC License ; robust-predicates 3.0.2 — Unlicense

Polices à trait unique / Single-line fonts, dans / in `fonts/trait-unique` (regroupées par / collected by https://github.com/msurguy/cnc-text-tool) : EMS, Cutlings, Relief SingleLine, Shriinivas, Routed Gothic — SIL Open Font License 1.1 ; Hershey — licence Hershey (attribution au Dr A. V. Hershey, U.S. National Bureau of Standards). Voir / see `fonts/trait-unique/LICENCES.txt`.

Polices décoratives / Decorative fonts, dans / in `fonts/decoratives` (téléchargées depuis / from https://github.com/google/fonts et / and https://github.com/ArtifexSoftware/urw-base35-fonts) : Alegreya (Juan Pablo del Peral), Cinzel Decorative (Natanael Gama), Pirata One (Rodrigo Fuenzalida, Nicolás Massi), Chicle (Angel Koziupa, Alejandro Paul), Comic Neue (Craig Rozynski), Protest Riot (Octavio Pardo), Great Vibes (Robert Leuschke) — SIL Open Font License 1.1 ; Smokum (Vernon Adams) — Apache License 2.0 ; URW Chancery (Z003, URW++) — GNU AGPL 3 avec exception pour les polices / with font exception. Voir / see `fonts/decoratives/LICENCES.txt`.

Polices de l'interface / Interface fonts, dans / in `lib/fonts` : Source Sans 3 (Adobe), JetBrains Mono (JetBrains), Barlow Condensed (Jeremy Tribby) — SIL Open Font License 1.1, voir / see `lib/fonts/OFL-*.txt`.
