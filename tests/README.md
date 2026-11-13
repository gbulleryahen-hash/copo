# Tests de non-régression du G-code

Ces tests vérifient qu'une modification de COPO ne change pas, sans qu'on le veuille, le G-code
produit pour des projets de référence. Ils ne touchent pas à `index.html` : ils ouvrent COPO dans
Chrome sans fenêtre et appellent ses propres fonctions, comme le ferait l'utilisateur.

## Lancer les tests

Il faut [Node.js](https://nodejs.org) (version 18 ou plus) et Chrome ou Edge installés.

```
npm --prefix tests install                  # une seule fois : installe puppeteer-core (pilote de Chrome)
node tests/verifier-gcode.js                # compare le G-code produit au G-code attendu
node tests/verifier-gcode.js poches         # seulement les projets dont le nom contient « poches »
node tests/verifier-gcode.js poches --voir  # ouvre le projet dans COPO, dans une fenêtre Chrome
```

`--voir` ouvre COPO dans une fenêtre Chrome **vierge**, comme pendant le test (machine par défaut,
interface en français), avec le projet chargé et l'onglet G-code affiché : le G-code visible est
celui que le test compare au fichier attendu. Votre navigateur habituel garde vos propres réglages
(machine, unités, langue) : le même projet ouvert chez vous peut donner un G-code différent sans
qu'il y ait de régression.

Si Chrome n'est pas trouvé, indiquez son chemin dans la variable `COPO_CHROME`.

Chaque cas affiche `ok`, ou `ÉCHEC` avec les premières lignes différentes (attendu / obtenu).
Le code de sortie vaut 0 si tout est conforme, 1 sinon.

## Ce qui est vérifié

Pour chaque projet de `projets/` et chaque post-processeur de la liste `CAS` de `verifier-gcode.js` :

1. le projet est ouvert comme un `.copo`, les parcours sont calculés comme dans l'application ;
2. aucun parcours ne doit être en erreur, et la page ne doit pas lever d'erreur JavaScript ;
3. les parcours sont recalculés de force **en tâche de fond** : le G-code doit être identique
   (le calcul en tâche de fond reprend le code de la page, les résultats doivent être les mêmes) ;
4. le G-code est comparé ligne par ligne au fichier `attendus/<projet>__<post>.nc`.

L'heure est figée pendant la production du G-code (certains post-processeurs Vectric écrivent la date).

| Projet | Contenu | Post-processeurs |
|---|---|---|
| `exemple` | le projet d'exemple de COPO (profil, perçage, V-carving, poches, double face) | les 9 intégrés + 3 Vectric (Mach ATC, ShopBot, Haas) |
| `exemple-rotatif` | l'exemple rotatif (4ᵉ axe) | GRBL, Mach3 |
| `poches` | anneaux, balayage 30°, zigzag, anneaux vers l'intérieur avec îlot, rampe, hélice, surépaisseur et finition, opposition | GRBL |
| `profils` | extérieur avec ponts, intérieur avec entrée en arc, sur la ligne en rampe continue, surépaisseur, ligne ouverte | GRBL, LinuxCNC |
| `percages` | foret d'un trait, débourrage et temporisation, trous en hélice à la fraise | GRBL, grblHAL, LinuxCNC, Mach3 (cycles G81/G82/G83) |
| `double-face` | un calque sur la face retournée | GRBL |

`exemple.copo` et `exemple-rotatif.copo` sont des copies figées des projets d'exemple de COPO :
modifier l'exemple de l'application ne change pas ces tests. Les autres projets sont fabriqués par
`fabrique-projets.js` (`node tests/fabrique-projets.js` après l'avoir modifié).

## Quand le G-code change volontairement

Après une modification qui doit changer le G-code (nouvelle option, correction d'un calcul) :

1. lancez les tests et lisez les différences : ce sont exactement les lignes que la modification change ;
2. si elles sont voulues, réécrivez le G-code attendu : `node tests/verifier-gcode.js --maj` ;
3. commitez les fichiers de `attendus/` avec la modification : le diff montre l'effet sur le G-code.

## Ajouter un cas

- un post-processeur : ajoutez-le à la liste `CAS` de `verifier-gcode.js`, puis `--maj` ;
- un projet : enregistrez un `.copo` dans `projets/` (ou ajoutez-le à `fabrique-projets.js`),
  ajoutez-le à `CAS`, puis `node tests/verifier-gcode.js <nom> --maj`.
