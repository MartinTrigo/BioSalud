# Seguridad de BioSalud ECOMARCAL

Cómo se protege el acceso a los datos y cómo se opera el día a día: dar de alta
un productor, dar de baja un teléfono perdido, qué hacer si algo se filtra.

El *por qué* de cada decisión está en [DECISIONES.md](DECISIONES.md).

---

## El problema de fondo

La dirección del servicio que escribe en las planillas tiene que estar en el
código de la app, y el código es público. **Cualquiera que la encuentre puede
mandarle pedidos.** No hay forma de esconderla: está en el teléfono de cada
productor.

Si no hubiera nada más, alguien podría leer los datos de todas las chacras,
inventar aplicaciones que nunca se hicieron —lo que en una app de certificación
es directamente falsificar un registro— o borrar la configuración de un
establecimiento entero.

En MonAgric esto se comprobó ejecutándolo. No era teoría.

---

## Cómo se resuelve: invitación y credencial por teléfono

Cada persona canjea **una sola vez** un código de invitación, y su teléfono
recibe a cambio una **credencial** larga y al azar que queda guardada ahí. Desde
ese momento, cada pedido viaja con ella.

```
Equipo IFAB                Productor                     Servicio
     │                         │                             │
     │── código RTKM-9PWX ────▶│                             │
     │   (una vez, en persona) │── canjea el código ────────▶│
     │                         │◀── credencial ──────────────│
     │                         │    (queda en ese teléfono)  │
     │                         │                             │
     │                         │── registros + credencial ──▶│  ✓
     │                    otro teléfono ── registros ───────▶│  ✗ rechazado
```

**Del lado del servicio se guarda solo la huella SHA-256 de la credencial.**
Alcanza para comprobarla, pero no permite reconstruirla: ni abriendo la planilla
de accesos se saca algo que sirva para entrar.

### Qué resuelve

- **Cierra la puerta.** Sin credencial no se lee ni se escribe nada. Lo único
  abierto es el canje del código.
- **Da trazabilidad.** En la hoja `Dispositivos` se ve qué aparatos cargan, de
  quién son y cuándo fue su última actividad. En una app de certificación esto
  no es un lujo: es parte de poder sostener que un registro es genuino.
- **Permite dar de baja a uno solo.** Sin afectar al resto de la chacra.

### Límite conocido

El identificador del teléfono se puede inventar. Sirve para **detectar** cosas
raras, no para impedirlas. La que impide es la credencial.

---

## Las dos planillas de acceso

Viven en una planilla **aparte de las de las chacras**. Si una chacra pudiera
abrirla, vería las huellas de todas las demás.

**Invitaciones**

| Código | Chacra | Para quién | Estado | Creada | Usada el | Dispositivo |
|---|---|---|---|---|---|---|

**Dispositivos**

| Dispositivo | Chacra | Persona | Activo | Alta | Última actividad | Registros | Huella |
|---|---|---|---|---|---|---|---|

---

## Operación

### Dar de alta a un productor

1. En la planilla `BioSalud · Accesos`, menú **BioSalud → Nueva invitación para
   una chacra**. Pide el código de la chacra y el nombre de la persona.
2. El código queda en la hoja `Invitaciones` y se muestra en pantalla.
3. Dárselo **en persona o por un canal directo**, no en un grupo de WhatsApp.
4. La persona lo escribe una vez en la app y no vuelve a necesitarlo.

La primera invitación de una chacra ya la crea el alta, así que esto es para
sumar a una segunda persona.

**No escribas filas a mano en `Invitaciones`.** El menú se niega a crear una
invitación para una chacra que no esté dada de alta, pero una fila escrita a mano
se saltea ese control: el canje la aceptaría igual —solo compara el código y la
chacra de esa fila— y el teléfono quedaría con una credencial válida para una
chacra sin planilla. Todo lo que cargue en el campo se queda en la cola, y nadie
se entera hasta preguntarse por qué esa chacra nunca subió nada.

Lo natural es hacerlo en la visita de instalación: uno se sienta al lado del
productor, le muestra la app y escribe el código ahí mismo.

### Dar de baja un teléfono

Poner `NO` en la columna **Activo** de su fila en `Dispositivos`. Desde el
siguiente pedido, ese teléfono deja de poder cargar. **No hay que tocar nada
más ni avisar a nadie.**

Hacerlo cuando: se pierde o roban un teléfono, alguien deja la chacra, o se
detecta un uso que no corresponde.

Lo que el productor ya había cargado y no llegó a subirse **no se pierde**:
queda en la cola de su teléfono. La app le avisa que tiene que activar de nuevo
con un código.

### La clave de administración

Vive en **Propiedades del script** (`CLAVE_ADMIN`), nunca en el código ni en el
repositorio. Sirve para las herramientas de escritorio, que no tienen un
teléfono asociado. Quien la tenga entra a cualquier chacra sin credencial, así
que se trata como lo que es: la llave maestra.

### Si algo se filtra

| Qué se filtró | Qué hacer |
|---|---|
| Una credencial de un teléfono | `NO` en su fila de `Dispositivos` y darle un código nuevo |
| La clave de administración | Cambiar `CLAVE_ADMIN` en Propiedades del script |
| Un código de invitación sin usar | Poner `Anulada` en su Estado |
| Se subió un secreto al repositorio | Rotarlo igual: el historial de git queda para siempre |

---

## Lo demás que protege la app

**Nada que escriba el productor se inserta tal cual en la pantalla.** Todo pasa
por una función de escape antes de mostrarse. Sin eso, un nombre de sector con
código adentro podría ejecutarse al abrir la app.

**La app no carga nada de afuera.** Ni tipografías, ni librerías, ni imágenes de
otros sitios. Eso permite declarar en la página de dónde puede venir cada cosa
(*Content-Security-Policy*) y que el navegador rechace todo lo demás. También es
lo que hace que funcione de verdad sin señal.

**Los pedidos al servicio nunca se guardan en el caché.** Solo se guarda la app
en sí. Guardar respuestas de datos mostraría información vieja como si fuera
actual, que en un seguimiento de aplicaciones es peor que no mostrar nada.

**Los reintentos no duplican filas.** Cada registro lleva su propio
identificador y el servicio descarta los que ya recibió.

**La configuración se respalda antes de pisarla.** Se guarda entera cada vez, así
que antes de reescribirla se deja una copia en una hoja oculta, y una
configuración vacía o sin sectores se rechaza en vez de borrar la buena.

**Los envíos van de a lotes y con candado.** Dos teléfonos escribiendo al mismo
tiempo no se pisan.

---

## Estado de implementación

| Medida | Estado |
|---|---|
| Escape de todo lo que escribe el productor | ✅ fase 1 |
| Política de contenido y cero recursos externos | ✅ fase 1 |
| Identificador de teléfono en cada registro | ✅ fase 1 |
| Servicio con control de acceso escrito | ✅ fase 1 |
| Planillas creadas y estructura de hojas definida | ✅ 18/08/2026 |
| Identificadores y clave fuera del repositorio | ✅ van en propiedades del script |
| Servicio desplegado y publicado | fase 4 |
| Canje de invitación desde la app | fase 4 |
| Huella, revocación y trazabilidad en planilla | fase 4 |
| Términos aceptados por el productor en la app | fase 4 |

El servicio se escribió **con el control de acceso desde la primera línea** a
propósito: en MonAgric se agregó después, y en el medio hubo un período con la
puerta abierta.

Los pasos para desplegarlo están en [INSTALACION.md](INSTALACION.md). Los
identificadores de las planillas viven en `IDS.txt`, en la carpeta del proyecto,
que no se publica.
