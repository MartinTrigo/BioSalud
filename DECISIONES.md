# Por qué BioSalud es como es

Este documento no explica *cómo* funciona la app —para eso están el código y el
[README](README.md)— sino **por qué se tomó cada decisión**. Sirve para cuando
pase el tiempo y no recordemos el razonamiento, o para que alguien que llegue
nuevo entienda qué se descartó y con qué argumento.

---

## Por qué una app aparte y no un módulo de MonAgric

**Decisión:** desarrollo separado, en su propio repositorio.

MonAgric tenía "Sanidad" en la lista de próximos módulos, así que la alternativa
existía. Pero son dos herramientas con públicos y obligaciones distintas:
MonAgric es voluntaria y sirve para planificar la producción; BioSalud es de uso
**obligatorio** para conservar un sello de certificación. Mezclarlas ataría el
ritmo de una al de la otra y volvería obligatorio, de hecho, todo lo demás.

**Lo que se resignó:** un productor que use las dos va a cargar sus sectores dos
veces. Vale la pena revisarlo más adelante; hoy no justifica acoplarlas.

---

## Por qué se descartó el prototipo previo

**Decisión:** empezar limpio, aprovechando solo contenido del intento hecho con
otra IA en `C:\MARTO\INFORMATICA\BioINTA`.

Tenía la estructura de secciones completa, pero no servía para el campo:

| Problema | Consecuencia |
|---|---|
| Librerías que se bajan de internet | Sin señal la app se ve rota: contradice el requisito principal |
| El envío a Sheets sin cola ni reintento | Si falla, **el dato se pierde en silencio** |
| Un webhook por chacra, cargado a mano | No escala a diez ni permite actualizar el servicio |
| Sin deduplicación | Un reintento duplica filas en la planilla |
| Catálogo y wiki dentro del código | Actualizar una ficha exige tocar código y republicar |
| Sin recurrencias | El seguimiento no puede decir "esto vencía el martes" |

Rehacerlo salía más barato que arreglarlo.

---

## Por qué se reusa la arquitectura de MonAgric

**Decisión:** app web sin frameworks, publicada en GitHub Pages, con base local
en el teléfono y un solo Apps Script que enruta a la planilla de cada chacra.

MonAgric ya resolvió en campo los tres problemas difíciles, y con productores
reales usándolo:

1. Guardar sin señal y enviar después **sin duplicar**.
2. Un solo servicio para todas las chacras: sumar una no exige tocar código ni
   que el productor haga ningún trámite.
3. Publicación gratis, sin servidor que se caiga un domingo.

Reusar eso ahorró meses y, sobre todo, ahorró los errores que ya se cometieron
una vez.

---

## Por qué los datos van a Google Sheets

**Decisión:** planillas de Google, una por establecimiento, con Apps Script de
servicio.

Una base de datos de verdad sería más prolija, pero implica un servidor que hay
que pagar y mantener. Sheets tiene tres cosas que acá pesan más:

1. **El productor puede abrir su planilla y ver todo**, sin depender de la app.
2. **No cuesta nada.**
3. Si algo sale mal, se entra y se arregla a mano.

Para una herramienta de uso obligatorio, lo primero es lo que más importa: nadie
está obligado a usar una app que le esconde sus propios registros.

**Lo que se resignó:** velocidad con muchos datos. Con diez chacras no se nota.

---

## Por qué el plan se expande en ocurrencias fechadas, y por qué no se guardan

**Decisión:** las aplicaciones fechadas se **calculan** cada vez a partir de la
regla del renglón. No se generan una vez y se guardan.

Un renglón dice "MM líquido, al 30 %, fertirriego, sector A, cada 14 días, de
octubre a marzo". Eso, tal cual, no sirve para el seguimiento: no se puede
marcar como hecho, ni saber qué está pendiente, ni qué se atrasó. Hay que
expandirlo en once fechas concretas. Esa expansión es la pieza que sostiene el
checklist, el semáforo de cumplimiento y los avisos.

La primera versión de esta decisión decía que esas once fechas se generaban al
guardar y quedaban almacenadas. **Al implementarlo quedó claro que era peor.**
Si están guardadas, cada corrección del plan —cambiar la frecuencia, correr la
fecha de inicio— obliga a regenerarlas cuidando de no pisar las que ya se
aplicaron. Ahí es exactamente donde los datos se desincronizan y aparecen
aplicaciones huérfanas.

Calculándolas, editar un renglón no puede romper nada: cambia la regla y las
fechas salen distintas la próxima vez que se miran.

