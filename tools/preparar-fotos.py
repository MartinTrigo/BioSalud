"""
BioSalud ECOMARCAL — preparar las fotos de la wiki

Toma las fotos originales, que pesan varios megas cada una, y las convierte a
lo que necesita la app: 900 píxeles de ancho, WebP, calidad 78. Una foto de
plaga queda en unos 43 KB, así que la biblioteca entera puede viajar en el
teléfono y funcionar sin señal.

CÓMO SE USA

    1. Dejar las fotos originales en  fotos-originales/
       El nombre del archivo decide dónde va: tiene que empezar con el id de
       la ficha, como aparece en docs/datos/*.json.

           polilla-col-1.jpg        → ficha "polilla-col"
           polilla-col-dano.jpg     → ficha "polilla-col"
           mm-solido-hojarasca.jpg  → ficha "mm-solido"

    2. Ejecutar:   python tools/preparar-fotos.py

    3. Las convertidas quedan en docs/img/fichas/ y el script imprime el
       fragmento JSON para pegar en la ficha correspondiente.

    4. Subir el número de CACHE en docs/sw.js y agregar las fotos a su lista.

Los originales NO se publican: fotos-originales/ está en el .gitignore, porque
pesan y porque en el repositorio solo hace falta la versión liviana.
"""

import pathlib
import sys
from PIL import Image, ImageOps

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGINALES = RAIZ / "fotos-originales"
DESTINO = RAIZ / "docs" / "img" / "fichas"

ANCHO = 900          # el ancho justo para pantalla completa en un celular
CALIDAD = 78         # WebP: por encima de esto se nota poco y pesa bastante más
TECHO_MB = 8         # si la biblioteca lo supera, hay que repensar la estrategia

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}


def convertir(origen, destino):
    with Image.open(origen) as im:
        # Las fotos de celular traen la orientación en los metadatos: sin esto
        # algunas quedan acostadas.
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")

        if im.width > ANCHO:
            alto = round(im.height * ANCHO / im.width)
            im = im.resize((ANCHO, alto), Image.LANCZOS)

        # save() sin exif: no viajan la marca del teléfono ni las coordenadas
        # de dónde se sacó la foto.
        im.save(destino, format="WEBP", quality=CALIDAD, method=6)
        return im.size


def main():
    if not ORIGINALES.exists():
        ORIGINALES.mkdir(parents=True)
        print(f"Se creó {ORIGINALES.relative_to(RAIZ)}.")
        print("Dejá ahí las fotos originales y volvé a ejecutar.")
        return

    DESTINO.mkdir(parents=True, exist_ok=True)

    fotos = sorted(p for p in ORIGINALES.iterdir()
                   if p.is_file() and p.suffix.lower() in EXTENSIONES)

    if not fotos:
        print(f"No hay fotos en {ORIGINALES.relative_to(RAIZ)}.")
        return

    por_ficha = {}
    total = 0

    print(f"{'archivo':<38} {'medidas':>12} {'peso':>9}")
    print("-" * 62)

    for foto in fotos:
        salida = DESTINO / (foto.stem.lower().replace(" ", "-") + ".webp")
        try:
            ancho, alto = convertir(foto, salida)
        except Exception as err:
            print(f"{foto.name:<38}  FALLÓ: {err}")
            continue

        peso = salida.stat().st_size
        total += peso
        print(f"{salida.name:<38} {ancho:>5}×{alto:<6} {peso/1024:>6.0f} KB")

        # El id de la ficha es lo que va antes del último guion.
        ficha = salida.stem.rsplit("-", 1)[0]
        por_ficha.setdefault(ficha, []).append(salida.name)

    print("-" * 62)
    print(f"{len(fotos)} fotos · {total/1024/1024:.2f} MB en total\n")

    if total / 1024 / 1024 > TECHO_MB:
        print(f"ATENCIÓN: se pasó del techo de {TECHO_MB} MB.")
        print("Conviene revisar si todas las fotos tienen que viajar con la app,")
        print("o si las de los biopreparados pueden pasar a cargarse bajo demanda.\n")

    print("Para pegar en docs/datos/*.json, dentro de cada ficha:\n")
    for ficha, archivos in sorted(por_ficha.items()):
        print(f'  "{ficha}" →')
        print('    "fotos": [')
        for a in archivos:
            print(f'      {{ "archivo": "{a}", "pie": "", "credito": "" }},')
        print('    ],\n')

    print("Completá 'pie' con qué se ve, y 'credito' con quién la sacó.")
    print("Después: agregar los archivos a la lista de docs/sw.js y subir el CACHE.")


if __name__ == "__main__":
    sys.exit(main())
