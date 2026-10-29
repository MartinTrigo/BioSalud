# Derechos de autor, marcas y datos

Qué hay que resolver antes de que BioSalud crezca, y en qué orden.

> Esto es una guía de trabajo escrita por quienes desarrollamos la app, no un
> dictamen legal. Cada punto marcado como **consultar** tiene que pasar por el
> área correspondiente del INTA y del CONICET antes de darse por cerrado.

---

## 1. La diferencia con MonAgric, y por qué importa

MonAgric es un desarrollo personal de Martín, hecho desde su chacra. Por eso
pudo licenciarlo como quiso: puso AGPL-3.0 y listo.

**BioSalud no es lo mismo.** Se desarrolla en el marco del trabajo como agente
de extensión del IFAB, para una agencia del INTA y el CONICET, y para un sello
de certificación que administra un tercero. Eso cambia quién es el titular.

La Ley 11.723 de Propiedad Intelectual, en su artículo 4 inciso d) —incorporado
por la Ley 25.036, que sumó el software a la ley— dice que cuando alguien
produce un programa **en el desempeño de sus funciones laborales**, el titular
del derecho es el empleador, salvo que se haya pactado otra cosa.

Traducido: **es muy probable que BioSalud no sea de Martín, sino del INTA, del
CONICET, o de los dos.** Y como el IFAB es una unidad de doble dependencia, lo
más probable es que sea de los dos, lo que hay que resolver explícitamente.

**Consecuencia práctica: no se puede poner una licencia todavía.** Elegir una
licencia es un acto de disposición sobre la obra, y solo lo puede hacer quien es
titular.

### Por qué hoy no hay archivo LICENSE, y está bien así

Un repositorio público **sin** archivo de licencia significa "todos los derechos
reservados": está a la vista, pero legalmente nadie puede copiarlo ni
redistribuirlo.

En MonAgric eso pasó por descuido y era lo contrario de lo buscado. Acá es a
propósito: **es la posición segura mientras se define la titularidad.** Poner una
licencia equivocada y después tener que retirarla es mucho peor, porque quien ya
copió bajo esa licencia conserva sus derechos.

---

## 2. Los logos no son nuestros

En la cabecera de la app están los logos de **IFAB, CONICET, INTA** y el sello
**ECOMARCAL**. Son marcas institucionales, cada una con su titular y su manual
de uso.

Que Martín trabaje en el IFAB no alcanza para usar los logos en un producto que
se distribuye: eso normalmente requiere autorización del área de comunicación
institucional de cada organismo.

El caso de **ECOMARCAL** es el más delicado. Es una marca de certificación de un
tercero, y la app lleva su nombre. Que la app se llame "BioSalud ECOMARCAL" y
que los productores certificados estén **obligados** a usarla la vuelve, en los
hechos, una herramienta del sello. Eso tiene que estar acordado por escrito con
quien administra ECOMARCAL, no darse por supuesto.

**Consultar:** comunicación institucional de INTA y de CONICET, y la
administración de ECOMARCAL.

---

## 3. Los datos de los productores

Acá hay una obligación legal concreta, distinta del derecho de autor.

La app va a guardar nombre del responsable, teléfono o correo, ubicación del
establecimiento y su actividad productiva. Eso son **datos personales** en los
términos de la Ley 25.326.

Además, la información de sanidad —qué plaga apareció en qué chacra, qué se
aplicó— es **sensible desde el punto de vista comercial**: si se filtrara, puede
afectar la reputación de un productor o el valor de su producción. No es un dato
personal sensible en el sentido legal, pero merece el mismo cuidado.

Puntos a resolver:

- **Registro de la base de datos.** Las bases del sector público tienen que
  inscribirse ante la Agencia de Acceso a la Información Pública. **Consultar**
  si esta queda comprendida y quién la inscribe.
- **Consentimiento informado.** El productor tiene que saber qué se guarda, dónde
  y quién lo ve, y aceptarlo. Para eso está [TERMINOS.md](TERMINOS.md), que en la
  fase 4 se muestra dentro de la app.
- **Uso en investigación.** Si estos datos alimentan una publicación, va agregado
  y anónimo, y avisado antes. Está escrito en los términos.
- **Dónde viven.** Desde el 29/10/2026, en una cuenta de Google registrada para
  la app (`biosalud.inta@gmail.com`), no en el Drive personal de Martín. Ver
  [MIGRACION-DRIVE.md](MIGRACION-DRIVE.md). **Eso resuelve la mitad del
  problema**: los datos de diez chacras ya no están mezclados con los de una
  persona. Pero una cuenta de Gmail propia **no es una cuenta institucional**,
  aunque diga `inta`: sigue dependiendo de quién tenga la contraseña, y si mañana
  Martín cambia de rol el problema vuelve. Queda pendiente migrar a una cuenta del
  INTA o del CONICET y dejarlo asentado.