**Lo que sí se guarda es lo que se aplicó de verdad**, que es un hecho y no una
previsión. Cada aplicación registrada lleva su fecha programada y su fecha real,
así el historial queda intacto aunque el plan cambie después.

La función vive en `docs/js/plan.js` como `Plan.ocurrencias(renglón)`, y la usan
tanto el resumen del plan como el Seguimiento.

---

## Por qué cada renglón se guarda antes de tocar "Guardar plan"

**Decisión:** el renglón se escribe en el teléfono apenas se agrega. El botón de
abajo cierra el plan y lo manda a la planilla, pero no es lo que evita perderlo.

Un botón de guardar al final es lo esperable, y por eso está. Pero en el campo
la app se cierra sola, se acaba la batería o entra una llamada, y perder diez
renglones cargados a mano es motivo suficiente para que alguien no la use más.

Así que son dos cosas distintas: **guardar** pasa siempre y en silencio;
**cerrar el plan** es una decisión del productor.

---

## Por qué los avisos van por correo y no por notificación push

**Decisión:** panel *Hoy / Esta semana / Atrasado* dentro de la app, más un
correo automático desde Apps Script con un disparador diario.

| Opción | Confiabilidad | Costo |
|---|---|---|
| Panel al abrir la app | Alta, pero exige abrir la app | Ninguno |
| **Correo automático desde Apps Script** | Alta, llega sin abrir nada | Ninguno |
| Notificación push real (VAPID) | Alta | Servidor propio y mantenimiento |

Una app web **no puede avisar sola en Android de forma confiable** sin un
servidor detrás. El correo cubre casi toda la necesidad sin infraestructura.
Push queda para más adelante si el piloto lo pide.

---

## Por qué la sugerencia de tratamiento es por reglas y no por inteligencia artificial

**Decisión:** reglas explícitas en un archivo de catálogo, legibles por
cualquiera.

```
plaga o enfermedad + cultivo + umbral de incidencia y severidad
        → tratamientos ordenados por prioridad
        → compatibilidad con el nivel de certificación
        → advertencias, carencia y condiciones de aplicación
```

Cualquier técnico del equipo puede leer una regla, discutirla y corregirla sin
tocar código, y siempre queda claro **por qué** la app sugirió lo que sugirió.
Con un modelo que "recomienda" sin poder explicarse, eso se pierde.

**Al programarlo, el esquema de arriba no se pudo cumplir tal cual, y está
bien.** La primera línea —comparar lo observado contra un umbral— supone que los
umbrales son números, y los de `datos/plagas.json` son frases. En varios casos la
frase dice justamente que no hay número: la mosca de la cebolla, *"no hay umbral
numérico estandarizado"*; los pulgones, *"no hay un número único para todas las
especies"*. Inventarlos para que el motor pudiera compararlos habría sido
fabricar precisión en una recomendación fitosanitaria, que es contra lo que
advierten los propios términos de uso.

Así que el Monitoreo hace algo más modesto: pone lo observado **al lado** del
umbral de la ficha, con sus mismas palabras, y deja la comparación donde puede
hacerse bien, que es en quien está parado en el cultivo. Lo que la app aporta no
es el fallo: es traer la ficha correcta al momento exacto, con la prevención
antes que el tratamiento —el orden que pide el protocolo del SPG—, con el estado
de cada preparado frente al sello, y con el registro ya hecho.

Si más adelante el equipo quiere umbrales numéricos propios, salidos de su
experiencia en la Comarca y no de la bibliografía, se agregan al catálogo y el
motor puede empezar a compararlos. Pero tienen que venir de alguien que los
sostenga, no del programa.

Y hay una razón más fuerte: una recomendación fitosanitaria equivocada tiene
consecuencias productivas y sanitarias reales. Por eso la app además:

1. Presenta la sugerencia como **orientativa**, nunca como prescripción.
2. Ofrece el contacto con el equipo de extensión en primer plano.
3. Registra de dónde salió cada plan de tratamiento, y deja lugar para que el
   técnico lo comente.
4. Marca de forma inequívoca lo **no admitido bajo sello ECOMARCAL**, para no
   empujar sin querer a un certificado fuera de su protocolo.

**El punto 3 decía antes "registra quién validó cada plan de tratamiento y
cuándo", y cambió al definirlo con el equipo.** La idea original era que un
tratamiento quedara en estado *Propuesto* hasta que un técnico lo firmara. Pero
eso pone al equipo de extensión como autoridad que habilita, y no es así como se
trabaja ni es lo que dicen los términos de uso: *"las decisiones de manejo son
tuyas, y también la responsabilidad por sus resultados"*.

