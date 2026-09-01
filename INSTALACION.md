# Poner el servicio en funcionamiento

Cómo se despliega el Apps Script que escribe en las planillas, y cómo se suma
una chacra después.

Los identificadores de las planillas están en **`IDS.txt`**, en la carpeta del
proyecto. Ese archivo no se publica: está en el `.gitignore` a propósito.

El modelo de acceso y su operación diaria están en [SEGURIDAD.md](SEGURIDAD.md).

---

## Lo que ya está hecho

Las planillas están creadas en el Drive personal de Martín, en la carpeta
**BioSalud — Datos**:

```
BioSalud — Datos/
├── BioSalud · Accesos          quién tiene acceso: invitaciones y dispositivos
└── Chacras/
    └── BioSalud · Chacra modelo    la estructura, para duplicar por chacra
```

Están **vacías a propósito**: las hojas y sus encabezados los crea el propio
servicio, para que no puedan quedar corridos respecto de lo que el código
escribe.

> Es el Drive personal mientras dure el desarrollo. Antes del piloto hay que
> mudarlas a una cuenta institucional: es el punto 1 de [DERECHOS.md](DERECHOS.md).

---

## Desplegar el servicio, la primera vez

### 1. Crear el proyecto de Apps Script

Abrir la planilla **BioSalud · Accesos** → **Extensiones → Apps Script**.
Borrar lo que haya en el editor y pegar todo el contenido de
[`apps-script/Code.gs`](apps-script/Code.gs).

### 2. Cargar las propiedades del script

Engranaje (**Configuración del proyecto**) → **Propiedades del script** →
agregar tres:

| Propiedad | Valor |
|---|---|
| `ACCESOS` | El id de la planilla *BioSalud · Accesos* (está en `IDS.txt`) |
| `CARPETA_DATOS` | El id de la carpeta *BioSalud — Datos* (está en `IDS.txt`) |
| `CHACRAS` | `{}` — se completa sola al dar de alta cada chacra |
| `CLAVE_ADMIN` | Una clave larga y al azar, inventada en el momento |

**La clave de administración abre cualquier chacra sin credencial.** No va en el
código, ni en el repositorio, ni en un correo. Se guarda en un gestor de
contraseñas.

### 3. Armar la estructura de las planillas

En el editor, elegir la función **`prepararPlanillas`** y ejecutarla. Google va a
pedir autorización la primera vez: hay que dársela, porque el script escribe en
tus planillas.

Deja creadas, con sus encabezados:

- En **Accesos**: `Invitaciones` y `Dispositivos`.
- En cada chacra: `Config`, `Plan`, `Aplicaciones`, `Monitoreos`, `Tratamientos`.

Se puede volver a ejecutar cuando se quiera: no duplica ni pisa nada.

### 4. Publicar el servicio

**Implementar → Nueva implementación**, tipo **Aplicación web**:

- *Ejecutar como*: **Yo**.
- *Quién tiene acceso*: **Cualquier persona**.

Copiar la URL que termina en `/exec` y anotarla en `IDS.txt`.

> "Cualquier persona" suena peor de lo que es: significa que la app puede
> enviarle datos sin que cada productor inicie sesión con Google. Lo que impide
> que un desconocido escriba **no es** el permiso de Google, es la credencial
> del teléfono. Sin ella el servicio rechaza todo.

### 5. Probar que responde

Abrir la URL en el navegador. Tiene que contestar algo así:

```json
{"ok":true,"servicio":"BioSalud","hora":"2026-08-18T…"}
```

Que no diga nada más es lo correcto: sin credencial, el servicio no cuenta
siquiera qué chacras existen.

---

## Sumar una chacra

En el editor, abrir la función **`altaDeChacra`**, editar las tres líneas de
arriba y ejecutarla:

```javascript
var codigo  = "radal";                 // código corto, sin espacios ni acentos
var nombre  = "Chacra El Radal";       // cómo se va a llamar la planilla
var persona = "Marta Quilodrán";       // quién va a cargar desde el celular
```

Eso hace todo de una vez:

- Crea la planilla dentro de la carpeta `Chacras`.
- Le arma las cinco hojas con sus encabezados.
- La registra en la propiedad `CHACRAS`.
- Genera el código de invitación.

En el registro de ejecución quedan el enlace a la planilla y el código. Después
faltan dos cosas a mano:

1. **Implementar → Administrar implementaciones → lápiz → Nueva versión.**
   Sin esto el servicio publicado sigue siendo el anterior y no conoce la chacra
   nueva.
2. **Compartir la planilla de esa chacra con esa chacra**, como lectora, para
   que pueda ver sus propios datos.

El **código corto** lo elige el equipo técnico, no el productor: si cada uno
eligiera el suyo, dos podrían elegir el mismo y sus registros terminarían en la
misma planilla. Es lo que el productor carga en su configuración.

**No compartas nunca la planilla de Accesos con nadie.** Ahí están las huellas
de todos los dispositivos de todas las chacras.

---

## Activar el teléfono de un productor

Con el servicio publicado y la chacra dada de alta:

1. El productor completa su **Configuración**, incluido el **código de chacra**.
2. En esa misma pantalla, abajo, aparece **Conexión con el equipo técnico**.
3. Escribe ahí el **código de invitación** y toca *Activar este teléfono*.
4. Desde ese momento, todo lo que tenía guardado se sube solo, y lo nuevo
   también, cada vez que haya señal.

Si el teléfono se pierde, se pone `NO` en la columna **Activo** de su fila en la
hoja `Dispositivos`. Deja de poder cargar al instante. Lo que ese teléfono tenía
sin enviar **no se pierde**: queda en el aparato hasta que se lo active de nuevo.

> Mientras la app no traiga la dirección del servicio escrita en el código, hay
> que pegarla una vez por teléfono, en *Conexión → Dirección del servicio*. Una
> vez que la dirección esté confirmada se pone en el código y ese paso
> desaparece para todos.

---

## Al cambiar el código del servicio

Pegar la versión nueva en el editor no alcanza: hay que hacer
**Implementar → Administrar implementaciones → lápiz → Nueva versión**. Hasta
ese momento la URL publicada sigue ejecutando el código anterior.

---

## Qué hoja guarda qué

| Hoja | Qué se acumula | Desde qué fase |
|---|---|---|
| `Config` | Establecimiento y sectores. **Se reescribe entera**, no se acumula | 1 |
| `Plan` | Los renglones del plan de salud de la temporada | 2 |
| `Aplicaciones` | Lo que se aplicó de verdad, con fecha programada y fecha real | 3 |
| `Monitoreos` | Lo observado en el campo, con incidencia y severidad | 5 |
| `Tratamientos` | Planes de tratamiento, con quién los validó | 5 |

Cada fila arranca con el `Id` que le puso el teléfono. Es lo que hace que un
reintento no duplique, y lo que ata una aplicación con su renglón del plan o un
tratamiento con el monitoreo que lo originó.
