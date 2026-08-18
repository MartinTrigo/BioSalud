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
| `CHACRAS` | `{"modelo":"id de la planilla modelo"}` |
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

1. Duplicar **BioSalud · Chacra modelo** dentro de la carpeta `Chacras` y
   renombrarla, por ejemplo *BioSalud · Chacra El Radal*.
2. Copiar su id de la barra de direcciones y agregarlo a la propiedad `CHACRAS`:
   `{"modelo":"1Sgy…","radal":"1AbC…"}`
   El código corto de la izquierda es el que va a cargar el productor en su
   configuración. Lo elige el equipo técnico, no el productor.
3. Ejecutar **`prepararPlanillas`** otra vez.
4. **Implementar → Administrar implementaciones → lápiz → Nueva versión.**
   Sin este paso, el servicio publicado sigue siendo el viejo.
5. Crear la invitación para esa chacra: editar `crearInvitacion()` con el código
   y el nombre de la persona, y ejecutarla. El código aparece en el registro de
   ejecución y queda anotado en la hoja `Invitaciones`.
6. Compartir la planilla de la chacra **con esa chacra**, como lector o editor,
   para que pueda ver sus propios datos.

**No compartas nunca la planilla de Accesos con nadie.** Ahí están las huellas
de todos los dispositivos de todas las chacras.

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
