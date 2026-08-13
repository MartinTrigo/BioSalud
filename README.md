# BioSalud ECOMARCAL

App de **salud del suelo y de los cultivos** para los productores del sello
agroecológico **ECOMARCAL**, en la Comarca Andina del Paralelo 42.

Desarrollada desde el **IFAB (CONICET / INTA El Bolsón)**, Agencia de Extensión
Rural El Bolsón, en el marco del enfoque **Una Salud**: suelo sano, planta sana,
gente sana.

El productor carga su plan de aplicaciones de bioinsumos y biopreparados, sigue
el checklist de lo que fue aplicando, y registra lo que observa cuando camina el
campo. Todo funciona **sin señal** y se sincroniza con la planilla de su chacra
cuando hay conexión.

**La app está publicada en <https://martintrigo.github.io/BioSalud/>**

> El plan de trabajo completo, con las fases y las decisiones de diseño, está en
> [PLAN.md](PLAN.md).

## Cómo instalarla en el celular

1. Abrir <https://martintrigo.github.io/BioSalud/> en el navegador del teléfono.
2. En el menú del navegador (los tres puntos), tocar **"Instalar aplicación"** o
   **"Agregar a pantalla de inicio"**.
3. Queda un ícono como cualquier otra app, y desde ahí abre a pantalla completa
   y funciona sin señal.

No hace falta cuenta ni contraseña: cada teléfono guarda sus propios datos.

## Estado

| Fase | Qué incluye | Estado |
|---|---|---|
| **1 · Base** | Armazón, identidad institucional, funcionamiento sin señal, Configuración del establecimiento | ✅ **hecha** |
| 2 · Catálogo y Plan | Lista de bioinsumos y biopreparados + Registrar Plan de Salud | pendiente |
| 3 · Seguimiento | Agenda Hoy / Semana / Atrasado + checklist de aplicaciones | pendiente |
| 4 · Sincronización | Apps Script multi-chacra y planillas por chacra | pendiente |
| 5 · Monitoreo | Registro a campo + sugerencia de tratamiento + aviso al técnico | pendiente |
| 6 · Wiki | Fichas de bioinsumos y de plagas regionales | pendiente |
| 7 · Avisos | Correo automático de aplicaciones pendientes | pendiente |
| 8 · Piloto | Prueba con 2 chacras y despliegue a las 10 | pendiente |

Lo que ya funciona: la app abre y se usa completa sin conexión, guarda en el
teléfono, bloquea el menú hasta que la configuración esté completa, y deja la
configuración en cola para subirla a la planilla apenas exista el servicio de la
fase 4.

## Cómo verla mientras se desarrolla

Para probar cambios antes de publicarlos, se levanta un servidor local:

```bash
python -m http.server 8123 --directory docs
```

Ese comando queda corriendo y no muestra nada por sí solo: hay que **abrir
<http://localhost:8123> en el navegador**. Para cortarlo, Ctrl+C.

## Cómo publicar un cambio

```bash
git add -A && git commit -m "qué se cambió" && git push
```

En un minuto está en <https://martintrigo.github.io/BioSalud/>, y los celulares
que ya la tengan instalada se actualizan solos la próxima vez que la abran.

## Cómo se organiza

```
AppBio/
├── PLAN.md              plan de trabajo, fases y decisiones de diseño
├── bibliografía/        material de referencia para la wiki
├── img/                 logos originales, tal como llegaron
└── docs/                LA APP (es lo que se publica)
    ├── index.html
    ├── manifest.webmanifest    para que se instale como app en Android
    ├── sw.js                   guarda la app en el teléfono: es el modo sin señal
    ├── css/estilos.css         colores institucionales y estilos
    ├── img/                    logos e íconos que viajan al celular
    └── js/
        ├── util.js             ayudas cortas
        ├── db.js               base local del teléfono y cola de envío
        ├── config.js           sección Configuración
        └── app.js              menú, navegación y bloqueo de secciones
```

La app se publica sirviendo la carpeta `docs/`. Es la misma forma en que está
publicado MonAgric, así que el circuito ya está probado: se sube el repositorio
a GitHub, se activa GitHub Pages apuntando a `docs/` de la rama principal, y
cada `git push` actualiza la app en el celular de todos.

## Al tocar el código

**Si cambiás cualquier archivo de `docs/`, subí el número de `CACHE` en
`sw.js`.** Si no, los celulares que ya tengan la app instalada siguen usando la
versión vieja, porque la guardaron entera para poder funcionar sin señal.

Los colores institucionales están todos declarados al principio de
`css/estilos.css` y salen muestreados de los propios logos: cambiando esos
valores se actualiza toda la app.

## Todavía falta

- El **sello ECOMARCAL y el logo de IFAB en mayor resolución**: los archivos
  actuales son chicos y limitan la nitidez del ícono y la cabecera
  (ver [docs/img/LEEME.md](docs/img/LEEME.md)).
- El **pliego ECOMARCAL**: qué productos admite el sello y cuáles no. Es lo que
  define las marcas de compatibilidad de la fase 2.
- El listado de **bioinsumos que promueve el INTA** con sus dosis y frecuencias.
