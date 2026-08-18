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
| 2 · Catálogo y Plan | Bioinsumos y biopreparados + Registrar Plan de Salud | pendiente |
| 3 · Seguimiento | Agenda Hoy / Semana / Atrasado + checklist | pendiente |
| 4 · Sincronización | Despliegue del servicio, planillas por chacra, invitaciones | pendiente |
| 5 · Monitoreo | Registro a campo + sugerencia de tratamiento | pendiente |
| 6 · Wiki | Fichas de bioinsumos y de plagas regionales | 🔄 **en curso** |
| 7 · Avisos | Correo automático de aplicaciones pendientes | pendiente |
| 8 · Piloto | Prueba con 2 chacras y despliegue a las 10 | pendiente |

Lo que ya funciona: la app abre y se usa completa sin conexión, guarda en el
teléfono, bloquea el menú hasta que la configuración esté completa, y deja la
configuración en cola para subirla apenas se despliegue el servicio.

## Cómo se organiza

```
AppBio/
├── PLAN.md · DECISIONES.md · SEGURIDAD.md · DERECHOS.md · TERMINOS.md
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
        └── app.js              menú, navegación y bloqueo de secciones
```

**Para corregir o sumar una ficha de la wiki no hace falta programar.** Se edita
el JSON de `docs/datos/`, se sube el número de `CACHE` en `sw.js` y se publica.
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
