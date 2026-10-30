"""
BioSalud ECOMARCAL — generar la cartilla de biopreparados

Arma un documento imprimible con todas las recetas, a partir de los MISMOS archivos
que usa la app. Eso es lo importante: la cartilla no es una copia que haya que
mantener aparte. Se corrige la ficha en docs/datos/biopreparados.json, se vuelve
a correr esto, y el papel y el celular vuelven a decir lo mismo.

Sale en dos formatos, los dos dentro de docs/ para que se puedan descargar desde
la app publicada:

    docs/cartilla-biopreparados.html   se abre en cualquier navegador
    docs/cartilla-biopreparados.pdf    para imprimir y repartir

CÓMO SE USA

    python tools/generar-cartilla.py

El PDF lo genera Chrome en segundo plano. Si no estuviera instalado, queda el
HTML igual, que se imprime a PDF desde el navegador con Ctrl+P.
"""

import base64
import datetime
import html
import json
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DATOS = RAIZ / "docs" / "datos"
SALIDA_HTML = RAIZ / "docs" / "cartilla-biopreparados.html"
SALIDA_PDF = RAIZ / "docs" / "cartilla-biopreparados.pdf"

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def e(t):
    return html.escape(str(t if t is not None else ""))


def imagen(ruta):
    """Las imágenes van dentro del archivo, para que el HTML viaje solo."""
    p = RAIZ / "docs" / "img" / ruta
    if not p.exists():
        return ""
    tipo = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{tipo};base64," + base64.b64encode(p.read_bytes()).decode()


def lista(items, clase=""):
    if not items:
        return ""
    return f'<ul class="{clase}">' + "".join(f"<li>{e(i)}</li>" for i in items) + "</ul>"


def pasos(items):
    if not items:
        return ""
    return "<ol>" + "".join(f"<li>{e(i)}</li>" for i in items) + "</ol>"


def ficha_html(f, categorias, fuentes, plagas):
    cat = next((c for c in categorias if c["id"] == f["categoria"]), {})

    rapidos = []
    for etiqueta, clave in (("Rinde", "rinde"), ("Tiempo", "tiempo"), ("Carencia", "carencia")):
        if f.get(clave):
            rapidos.append(f"<div><dt>{etiqueta}</dt><dd>{e(f[clave])}</dd></div>")

    dosis = ""
    if f.get("dosis"):
        filas = "".join(
            f"<tr><th>{e(d['cuando'])}</th><td>{e(d['cuanto'])}</td></tr>" for d in f["dosis"])
        dosis = f'<h3>Cómo se aplica</h3><table class="dosis">{filas}</table>'

    materiales = ""
    if f.get("materiales"):
        m = f["materiales"]
        grupos = "".join(
            f'<h4>{e(g["nombre"])} · {e(g.get("proporcion", ""))}</h4>'
            + (f'<p class="dato">{e(g["para_que"])}</p>' if g.get("para_que") else "")
            + lista(g.get("opciones"))
            for g in m.get("grupos", []))
        materiales = (
            "<h3>Con qué se arma</h3>"
            + (f'<p>{e(m["intro"])}</p>' if m.get("intro") else "")
            + f'<div class="materiales">{grupos}</div>'
            + (f'<p class="dato">{e(m["nota"])}</p>' if m.get("nota") else ""))

    # Contra qué se usa, calculado desde las fichas de plagas.
    contra = [p["nombre"] for p in plagas.get("fichas", [])
              if f["id"] in (p.get("tratamientos") or [])]

    cita = " ".join(fuentes.get(i, i) for i in f.get("fuente", []))

    return f"""
    <article class="ficha">
      <header class="ficha__cab">
        <span class="ficha__cat">{e(cat.get('icono',''))} {e(cat.get('nombre',''))}</span>
        <h2>{e(f['nombre'])}{' <span class="sello">Comarca</span>' if f.get('comarca') else ''}</h2>
        <p class="ficha__resumen">{e(f['resumen'])}</p>
        {f'<dl class="rapidos">{"".join(rapidos)}</dl>' if rapidos else ''}
      </header>

      {f'<div class="alerta"><strong>Dato a verificar.</strong> {e(f["revisar"])}</div>' if f.get('revisar') else ''}

      <div class="dos-columnas">
        <section>
          <h3>Qué lleva</h3>
          {lista(f.get('ingredientes'))}
        </section>
        <section>
          <h3>Cómo se prepara</h3>
          {pasos(f.get('preparacion'))}
        </section>
      </div>

      {materiales}
      {f'<h3>Para qué sirve</h3><p>{e(f["uso"])}</p>' if f.get('uso') else ''}
      {dosis}
      {f'<p class="dato"><strong>Cuánto dura:</strong> {e(f["conservacion"])}</p>' if f.get('conservacion') else ''}
      {f'<p class="dato"><strong>Se usa contra:</strong> {e(", ".join(contra))}</p>' if contra else ''}

      {f'<div class="cuidados"><h3>Cuidados y riesgos</h3>{lista(f.get("cuidados"))}</div>' if f.get('cuidados') else ''}

      <p class="fuente">{e(cita)}</p>
    </article>"""


