"""
BioSalud ECOMARCAL — pasar los términos de uso a la app

TERMINOS.md es el documento institucional: lo revisa el equipo del IFAB y se
acuerda con la administración del sello. La app tiene que mostrar EXACTAMENTE ese
texto, así que no se copia a mano: se convierte.

    python tools/generar-terminos.py

Sale docs/datos/terminos.json, que la app lee como lee las fichas. Si mañana se
corrige una frase en TERMINOS.md, se vuelve a correr esto y la app dice lo mismo.
Un texto que alguien acepta no puede tener dos versiones distintas circulando.

LA VERSIÓN LLEVA UNA HUELLA DEL TEXTO

La versión que se guarda con cada aceptación no es solo la etiqueta ("agosto de
2026"): lleva pegados los primeros caracteres de un hash del contenido. Así,
mirando la planilla de accesos se puede saber si una persona aceptó el texto que
está vigente hoy o uno anterior, aunque la etiqueta no haya cambiado.
"""

import hashlib
import json
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "TERMINOS.md"
SALIDA = RAIZ / "docs" / "datos" / "terminos.json"


def en_texto(linea):
    """Markdown a texto plano, conservando solo las negritas.

    Las negritas se dejan con sus asteriscos y la app las convierte DESPUÉS de
    escapar el texto, así que del origen no puede colarse HTML. Los enlaces
    pasan a "texto (dirección)": en un celular, sin señal, un enlace que no se
    puede abrir igual tiene que poder leerse y copiarse.
    """
    def enlace(m):
        texto, url = m.group(1), m.group(2)
        # Un enlace a otro documento del repositorio no le dice nada a quien lee
        # desde el celular, y repetirlo queda como "DERECHOS.md (DERECHOS.md)".
        return texto if texto == url or not url.startswith("http") else f"{texto} ({url})"

    t = linea.strip()
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", enlace, t)       # [texto](url)
    t = re.sub(r"<(https?://[^>]+)>", r"\1", t)             # <url>
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", t)       # *cursiva* → llana
    t = t.replace("`", "")
    return t.strip()


def convertir(md):
    lineas = md.split("\n")
    titulo = ""
    etiqueta = ""
    nota = []
    secciones = []
    actual = {"titulo": "", "bloques": []}
    parrafo = []
    lista = None

    def cerrar_parrafo():
        nonlocal parrafo
        if parrafo:
            actual["bloques"].append({"tipo": "parrafo", "texto": " ".join(parrafo)})
            parrafo = []

    def cerrar_lista():
        nonlocal lista
        if lista:
            actual["bloques"].append(lista)
            lista = None

    for linea in lineas:
        cruda = linea.rstrip()
        t = cruda.strip()

        if t.startswith("# "):
            titulo = en_texto(t[2:])
            continue

        if t.startswith("## "):
            cerrar_parrafo()
            cerrar_lista()
            if actual["bloques"] or actual["titulo"]:
                secciones.append(actual)
            actual = {"titulo": en_texto(t[3:]), "bloques": []}
            continue

        if t.startswith(">"):
            cerrar_parrafo()
            cerrar_lista()
            texto = en_texto(t.lstrip(">").strip())
            if texto:
                nota.append(texto)
            continue

        # La línea en cursiva que va debajo del título lleva la etiqueta de versión.
        if not etiqueta and t.startswith("*") and t.endswith("*") and not t.startswith("**"):
            etiqueta = en_texto(t)
            continue

        if not t:
            cerrar_parrafo()
            cerrar_lista()
            continue

        viñeta = re.match(r"^[-*]\s+(.*)$", t)
        numerada = re.match(r"^\d+\.\s+(.*)$", t)

        if viñeta or numerada:
            cerrar_parrafo()
            tipo = "lista" if viñeta else "numerada"
            if not lista or lista["tipo"] != tipo:
                cerrar_lista()
                lista = {"tipo": tipo, "items": []}
            lista["items"].append(en_texto((viñeta or numerada).group(1)))
            continue

        # Una línea indentada que sigue a una viñeta es continuación de ese ítem.
        if lista and cruda.startswith("  "):
            lista["items"][-1] += " " + en_texto(t)
            continue

        cerrar_lista()
        parrafo.append(en_texto(t))

    cerrar_parrafo()
    cerrar_lista()
    if actual["bloques"] or actual["titulo"]:
        secciones.append(actual)

    return titulo, etiqueta, nota, secciones


def main():
    md = ORIGEN.read_text(encoding="utf-8")
    titulo, etiqueta, nota, secciones = convertir(md)

    # La huella sale de LO QUE LA APP MUESTRA —la etiqueta y las secciones—, y no
    # del archivo entero. Si saliera del archivo, corregir la nota interna, que
    # el productor ni siquiera ve, le avisaría a todos que "los términos
    # cambiaron". Una alerta falsa gasta la alerta.
    mostrado = json.dumps([etiqueta, secciones], ensure_ascii=False, sort_keys=True)
    huella = hashlib.sha256(" ".join(mostrado.split()).encode("utf-8")).hexdigest()[:8]

    # De "Versión de prueba (beta) · … · agosto de 2026" queda "agosto de 2026".
    corta = etiqueta.split("·")[-1].strip() if etiqueta else "sin fecha"

    # La cita del principio de TERMINOS.md es una nota para quien revisa el
    # documento, no para quien lo acepta: habla de la app en tercera persona y
    # menciona archivos del repositorio. Viaja igual, para no perder el rastro,
    # pero la app no la muestra: muestra la etiqueta de versión, que sí dice lo
    # único que el productor necesita saber, que es una versión de prueba.
    datos = {
        "version": f"{corta} · {huella}",
        "etiqueta": etiqueta,
        "titulo": titulo,
        "nota_interna": " ".join(nota),
        "secciones": secciones,
        "origen": "TERMINOS.md",
    }

    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    bloques = sum(len(s["bloques"]) for s in secciones)
    print(f"{SALIDA.relative_to(RAIZ)}")
    print(f"version  {datos['version']}")
    print(f"{len(secciones)} secciones · {bloques} bloques")


if __name__ == "__main__":
    main()
