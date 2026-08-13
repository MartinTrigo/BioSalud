# BioSalud ECOMARCAL — Plan de trabajo

*App de salud del suelo y los cultivos*

**Institución:** IFAB (CONICET / INTA El Bolsón) · Agencia de Extensión Rural El Bolsón
**Marco:** Sello de certificación agroecológica **ECOMARCAL**
**Alcance geográfico:** Comarca Andina del Paralelo 42 — El Bolsón, Mallín Ahogado, Lago Puelo,
El Hoyo, Epuyén, Cholila, El Manso
**Enfoque conceptual:** Una Salud (suelo → planta → persona)
**Usuarias/os:** hasta 10 chacras certificadas o en transición + equipo técnico de extensión

---

## 1. Qué tiene que hacer la app

| Sección | Función |
|---|---|
| **Configuración** | Datos del establecimiento y sectores de riego. **Bloquea el resto hasta completarse.** |
| **Registrar Plan de Salud** | Armar el calendario de aplicaciones: producto, dosis, método, frecuencia, sectores. |
| **Seguimiento de plan** | Qué toca aplicar hoy / esta semana / está atrasado. Checklist de lo realizado. |
| **Monitoreo de campo** | Registrar síntoma, signo o plaga con sector/bancal, incidencia y severidad. Sugiere tratamiento y ofrece contacto con el técnico. |
| **Plan de tratamiento** | Derivado de un monitoreo: calendario, producto, dosis, lote y checklist de aplicado. |
| **Info / Wiki** | Fichas de bioinsumos y biopreparados (preparación, uso, cuidados, riesgos) y de plagas y enfermedades regionales. |

**Requisitos transversales**

- Funciona **sin señal** en el campo; sincroniza cuando hay conexión.
- Se usa desde el celular con **un solo enlace**, instalable como app en Android.
- Cada chacra escribe en **su propia planilla de Google** alojada en tu Drive, y puede
  verla o descargarla con el link que le compartas.
- Identidad visual institucional: logos y colores de IFAB / CONICET / INTA y ECOMARCAL.
- El equipo técnico accede a todos los datos para hacer seguimiento y asesorar.

---

## 2. Punto de partida: qué ya existe

### `MonAgric` — arquitectura probada en campo

App web (PWA) publicada en GitHub Pages, con cola de envío local y **un solo servicio de
Apps Script que enruta a la planilla de cada chacra** según un código. Ya está funcionando
con productores. Lo que conviene reutilizar tal cual:

- El patrón *guardo local primero → envío después* con reintentos y sin duplicados
  (cada registro lleva un `id` propio del dispositivo).
- El ruteo multi-chacra por propiedad `CHACRAS` del script: sumar una chacra no exige
  tocar código ni publicar un servicio nuevo.
- `catalogo.json`: lo que es igual para todas las chacras vive en un archivo versionado,
  no en la base de cada una. Es lo que permite comparar entre chacras.
- Publicación en GitHub Pages desde la carpeta `docs/`: se actualiza con cada `git push`.

### `BioINTA` — intento previo, descartado como base

Prototipo hecho con otra IA. **No se usa como punto de partida**: no sirve para campo
(depende de librerías que se bajan de internet, así que sin señal se ve rota; el envío a
Sheets no tiene cola ni reintento y pierde datos en silencio; un webhook por chacra cargado
a mano, que no escala a diez; sin deduplicación, así que un reintento duplica filas; y sin
recurrencias, así que el seguimiento no puede decir "esto vencía el martes").

Lo único que se aprovecha es **contenido**: los textos de wiki y las listas de productos y
plagas que ya tenía cargados, revisados uno por uno antes de entrar.

---

## 3. Arquitectura propuesta

