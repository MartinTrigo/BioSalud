# Mudar los datos a la cuenta de la app

Hasta el 29/10/2026 todo vivía en el Drive personal de Martín. Desde ahora va en
una cuenta registrada para la app:

**`biosalud.inta@gmail.com`**

Este documento es el procedimiento, en orden, y sobre todo las tres cosas que
pueden salir mal si se hace en otro orden.

> **Esta cuenta no es institucional.** Tiene `inta` en el nombre, pero es una
> cuenta de Gmail que registró Martín, no una cuenta de INTA ni de CONICET. Es
> mejor que un Drive personal —los datos dejan de estar mezclados con los de una
> persona— pero no cumple todavía el punto 1 de [DERECHOS.md](DERECHOS.md), y los
> términos de uso no deberían decir "institucional" hasta que lo sea. Un productor
> que lee "inta" en la dirección va a suponer otra cosa.

---

## Por qué no alcanza con transferir los archivos

Lo primero que uno piensa es pasar la propiedad de los archivos a la cuenta
nueva. Para las planillas funcionaría, pero deja el problema a medias, y es por
el Apps Script.

El servicio está **contenido** en la planilla `BioSalud · Accesos`, y la
aplicación web **se ejecuta con la identidad de quien la implementó**. Eso es lo
que le permite crear planillas y escribir fotos: lo hace como Martín. Si solo se
transfieren los archivos, el código sigue corriendo como él, escribiendo en una
cuenta que ya no es la suya. Se habría mudado la carpeta pero no el permiso, que
es justamente lo que se quería mudar.

Por eso: **el servicio se vuelve a crear en la cuenta nueva**, y los datos se
copian.

El costo es concreto y hay que saberlo de antemano: **la dirección del servicio
cambia**. Una implementación nueva tiene otra URL, así que hay que escribirla en
`docs/js/envio.js` y volver a publicar la app.

---

## Lo que se copia y lo que se vuelve a crear

| Qué | Cómo |
|---|---|
| `BioSalud · Accesos` | Se **copia**, con sus filas: ahí están las invitaciones y, sobre todo, las huellas de los teléfonos activados |
| `Chacra Tika` | Se **copia**: tiene la configuración y los registros que ya subieron |
| `Chacra El Radal` | **No se copia**: está vacía, las cinco hojas tienen solo encabezados. Se vuelve a dar de alta desde el menú, y así nace con la estructura actual en vez de arrastrar los encabezados viejos |
| `Chacra modelo` | No se copia. Quedó obsoleta desde que existe el alta desde el menú |
| Carpetas `BioSalud — Datos`, `Chacras` | Se crean nuevas en la cuenta nueva |
| Carpeta `Fotos` | No existe todavía: la crea el servicio sola con la primera foto |
| El proyecto de Apps Script | Se **vuelve a crear**: se pega `apps-script/Code.gs` en la planilla Accesos copiada |
| Propiedades del script | Se vuelven a cargar, con los **ids nuevos** |
| `CLAVE_ADMIN` | Se genera **una nueva**. La vieja vivió en un proyecto atado a una cuenta personal: no se arrastra |

**Las huellas de los teléfonos son lo que hay que cuidar.** La credencial vive en
el teléfono y el servicio la valida contra la columna `Huella` de `Dispositivos`.
Si esas filas viajan en la copia, los teléfonos ya activados **siguen andando**:
lo único que cambia para ellos es la dirección, que les llega con la próxima
actualización de la app. Si las filas no viajan, hay que darlos de alta de nuevo.

---

## El orden

### 1. En la cuenta nueva, armar el lugar

Entrar a `biosalud.inta@gmail.com` y crear en su Drive:

```
BioSalud — Datos
└── Chacras
```

### 2. Copiar las planillas

Desde la cuenta de Martín, compartir con `biosalud.inta@gmail.com` como editor:

- `BioSalud · Accesos`
- `BioSalud · Chacra Tika`

Después, **desde la cuenta nueva**, abrir cada una y hacer **Archivo → Hacer una
copia**, guardándola en la carpeta que corresponda. La copia queda con la cuenta
nueva como dueña, que es el punto de todo esto. Conviene sacarles el " (copia)"
del nombre.

