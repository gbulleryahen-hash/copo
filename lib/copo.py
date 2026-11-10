"""copo — décrire une pièce et ses usinages en Python, puis l'ouvrir dans COPO.

(Après toute modification de ce fichier : python lib/genere-copo-py-js.py, pour mettre à jour
la copie lib/copo-py.js utilisée quand index.html est ouvert directement depuis le disque.)

Fichier › Ouvrir un script Python… exécute le script dans le navigateur (Pyodide),
puis COPO dessine la pièce, calcule les parcours, montre la vue 3D et le G-code.

Toutes les cotes sont en millimètres, l'origine (0, 0) est le coin bas gauche du brut,
X vers la droite, Y vers le haut. Les profondeurs sont positives (6 = 6 mm sous la surface).

Exemple :

    from copo import *

    brut(300, 200, 18, materiau="contreplaqué")
    f6 = fraise(6)
    plaque = rectangle(20, 20, 260, 160, rayon=10)
    trous = [cercle(40 + i * 55, 100, 4) for i in range(5)]
    percage(trous, foret(8), 18)
    profil(plaque, f6, 18, cote="exterieur", ponts=4)

Les réglages non prévus ici passent tels quels à COPO par mots-clés
(par exemple allow=0.3 pour la surépaisseur, dir="conv" pour l'usinage en opposition).

Script paramétrique : parametre() et choix() font apparaître un formulaire dans COPO ;
chaque modification relance le script avec les nouvelles valeurs. Déclarez les paramètres
en tête du script, puis les vérifications, puis la géométrie :

    L = parametre("Longueur", 150, mini=20)
    n = parametre("Compartiments", 3, mini=1, maxi=10)      # entier : défaut entier
    sens = choix("Orientation", ["Transversal", "Longitudinal"])
    verifier(L > 2 * paroi, "Les parois sont trop épaisses.")  # message rouge, pièce non mise à jour
    avertissement("Poche plus profonde que la coupe.")       # message orange
    afficher("Hauteur fermée", h, "mm")                      # valeur calculée, en lecture seule
"""

import json as _json
import math as _math

__all__ = [
    "projet", "brut", "calque",
    "rectangle", "cercle", "ellipse", "polygone", "etoile", "polyligne", "arc",
    "fraise", "fraise_v", "fraise_boule", "foret",
    "profil", "poche", "percage", "vcarve",
    "parametre", "choix", "afficher", "verifier", "avertissement", "info", "CopoErreur",
    # alias anglais
    "project", "stock", "layer", "circle", "polygon", "star", "polyline",
    "end_mill", "v_bit", "ball_mill", "drill_bit", "profile", "pocket", "drill",
]


class CopoErreur(Exception):
    """Erreur dans la description de la pièce (message affiché dans COPO)."""


# ---------------------------------------------------------------- état du script

class _Etat:
    def __init__(self, valeurs=None):
        self.valeurs = valeurs or {}   # saisies du formulaire : {nom: {"v": valeur, "sig": signature}}
        self.params = []               # champs du formulaire, dans l'ordre de déclaration
        self.messages = []             # [("erreur" | "avertissement" | "info", texte)]
        self.nom = None
        self.materiau_nom = None
        self.brut = None
        self.calques = []
        self.formes = []
        self.parcours = []
        self.n = 0

    def uid(self, prefixe):
        self.n += 1
        return "py%s%d" % (prefixe, self.n)


_E = _Etat()


def _reset(valeurs_json=None):
    global _E
    _E = _Etat(_json.loads(valeurs_json) if valeurs_json else None)


def _num(v, nom):
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise CopoErreur("%s : nombre attendu, reçu %r" % (nom, v))
    if _math.isnan(x) or _math.isinf(x):
        raise CopoErreur("%s : nombre fini attendu, reçu %r" % (nom, v))
    return x


def _pos(v, nom):
    x = _num(v, nom)
    if x <= 0:
        raise CopoErreur("%s doit être positif (reçu %g)" % (nom, x))
    return x


# ---------------------------------------------------------------- paramètres (formulaire dans COPO)

def _declare(nom, d):
    nom = str(nom)
    if any(p["nom"] == nom for p in _E.params):
        raise CopoErreur("paramètre déclaré deux fois : %r" % (nom,))
    d["nom"] = nom
    _E.params.append(d)
    return d