def main():
    bio = json.loads((DATOS / "biopreparados.json").read_text(encoding="utf-8"))
    plagas = json.loads((DATOS / "plagas.json").read_text(encoding="utf-8"))
    veda = json.loads((DATOS / "no-permitidos.json").read_text(encoding="utf-8"))

    hoy = datetime.date.today()
    fecha = f"{hoy.day} de {MESES[hoy.month - 1]} de {hoy.year}"

    categorias = bio["categorias"]
    fuentes = bio["fuentes"]
    fichas = bio["fichas"]

    # Índice y cuerpo, agrupados por función.
    indice, cuerpo = [], []
    for c in categorias:
        de_la_cat = [f for f in fichas if f["categoria"] == c["id"]]
        if not de_la_cat:
            continue
        indice.append(
            f'<li class="idx-cat"><strong>{e(c["icono"])} {e(c["nombre"])}</strong>'
            f'<span>{e(c["descripcion"])}</span>'
            + "".join(f'<span class="idx-item">{e(f["nombre"])}'
                      + (' <em>Comarca</em>' if f.get("comarca") else "") + "</span>"
                      for f in de_la_cat)
            + "</li>")
        cuerpo.append(f'<h1 class="seccion">{e(c["icono"])} {e(c["nombre"])}</h1>')
        cuerpo += [ficha_html(f, categorias, fuentes, plagas) for f in de_la_cat]

    # Lo que el sello no admite. En papel va entero y desplegado: no hay dónde
    # tocar para abrir, y es la parte que conviene leer antes de ir a buscar un
    # insumo prestado.
    #
    # Los iconos quedan afuera del papel: en la app ayudan a encontrar el que se
    # busca, pero acá no hacen falta y cada emoji nuevo obliga a Chrome a
    # embeber más fuente de color. Los seis de esta sección engordaban el PDF
    # 400 KB, en un documento que el productor baja con la señal que tenga.
    veda_html = ""
    for g in veda.get("grupos", []):
        veda_html += (
            f'<div class="veda"><h3>{e(g["titulo"])}</h3>'
            f'<p class="veda__que">{e(g["que_es"])}</p>'
            f'<p><strong>Por qué.</strong> {e(g["porque"])}</p>'
            + (f'<p class="veda__abierto"><strong>Todavía en discusión.</strong> '
               f'{e(g["abierto"])}</p>' if g.get("abierto") else "")
            + f'<p class="veda__lugar"><strong>En su lugar.</strong> '
              f'{e(g["en_su_lugar"])}</p></div>'
        )
    for c in veda.get("condicionales", []):
        veda_html += (
            f'<div class="veda veda--condicional"><h3>{e(c["titulo"])}</h3>'
            f'<p>{e(c["regla"])}</p>'
            f'<p class="veda__que">{e(c["porque"])}</p></div>'
        )
    if veda.get("cierre"):
        veda_html += (f'<div class="aviso-general"><h3>{e(veda["cierre"]["titulo"])}</h3>'
                      f'<p>{e(veda["cierre"]["texto"])}</p></div>')

    # Tabla de qué usar contra qué, derivada de las fichas de plagas.
    filas_plagas = ""
    for p in plagas.get("fichas", []):
        trat = [next((f["nombre"] for f in fichas if f["id"] == t), t)
                for t in (p.get("tratamientos") or [])]
        if trat:
            filas_plagas += (f"<tr><th>{e(p['nombre'])}<br><em>{e(p['cientifico'])}</em></th>"
                             f"<td>{e(', '.join(trat))}</td></tr>")

    css = """
    @page { size: A4; margin: 18mm 16mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt;
           line-height: 1.45; color: #1b2620; margin: 0; }
    h1, h2, h3, .sello, .idx-cat, .rapidos, .dosis th, th {
           font-family: Helvetica, Arial, sans-serif; }

    .portada { text-align: center; padding-top: 45mm; page-break-after: always; }
    .portada img { height: 22mm; margin: 0 6mm; vertical-align: middle; }
    .portada h1 { font-size: 30pt; color: #16632f; margin: 14mm 0 2mm; line-height: 1.1; }
    .portada .bajada { font-size: 13pt; color: #5b6b62; margin: 0 0 18mm; }
    .portada .inst { font-size: 11pt; line-height: 1.7; }
    .portada .autoria { font-size: 11pt; line-height: 1.6; margin-top: 12mm; }
    .portada .pie { margin-top: 22mm; font-size: 9pt; color: #5b6b62; }

    .intro { page-break-after: always; }
    h1.seccion { font-size: 17pt; color: #16632f; border-bottom: 2.5pt solid #16632f;
                 padding-bottom: 2mm; margin: 0 0 5mm; page-break-before: always; }
    .intro h1 { font-size: 19pt; color: #16632f; margin: 0 0 4mm; }

    .ficha { page-break-inside: avoid; margin-bottom: 9mm;
             border-bottom: 0.5pt solid #d3ddd6; padding-bottom: 6mm; }
    .ficha__cat { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .6pt; color: #5b6b62; }
    .ficha h2 { font-size: 15pt; color: #16632f; margin: 1mm 0 2mm; }
    .ficha__resumen { margin: 0 0 3mm; font-style: italic; color: #3c4a42; }

    .sello { font-size: 7.5pt; font-style: normal; text-transform: uppercase;
             letter-spacing: .5pt; background: #2e8b4a; color: #fff;
             padding: 1pt 5pt; border-radius: 8pt; vertical-align: 2pt; }

    .rapidos { display: flex; flex-wrap: wrap; gap: 1mm 8mm; margin: 0 0 4mm;
               font-size: 9pt; padding: 2mm 3mm; background: #f0f5f1; }
    .rapidos div { display: flex; gap: 2mm; }
    /* Los dos puntos son para que al copiar el texto no quede "Rinde65 kg". */
    .rapidos dt { color: #5b6b62; } .rapidos dt::after { content: ":"; }
    .rapidos dd { margin: 0; font-weight: bold; }

    h3 { font-size: 10.5pt; color: #16632f; margin: 4mm 0 1.5mm;
         text-transform: uppercase; letter-spacing: .4pt; }
    ul, ol { margin: 0; padding-left: 5mm; }
    li { margin-bottom: 1.2mm; }
    p { margin: 0 0 2mm; }

    /* Cada grupo de materiales es una columna: título, para qué y opciones. */
    .materiales h4 { font-size: 9.5pt; margin: 0 0 1mm; color: #3c4a42; }
    .materiales { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-flow: column;
                  grid-template-rows: auto auto auto; gap: 1mm 5mm; font-size: 9pt; }

    .dos-columnas { display: flex; gap: 7mm; }
    .dos-columnas section { flex: 1; }

    table { width: 100%; border-collapse: collapse; margin: 1mm 0 3mm; font-size: 9.5pt; }
    th { text-align: left; vertical-align: top; padding: 1.4mm 3mm 1.4mm 0;
         width: 38%; color: #16632f; border-bottom: 0.5pt solid #e3eae5; }
    td { padding: 1.4mm 0; border-bottom: 0.5pt solid #e3eae5; }

    .dato { font-size: 9.5pt; }
    .cuidados { background: #fdfaf3; border-left: 2.5pt solid #d9a521;
                padding: 2.5mm 4mm; margin: 4mm 0 0; page-break-inside: avoid; }
    .cuidados h3 { margin-top: 0; color: #8a6512; }
    .alerta { background: #fceceb; border-left: 2.5pt solid #b3261e;
              padding: 2.5mm 4mm; margin: 0 0 4mm; font-size: 9.5pt; }
    .fuente { font-size: 8pt; color: #5b6b62; margin-top: 3mm; }

    .idx { list-style: none; padding: 0; }
    .idx-cat { margin-bottom: 5mm; page-break-inside: avoid; }
    .idx-cat > strong { display: block; color: #16632f; font-size: 11.5pt; }
    .idx-cat > span { display: block; font-size: 9pt; color: #5b6b62; margin-bottom: 1.5mm; }
    .idx-item { display: block; font-size: 10pt; padding-left: 5mm; }
    .idx-item em { font-size: 7.5pt; font-style: normal; color: #2e8b4a;
                   text-transform: uppercase; letter-spacing: .4pt; }

    .aviso-general { background: #f0f5f1; border-left: 2.5pt solid #16632f;
                     padding: 3mm 4mm; margin: 4mm 0; }
    .cierre { page-break-before: always; }

    .veda { border-left: 2.5pt solid #b3261e; padding: 2mm 4mm; margin: 0 0 4mm;
            page-break-inside: avoid; }
    .veda h3 { margin: 0 0 1mm; }
    .veda__que { color: #5b6b62; margin: 0 0 2mm; }
    .veda__lugar { background: #f0f5f1; padding: 2mm 3mm; margin: 2mm 0 0; }
    .veda__abierto { background: #fdf4e3; padding: 2mm 3mm; margin: 2mm 0 0; }
    .veda--condicional { border-left-color: #d9a521; }
    """

    doc = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Biopreparados para la Comarca Andina — BioSalud ECOMARCAL</title>
