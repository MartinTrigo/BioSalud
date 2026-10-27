// ==========================================================================
// BioSalud ECOMARCAL — términos de uso
//
// El texto no está acá: sale de datos/terminos.json, que se genera desde
// TERMINOS.md con tools/generar-terminos.py. Un texto que alguien acepta no
// puede tener dos versiones circulando, así que la app muestra exactamente el
// documento institucional y no una copia escrita aparte.
//
// CUÁNDO SE PIDE LA ACEPTACIÓN
//
// Antes de activar el teléfono, que es el momento en que los datos empiezan a
// salir del aparato. Antes de eso no hay nada que consentir: todo lo que se
// carga se queda en el teléfono. Atarlo a la activación también lo hace
// verificable, porque queda en la misma fila de la planilla de accesos que
// registra ese teléfono.
//
// QUÉ SE GUARDA
//
// La versión aceptada, la fecha, quién y desde qué teléfono. La versión lleva
// pegada una huella del contenido, así que se puede saber si alguien aceptó el
// texto vigente o uno anterior aunque la etiqueta no haya cambiado.
//
// Lo importante de este archivo no es la pantalla: es que la aceptación sea un
// hecho registrado y no una casilla que se marca y se olvida.
// ==========================================================================

window.Terminos = (function () {
  const { esc, brindis } = window.Util;

  const CLAVE = "terminos";

  let datos = null;        // datos/terminos.json
  let aceptacion = null;   // lo guardado en el teléfono
  let destino = null;
  let volverA = null;

  async function cargar() {
    if (!datos) datos = await (await fetch("datos/terminos.json")).json();
    const fila = await window.BioDB.obtener("config", CLAVE);
    aceptacion = fila ? fila.valor : null;
    return datos;
  }

  // Para que otras pantallas puedan preguntar sin dibujar nada.
  async function estado() {
    await cargar();
    return {
      version: datos.version,
      aceptados: !!aceptacion,
      // Aceptó, pero el texto cambió desde entonces.
      desactualizados: !!aceptacion && aceptacion.version !== datos.version,
      aceptacion: aceptacion,
    };
  }

  // Solo las negritas, y después de escapar: del documento no puede salir HTML.
  const conNegritas = (t) =>
    esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  function bloque(b) {
    if (b.tipo === "lista") {
      return `<ul class="lista">${b.items.map((i) => `<li>${conNegritas(i)}</li>`).join("")}</ul>`;
    }
    if (b.tipo === "numerada") {
      return `<ol class="pasos">${b.items.map((i) => `<li>${conNegritas(i)}</li>`).join("")}</ol>`;
    }
    return `<p>${conNegritas(b.texto)}</p>`;
  }

  async function render(contenedor, navegar) {
    destino = contenedor;
    volverA = navegar;

    destino.innerHTML = `<p class="cargando">Cargando los términos…</p>`;
    try {
      await cargar();
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudieron leer los términos.
        Si es la primera vez que abrís la app, hace falta señal una vez para que
        queden guardados en el teléfono.<br><br>Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Términos de uso", subtitulo: "Error" };
    }

    const yaEsta = !!aceptacion && aceptacion.version === datos.version;

    destino.innerHTML = `
      ${datos.etiqueta ? `<p class="aviso aviso--info"><strong>${esc(datos.etiqueta)}.</strong>
        Todavía no está aprobado por el equipo del IFAB ni acordado con la
        administración del sello: puede cambiar, y si cambia te vamos a avisar.</p>` : ""}

      ${yaEsta ? `<p class="aviso aviso--ok">Aceptaste esta versión el
        ${esc(fechaLarga(aceptacion.fecha))}${aceptacion.persona
          ? ", como " + esc(aceptacion.persona) : ""}.</p>` : ""}

      ${aceptacion && aceptacion.version !== datos.version ? `
        <p class="aviso aviso--info">Los términos cambiaron desde que los
          aceptaste. Esta es la versión nueva: conviene leerla y volver a
          aceptarla.</p>` : ""}

      ${datos.secciones.map((s) => `
        <div class="tarjeta terminos">
          ${s.titulo ? `<h2>${esc(s.titulo)}</h2>` : ""}
          ${s.bloques.map(bloque).join("")}
        </div>`).join("")}

      <p class="nota nota--pie">Versión ${esc(datos.version)}. Sale de
        TERMINOS.md, el documento del equipo del IFAB.</p>

      ${yaEsta ? `
        <button class="boton boton--secundario boton--ancho" id="btn-volver">Volver</button>`
      : `
        <div class="tarjeta separado">
          <p>Para activar tu teléfono y que tus registros lleguen a la planilla de
            tu chacra, hace falta que aceptes estos términos. Mientras tanto podés
            usar la app igual: todo se guarda en el teléfono.</p>
          <button class="boton boton--ancho" id="btn-aceptar">Acepto los términos</button>
          <button class="boton--peligro centrado" id="btn-volver">Ahora no</button>
        </div>`}`;

    conectar();
    return { titulo: "Términos de uso", subtitulo: "Versión " + datos.version };
  }

  function fechaLarga(iso) {
    if (!iso) return "—";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }

  function conectar() {
    const volver = destino.querySelector("#btn-volver");
    if (volver) volver.onclick = () => volverA("config");

    const aceptar = destino.querySelector("#btn-aceptar");
    if (aceptar) aceptar.onclick = async () => {
      const config = await window.BioDB.leerConfig();
      aceptacion = {
        version: datos.version,
        fecha: new Date().toISOString(),
        persona: (config || {}).responsable || "",
        dispositivo: window.Acceso.dispositivo(),
      };
      await window.BioDB.guardar("config", {
        clave: CLAVE,
        valor: aceptacion,
        actualizado: aceptacion.fecha,
      });
      brindis("Términos aceptados");
      volverA("config");
    };
  }

  return { render, estado };
})();
