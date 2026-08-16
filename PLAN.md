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
| **2 · Catálogo y Plan** | Lista de bioinsumos, biopreparados y banda verde + **Registrar Plan de Salud** con recurrencias | pendiente |
| **3 · Seguimiento** | Agenda Hoy / Semana / Atrasado + checklist + semáforo de cumplimiento | pendiente |
| **4 · Sincronización** | Despliegue del Apps Script, planillas por chacra, canje de invitación, términos aceptados en la app | pendiente |
| **5 · Monitoreo** | Registro a campo + motor de sugerencia + aviso al técnico + plan de tratamiento | pendiente |
| **6 · Wiki** | Fichas de bioinsumos y de plagas regionales, consultables sin señal | pendiente |
| **7 · Avisos** | Correo automático de aplicaciones pendientes | pendiente |
| **8 · Piloto** | Prueba con 2 chacras, ajustes y despliegue a las 10 | pendiente |

Cada fase deja algo **usable y mostrable**.

**Dependencias que importan:** la 3 necesita la 2; la 5 necesita la 2 y la 4; la
7 necesita la 4. La 6 es independiente y puede adelantarse en cualquier momento
si hay tiempo para redactar fichas.

---

## 3. Qué hace falta

### Bloqueantes

| # | Qué | Bloquea |
|---|---|---|
| 1 | **Pliego ECOMARCAL**: qué productos admite el sello, cuáles no, y qué registros exige | Fase 2 |
| 2 | **Bioinsumos que promueve el INTA**, con dosis, método y frecuencia recomendada | Fase 2 |
| 3 | **Cuenta institucional de Drive** donde alojar las planillas | Fase 4 |
| 4 | **Códigos y nombres de las chacras** del piloto | Fase 4 |
| 5 | **Correo de contacto del equipo** para el botón "contactar al técnico" | Fase 5 |

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
