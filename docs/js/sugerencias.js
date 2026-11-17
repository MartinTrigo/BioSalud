// ==========================================================================
// BioSalud ECOMARCAL — sugerencias desde el inicio
//
// Un cuadro para que quien usa la app cuente qué mejoraría o qué no anda, sin
// tener que buscar el teléfono del técnico ni acordarse después.
//
// VIAJA POR LA MISMA COLA QUE TODO LO DEMÁS.
// Se escribe muchas veces justo en el campo, donde no hay señal. Así queda
// guardada en el teléfono y sale sola cuando hay conexión, igual que un
// monitoreo. En el servicio no va a la planilla de la chacra sino a la hoja
// "Sugerencias" de la planilla de accesos, donde el equipo las lee todas juntas.
//
// No es un <dialog> nativo a propósito: Safari lo tiene recién desde 2022 y la
// app tiene que andar en el peor celular. Es una capa propia, con lo mínimo de
// accesibilidad: rol de diálogo, foco adentro y Escape para cerrar.
// ==========================================================================

window.Sugerencias = (function () {
  const TIPOS = ["Una mejora", "Algo no funciona", "Otra cosa"];
  const LARGO_MAXIMO = 2000;

  let capa = null;
  let foco = null;     // lo que tenía el foco antes de abrir, para devolvérselo

  function abrir() {
    if (capa) return;
    foco = document.activeElement;

    capa = document.createElement("div");
    capa.className = "capa";
    capa.innerHTML = `
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="sug-titulo">
        <h2 id="sug-titulo">💬 Enviar una sugerencia</h2>
        <p class="nota">Contanos qué mejorarías o qué no anda bien. Lo lee el
          equipo técnico. Si no hay señal, queda guardada y se envía sola.</p>

        <div class="campo">
          <label for="sug-tipo">¿Qué querés contar?</label>
          <select id="sug-tipo">
            ${TIPOS.map((t) => `<option>${t}</option>`).join("")}
          </select>
        </div>

        <div class="campo">
          <label for="sug-texto">Tu comentario</label>
          <textarea id="sug-texto" rows="5" maxlength="${LARGO_MAXIMO}"
            placeholder="Por ejemplo: en el monitoreo me gustaría poder…"></textarea>
          <span class="campo__error" id="sug-error" hidden>Escribí algo antes de enviar.</span>
        </div>

        <div class="dialogo__botones">
          <button class="boton boton--secundario" id="sug-cancelar" type="button">Cancelar</button>
          <button class="boton" id="sug-enviar" type="button">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(capa);
    document.body.classList.add("con-capa");

    const texto = capa.querySelector("#sug-texto");
    texto.focus();

    capa.querySelector("#sug-cancelar").onclick = cerrar;
    capa.querySelector("#sug-enviar").onclick = enviar;
    // Tocar fuera del recuadro cierra solo si no se escribió nada: con guantes
    // es fácil rozar el borde y perder un párrafo.
    capa.addEventListener("click", (e) => {
      if (e.target === capa && !texto.value.trim()) cerrar();
    });
    capa.addEventListener("keydown", teclado);
  }

  function teclado(e) {
    if (e.key === "Escape") { cerrar(); return; }
    if (e.key !== "Tab") return;
    // El foco da la vuelta dentro del cuadro en vez de escaparse a la página de atrás.
    const enfocables = capa.querySelectorAll("select, textarea, button");
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) { ultimo.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { primero.focus(); e.preventDefault(); }
  }

  function cerrar() {
    if (!capa) return;
    capa.remove();
    capa = null;
    document.body.classList.remove("con-capa");
    if (foco && foco.focus) { try { foco.focus(); } catch (e) { /* ya no está */ } }
  }

  async function enviar() {
    const texto = capa.querySelector("#sug-texto");
    const comentario = texto.value.trim();
    const error = capa.querySelector("#sug-error");
    if (!comentario) {
      error.hidden = false;
      texto.classList.add("mal");
      texto.focus();
      return;
    }

    const boton = capa.querySelector("#sug-enviar");
    boton.disabled = true;

    try {
      const config = await window.BioDB.leerConfig();
      const version = document.getElementById("pie-version");
      await window.BioDB.encolar("sugerencia", {
        fecha: window.Util.fechaISO(new Date()),
        tipo: capa.querySelector("#sug-tipo").value,
        comentario: comentario.slice(0, LARGO_MAXIMO),
        persona: (config && config.responsable) || "",
        establecimiento: (config && config.nombre) || "",
        version: version ? version.textContent : "",
      });
    } catch (err) {
      boton.disabled = false;
      window.Util.brindis("No se pudo guardar la sugerencia en el teléfono.");
      return;
    }

    cerrar();
    window.Util.brindis("¡Gracias! Tu sugerencia quedó guardada.");
    // Si hay señal y el teléfono está activado, sale ahora; si no, cuando se pueda.
    window.Envio.sincronizar();
  }

  return { abrir, cerrar };
})();
