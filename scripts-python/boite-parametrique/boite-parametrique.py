# Boîte paramétrique avec couvercle et compartiments — version COPO d'un générateur écrit pour Fusion 360
# (mêmes paramètres, mêmes vérifications, mêmes messages).
# Dans COPO : Fichier › Ouvrir un script Python… ; les paramètres s'affichent dans un formulaire,
# chaque modification recalcule la pièce, les parcours et le G-code.
#
# Le corps et le couvercle sont usinés côte à côte dans le même brut, par le dessus :
#   - le couvercle est posé à l'envers (dessus contre la table), son creux tourné vers le haut ;
#   - la feuillure du corps est taillée par un contournage extérieur du haut du corps (ou une poche
#     en anneau si la fraise de contour est plus étroite que la feuillure) ;
#   - les compartiments sont des poches à la fraise des poches (D, R) ;
#   - les deux pièces sont détourées en dernier, avec des ponts d'attache.
# Toutes les cotes sont en mm.

from copo import *

TOL = 1e-6
EPAISSEUR_MINI = 2.5  # paroi la plus fine usinable dans le bois à la fraise

# ---------------------------------------------------------------- paramètres de la boîte
L = parametre("Longueur de la boîte", 150)
l = parametre("Largeur de la boîte", 100)
h_corps = parametre("Hauteur du corps", 21)
h_couv = parametre("Hauteur du couvercle", 20)
paroi = parametre("Épaisseur des parois latérales", 6)
fond = parametre("Épaisseur du fond", 6)
dessus = parametre("Épaisseur du dessus du couvercle", 5)
n = parametre("Nombre de compartiments", 3, unite="", mini=1, maxi=10)
sens = choix("Orientation des cloisons", ["Transversales (parallèles à la largeur)",
                                          "Longitudinales (parallèles à la longueur)"])
longitudinal = sens.startswith("Longitudinales")
cloison = parametre("Épaisseur des cloisons", 3)

# largeurs des compartiments : égales par défaut, remises à égalité quand la disposition change ;
# le dernier prend la place restante
long_int, larg_int = L - 2 * paroi, l - 2 * paroi
portee, autre = (larg_int, long_int) if longitudinal else (long_int, larg_int)
disponible = portee - (n - 1) * cloison
disposition = (L, l, paroi, cloison, n, sens)
largeurs = [parametre("Largeur du compartiment %d" % i, disponible / n, depend_de=disposition)
            for i in range(1, n)]
largeurs.append(disponible - sum(largeurs))
afficher("Largeur du compartiment %d" % n, largeurs[-1], "mm")

feuillure_l = parametre("Largeur de la feuillure", 3)
feuillure_p = parametre("Profondeur de la feuillure", 8)
rayon = parametre("Rayon des angles de la boîte", 6)
D = parametre("Fraise des poches : diamètre D", 19)
R = parametre("Fraise des poches : rayon R", 6.3)
I = parametre("Fraise des poches : hauteur de coupe I", 15.9)
jeu = parametre("Jeu d'emboîtement", 0.2)

# ---------------------------------------------------------------- paramètres d'usinage (absents de la version Fusion)
Dc = parametre("Fraise de contour : diamètre", 6)
marge = parametre("Marge autour des pièces", 10)
ecart = parametre("Écart entre corps et couvercle", 10)
ponts = parametre("Ponts d'attache par pièce", 4, unite="", mini=0, maxi=12)

afficher("Hauteur totale boîte fermée", h_corps + h_couv - feuillure_p, "mm")

# ---------------------------------------------------------------- vérifications (checkParams)
for v, nom in ((L, "La longueur"), (l, "La largeur"), (h_corps, "La hauteur du corps"),
               (h_couv, "La hauteur du couvercle"), (paroi, "L'épaisseur des parois"),
               (fond, "L'épaisseur du fond"), (dessus, "L'épaisseur du dessus"),
               (feuillure_l, "La largeur de la feuillure"), (feuillure_p, "La profondeur de la feuillure"),
               (Dc, "Le diamètre de la fraise de contour")):
    verifier(v > TOL, "%s doit être strictement positive." % nom)
verifier(jeu >= 0 and R >= 0 and rayon >= 0,
         "Le jeu, le rayon de la fraise et le rayon des angles ne peuvent pas être négatifs.")
verifier(2 * paroi < min(L, l) - TOL, "Les parois sont trop épaisses pour les dimensions de la boîte.")
verifier(2 * rayon < min(L, l) - TOL, "Le rayon des angles est trop grand pour les dimensions de la boîte.")
verifier(fond < h_corps - TOL, "Le fond doit être moins épais que la hauteur du corps.")
verifier(dessus < h_couv - TOL, "Le dessus doit être moins épais que la hauteur du couvercle.")
verifier(feuillure_l < paroi - TOL, "La feuillure doit être moins large que la paroi.")
verifier(feuillure_l > jeu + TOL, "La feuillure doit être plus large que le jeu (la paroi du couvercle serait nulle).")
verifier(feuillure_p < h_corps - TOL, "La feuillure doit être moins profonde que la hauteur du corps.")
verifier(feuillure_p <= h_couv - dessus + TOL, "La feuillure doit être moins profonde que le creux du couvercle.")
if n > 1:
    verifier(cloison > TOL, "L'épaisseur des cloisons doit être strictement positive.")