def _saisie(nom, sig):
    s = _E.valeurs.get(str(nom))
    if s is None or s.get("sig") != sig:
        return None
    return s.get("v")


def parametre(nom, defaut, unite="mm", mini=None, maxi=None, pas=None, depend_de=None, aide=None):
    """Cote ou nombre réglable dans le formulaire de COPO ; renvoie la valeur saisie (ou defaut).
    Un défaut entier donne un champ entier, un défaut True/False une case à cocher.
    depend_de : valeurs dont le changement remet ce paramètre à son défaut
    (par exemple des largeurs de compartiments qui dépendent de la longueur et du nombre)."""
    sig = None if depend_de is None else repr(depend_de)
    if isinstance(defaut, bool):
        v = _saisie(nom, sig)
        v = defaut if v is None else bool(v)
        _declare(nom, {"type": "bool", "v": v, "defaut": defaut, "sig": sig, "aide": aide})
        return v
    entier = isinstance(defaut, int) and (pas is None or float(pas).is_integer())
    defaut = _num(defaut, nom)
    v = _saisie(nom, sig)
    try:
        v = defaut if v is None else float(v)
    except (TypeError, ValueError):
        v = defaut
    if entier:
        v = int(round(v))
    d = _declare(nom, {"type": "int" if entier else "num", "v": v, "defaut": defaut, "unite": str(unite or ""),
                       "mini": mini, "maxi": maxi, "pas": pas, "sig": sig, "aide": aide})
    if mini is not None and v < mini:
        _E.messages.append(("erreur", "%s : %g au minimum." % (d["nom"], mini)))
    if maxi is not None and v > maxi:
        _E.messages.append(("erreur", "%s : %g au maximum." % (d["nom"], maxi)))
    return v


def choix(nom, options, defaut=0):
    """Liste déroulante ; renvoie le texte de l'option choisie. defaut : indice ou texte."""
    opts = [str(o) for o in options]
    if not opts:
        raise CopoErreur("choix %r : aucune option" % (nom,))
    if not isinstance(defaut, int):
        defaut = opts.index(str(defaut)) if str(defaut) in opts else 0
    v = _saisie(nom, None)
    if v not in opts:
        v = opts[max(0, min(len(opts) - 1, defaut))]
    _declare(nom, {"type": "choix", "v": v, "options": opts, "defaut": opts[defaut], "sig": None})
    return v


def afficher(nom, valeur, unite=""):
    """Ligne en lecture seule dans le formulaire (valeur calculée)."""
    if isinstance(valeur, float):
        valeur = ("%.2f" % valeur).rstrip("0").rstrip(".")
    _declare(nom, {"type": "texte", "v": str(valeur) + (" " + unite if unite else ""), "sig": None})


def verifier(condition, message):
    """Si la condition est fausse : message en rouge, et COPO garde la pièce précédente.
    Le script continue (pour que tout le formulaire reste affiché) ; une erreur qui en découlerait
    plus loin est masquée par ce message."""
    if not condition:
        _E.messages.append(("erreur", str(message)))
    return bool(condition)


def avertissement(message):
    """Message en orange sous le formulaire (la pièce est quand même mise à jour)."""
    _E.messages.append(("avertissement", str(message)))


def info(message):
    """Message en bleu sous le formulaire."""
    _E.messages.append(("info", str(message)))


def _formulaire():
    return _json.dumps({"params": _E.params, "messages": _E.messages})


def _erreurs():
    return [m for k, m in _E.messages if k == "erreur"]


# ---------------------------------------------------------------- projet et brut

_ORIGINES = {
    "bas-gauche": "bl", "bas": "bc", "bas-droite": "br",
    "gauche": "ml", "centre": "mc", "droite": "mr",
    "haut-gauche": "tl", "haut": "tc", "haut-droite": "tr",
}
_ORIGINES_COPO = set(_ORIGINES.values())


def projet(nom=None, materiau=None):
    """Nom du projet et libellé du matériau (affichés dans COPO et la fiche de gamme)."""
    _E.nom = None if nom is None else str(nom)
    _E.materiau_nom = None if materiau is None else str(materiau)