Así que el productor arma el tratamiento y lo aplica, y el técnico lo ve en la
planilla de esa chacra y puede dejarle un comentario. Las columnas de la hoja
`Tratamientos` cambiaron de nombre para que digan eso: donde había *Validado
por* y *Validado el* ahora hay *Origen*, *Comentario del técnico*, *Comentado
por* y *Comentado el*. Una columna que dice "Validado por" y nunca se completa
no es un dato que falta: es un dato que miente sobre cómo se trabaja.

Lo que sí queda registrado es el **origen**: si el producto salió de la lista
que la app acercó a partir de la ficha, o si el productor lo eligió por su
cuenta. Esa diferencia importa para saber, más adelante, qué tanto se usó lo que
la app sugiere.

---

## Por qué el control de acceso está desde el primer día

**Decisión:** el servicio se escribió con invitación y credencial por teléfono
antes de existir la primera planilla.

En MonAgric el acceso se agregó después, y en el medio hubo un período en que
cualquiera con la dirección del servicio —que está en el código público— podía
leer los datos de todas las chacras, inventar registros o borrar la
configuración de una temporada. Se comprobó ejecutándolo.

En una app de certificación eso es más grave todavía: **inventar una aplicación
que nunca se hizo es falsificar un registro del que depende un sello.**

El modelo elegido y su operación están en [SEGURIDAD.md](SEGURIDAD.md). Las
alternativas que se descartaron, con el mismo razonamiento que en MonAgric:

| Opción | Por qué no |
|---|---|
| Una clave por chacra | Si una persona la filtra, se filtró para toda la chacra, y no se puede dar de baja a uno solo |
| Usuario y contraseña | Convierte al equipo técnico en soporte de contraseñas olvidadas, y no valida que quien se registra sea de la chacra |
| Entrar con Google | Identidad verificada de verdad, pero necesita un proyecto en Google Cloud y bastante más armado |

Ganó la invitación porque encaja con cómo se va a instalar de todos modos: el
técnico se sienta al lado del productor y escribe el código una vez.

---

## Por qué la app no carga nada de internet

**Decisión:** cero librerías, tipografías o imágenes externas. Todo viaja en el
teléfono.

Es lo que hace que funcione de verdad sin señal —que es el requisito principal—
y de paso permite declarar una política de contenido estricta: el navegador
rechaza cualquier cosa que no venga de la propia app.

**Lo que se resignó:** escribir a mano lo que una librería daría hecho. A cambio,
la app entera pesa menos que el logo de una sola tipografía web.

---

## Por qué la wiki viaja entera en el teléfono, fotos incluidas

**Decisión (18/08/2026):** todo se descarga y queda guardado. Texto y fotos.

La pregunta original era si convenía dejar la wiki online para que la app fuera
más liviana. La primera respuesta fue "el texto sí, las fotos bajo demanda",
sobre una estimación de cuánto pesaba una foto. **Esa estimación estaba mal.**
Al medirlo con fotos reales de plagas, a distintos anchos y formatos:

| Ancho | WebP q78 | AVIF q60 | JPEG q80 |
|---|---|---|---|
| 480 px | 18 KB | 15 KB | 26 KB |
| **900 px** | **43 KB** | 38 KB | 72 KB |
| 1400 px | 72 KB | 65 KB | 136 KB |

A 900 px en WebP una foto pesa 43 KB, no los 80 a 150 KB estimados. Con eso, la
biblioteca completa —unas 54 fichas con tres fotos cada una— entra en **7 MB**.
No hace falta partir nada.

**Formato: WebP a 900 px, calidad 78.** AVIF sale un 12 % más chico pero WebP
tiene soporte universal, y esa diferencia no justifica el riesgo. Los 900 px son
el ancho justo para verse nítida a pantalla completa en un celular de alta
densidad.

Y la razón de uso confirma la decisión: **el momento en que se necesita la wiki
es justo el peor momento de señal.** El productor camina el campo, ve una mancha
rara y quiere compararla con una foto. Ahí es donde una wiki online falla, y es
exactamente donde la foto hace el trabajo que el texto solo confirma.

**El techo es 8 MB.** El script `tools/preparar-fotos.py` avisa si se pasa. Si
alguna vez ocurre, ahí sí se parte: lo primero que pasaría a cargarse bajo
demanda son las fotos de los biopreparados, que se consultan en el galpón y con
señal, nunca las de plagas.

---

## Por qué la wiki tiene dos ejes y no uno

