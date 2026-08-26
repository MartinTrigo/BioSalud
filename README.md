# BioSalud ECOMARCAL

App de **salud del suelo y de los cultivos** para los productores del sello
agroecológico **ECOMARCAL**, en la Comarca Andina del Paralelo 42.

Desarrollada desde el **IFAB (CONICET / INTA El Bolsón)**, Agencia de Extensión
Rural El Bolsón, en el marco del enfoque **Una Salud**: suelo sano, planta sana,
gente sana.

El productor carga su plan de aplicaciones de bioinsumos y biopreparados, sigue
el checklist de lo que fue aplicando, y registra lo que observa cuando camina el
campo. Todo funciona **sin señal** y se sincroniza con la planilla de su
establecimiento cuando hay conexión.

**La app está publicada en <https://martintrigo.github.io/BioSalud/>**

Contacto: Martín Trigo, IFAB (CONICET / INTA El Bolsón) —
trigo.martin@inta.gob.ar

---

## Si llegás nuevo a este proyecto

Según para qué vengas, el camino corto:

| Si sos… | Empezá por | Después |
|---|---|---|
| **Del equipo del IFAB o de la agencia** | Abrí la app y andá a *Info / Wiki* | [PLAN.md](PLAN.md), para ver en qué fase está y qué falta |
| **Programador o informático que va a revisar** | La sección de acá abajo, *Cómo funciona*. Después `docs/js/app.js`, que son 223 líneas y es el que manda | [DECISIONES.md](DECISIONES.md) antes de proponer cambios: explica qué se descartó y con qué argumento |
| **Quien tenga que poner el servicio en marcha** | [INSTALACION.md](INSTALACION.md) | [SEGURIDAD.md](SEGURIDAD.md) |
| **Del área legal o de vinculación** | [DERECHOS.md](DERECHOS.md) | [TERMINOS.md](TERMINOS.md) |
| **Un productor** | El enlace de arriba, y listo | — |

---

## Cómo funciona, en resumen

Para quien tenga que evaluarlo técnicamente, todo lo importante en una pantalla.

**Qué es.** Una aplicación web instalable (PWA). No hay app en Play Store: se
abre un enlace y el navegador la instala. Se actualiza sola al publicarla.

**Con qué está hecha.** HTML, CSS y JavaScript **sin frameworks y sin ninguna
dependencia externa**. No hay `npm install`, no hay paso de compilación, no hay
nada que se baje de un CDN. Se sirve la carpeta `docs/` tal cual está y funciona.
Son 1.641 líneas en total.

**Por qué así.** Porque el requisito principal es que funcione **sin señal** en
el campo, y porque tiene que poder mantenerla alguien más dentro de diez años sin
pelearse con versiones de librerías. Está argumentado en
[DECISIONES.md](DECISIONES.md).

**Dónde viven los datos.** En dos lugares: en el teléfono, en IndexedDB, que es
lo que permite cargar sin señal; y en una planilla de Google por cada
establecimiento. Entre medio hay un único Apps Script que enruta cada registro a
la planilla que corresponde. **No hay servidor propio ni base de datos que
mantener**, y ese fue un criterio explícito, no una limitación.

**Cómo se protege.** Cada teléfono canjea una vez un código de invitación y
recibe una credencial; el servicio guarda solo su huella SHA-256. Sin credencial
no se lee ni se escribe nada. Ver [SEGURIDAD.md](SEGURIDAD.md).

**Está todo en castellano**, incluidos los nombres de las funciones y las
variables, y los comentarios explican el *porqué* y no el *qué*. Es a propósito:
esto lo va a mantener gente del ámbito agronómico local, no una empresa de
software.

**Lo que conviene saber antes de opinar:**

- **No hay tests automatizados.** La verificación se hizo abriendo la app y
  probando cada cambio en el navegador, incluido apagar el servidor para
  comprobar el modo sin señal. Para 1.600 líneas sin dependencias es defendible,
  pero es una deuda real y crece con el proyecto.
- **El servicio todavía no está desplegado.** `apps-script/Code.gs` está escrito
  y verificado, pero no corre en ningún lado. Hoy los datos quedan solo en cada
  teléfono.
- **El repositorio no tiene licencia todavía**, a propósito: hay que resolver
  antes la titularidad entre INTA y CONICET. Está explicado en
  [DERECHOS.md](DERECHOS.md).