def brut(largeur, hauteur, epaisseur, origine="bas-gauche", z="dessus", materiau=None):
    """Panneau à usiner. origine : bas-gauche, centre, haut-droite… (ou bl, mc, tr…) ;
    z : « dessus » ou « dessous » (zéro Z sur le dessus ou le dessous du brut) ;
    materiau : bois tendre, bois dur, MDF, acrylique, PVC, PEHD, aluminium, laiton."""
    o = _ORIGINES.get(str(origine).lower(), str(origine).lower())
    if o not in _ORIGINES_COPO:
        raise CopoErreur("origine inconnue : %r (bas-gauche, centre, haut-droite…)" % (origine,))
    zz = {"dessus": "top", "dessous": "bottom", "top": "top", "bottom": "bottom"}.get(str(z).lower())
    if zz is None:
        raise CopoErreur("z doit valoir « dessus » ou « dessous » (reçu %r)" % (z,))
    _E.brut = {
        "w": _pos(largeur, "largeur du brut"),
        "h": _pos(hauteur, "hauteur du brut"),
        "t": _pos(epaisseur, "épaisseur du brut"),
        "originXY": o, "originZ": zz,
        "mat": None if materiau is None else str(materiau),
    }
    if materiau is not None and _E.materiau_nom is None:
        _E.materiau_nom = str(materiau)


def calque(nom, couleur=None, face=1):
    """Crée un calque et renvoie son identifiant (à passer en calque=… aux formes).
    face=2 : formes usinées sur la face retournée (usinage double face)."""
    c = {"id": _E.uid("l"), "name": str(nom), "visible": True, "locked": False}
    if couleur:
        c["color"] = str(couleur)
    if face == 2:
        c["face"] = 2
    _E.calques.append(c)
    return c["id"]


# ---------------------------------------------------------------- formes

class Forme:
    """Un vecteur du dessin. Se passe aux usinages, seul ou dans une liste."""

    def __init__(self, d, calque_id):
        d["id"] = _E.uid("s")
        if calque_id is not None:
            if not any(c["id"] == calque_id for c in _E.calques):
                raise CopoErreur("calque inconnu : %r (créez-le avec calque())" % (calque_id,))
            d["layer"] = calque_id
        self._d = d
        _E.formes.append(d)

    @property
    def id(self):
        return self._d["id"]

    def __repr__(self):
        return "<Forme %s %s>" % (self._d["kind"], self.id)


def rectangle(x, y, largeur, hauteur, rayon=0, centre=False, calque=None):
    """Rectangle depuis son coin bas gauche (ou depuis son centre avec centre=True),
    coins arrondis de rayon donné."""
    w, h = _pos(largeur, "largeur"), _pos(hauteur, "hauteur")
    x, y = _num(x, "x"), _num(y, "y")
    if centre:
        x, y = x - w / 2, y - h / 2
    r = max(0.0, _num(rayon, "rayon"))
    return Forme({"kind": "rect", "x": x, "y": y, "w": w, "h": h, "r": r}, calque)


def cercle(cx, cy, rayon, calque=None):
    """Cercle de centre (cx, cy)."""
    return Forme({"kind": "ellipse", "cx": _num(cx, "cx"), "cy": _num(cy, "cy"),
                  "rx": _pos(rayon, "rayon"), "ry": _pos(rayon, "rayon")}, calque)


def ellipse(cx, cy, rx, ry, calque=None):
    """Ellipse de centre (cx, cy) et de demi-axes rx, ry."""
    return Forme({"kind": "ellipse", "cx": _num(cx, "cx"), "cy": _num(cy, "cy"),
                  "rx": _pos(rx, "rx"), "ry": _pos(ry, "ry")}, calque)


def polygone(cx, cy, rayon, cotes, rotation=90, calque=None):
    """Polygone régulier inscrit dans un cercle de rayon donné ; rotation en degrés
    (90 : un sommet en haut)."""
    n = int(cotes)
    if n < 3:
        raise CopoErreur("un polygone a au moins 3 côtés")
    return Forme({"kind": "poly", "cx": _num(cx, "cx"), "cy": _num(cy, "cy"),
                  "r": _pos(rayon, "rayon"), "n": n, "rot": _num(rotation, "rotation")}, calque)


