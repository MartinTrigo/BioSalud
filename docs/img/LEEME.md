# Imágenes de la app

Los archivos de esta carpeta son los que **viajan al celular** del productor.
Los originales quedan en `AppBio/img/`; acá van con el nombre que espera la app.

## Logos de la cabecera

| Archivo | Estado | Origen |
|---|---|---|
| `logo-ifab.png` | ✅ cargado | `img/IFAB-web.png` |
| `logo-ecomarcal.jpg` | ✅ cargado | `img/ecomarcal logo.jpg` |

En la cabecera van **solo estos dos**. El logo del IFAB ya es un conjunto que
incluye CONICET, INTA y la sigla del instituto, así que poner además los dos
sueltos sería repetirlos y llenar de logos una pantalla de 375 px de ancho.

Los originales de CONICET e INTA por separado siguen en `AppBio/img/` por si
alguna vez hacen falta, pero no viajan al celular.

Los logos se muestran sobre una franja **blanca**, porque están hechos para
leerse sobre fondo claro: el CONICET tiene las letras en negro y el INTA, barras
celestes que sobre verde desaparecerían.

**El archivo del IFAB es chico: 153 × 100 px.** Se muestra a 46 px de alto, que
es lo máximo que tolera sin verse borroso en pantallas de alta densidad. Si
conseguís una versión más grande o vectorial, reemplazalo y se puede agrandar.

Si algún día falta un archivo, la app muestra la sigla en un recuadro de texto
en vez de una imagen rota.

## Íconos de la app

`icono-192.png` y `icono-512.png` son lo que se ve en la pantalla de inicio del
celular cuando el productor instala la app. Están generados a partir del sello
ECOMARCAL.

**Se pueden mejorar.** El archivo original del sello mide 225 × 225 px, así que
al llevarlo a 512 queda algo blando. Si conseguís el sello en mayor resolución o
en vectorial, se regeneran con más definición.

## Colores

La paleta de la app sale de estos mismos logos, muestreada de los archivos:

| Color | Valor | De dónde sale |
|---|---|---|
| Verde | `#16632F` | hojas del sello ECOMARCAL |
| Celeste | `#00BFEF` | barras del logo INTA |
| Azul | `#4C7FBE` | cinta del logo CONICET |
| Dorado | `#D9A521` | sol del logo CONICET |

Están definidos al principio de `css/estilos.css`. Si cambia un logo, se cambian
esos cuatro valores y toda la app se actualiza sola.