**Decisión:** *Enfermedades y plagas* por un lado y *Manejo y tratamientos* por
el otro, cruzados entre sí.

Son las dos maneras reales en que alguien llega a consultar: "veo algo raro en
el campo" y "qué preparo y cómo". Un único índice obliga a la mitad de las
consultas a entrar por la puerta equivocada.

El cruce se declara **una sola vez**, del lado de la plaga: cada ficha de plaga
lista los biopreparados que la controlan. La lista inversa —contra qué se usa
cada biopreparado— la calcula la app al mostrarla. Así no hay dos listas que
puedan quedar contradiciéndose cuando alguien corrige una sola.

---

## Por qué el service worker pide a la red y espera poco

**Decisión:** red primero, con tres segundos de paciencia, y caché de respaldo.

Las dos estrategias puras fallan acá:

- **Caché primero** deja a los teléfonos con la versión vieja para siempre,
  porque nunca vuelven a preguntar. Es lo que pasó en MonAgric.
- **Red primero sin límite** cuelga la app cuando hay señal débil, que en la
  Comarca es lo más común. Una señal mala es peor que ninguna: el teléfono
  espera en vez de rendirse.

Esperar unos segundos y seguir con lo guardado resuelve las dos: con buena señal
siempre llega lo último, con señal mala o nula la app abre igual.

---

## Por qué los campos numéricos son de texto

**Decisión:** `type="text"` con teclado numérico, y la conversión se hace en el
código.

Un `input type="number"` considera inválido "2,5" y deja el campo vacío **sin
avisar**. En el campo la gente escribe con coma, y también escribe "1.200" para
mil doscientos. Se recibe texto y se interpreta a la argentina: la coma es el
decimal y el punto separa miles.

Es una lección de MonAgric que costó tiempo descubrir, porque el síntoma —un
campo que se vacía solo— no se parece a la causa.

---

## Por qué todavía no hay licencia

**Decisión (16/08/2026):** el repositorio queda público y sin archivo LICENSE
hasta resolver la titularidad.

BioSalud se desarrolla en el marco del trabajo en el IFAB, así que es probable
que el titular sea el INTA, el CONICET o los dos, y no su autor. Elegir una
licencia es un acto de disposición sobre la obra: solo puede hacerlo el titular.

Un repositorio público sin licencia es "todos los derechos reservados". Acá eso
es **a propósito**: es la posición segura mientras se define. Poner una licencia
equivocada y tener que retirarla es peor, porque quien copió bajo esa licencia
conserva sus derechos.

La recomendación, cuando se destrabe, es AGPL-3.0. El razonamiento completo está
en [DERECHOS.md](DERECHOS.md).

---

## Por qué la wiki es la única sección que no espera a la configuración

**Decisión (18/08/2026):** la Info / Wiki se puede leer desde que se abre la app
por primera vez. El resto sigue bloqueado hasta cargar el establecimiento.

La regla original era que sin configuración no se activaba ningún botón, y para
las secciones de planificación y registro se mantiene: no se puede planificar una
aplicación sin saber qué sectores tiene la chacra.

Pero la wiki no necesita saber nada del establecimiento. Es material de lectura.
Bloquearla obligaba a cargar una chacra entera solo para poder mostrarle a
alguien de qué se trata, y le cerraba la puerta a un productor que todavía no se
decidió pero quiere leer cómo se hace un biofertilizante.

---

## Por qué la cuenta del cobre mira los litros de caldo y no la dosis

**Decisión:** para calcular cuánto cobre recibe un sector se pregunta cuántos
litros de caldo se preparan por aplicación, y no se interpreta la dosis.

El Anexo III de la Resolución 374/2016 admite los compuestos de cobre hasta 6 kg
de cobre por hectárea y por año, y el protocolo del SPG pide que el Consejo de
Garantía lleve ese acumulado por chacra y por temporada (ver
[SPG-ECOMARCAL.md](SPG-ECOMARCAL.md)). La app ya sabe qué se va a aplicar, dónde
y cada cuánto, así que estaba a un dato de poder llevar la cuenta sola.

Ese dato no podía ser la dosis. La dosis se escribe a mano —"25 %", "200 cc por
mochila", "puro"— y de ahí no sale un número confiable. Pero además no hace
falta: **el cobre entra una sola vez, con el sulfato, al preparar la tanda.**
Diluir después reparte el mismo cobre en más agua, no agrega ni saca un gramo.
Los litros de caldo preparados, en cambio, son un dato que el productor sabe
seguro, porque es el tamaño del tambor que llena.

