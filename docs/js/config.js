// ==========================================================================
// BioSalud ECOMARCAL — Configuración del establecimiento
//
// Es lo primero que hace el productor y lo único habilitado hasta que esté
// completa: sin saber qué sectores tiene la chacra, no se puede armar un plan
// de aplicaciones ni registrar un monitoreo.
// ==========================================================================

window.Config = (function () {
  const { esc, brindis, numero, aNumero, superficie } = window.Util;

  const LOCALIDADES = [
    "El Bolsón", "Mallín Ahogado", "Lago Puelo", "El Hoyo",
    "Epuyén", "Cholila", "El Manso",
  ];

  const CULTIVOS = ["Hortícola", "Frutícola", "Grano", "Aromáticas", "Otros"];

  // El tipo de riego decide con qué se puede aplicar cada producto: por
  // fertirriego solo sirve donde hay goteo o microaspersión.
  const RIEGOS = ["Goteo", "Microaspersión", "Aspersión", "Manta o surco", "Sin riego"];

  const SITUACIONES = [
    "Certificado ECOMARCAL",
    "En proceso de certificación",
    "En transición agroecológica",
    "Sin certificar",
  ];

  let borrador = null;    // lo que se está editando en pantalla
  let editando = null;    // id del sector en edición, o null si se está agregando
  let errores = {};
  let destino = null;
  let alGuardar = null;

  function nueva() {
    return {
      nombre: "", localidad: "", responsable: "", contacto: "",
      codigo: "", situacion: "", sectores: [],
    };
  }

  // La app se desbloquea recién cuando hay establecimiento, localidad,
  // responsable y al menos un sector cargado.
  function completa(cfg) {
    return !!(cfg && cfg.nombre && cfg.localidad && cfg.responsable
              && cfg.sectores && cfg.sectores.length);
  }

  function superficieTotal(cfg) {
    return (cfg.sectores || []).reduce((suma, s) => suma + (Number(s.superficie) || 0), 0);
  }

  // ---------- Pantalla ----------

  async function render(contenedor, cuandoGuarde) {
    destino = contenedor;
    alGuardar = cuandoGuarde;
    errores = {};
    editando = null;
    const guardada = await window.BioDB.leerConfig();
    borrador = guardada ? JSON.parse(JSON.stringify(guardada)) : nueva();
    pintar();
  }

  function opciones(lista, elegido, vacio) {
    const primera = `<option value="">${esc(vacio)}</option>`;
    return primera + lista.map((v) =>
      `<option value="${esc(v)}"${v === elegido ? " selected" : ""}>${esc(v)}</option>`
    ).join("");
  }

  function error(campo) {
    return errores[campo] ? `<span class="campo__error">${esc(errores[campo])}</span>` : "";
  }

  const mal = (campo) => (errores[campo] ? " mal" : "");

  function pintar() {
    const c = borrador;
    const enEdicion = editando ? c.sectores.find((s) => s.id === editando) : null;
    const s = enEdicion || {};

    destino.innerHTML = `
      ${completa(c) ? "" : `<p class="aviso aviso--info">
        Completá estos datos una sola vez. Hasta que estén cargados, el resto de
        las secciones queda bloqueado.</p>`}

      <div class="tarjeta">
        <h2>Datos del establecimiento</h2>

        <div class="campo">
          <label for="f-nombre">Nombre del establecimiento</label>
          <input id="f-nombre" class="${mal("nombre")}" type="text" value="${esc(c.nombre)}"
                 autocomplete="off" placeholder="Chacra La Esperanza">
          ${error("nombre")}
        </div>

        <div class="campo">
          <label for="f-localidad">Localidad</label>
          <select id="f-localidad" class="${mal("localidad")}">
            ${opciones(LOCALIDADES, c.localidad, "Elegí una localidad…")}
          </select>
          ${error("localidad")}
        </div>

        <div class="campo">
          <label for="f-responsable">Responsable de las aplicaciones</label>
          <input id="f-responsable" class="${mal("responsable")}" type="text"
                 value="${esc(c.responsable)}" autocomplete="off" placeholder="Nombre y apellido">
          ${error("responsable")}
        </div>

        <div class="campo">
          <label for="f-contacto">Teléfono o correo <span class="ayuda">Para que el equipo técnico pueda contactarte ante un aviso de plaga o enfermedad.</span></label>
          <input id="f-contacto" type="text" value="${esc(c.contacto)}" autocomplete="off">
        </div>

        <div class="campo">
          <label for="f-situacion">Situación ante el sello ECOMARCAL</label>
          <select id="f-situacion">${opciones(SITUACIONES, c.situacion, "Elegí una opción…")}</select>
        </div>

        <div class="campo">
          <label for="f-codigo">Código de chacra <span class="ayuda">Te lo da el equipo de extensión del IFAB. Es lo que dirige tus registros a la planilla de tu chacra. Si todavía no lo tenés, dejalo vacío.</span></label>
          <input id="f-codigo" type="text" value="${esc(c.codigo)}" autocomplete="off"
                 spellcheck="false" placeholder="por ejemplo: laesperanza">
        </div>
      </div>

      <div class="tarjeta">
        <h2>Sectores de riego</h2>
        <p class="nota">Cargá un sector por vez, con su superficie y qué se cultiva ahí.
          Después vas a poder planificar y registrar aplicaciones sector por sector.</p>
        ${error("sectores")}

        ${c.sectores.length ? `
          <ul class="sectores">
            ${c.sectores.map(filaSector).join("")}
          </ul>
          <p class="nota"><strong>${c.sectores.length}</strong>
            ${c.sectores.length === 1 ? "sector" : "sectores"} ·
            <strong>${superficie(superficieTotal(c))}</strong> en total</p>
        ` : `<p class="vacio">Todavía no cargaste ningún sector.</p>`}

        <h2 class="separado">${enEdicion ? "Editar sector " + esc(enEdicion.nombre) : "Agregar un sector"}</h2>

        <div class="fila">
          <div class="campo">
            <label for="f-sector">Sector</label>
            <input id="f-sector" class="${mal("sector")}" type="text" value="${esc(s.nombre || siguienteNombre())}"
                   autocomplete="off" maxlength="24">
            ${error("sector")}
          </div>
          <div class="campo">
            <label for="f-superficie">Superficie (m²)</label>
            <input id="f-superficie" class="${mal("superficie")}" type="text" inputmode="decimal"
                   value="${esc(s.superficie || "")}" placeholder="1000">
            ${error("superficie")}
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="f-bancales">Bancales <span class="ayuda">Opcional</span></label>
            <input id="f-bancales" class="${mal("bancales")}" type="text" inputmode="numeric"
                   value="${esc(s.bancales || "")}" placeholder="8">
            ${error("bancales")}
          </div>
          <div class="campo">
            <label for="f-cultivo">Tipo de cultivo</label>
            <select id="f-cultivo" class="${mal("cultivo")}">
              ${opciones(CULTIVOS, s.cultivo, "Elegí…")}
            </select>
            ${error("cultivo")}
          </div>
        </div>

        <div class="campo">
          <label for="f-riego">Tipo de riego <span class="ayuda">Opcional. Define si en ese sector se puede aplicar por fertirriego.</span></label>
          <select id="f-riego">${opciones(RIEGOS, s.riego, "Elegí…")}</select>
        </div>

        <button class="boton boton--secundario boton--ancho" id="btn-sector">
          ${enEdicion ? "Guardar cambios del sector" : "Agregar sector"}
        </button>
        ${enEdicion ? `<button class="boton--peligro centrado"
                        id="btn-cancelar-sector">Cancelar edición</button>` : ""}
      </div>

      <button class="boton boton--ancho" id="btn-guardar">Guardar configuración</button>
    `;

    conectar();
  }

  function filaSector(s) {
    const detalle = [
      superficie(s.superficie),
      s.bancales ? `${numero(s.bancales)} ${s.bancales == 1 ? "bancal" : "bancales"}` : null,
      s.cultivo,
      s.riego && s.riego !== "Sin riego" ? "riego por " + s.riego.toLowerCase() : null,
    ].filter(Boolean).join(" · ");

    return `
      <li class="sector">
        <span class="sector__datos">
          <span class="sector__nombre">${esc(s.nombre)}</span>
          <span class="sector__detalle">${esc(detalle)}</span>
        </span>
        <button class="boton--peligro boton--editar" data-editar="${esc(s.id)}"
                aria-label="Editar sector ${esc(s.nombre)}">Editar</button>
        <button class="boton--peligro" data-borrar="${esc(s.id)}" aria-label="Borrar sector ${esc(s.nombre)}">Borrar</button>
      </li>`;
  }

  // Propone A, B, C… saltando las letras que ya se usaron.
  function siguienteNombre() {
    const usados = new Set(borrador.sectores.map((s) => s.nombre.trim().toUpperCase()));
    for (let i = 0; i < 26; i++) {
      const letra = String.fromCharCode(65 + i);
      if (!usados.has(letra)) return letra;
    }
    return "";
  }

  // ---------- Eventos ----------

  function conectar() {
    destino.querySelector("#btn-sector").onclick = guardarSector;
    destino.querySelector("#btn-guardar").onclick = guardarTodo;

    const cancelar = destino.querySelector("#btn-cancelar-sector");
    if (cancelar) cancelar.onclick = () => { leerCabecera(); editando = null; errores = {}; pintar(); };

    destino.querySelectorAll("[data-editar]").forEach((b) => {
      b.onclick = () => { leerCabecera(); editando = b.dataset.editar; errores = {}; pintar(); };
    });

    destino.querySelectorAll("[data-borrar]").forEach((b) => {
      b.onclick = () => {
        const sector = borrador.sectores.find((s) => s.id === b.dataset.borrar);
        if (!confirm(`¿Borrar el sector ${sector.nombre}?`)) return;
        leerCabecera();
        borrador.sectores = borrador.sectores.filter((s) => s.id !== b.dataset.borrar);
        if (editando === b.dataset.borrar) editando = null;
        errores = {};
        pintar();
      };
    });
  }

  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  // Guarda en el borrador lo tipeado arriba, para que no se pierda al repintar.
  function leerCabecera() {
    borrador.nombre = valor("#f-nombre").trim();
    borrador.localidad = valor("#f-localidad");
    borrador.responsable = valor("#f-responsable").trim();
    borrador.contacto = valor("#f-contacto").trim();
    borrador.situacion = valor("#f-situacion");
    borrador.codigo = valor("#f-codigo").trim().toLowerCase().replace(/\s+/g, "");
  }

  function guardarSector() {
    leerCabecera();
    errores = {};

    const nombre = valor("#f-sector").trim();
    const sup = aNumero(valor("#f-superficie"));
    const textoBancales = valor("#f-bancales").trim();
    const bancales = textoBancales ? aNumero(textoBancales) : 0;
    const cultivo = valor("#f-cultivo");

    if (!nombre) errores.sector = "Poné un nombre o letra para el sector.";
    else if (borrador.sectores.some((s) => s.id !== editando
             && s.nombre.trim().toUpperCase() === nombre.toUpperCase())) {
      errores.sector = "Ya hay un sector con ese nombre.";
    }
    if (Number.isNaN(sup)) errores.superficie = "La superficie tiene que ser un número. Por ejemplo: 1200";
    else if (sup <= 0) errores.superficie = "Indicá la superficie en metros cuadrados.";
    if (textoBancales && (Number.isNaN(bancales) || bancales <= 0)) {
      errores.bancales = "Poné cuántos bancales, o dejalo vacío.";
    }
    if (!cultivo) errores.cultivo = "Elegí el tipo de cultivo.";

    if (Object.keys(errores).length) { pintar(); return; }

    const datos = {
      nombre: nombre,
      superficie: sup,
      bancales: bancales > 0 ? bancales : null,
      cultivo: cultivo,
      riego: valor("#f-riego"),
    };

    if (editando) {
      const i = borrador.sectores.findIndex((s) => s.id === editando);
      borrador.sectores[i] = Object.assign({}, borrador.sectores[i], datos);
      editando = null;
      brindis(`Sector ${datos.nombre} actualizado`);
    } else {
      borrador.sectores.push(Object.assign({ id: window.BioDB.nuevoId() }, datos));
      brindis(`Sector ${datos.nombre} agregado`);
    }

    pintar();
    destino.querySelector("#f-sector").focus();
  }

  async function guardarTodo() {
    leerCabecera();
    errores = {};

    if (!borrador.nombre) errores.nombre = "Escribí el nombre del establecimiento.";
    if (!borrador.localidad) errores.localidad = "Elegí la localidad.";
    if (!borrador.responsable) errores.responsable = "Escribí quién es responsable de las aplicaciones.";
    if (!borrador.sectores.length) errores.sectores = "Cargá al menos un sector de riego antes de guardar.";

    if (Object.keys(errores).length) {
      pintar();
      const primero = destino.querySelector(".mal, .campo__error");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    borrador.actualizado = new Date().toISOString();
    await window.BioDB.guardarConfig(borrador);
    // Queda en la cola para subir a la planilla de la chacra cuando haya
    // conexión. Reemplaza cualquier versión anterior que no se haya enviado.
    await window.BioDB.encolarUnico("config", borrador);

    brindis("Configuración guardada");
    if (alGuardar) alGuardar(borrador);
  }

  return { render, completa, superficieTotal, LOCALIDADES, CULTIVOS, RIEGOS, SITUACIONES };
})();