```
Celular del productor                    Tu Drive
┌──────────────────────┐                ┌────────────────────────┐
│  App web (PWA)       │                │  Planilla · Chacra 1   │
│  · IndexedDB local   │   Apps Script  │  Planilla · Chacra 2   │
│  · Cola de envío     │──── 1 servicio ┼─→ …                    │
│  · Funciona offline  │      (1 URL)   │  Planilla · Chacra 10  │
└──────────────────────┘                └────────────────────────┘
         ↑                                         ↓
   catalogo.json                          Equipo técnico IFAB
   (productos, plagas,                    (lectura, seguimiento,
    reglas de tratamiento)                 asesoramiento)
```

- **Front:** HTML + CSS + JavaScript sin frameworks ni CDN. Todo el código viaja en el
  Service Worker, así la app abre y funciona completa sin señal.
- **Datos locales:** IndexedDB (config, sectores, planes, ocurrencias, aplicaciones,
  monitoreos, tratamientos) + store `outbox` con la cola de envío.
- **Backend:** un único Apps Script publicado como aplicación web. Recibe lotes de
  registros, los enruta a la planilla de la chacra y descarta los `id` ya recibidos.
- **Catálogo compartido:** `catalogo.json` versionado en el repo, cacheado por el Service
  Worker. Contiene productos, plagas/enfermedades y las reglas de sugerencia de tratamiento.
- **Hosting:** GitHub Pages, carpeta `docs/`. Gratis, sin servidor que mantener.

### Pieza clave del diseño: ocurrencias