**La cuenta es por sector y no por chacra**, porque el tope es por hectárea y
porque el cobre se acumula donde cae. Trescientos gramos son 15 kg por hectárea
en un invernadero de 200 m² y 600 g por hectárea en media hectárea de frutal: el
mismo número de un lado es un problema y del otro no.

**Se cuenta dos veces, y las dos hacen falta.** En el Plan, expandiendo la
recurrencia de cada renglón: es una proyección, y responde "si cumplo este plan,
¿me paso?", que es la pregunta que hay que hacerse en octubre y no en febrero. En
el Seguimiento, sumando lo que se marcó como aplicado: es el dato real, el que el
Consejo de Garantía necesita para firmar. Por eso `js/cobre.js` recibe una lista
plana de aplicaciones y no sabe de dónde salió: las dos cuentas son la misma
aritmética sobre orígenes distintos.

**Cuando el volumen no se anotó, se usa el previsto del plan y se avisa.** El
volumen aplicado es un campo opcional del registro, así que la cuenta real puede
quedar incompleta. Mezclar medido con supuesto sin decirlo sería peor que tener
menos precisión: la tarjeta dice en cuántas aplicaciones hizo falta suponer.

**Lo que esta cuenta todavía no ve:** un producto comercial con cobre cargado
como "otro producto que no está en la wiki". No tiene ficha, así que no tiene
cuánto cobre lleva.

---

## Por qué los términos se aceptan al activar el teléfono, y no al abrir la app

**Decisión:** la aceptación se pide justo antes de canjear el código de
invitación, y queda registrada en la fila de ese teléfono en la planilla de
accesos.

Activar es el momento en que los datos empiezan a salir del aparato. Antes de
eso no hay nada que consentir: todo lo que se carga se queda en el teléfono, y
una pantalla de términos al abrir la app por primera vez sería un trámite
delante de alguien que todavía no sabe si la va a usar. Atarlo a la activación
además lo vuelve verificable, porque el consentimiento es de una persona en un
teléfono —no de la chacra— y queda en la misma fila que registra ese teléfono.

**El control está en `js/envio.js` y no solo en la pantalla.** `canjear()` se
niega a activar si no hay términos aceptados, aunque alguien llegue por otro
camino.

**La versión aceptada lleva una huella del contenido.** No alcanza con guardar
"agosto de 2026": si mañana se corrige una frase y la etiqueta no cambia, no
habría forma de saber qué aceptó cada uno. La versión es `etiqueta · hash`, así
que mirando la planilla se distingue quién aceptó el texto vigente.

**El texto no se escribe dos veces.** `TERMINOS.md` es el documento
institucional, y `tools/generar-terminos.py` lo convierte a
`docs/datos/terminos.json`, que es lo que la app muestra. Un texto que alguien
acepta no puede tener dos versiones circulando. Es la misma idea que la cartilla
de biopreparados: una sola fuente, dos salidas.

**Si los términos cambian, se avisa pero no se bloquea.** La app dice que hay
una versión nueva y ofrece leerla, y sigue funcionando. Bloquear a un productor
por un cambio de redacción, en una app de uso obligatorio para el sello, sería
usar la certificación como palanca.

**La nota del borrador no se muestra.** La cita que abre `TERMINOS.md` está
dirigida a quien revisa el documento: habla de la app en tercera persona y
menciona archivos del repositorio. Viaja en el JSON como `nota_interna` para no
perder el rastro, pero en la app se muestra la etiqueta de versión, que dice lo
único que el productor necesita saber: que es una versión de prueba.

---

## Decisiones menores que conviene recordar

**El código de chacra lo asigna el equipo, no el productor.** Si cada uno
eligiera el suyo, dos podrían elegir el mismo y sus registros terminarían en la
misma planilla.

**El tipo de riego se pregunta en la configuración** aunque no se use todavía.
Define si en ese sector se puede aplicar por fertirriego, que es uno de los tres
métodos del plan. Preguntarlo después obligaría a que diez productores vuelvan a
entrar a corregir.

**La configuración se rechaza si viene vacía.** Se guarda entera cada vez, así
que una configuración a medio cargar borraría la buena. El servicio la rechaza y
además deja una copia oculta de la anterior.

**Los logos van sobre una franja blanca.** El del CONICET tiene las letras en
negro y el del INTA barras celestes: sobre verde desaparecen.

**El logo del IFAB reemplaza a los tres sueltos.** Ya es un conjunto que incluye
CONICET, INTA y la sigla del instituto. Cuatro logos en fila no entran en una
pantalla de 375 px.