def etoile(cx, cy, rayon_ext, rayon_int, branches=5, rotation=90, calque=None):
    """Étoile à n branches."""
    n = int(branches)
    if n < 2:
        raise CopoErreur("une étoile a au moins 2 branches")
    return Forme({"kind": "star", "cx": _num(cx, "cx"), "cy": _num(cy, "cy"),
                  "r1": _pos(rayon_ext, "rayon_ext"), "r2": _pos(rayon_int, "rayon_int"),
                  "n": n, "rot": _num(rotation, "rotation")}, calque)


def polyligne(points, fermee=False, calque=None):
    """Suite de segments [(x, y), …] ; fermee=True relie le dernier point au premier."""
    pts = []
    for i, p in enumerate(points):
        try:
            px, py = p
        except (TypeError, ValueError):
            raise CopoErreur("point %d : couple (x, y) attendu, reçu %r" % (i, p))
        pts.append([_num(px, "x"), _num(py, "y")])
    if len(pts) < 2:
        raise CopoErreur("une polyligne a au moins 2 points")
    if fermee and len(pts) < 3:
        raise CopoErreur("une polyligne fermée a au moins 3 points")
    return Forme({"kind": "pts", "pts": pts, "closed": bool(fermee)}, calque)


def arc(cx, cy, rayon, debut, fin, calque=None):
    """Arc ouvert de centre (cx, cy), de l'angle debut à l'angle fin (degrés, sens trigo)."""
    a0, a1 = _num(debut, "debut"), _num(fin, "fin")
    if a1 == a0:
        raise CopoErreur("arc : les angles de début et de fin sont égaux")
    return Forme({"kind": "arc", "cx": _num(cx, "cx"), "cy": _num(cy, "cy"),
                  "r": _pos(rayon, "rayon"), "a0": a0, "a1": a1}, calque)


# ---------------------------------------------------------------- outils

class Outil:
    """Description d'un outil ; COPO reprend celui de la bibliothèque du projet s'il existe
    (même type, même diamètre, même angle), sinon il l'ajoute."""

    def __init__(self, type_, dia, angle=None, **reglages):
        self.d = {"type": type_, "dia": _pos(dia, "diamètre")}
        if angle is not None:
            self.d["angle"] = _pos(angle, "angle")
        noms = {"vitesse": "rpm", "avance": "feed", "plongee": "plunge", "passe": "pass",
                "recouvrement": "over", "dents": "flutes", "nom": "name", "numero": "num"}
        for k, v in reglages.items():
            if k not in noms:
                raise CopoErreur("réglage d'outil inconnu : %s (%s)" % (k, ", ".join(noms)))
            self.d[noms[k]] = v if k == "nom" else _num(v, k)

    def __repr__(self):
        return "<Outil %s Ø%g>" % (self.d["type"], self.d["dia"])


def fraise(diametre, **reglages):
    """Fraise droite. Réglages possibles : vitesse (tr/min), avance, plongee (mm/min),
    passe (mm), recouvrement (%), dents, nom, numero."""
    return Outil("flat", diametre, **reglages)


def fraise_v(angle, diametre, **reglages):
    """Fraise en V : angle au sommet (degrés) et diamètre utile."""
    return Outil("v", diametre, angle=angle, **reglages)


def fraise_boule(diametre, **reglages):
    """Fraise hémisphérique."""
    return Outil("ball", diametre, **reglages)


def foret(diametre, angle=118, **reglages):
    """Foret de perçage."""
    return Outil("drill", diametre, angle=angle, **reglages)


# ---------------------------------------------------------------- usinages

def _formes(f):
    if isinstance(f, Forme):
        return [f.id]
    try:
        L = list(f)
    except TypeError:
        raise CopoErreur("forme ou liste de formes attendue, reçu %r" % (f,))
    ids = []
    for x in L:
        ids.extend(_formes(x))
    if not ids:
        raise CopoErreur("aucune forme à usiner")
    return ids


def _outil(o):
    if not isinstance(o, Outil):
        raise CopoErreur("outil attendu (fraise(6), fraise_v(90, 12), foret(8)…), reçu %r" % (o,))
    return dict(o.d)


def _ajout(type_, formes, outil, nom, p, options):
    for k, v in options.items():
        p[k] = v.d if isinstance(v, Outil) else v
    t = {"type": type_, "shapes": _formes(formes), "tool": _outil(outil), "p": p}
    if nom:
        t["name"] = str(nom)
    _E.parcours.append(t)