> **La copia de una planilla no se lleva el script.** `Accesos` copiada llega sin
> el Apps Script, y está bien: se pega de nuevo en el paso 4.

### 3. Anotar los ids nuevos

De la barra de direcciones de cada archivo, en `IDS.txt` —que no se publica—:

- id de la carpeta `BioSalud — Datos`
- id de la carpeta `Chacras`
- id de la planilla `BioSalud · Accesos`
- id de cada planilla de chacra

**Dejar los ids viejos escritos abajo, marcados como viejos, hasta terminar el
paso 7.** Si algo no anda, la forma de volver atrás es tenerlos a mano; y
mientras la migración esté a medio hacer, un id suelto sin saber de qué cuenta es
se vuelve una media hora de confusión.

### 4. Crear el servicio en la cuenta nueva

En la planilla `BioSalud · Accesos` copiada: **Extensiones → Apps Script**. Pegar
todo `apps-script/Code.gs`, guardar, y en **Configuración del proyecto →
Propiedades del script** cargar:

| Propiedad | Valor |
|---|---|
| `ACCESOS` | el id **nuevo** de la planilla Accesos |
| `CARPETA_DATOS` | el id **nuevo** de `BioSalud — Datos` |
| `CARPETA_CHACRAS` | el id **nuevo** de `Chacras` |
| `CHACRAS` | `{"tika":"id nuevo de Chacra Tika"}` — El Radal se suma sola al darla de alta desde el menú |
| `CLAVE_ADMIN` | una clave nueva, larga y al azar |

Después **recargar la planilla** para que aparezca el menú BioSalud, y correr
**BioSalud → Revisar la configuración del servicio**: abre cada planilla de
`CHACRAS` y dice cómo se llama, así un id mal copiado se detecta acá y no cuando
un productor está cargando en el campo.

### 5. Implementar

**Implementar → Nueva implementación → Aplicación web**, ejecutando **como yo**
(que ahora es la cuenta de la app) y con acceso para **cualquier persona**. Copiar
la dirección que termina en `/exec`.

> **Esa dirección no es la app.** Es el servicio con el que la app habla por
> detrás. Si se abre en un navegador tiene que contestar
> `{"ok":true,"servicio":"BioSalud"}` y nada más: sin credencial el servicio no
> cuenta ni qué chacras existen. La app sigue estando en
> <https://martintrigo.github.io/BioSalud/>, y es la única dirección que un
> productor necesita conocer.

### 6. Escribir la dirección nueva en la app

En `docs/js/envio.js`, reemplazar la dirección vieja por la nueva, subir el
número de caché en `docs/sw.js`, commitear y pushear.

**Hasta que esto no esté publicado, los teléfonos siguen hablando con el servicio
viejo.** No se pierde nada —los dos servicios funcionan— pero los registros
entran en las planillas de la cuenta vieja.

### 7. Probar antes de dar de baja nada

Con la app actualizada en un teléfono:

1. Que la configuración suba.
2. Que un monitoreo con foto suba, y que la foto aparezca en
   `Fotos/<chacra>/` del Drive **de la cuenta nueva**.
3. Que el productor siga pudiendo ver su planilla: hay que **volver a
   compartírsela**, porque la copia no hereda los permisos de la original.

### 8. Recién ahí, apagar lo viejo

En la planilla `Accesos` **vieja**, poner `NO` en la columna `Activo` de todos los
dispositivos, y archivar la carpeta `BioSalud — Datos` vieja. No borrarla: hasta
no tener varias semanas de datos en la cuenta nueva, es el respaldo.

---

## Lo que queda pendiente después de esto

- Volver a compartir cada planilla de chacra con su productor (paso 7.3).
- Decidir los permisos de las fotos: hoy quedan con los de la carpeta, así que
  las ve el equipo y no el productor. Mudar de cuenta no resuelve esa decisión,
  solo cambia de quién es la carpeta.
- El punto 1 de [DERECHOS.md](DERECHOS.md) sigue abierto: una cuenta de Gmail
  propia no es una cuenta institucional. Y antes de mudar a una cuenta de INTA
  hay que saber si incluye Google Workspace: todo el backend es Apps Script sobre
  Sheets, y en Microsoft no existe Apps Script.