<style>{css}</style></head><body>

<div class="portada">
  <div>
    <img src="{imagen('logo-ifab.png')}" alt="IFAB CONICET INTA">
    <img src="{imagen('logo-ecomarcal.jpg')}" alt="ECOMARCAL">
  </div>
  <h1>Biopreparados para la<br>Comarca Andina</h1>
  <p class="bajada">Elaboración, uso y dosis · {len(fichas)} recetas</p>
  <p class="inst">
    <strong>IFAB</strong> — Instituto de Investigaciones Forestales y Agropecuarias Bariloche<br>
    CONICET / INTA · Agencia de Extensión Rural El Bolsón<br>
    Sello agroecológico <strong>ECOMARCAL</strong>
  </p>
  <p class="autoria">
    <strong>Martín Emiliano Trigo</strong><br>
    IFAB (CONICET-INTA AER Sede El Bolsón)<br>
    con el equipo de extensión del IFAB
  </p>
  <p class="pie">
    Recopilado y redactado a partir de la bibliografía citada en cada ficha.<br>
    Versión {e(bio.get('version',''))} · Generado el {fecha}<br>
    Este documento se genera desde la app BioSalud: martintrigo.github.io/BioSalud
  </p>
</div>

<div class="intro">
  <h1>Cómo usar esta cartilla</h1>
  <p>Las recetas están ordenadas <strong>por función</strong>: qué se busca lograr,
  antes que con qué. Cada ficha dice qué lleva, cómo se prepara, para qué sirve,
  en qué dosis se aplica, cuánto dura y qué cuidados exige.</p>

  <p>Las marcadas como <span class="sello">Comarca</span> se vienen elaborando y
  probando acá, en talleres de la AER INTA El Bolsón. Las demás vienen de otras
  regiones y todavía hay que ajustarlas a nuestras condiciones.</p>

  <p><strong>Ninguna ficha es copia de su fuente.</strong> Todas están reescritas
  por el equipo del IFAB, y cada una indica de dónde sale para que se pueda ir al
  documento original.</p>

  <div class="aviso-general">
    <h3>{e(bio['recomendaciones']['titulo'])}</h3>
    {lista(bio['recomendaciones']['puntos'])}
  </div>

  <h1>Índice por función</h1>
  <ul class="idx">{''.join(indice)}</ul>
