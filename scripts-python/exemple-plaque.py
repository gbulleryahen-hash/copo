# Exemple de script Python pour COPO : une plaque de fixation percée, avec une poche et une gravure.
# Dans COPO : Fichier › Ouvrir un script Python…, puis choisissez ce fichier.
# Modifiez une cote et enregistrez : COPO relance le script et met à jour la pièce et le G-code.

from copo import *

projet("Plaque de fixation", materiau="Contreplaqué 18 mm")

# brut de 300 × 200 × 18 mm, zéro au coin bas gauche, sur le dessus
L, H, E = 300, 200, 18
brut(L, H, E, origine="bas-gauche", z="dessus", materiau="bois tendre")

f6 = fraise(6)
f3 = fraise(3.175)
v90 = fraise_v(90, 12)
m8 = foret(8)

# contour de la plaque, coins arrondis
marge = 15
plaque = rectangle(marge, marge, L - 2 * marge, H - 2 * marge, rayon=12)

# une rangée de trous de fixation, régulièrement espacés
n_trous = 5
pas = (L - 2 * marge - 60) / (n_trous - 1)
trous = [cercle(marge + 30 + i * pas, H - marge - 25, 4) for i in range(n_trous)]

# une poche oblongue au centre et un hexagone
poche_centrale = rectangle(L / 2, H / 2 - 10, 140, 50, rayon=25, centre=True)
hexa = polygone(L / 2, 55, 18, 6)

print("Pas entre les trous :", round(pas, 2), "mm")

# usinages, dans l'ordre d'exécution
percage(trous, m8, E, debourrage=4)
poche(poche_centrale, f6, 8, strategie="anneaux")
vcarve(hexa, v90, profondeur_max=0)
profil(plaque, f6, E, cote="exterieur", ponts=4)