epaisseurs = [(paroi - feuillure_l, "La paroi du corps au-dessus de la feuillure (paroi - feuillure)"),
              (feuillure_l - jeu, "La paroi du couvercle (feuillure - jeu)")]
if n > 1:
    epaisseurs.append((cloison, "La cloison"))
for e, nom in epaisseurs:
    verifier(e >= EPAISSEUR_MINI - TOL, "%s fait %.2f mm : le minimum pour le fraisage est de %.2f mm."
             % (nom, e, EPAISSEUR_MINI))
verifier(min(largeurs) > TOL, "Les cloisons ou les largeurs saisies ne laissent pas de place pour tous les compartiments.")
verifier(D > TOL, "Le diamètre de la fraise doit être strictement positif.")
verifier(R <= D / 2 + TOL, "Le rayon R de la fraise ne peut pas dépasser la moitié de son diamètre D.")
plus_petit = min(min(largeurs), autre)
verifier(D < plus_petit - TOL, "La fraise est trop large pour le plus petit compartiment (%.2f mm)." % plus_petit)
prof_poche = h_corps - fond
verifier(R < prof_poche - TOL, "Le rayon de la fraise est trop grand pour la profondeur des compartiments.")
r_haut = max(rayon - feuillure_l, 0)  # angles du haut du corps, concentriques aux angles extérieurs
retrait = r_haut - (paroi - feuillure_l) - D / 2
if retrait > 0:
    verifier(r_haut - D / 2 - 2 ** 0.5 * retrait > TOL, "Le rayon des angles est trop grand pour cette épaisseur de paroi.")

# ---------------------------------------------------------------- messages (depthWarning, toolInfo)
if prof_poche > I + TOL:
    avertissement("Attention : compartiments de %.2f mm pour %.2f mm de coupe. Vérifie que le porte-outil "
                  "n'entre pas en contact avec les parois." % (prof_poche, I))
if R <= TOL:
    info("Rayon = 0 : poches sans congé, fraise droite à bout plat.")
    fraise_poches = fraise(D)
elif R >= D / 2 - TOL:
    info("Rayon = D/2 : fond entièrement arrondi, fraise hémisphérique.")
    fraise_poches = fraise_boule(D)
else:
    info("Rayon de %.2f mm : congé de fond, fraise à bol." % R)
    avertissement("COPO n'a pas de fraise à bol : le G-code des compartiments est juste (même trajectoire), "
                  "mais la vue 3D montre un fond à angles vifs au lieu du congé R.")
    fraise_poches = fraise(D, nom="Fraise à bol D%g R%g" % (D, R))
r_creux = r_haut + jeu
if Dc / 2 > r_creux + TOL:
    avertissement("La fraise de contour (Ø %g) arrondit les angles du creux du couvercle à %.2f mm au lieu de "
                  "%.2f mm : le couvercle ne s'emboîtera pas sans retouche." % (Dc, Dc / 2, r_creux))

# ---------------------------------------------------------------- brut et géométrie
T = max(h_corps, h_couv)  # épaisseur du brut : la plus haute des deux pièces
projet("Boîte paramétrique", materiau="Bois")
brut(L + 2 * marge, 2 * l + ecart + 2 * marge, T, origine="bas-gauche", z="dessus")
contour = fraise(Dc)

x0, y_corps, y_couv = marge, marge, marge + l + ecart
corps = rectangle(x0, y_corps, L, l, rayon=rayon)
haut_corps = rectangle(x0 + feuillure_l, y_corps + feuillure_l, L - 2 * feuillure_l, l - 2 * feuillure_l, rayon=r_haut)
couvercle = rectangle(x0, y_couv, L, l, rayon=rayon)
creux = rectangle(x0 + feuillure_l - jeu, y_couv + feuillure_l - jeu,
                  L - 2 * feuillure_l + 2 * jeu, l - 2 * feuillure_l + 2 * jeu, rayon=r_creux)

compartiments = []
debut = 0.0
for taille in largeurs:
    if longitudinal:
        r = rectangle(x0 + paroi, y_corps + paroi + debut, autre, taille, rayon=D / 2)
    else:
        r = rectangle(x0 + paroi + debut, y_corps + paroi, taille, autre, rayon=D / 2)
    compartiments.append(r)
    debut += taille + cloison

# ---------------------------------------------------------------- usinages (dans l'ordre d'exécution)
dz_corps, dz_couv = T - h_corps, T - h_couv  # surfaçage de la pièce la moins haute
if dz_corps > TOL:
    poche(corps, contour, dz_corps, nom="Surfaçage du corps")
if dz_couv > TOL:
    poche(couvercle, contour, dz_couv, nom="Surfaçage du couvercle")
if Dc >= feuillure_l - TOL:
    profil(haut_corps, contour, dz_corps + feuillure_p, cote="exterieur", nom="Feuillure")
else:
    poche([corps, haut_corps], contour, dz_corps + feuillure_p, nom="Feuillure")
poche(creux, contour, dz_couv + h_couv - dessus, nom="Creux du couvercle")
poche(compartiments, fraise_poches, dz_corps + prof_poche, nom="Compartiments")
profil(corps, contour, T, cote="exterieur", ponts=ponts, nom="Détourage du corps")
profil(couvercle, contour, T, cote="exterieur", ponts=ponts, nom="Détourage du couvercle")