</div>

{''.join(cuerpo)}

<div class="cierre">
  <h1 class="seccion">{e(veda['titulo'])}</h1>
  <p>{e(veda['bajada'])} {e(veda['intro'])}</p>
  <p class="fuente">{e(veda['estado'])}</p>
  {veda_html}

  <h1 class="seccion">Qué usar contra qué</h1>
  <p>Resumen orientativo, armado a partir de las fichas de plagas de la app.
  <strong>No reemplaza el monitoreo</strong>: antes de aplicar hay que confirmar
  que la plaga esté presente y que supere el umbral de la ficha correspondiente.</p>
  <table>{filas_plagas}</table>

  <h1 class="seccion">Bibliografía</h1>
  {lista(list(fuentes.values()))}

  <h3>Lo que falta</h3>
  {lista(bio.get('pendiente'))}

  <p class="fuente">IFAB (CONICET / INTA El Bolsón) · Comarca Andina del Paralelo 42 ·
  {fecha}. Las condiciones de uso y las limitaciones de las recomendaciones están
  en los términos de la app.</p>
</div>

</body></html>"""

    SALIDA_HTML.write_text(doc, encoding="utf-8")
    print(f"HTML  {SALIDA_HTML.relative_to(RAIZ)}  ({SALIDA_HTML.stat().st_size/1024:.0f} KB)")

    navegador = next((c for c in CHROMES if pathlib.Path(c).exists()), None)
    if not navegador:
        print("No se encontró Chrome ni Edge. El HTML se puede imprimir a PDF con Ctrl+P.")
        return

    subprocess.run([
        navegador, "--headless", "--disable-gpu", "--no-pdf-header-footer",
        f"--print-to-pdf={SALIDA_PDF}", SALIDA_HTML.as_uri(),
    ], check=True, timeout=180,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print(f"PDF   {SALIDA_PDF.relative_to(RAIZ)}  ({SALIDA_PDF.stat().st_size/1024:.0f} KB)")
    print(f"\n{len(fichas)} recetas · {len(plagas.get('fichas', []))} plagas en la tabla final")


if __name__ == "__main__":
    sys.exit(main())