Un renglón del plan ("Biofertilizante, 2 L/100 L, por fertirriego, sectores A y B, cada 15
días, de octubre a marzo") se expande al guardarse en **ocurrencias fechadas**. Sin eso el
seguimiento no puede saber qué está pendiente, qué se atrasó ni qué avisar. Es lo que
sostiene el checklist, el semáforo de cumplimiento y las notificaciones.

### Hojas de cada planilla de chacra

| Hoja | Contenido |
|---|---|
| `Config` | Establecimiento, localidad, y una fila por sector (sector, m², bancales, tipo de cultivo) |
| `Plan` | Renglones del plan de salud, con su regla de repetición |
| `Aplicaciones` | Checklist ejecutado: fecha programada, fecha real, producto, dosis, sector, operador, clima, observaciones |
| `Monitoreos` | Fecha, sector, bancal, cultivo, síntoma/signo/plaga, incidencia %, severidad, foto, notas |
| `Tratamientos` | Planes de tratamiento generados a partir de un monitoreo, y su validación por el técnico |

---

## 4. Notificaciones: qué es realista

Conviene decirlo claro antes de prometerlo en la agencia. Una app web **no puede avisar
sola en Android de forma confiable** si no hay un servidor detrás mandando el aviso.

| Opción | Confiabilidad | Costo |
|---|---|---|
| Panel *Hoy / Esta semana / Atrasado* al abrir la app, con contador | Alta (pero exige abrir la app) | Ninguno |
| **Mail automático desde Apps Script** con un disparador diario o semanal | Alta, llega sin abrir nada | Ninguno |
| Notificación local del navegador con la app abierta | Media | Ninguno |
| Push web real (VAPID) | Alta | Exige servidor propio y mantenimiento |

**Recomendación:** panel + mail automático desde Apps Script. Cubre el 90 % de la necesidad
sin infraestructura. Push web queda como fase posterior si el piloto lo pide.

---

## 5. Sugerencia de tratamiento

Motor de **reglas explícitas** en `catalogo.json`, no una caja negra:

```
plaga/enfermedad + cultivo + umbral de incidencia/severidad
        → tratamientos ordenados por prioridad
        → compatibilidad con el nivel de certificación (agroecológico / orgánico / transición)
        → advertencias, plazo de carencia, condiciones de aplicación
```

Ventaja: cualquier técnico del equipo puede leer, discutir y corregir una regla sin tocar
código, y queda trazable por qué la app sugirió lo que sugirió.

**Resguardo profesional.** Una recomendación fitosanitaria tiene consecuencias productivas y
sanitarias. La app debe:

1. Presentar la sugerencia como **orientativa y preliminar**, nunca como prescripción.
2. Ofrecer siempre el contacto con el equipo de extensión, en primer plano.
3. Registrar quién validó cada plan de tratamiento y cuándo.
4. Marcar de forma inequívoca los productos **no admitidos bajo sello ECOMARCAL**, para que
   la app no empuje sin querer a un productor certificado fuera de su protocolo.

---

## 6. Fases de trabajo

| Fase | Entregable | Depende de |
|---|---|---|
| ~~**F0 · Definiciones**~~ | ~~Nombre de la app, logos, paleta institucional~~ ✅ | — |
| ~~**F1 · Base**~~ | ~~Esqueleto navegable con identidad institucional + **Configuración** completa y funcionando offline~~ ✅ | — |
| **F2 · Catálogo y Plan** | Lista de bioinsumos, biopreparados y banda verde + **Registrar Plan de Salud** con recurrencias | F1 |
| **F3 · Seguimiento** | Agenda Hoy/Semana/Atrasado + checklist de aplicación + semáforo de cumplimiento | F2 |
| **F4 · Sincronización** | Apps Script multi-chacra, planillas por chacra, cola de envío y deduplicación | F3 |
| **F5 · Monitoreo** | Registro de campo con incidencia y severidad + motor de sugerencia + aviso al técnico + plan de tratamiento | F2, F4 |
| **F6 · Wiki** | Fichas de bioinsumos y de plagas/enfermedades regionales, consultables sin señal | Bibliografía |
| **F7 · Avisos** | Mail automático desde Apps Script | F4 |
| **F8 · Piloto** | Prueba con 2 chacras, ajustes, y despliegue a las 10 | Todo |

Cada fase deja algo **usable y mostrable**. F1 ya se puede presentar en la agencia.

---

## 7. Qué necesito de vos

**Bloqueantes** (frenan una fase):

1. ✅ ~~Logos de CONICET, INTA y ECOMARCAL~~ — ya cargados. Falta solo el **logo de IFAB**,
   y el **sello ECOMARCAL en mayor resolución** para que el ícono de la app se vea nítido
   (el archivo actual mide 225 × 225 px).
2. **Protocolo o pliego ECOMARCAL**: qué productos se admiten, cuáles no, y qué registros
   exige el sello. Es lo que define las marcas de compatibilidad de la app. → bloquea F2.
3. **Listado de bioinsumos que promueven desde INTA** (biofertilizante, bioestimulante,
   biorepelente) con su dosis, método y frecuencia recomendada. → bloquea F2.

**Enriquecen** (mejoran el resultado, no frenan):

4. Fichas regionales de plagas y enfermedades de la Comarca. Ya hay tres PDF en
   `bibliografía/` (Rivera y Wright, biopreparados FAO, fichas Milpa) para arrancar.
5. Nombres y códigos de las chacras del piloto.
6. A qué cuenta de Drive van las planillas, y con qué cuenta de GitHub se publica.
7. Correo de contacto del equipo de extensión para el botón "contactar al técnico".

---

## 8. Decisiones tomadas y pendientes

**Tomadas**

- **Nombre:** BioSalud ECOMARCAL.
- **Avisos:** panel Hoy / Esta semana / Atrasado dentro de la app, más correo automático
  desde Apps Script. Push web queda descartado por ahora, porque exige servidor propio.
- **Paleta:** muestreada de los propios logos institucionales (ver `docs/img/LEEME.md`).
  El verde principal es el de las hojas del sello ECOMARCAL, no un verde inventado.
- **Punto de partida:** desarrollo limpio sobre la arquitectura probada de MonAgric.

**Pendientes**

- **Relación con MonAgric.** Hoy se construyen por separado, como pediste. Más adelante vale
  la pena evaluar si comparten configuración de sectores, para que un productor que usa las
  dos no cargue sus sectores dos veces.
- **Fotos en el monitoreo.** Muy útiles para el diagnóstico a distancia, pero las planillas
  de Google no guardan imágenes bien: habría que subirlas a una carpeta de Drive y guardar
  el link. Se puede, suma una fase.
