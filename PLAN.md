# BioSalud ECOMARCAL — Plan de trabajo

Las fases del desarrollo, qué entrega cada una y qué hace falta para poder
avanzar.

El *por qué* de cada decisión está en [DECISIONES.md](DECISIONES.md). Qué es la
app y cómo se usa, en el [README](README.md).

---

## 1. Qué tiene que hacer la app

| Sección | Función |
|---|---|
| **Configuración** | Datos del establecimiento y sectores de riego. **Bloquea el resto hasta completarse.** |
| **Registrar Plan de Salud** | Armar el calendario de aplicaciones: producto, dosis, método, frecuencia, sectores. |
| **Seguimiento de plan** | Qué toca aplicar hoy, esta semana y qué está atrasado. Checklist de lo realizado. |
| **Monitoreo de campo** | Registrar síntoma, signo o plaga con sector y bancal, incidencia y severidad. Sugiere tratamiento y ofrece contacto con el técnico. |
| **Plan de tratamiento** | Derivado de un monitoreo: calendario, producto, dosis, lote y checklist de aplicado. |
| **Info / Wiki** | Fichas de bioinsumos y biopreparados, y de plagas y enfermedades regionales. |

**Requisitos transversales**

- Funciona **sin señal** en el campo y sincroniza cuando hay conexión.
- Se usa desde el celular con **un solo enlace**, instalable como app en Android.
- Cada establecimiento escribe en **su propia planilla**, que puede ver y
  descargar cuando quiera.
- Identidad visual del IFAB (CONICET / INTA) y del sello ECOMARCAL.
- El equipo técnico accede a todos los datos para acompañar y asesorar.
- **Nada se lee ni se escribe sin credencial** (ver [SEGURIDAD.md](SEGURIDAD.md)).

---

## 2. Fases

| Fase | Entregable | Estado |
|---|---|---|
| **0 · Definiciones** | Nombre, logos, paleta institucional | ✅ hecha |
| **1 · Base** | Armazón, identidad, funcionamiento sin señal, **Configuración** del establecimiento, servicio con control de acceso escrito | ✅ hecha |
| **2 · Catálogo y Plan** | Lista de bioinsumos, biopreparados y banda verde + **Registrar Plan de Salud** con recurrencias y cuenta del cobre contra el tope de 6 kg/ha/año | ✅ hecha |
| **3 · Seguimiento** | Agenda Hoy / Semana / Atrasado + checklist + semáforo de cumplimiento | pendiente |
| **4 · Sincronización** | Despliegue del Apps Script, planillas por chacra, canje de invitación, términos aceptados en la app | 🔄 casi — servicio publicado y respondiendo, alta de chacras desde el menú de la planilla de accesos, canje arreglado; falta activar el primer teléfono y mostrar los términos en la app |
| **5 · Monitoreo** | Registro a campo + motor de sugerencia + aviso al técnico + plan de tratamiento | pendiente |
| **6 · Wiki** | Fichas de bioinsumos y de plagas regionales + qué no admite el sello, consultables sin señal | 🔄 en curso — 24 biopreparados, 7 plagas y los no permitidos del sello; faltan las enfermedades fúngicas y las fotos propias |
| **7 · Avisos** | Correo automático de aplicaciones pendientes | pendiente |
| **8 · Piloto** | Prueba con 2 chacras, ajustes y despliegue a las 10 | pendiente |

Cada fase deja algo **usable y mostrable**.

**Dónde estamos, dicho en lo que un productor puede hacer hoy:** configurar su
establecimiento y sus sectores, consultar la wiki entera sin señal, armar el plan
de la temporada con el control de cobre, y sincronizar con la planilla de su
chacra. Lo que todavía no puede: marcar lo que efectivamente aplicó, registrar lo
que ve caminando la chacra, ni recibir recordatorios.

**Dependencias que importan:** la 3 necesita la 2; la 5 necesita la 2 y la 4; la
7 necesita la 4. La 6 es independiente y puede adelantarse en cualquier momento
si hay tiempo para redactar fichas.

---

## 3. Qué hace falta

### Bloqueantes

| # | Qué | Bloquea |
|---|---|---|
| 1 | **Cuenta institucional de Drive**, y antes de eso saber **si incluye Google Workspace**: el backend es Apps Script sobre Google Sheets, y en Microsoft no existe Apps Script. Hoy las planillas están en el Drive personal, que es lo acordado mientras dure el desarrollo | Antes del piloto |
| 2 | **Códigos y nombres del resto de las chacras** del piloto. Ya están `radal` y `tika` | Fase 8 |

### Bloqueantes que se cayeron

- **Pliego ECOMARCAL.** Existe el borrador del Protocolo de Elaboración de
  Bioinsumos del SPG, revisado ficha por ficha en
  [SPG-ECOMARCAL.md](SPG-ECOMARCAL.md). De ahí salieron la cuenta del cobre
  contra el tope de 6 kg/ha/año y la pantalla de no permitidos. Sigue en
  discusión en el Consejo de Garantía y la Asamblea, así que la app dice que es
  un borrador en vez de afirmar que algo está permitido.
- **Bioinsumos del INTA.** Las 24 fichas están cargadas, cada una con su fuente
  (siete publicaciones, cinco de la Patagonia Norte).
- **Correo de contacto del equipo.** Es `trigo.martin@inta.gob.ar`. Falta
  cablearlo al botón, que es trabajo de la fase 5.

### Mejoran el resultado

- Fichas regionales de plagas y enfermedades de la Comarca. Hay tres PDF en
  `bibliografía/` para arrancar (ver el punto 4 de [DERECHOS.md](DERECHOS.md)
  sobre cómo usarlos).
- **Sello ECOMARCAL y logo del IFAB en mayor resolución.** Los actuales son
  chicos y limitan la nitidez del ícono y de la cabecera.
- Fotos propias de plagas y síntomas de la zona, que además evitan el problema
  de derechos de las imágenes ajenas.

### Gestión, en paralelo al desarrollo

Están detallados en [DERECHOS.md](DERECHOS.md), con responsable y momento. Los
dos que no dependen de nadie más y se pueden hacer ya: mover las planillas a una
cuenta institucional y escribir `AUTORES.md`.

---

## 4. Decisiones tomadas

- **Nombre:** BioSalud ECOMARCAL.
- **Avisos:** panel en la app más correo automático desde Apps Script. Push web
  descartado por ahora.
- **Paleta:** muestreada de los propios logos institucionales.
- **Punto de partida:** desarrollo limpio sobre la arquitectura de MonAgric.
- **Acceso:** invitación y credencial por teléfono, desde el primer día.
- **Licencia:** pendiente de resolver la titularidad; el repositorio queda
  público y sin licencia mientras tanto.

## 5. Decisiones pendientes

- **Relación con MonAgric.** Hoy van separadas. Más adelante vale evaluar si
  comparten la configuración de sectores, para que un productor que usa las dos
  no los cargue dos veces.
- **Fotos en el monitoreo.** Muy útiles para el diagnóstico a distancia, pero las
  planillas no guardan imágenes: habría que subirlas a una carpeta de Drive y
  guardar el enlace. Se puede, suma una fase.
- **Qué pasa cuando una chacra pierde el sello.** Sus datos, ¿se archivan, se
  borran, se conservan? Conviene definirlo antes del piloto, no después.