- **El historial de git es parte de la documentación.** Cada commit explica qué
  se cambió y por qué. `git log` cuenta la historia del proyecto.

---

## Los documentos del proyecto

| Documento | Para qué |
|---|---|
| **README** (este) | Qué es, cómo se usa y cómo se toca |
| [PLAN.md](PLAN.md) | Las fases, qué falta y qué hace falta para avanzar |
| [DECISIONES.md](DECISIONES.md) | Por qué cada cosa es como es, y qué se descartó |
| [SEGURIDAD.md](SEGURIDAD.md) | El acceso a los datos y cómo operarlo |
| [INSTALACION.md](INSTALACION.md) | Cómo desplegar el servicio y sumar una chacra |
| [DERECHOS.md](DERECHOS.md) | Titularidad, marcas, datos personales y licencia |
| [TERMINOS.md](TERMINOS.md) | Términos de uso, para que los lea el productor |
| [CREDITOS.md](CREDITOS.md) | Autoría y licencia de cada foto de la wiki |

Son ocho documentos, que para 1.641 líneas de código puede parecer mucho. La
razón es que este proyecto tiene tantas decisiones **no técnicas** —qué admite el
sello, de quién son los datos, qué se le puede recomendar a un productor— como
técnicas, y cada una tiene su destinatario. Un programador solo necesita este
README y DECISIONES.

## Cómo instalarla en el celular

1. Abrir <https://martintrigo.github.io/BioSalud/> en el navegador del teléfono.
2. En el menú del navegador (los tres puntos), tocar **"Instalar aplicación"** o
   **"Agregar a pantalla de inicio"**.
3. Queda un ícono como cualquier otra app, abre a pantalla completa y funciona
   sin señal.

A partir de la fase 4 hace falta además un **código de invitación** que da el
equipo técnico, y se escribe una sola vez.

## Estado

| Fase | Qué incluye | Estado |
|---|---|---|
| **1 · Base** | Armazón, identidad institucional, sin señal, Configuración del establecimiento, servicio con control de acceso escrito | ✅ **hecha** |
| **2 · Catálogo y Plan** | Bioinsumos y biopreparados + Registrar Plan de Salud | ✅ **hecha** |
| 3 · Seguimiento | Agenda Hoy / Semana / Atrasado + checklist | pendiente |
| 4 · Sincronización | Despliegue del servicio, planillas por chacra, invitaciones | pendiente |
| 5 · Monitoreo | Registro a campo + sugerencia de tratamiento | pendiente |
| 6 · Wiki | Fichas de bioinsumos y de plagas regionales | 🔄 **en curso** |
| 7 · Avisos | Correo automático de aplicaciones pendientes | pendiente |
| 8 · Piloto | Prueba con 2 chacras y despliegue a las 10 | pendiente |

Lo que ya funciona: la app abre y se usa completa sin conexión, guarda en el
teléfono, bloquea el menú hasta que la configuración esté completa, y deja la
configuración en cola para subirla apenas se despliegue el servicio.

## Dónde vive cada cosa

Hay **una sola fuente de la verdad**: la carpeta del proyecto,
`C:\MARTO\INFORMATICA\BioSalud`. Todo lo demás sale de ahí.

```
   ┌──────────────────────────────────────────────────┐
   │  C:\MARTO\INFORMATICA\BioSalud                   │   ← se edita acá
   │  código, documentos, contenido de la wiki        │      y solo acá
   └──────────────────────────────────────────────────┘
        │                        │
        │ Drive sincroniza       │ git push
        │ solo (respaldo)        ▼
        ▼                   ┌─────────────────────────┐
   ┌──────────┐             │ github.com/…/BioSalud   │
   │  Drive   │             └─────────────────────────┘
   │ (espejo) │                        │ GitHub Pages publica docs/
   └──────────┘                        ▼
                            ┌──────────────────────────────┐
                            │ martintrigo.github.io/…      │ ← lo que se
                            └──────────────────────────────┘    instala
```

El espejo de Drive **no es otra copia que haya que mantener**: es la misma
carpeta, respaldada sola. Nunca se edita desde ahí.

Aparte, y a propósito, están los **datos**:

| Dónde | Qué | Por qué separado |
|---|---|---|
| `Mi unidad/BioSalud — Datos` | Las planillas de las chacras | Un Google Sheets no se guarda de verdad en una carpeta sincronizada: baja como un acceso directo de 194 bytes, y **si esa carpeta local se borra, Drive borra las planillas reales**. Además a cada chacra se le comparte su planilla y ninguna otra, y eso se maneja mejor en una carpeta que solo tiene datos |

La carpeta de Drive tiene adentro un documento *LEEME* que explica lo mismo,
para quien la abra sin pasar por acá.

### La única copia que puede quedar desactualizada

Cuando el servicio esté desplegado, `apps-script/Code.gs` va a existir **dos
veces**: acá, que es el original, y pegado dentro del editor de Apps Script, que
es la copia que corre. Git no llega hasta ahí.

Así que cada vez que se toque ese archivo hay que volver a pegarlo en el editor
y hacer **Implementar → Administrar implementaciones → Nueva versión**. Es el
único lugar del proyecto donde "cuál es la última versión" puede volverse una
pregunta, y la respuesta siempre es: **la del repositorio**.

## Cómo se organiza

```
BioSalud/
├── PLAN.md · DECISIONES.md · SEGURIDAD.md · DERECHOS.md · TERMINOS.md
├── CREDITOS.md · INSTALACION.md · IDS.txt (no se publica)
├── bibliografía/        material de referencia (no se publica: ver DERECHOS.md)
├── img/                 logos originales, tal como llegaron
├── apps-script/
│   └── Code.gs          el servicio que escribe en las planillas
└── docs/                LA APP (es lo que se publica)
    ├── index.html
    ├── manifest.webmanifest    para que se instale como app en Android
    ├── sw.js                   guarda la app en el teléfono: el modo sin señal
    ├── css/estilos.css         colores institucionales y estilos
    ├── img/                    logos e íconos que viajan al celular
    ├── datos/                  EL CONTENIDO DE LA WIKI
    │   ├── biopreparados.json  recetas, por función
    │   └── plagas.json         plagas y enfermedades, con sus umbrales
    └── js/
        ├── util.js             ayudas cortas: escape, números, fechas
        ├── acceso.js           identificador del teléfono y credencial
        ├── db.js               base local del teléfono y cola de envío
        ├── config.js           sección Configuración
        ├── wiki.js             sección Info / Wiki
        ├── plan.js             sección Registrar Plan de Salud
        └── app.js              menú, navegación y bloqueo de secciones
```

**Para corregir o sumar una ficha de la wiki no hace falta programar.** Se edita
el JSON de `docs/datos/`, se sube el número de `CACHE` en `sw.js` y se publica.

**Para sumar fotos**, dejarlas en `fotos-originales/` con el id de la ficha
adelante (`polilla-col-dano.jpg`) y correr:

```bash
python tools/preparar-fotos.py
```

Las deja en `docs/img/fichas/` a 900 px y unos 43 KB cada una, e imprime el
fragmento JSON para pegar en la ficha. Los originales no se publican.

**Para regenerar la cartilla en PDF** después de corregir una ficha:

```bash
python tools/generar-cartilla.py
```

Sale de los mismos JSON que la app, así que el papel y el celular no pueden
decir cosas distintas. Deja `docs/cartilla-biopreparados.pdf` y su versión HTML,
descargables desde la wiki. El PDF **no** está en la lista del service worker: es
casi 1 MB y se baja cuando alguien lo pide, no con la app.
Cada ficha lleva su cita bibliográfica y las plagas declaran qué biopreparados
las tratan; el cruce inverso lo calcula la app sola.

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
que ya la tengan instalada la reciben la próxima vez que la abran con señal.

## Al tocar el código

**Si cambiás cualquier archivo de `docs/`, subí el número de `CACHE` en
`sw.js`.** Es lo que le avisa al teléfono que hay una versión nueva para guardar.

**Nunca subas al repositorio la clave de administración ni la dirección del
servicio con credenciales.** El repositorio es público. Está contemplado en el
`.gitignore`, pero conviene mirar `git status` antes de cada commit.

**Todo lo que escribe el productor pasa por `Util.esc()` antes de mostrarse.** Si
agregás una pantalla nueva, no rompas esa regla: un nombre de sector con código
adentro no tiene que poder ejecutarse.

Los colores institucionales están declarados al principio de `css/estilos.css` y
salen muestreados de los propios logos: cambiando esos valores se actualiza toda
la app.
