"""Régénère lib/copo-py.js à partir de lib/copo.py — à lancer après chaque modification de copo.py :

    python lib/genere-copo-py-js.py

Pourquoi : quand index.html est ouvert directement depuis le disque (file://), le navigateur interdit
de lire lib/copo.py par programme, mais accepte une balise <script>. lib/copo-py.js contient donc
le même module, dans une chaîne JavaScript. COPO lit copo.py en http(s) et cette copie en file://.
"""
import hashlib
import json
import pathlib

ici = pathlib.Path(__file__).resolve().parent
src = (ici / "copo.py").read_text(encoding="utf-8")
empreinte = hashlib.sha256(src.encode("utf-8")).hexdigest()[:16]
js = ("// Généré par lib/genere-copo-py-js.py à partir de lib/copo.py — ne pas modifier à la main.\n"
      "window.COPO_PY_SRC = " + json.dumps(src, ensure_ascii=False) + ";\n"
      "window.COPO_PY_SHA = " + json.dumps(empreinte) + ";\n")
(ici / "copo-py.js").write_text(js, encoding="utf-8", newline="\n")
print("lib/copo-py.js régénéré (empreinte %s)" % empreinte)