_COTES = {"exterieur": "out", "extérieur": "out", "interieur": "in", "intérieur": "in",
          "ligne": "on", "sur la ligne": "on", "out": "out", "in": "in", "on": "on"}
_ENTREES = {"plongee": "plunge", "plongée": "plunge", "rampe": "rampzz", "rampe continue": "ramp",
            "arc": "arc", "arc en rampe": "arcramp", "helice": "helix", "hélice": "helix"}


def profil(formes, outil, profondeur, cote="exterieur", ponts=0, passe=None, entree=None,
           nom=None, **options):
    """Contournage. cote : exterieur, interieur ou ligne ; ponts : nombre de ponts d'attache
    (0 = aucun) ; passe : profondeur par passe (par défaut celle de l'outil) ;
    entree : plongee, rampe, rampe continue, arc, arc en rampe, helice."""
    s = _COTES.get(str(cote).lower())
    if s is None:
        raise CopoErreur("cote : exterieur, interieur ou ligne (reçu %r)" % (cote,))
    p = {"side": s, "depth": _pos(profondeur, "profondeur")}
    n = int(ponts or 0)
    if n > 0:
        p.update(tabs=True, tabN=n)
    if passe is not None:
        p["pass"] = _pos(passe, "passe")
    if entree is not None:
        e = _ENTREES.get(str(entree).lower(), str(entree))
        if e not in _ENTREES.values():
            raise CopoErreur("entree : plongee, rampe, rampe continue, arc, arc en rampe ou helice")
        p["entry"] = e
    _ajout("profile", formes, outil, nom, p, options)


_STRATEGIES = {"anneaux": "rings", "anneaux vers l'interieur": "ringsIn", "balayage": "raster",
               "zigzag": "zigzag", "rings": "rings", "ringsIn": "ringsIn", "raster": "raster"}


def poche(formes, outil, profondeur, strategie="anneaux", angle=0, passe=None, nom=None, **options):
    """Évidement des formes fermées. strategie : anneaux, balayage ou zigzag ;
    angle : direction du balayage (degrés)."""
    st = _STRATEGIES.get(str(strategie))
    if st is None:
        raise CopoErreur("strategie : anneaux, balayage ou zigzag (reçu %r)" % (strategie,))
    p = {"depth": _pos(profondeur, "profondeur"), "strategy": st, "rasterAng": _num(angle, "angle")}
    if passe is not None:
        p["pass"] = _pos(passe, "passe")
    _ajout("pocket", formes, outil, nom, p, options)


def percage(formes, outil, profondeur, debourrage=0, temporisation=0, nom=None, **options):
    """Perçage au centre des formes. debourrage : remontée tous les n mm (0 = d'un trait) ;
    temporisation : pause au fond, en secondes."""
    p = {"depth": _pos(profondeur, "profondeur"), "peck": max(0.0, _num(debourrage, "debourrage")),
         "dwell": max(0.0, _num(temporisation, "temporisation"))}
    _ajout("drill", formes, outil, nom, p, options)


def vcarve(formes, outil, profondeur_max=0, degagement=None, nom=None, **options):
    """Gravure en V par l'axe médian. profondeur_max : 0 = sans limite ;
    degagement : fraise droite qui vide les fonds plats (si profondeur_max est atteinte)."""
    p = {"depth": max(0.0, _num(profondeur_max, "profondeur_max"))}
    if degagement is not None:
        p["clrTool"] = _outil(degagement)
    _ajout("vcarve", formes, outil, nom, p, options)


# ---------------------------------------------------------------- alias anglais

project, stock, layer = projet, brut, calque
circle, polygon, star, polyline = cercle, polygone, etoile, polyligne
end_mill, v_bit, ball_mill, drill_bit = fraise, fraise_v, fraise_boule, foret
profile, pocket, drill = profil, poche, percage


# ---------------------------------------------------------------- lecture par COPO

def _resultat():
    if _erreurs():
        raise CopoErreur("\n".join(_erreurs()))
    if _E.brut is None:
        raise CopoErreur("le script doit définir le brut : brut(largeur, hauteur, epaisseur)")
    if not _E.formes:
        raise CopoErreur("le script ne dessine aucune forme")
    return _json.dumps({
        "name": _E.nom, "material": _E.materiau_nom, "stock": _E.brut,
        "layers": _E.calques, "shapes": _E.formes, "tps": _E.parcours,
    })