Lo que ya no se puede postergar es lo otro: antes de mudar a una cuenta
institucional hay que saber **si incluye Google Workspace**, porque todo el
backend es Apps Script sobre Sheets y en Microsoft no existe Apps Script.

---

## 4. El contenido de la wiki

La wiki de la fase 6 es una obra distinta del código, con sus propias reglas.

En `bibliografía/` hay material de terceros: las fichas de FAO sobre
biopreparados, los *Apuntes de Patología Vegetal* de Rivera y Wright, las fichas
de plagas hortícolas de Milpa. **Sirven para estudiar y citar, no para copiar.**

- El texto de cada ficha se **redacta de nuevo**, con la fuente citada al pie.
- Las fotos y dibujos son lo más riesgoso: una imagen no se puede "redactar de
  nuevo". Se usan solo las propias, las de INTA, o las que tengan licencia libre
  con la atribución que pida.
- Por eso `bibliografía/` está excluida del repositorio: el repositorio es
  público y redistribuir esos PDF no corresponde.

Escrita así, la wiki es **obra original nuestra** y puede licenciarse aparte del
código, por ejemplo con Creative Commons, que para textos y fotos sí es lo
adecuado. Para el código no lo es: la propia Creative Commons desaconseja usar
sus licencias para software.

---

## 5. Quiénes son los autores

Conviene anotarlo **ahora**, mientras es fácil. Reconstruir después quién aportó
qué es incómodo y suele terminar en que alguien queda afuera.

Va en un archivo `AUTORES.md` con nombre, rol y período. Cuentan la programación,
pero también el diseño de las fichas técnicas, la validación de las reglas de
tratamiento y las pruebas en campo con los productores.

Importa por dos razones: es un antecedente para quienes participan, y si alguna
vez hay que relicenciar la obra hace falta el acuerdo de todos los titulares.

---

## 6. Qué licencia, cuando se pueda

Cuando la titularidad esté resuelta, la recomendación es **AGPL-3.0** para el
código, igual que MonAgric:

- Es copyleft: cualquiera puede copiarla y mejorarla, con la condición de que
  las mejoras también queden libres. Encaja con que sea un desarrollo público.
- Es **AGPL** y no GPL porque BioSalud es una aplicación web. Con GPL, alguien
  podría tomar el código, mejorarlo y ofrecerlo como servicio sin publicar sus
  cambios, porque nunca "distribuye" el programa. AGPL cierra ese hueco.
- No impide cobrar más adelante: el titular puede licenciar la misma obra
  también de forma comercial.

Y hay una razón que pesa especialmente acá: **los productores están obligados a
usar esta app para conservar su sello.** Una herramienta de uso obligatorio no
debería depender de que una sola persona la siga manteniendo. Con el código
libre, si mañana Martín cambia de rol, cualquiera con conocimientos puede
continuarla y ninguna chacra queda a la intemperie.

---

## 7. Por dónde empezar

De más urgente a menos, y de más fácil a más lento:

| # | Qué | Quién | Cuándo |
|---|---|---|---|
| 1 | Mover las planillas a una cuenta **institucional**, y antes averiguar si incluye Google Workspace | Martín | Antes del piloto. El 29/10 se mudaron a una cuenta propia de la app, que no es institucional |
| 2 | Escribir `AUTORES.md` | Martín | Ya |
| 3 | Revisar y aprobar [TERMINOS.md](TERMINOS.md) | Equipo IFAB | Antes del piloto |
| 4 | Acuerdo por escrito con ECOMARCAL sobre el uso de la marca | IFAB + ECOMARCAL | Antes del piloto |
| 5 | Consultar titularidad y licencia | Vinculación tecnológica de INTA y CONICET | Antes de licenciar |
| 6 | Autorización de uso de logos | Comunicación de INTA y CONICET | Antes de difundir |
| 7 | Consultar registro de la base ante la AAIP | Legales del organismo | Antes del piloto |
| 8 | Registrar la obra en la DNDA | Según lo que digan en el 5 | Después del 5 |

Los puntos 1 y 2 no dependen de nadie más y se pueden hacer esta semana. El 5 es
el que destraba todo lo demás, así que conviene iniciarlo temprano aunque tarde:
en los organismos públicos estas consultas llevan tiempo, y mientras tanto el
desarrollo puede seguir sin problema con el repositorio como está.
