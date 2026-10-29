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
// Al abrir la app, antes de cargar nada. Durante un tiempo se pidió recién al
// activar el teléfono, con el argumento de que hasta entonces no hay nada que
// consentir porque todo se queda en el aparato. Era cierto y funcionaba mal: el
// productor cargaba el establecimiento y los sectores, al final aparecía el
// botón de los términos, y leerlos lo sacaba del formulario a medio llenar.
// Primero los términos y después la configuración es además el orden que ya
// conoce de cualquier otra app.
//
// La única pantalla que no los espera es la Info / Wiki: es material de lectura,
// no pide ni guarda nada del establecimiento, y alguien que todavía está
// decidiendo si entra al sello tiene que poder leer cómo se hace un
// biofertilizante sin aceptar nada.
//
// El control que de verdad cuida los datos sigue estando en el canje: sin
// términos aceptados el teléfono no se activa y nada sale de ahí (js/envio.js).
// Esta pantalla ordena el recorrido; ese es el candado.
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
    // Nunca aceptó nada: esta es la primera pantalla que ve de la app, y la
    // armazón no lo deja pasar de acá (js/app.js). Cambia lo que dice y, sobre
    // todo, la salida: "Ahora no" lo devolvería a la configuración, que vuelve
    // a mandarlo acá.
    const primeraVez = !aceptacion;

    destino.innerHTML = `
      ${primeraVez ? `<p class="aviso aviso--info"><strong>Antes de empezar.</strong>
        Lo que cargues queda guardado en tu teléfono y se envía a la planilla de
        tu chacra. Acá dice qué se guarda, quién lo puede ver y qué podés pedir
        que se borre.</p>` : ""}

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
        <button class="boton boton--secundario boton--ancho" id="btn-salir">Volver</button>`
      : primeraVez ? `
        <div class="tarjeta separado">
          <p>Para usar la app hace falta que aceptes estos términos. Si todavía
            estás conociendo la app, podés leer la <strong>Info / Wiki</strong>
            —las fichas de biopreparados y de plagas— sin aceptar nada.</p>
          <button class="boton boton--ancho" id="btn-aceptar">Acepto los términos</button>
          <button class="boton boton--secundario boton--ancho separado" id="btn-solo-wiki">
            Solo quiero leer la Info / Wiki</button>
        </div>`
      : `
        <div class="tarjeta separado">
          <p>Hasta que aceptes esta versión seguís usando la app con lo que
            aceptaste antes, pero conviene leer la nueva.</p>
          <button class="boton boton--ancho" id="btn-aceptar">Acepto los términos</button>
          <button class="boton--peligro centrado" id="btn-salir">Ahora no</button>
        </div>`}`;

    conectar();
    return {
      titulo: "Términos de uso",
      subtitulo: primeraVez ? "Antes de empezar" : "Versión " + datos.version,
    };
  }

  function fechaLarga(iso) {
    if (!iso) return "—";
    const [a, m, d] = String(iso).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
  }

  function conectar() {
    // Este botón solo existe cuando ya hay una aceptación, y en ese caso a los
    // términos se llega desde Configuración: ahí vuelve.
    const salir = destino.querySelector("#btn-salir");
    if (salir) salir.onclick = () => volverA("config");

    const soloWiki = destino.querySelector("#btn-solo-wiki");
    if (soloWiki) soloWiki.onclick = () => volverA("wiki");

    const aceptar = destino.querySelector("#btn-aceptar");
    if (aceptar) aceptar.onclick = async () => {
      const config = await window.BioDB.leerConfig();
      aceptacion = {
        version: datos.version,
        fecha: new Date().toISOString(),
        // En la primera vez todavía no hay configuración, así que no se sabe el
        // nombre: lo completa guardarPersona() cuando se guarde. El teléfono y
        // la fecha sí quedan desde el primer momento.
        persona: (config || {}).responsable || "",
        dispositivo: window.Acceso.dispositivo(),
      };
      await guardar();
      brindis("Términos aceptados");
      volverA(await dondeSeguir());
    };
  }

  const guardar = () => window.BioDB.guardar("config", {
    clave: CLAVE,
    valor: aceptacion,
    actualizado: new Date().toISOString(),
  });

  // Después de aceptar se abre la configuración, que es lo que sigue; si ya
  // estaba cargada, el inicio.
  async function dondeSeguir() {
    const config = await window.BioDB.leerConfig();
    return window.Config.completa(config) ? "inicio" : "config";
  }

  // Lo llama Configuración al guardar: la aceptación de la primera vez quedó
  // sin nombre porque todavía no había ninguno cargado, y una aceptación sin
  // quién la hizo sirve de poco.
  async function guardarPersona(nombre) {
    if (!nombre) return;
    await cargar();
    if (!aceptacion || aceptacion.persona) return;
    aceptacion.persona = nombre;
    await guardar();
  }

  return { render, estado, guardarPersona };
})();
