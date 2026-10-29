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
        Completá estos datos una sola vez. Hasta que estén cargados quedan
        bloqueadas las secciones de planificación y registro; la Info / Wiki se
        puede leer desde ahora.</p>`}

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

      ${completa(c) ? conexion() : ""}
    `;

    conectar();
    pintarConexion();
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

  // ---------- Conexión con la planilla de la chacra ----------
  //
  // Va al final y solo cuando la configuración está completa: antes de tener
  // establecimiento y sectores no hay nada que enviar.
  //
  // LOS DOS CÓDIGOS VAN JUNTOS, ACÁ.
  //
  // El de chacra estaba arriba, entre los datos del establecimiento, y el de
  // invitación acá abajo, separados por toda la carga de sectores. Son las dos
  // mitades de la misma credencial y se entregan juntos en la visita, así que
  // tenerlos en puntas opuestas de la pantalla no ayudaba a nadie: mezclaba lo
  // que carga el productor con lo que le da el equipo técnico, y hacía fácil
  // escribir uno y creer que ya estaba.
  //
  // La dirección del servicio solo aparece si la app no la trae cargada. Viaja
  // escrita en js/envio.js, así que el campo no le sirve al productor y dejarlo
  // a la vista solo invita a que alguien lo borre y se quede sin sincronizar
  // sin entender por qué.

  function conexion() {
    const c = borrador;
    return `
      <div class="tarjeta separado" id="caja-conexion">
        <h2>Conexión con el equipo técnico</h2>
        <p class="nota">Estos dos códigos te los da el equipo de extensión del
          IFAB, normalmente en la visita.</p>
        <p class="estado-envio" id="estado-envio">Verificando…</p>

        <div class="campo">
          <label for="f-codigo">Código de chacra
            <span class="ayuda">Dirige tus registros a la planilla de tu chacra. Es siempre el mismo y no cambia.</span></label>
          <input id="f-codigo" type="text" value="${esc(c.codigo)}" autocomplete="off"
                 spellcheck="false" placeholder="por ejemplo: laesperanza">
        </div>

        <div id="zona-activar"></div>

        <button class="boton--enlace centrado" id="btn-terminos">Términos de uso</button>

        ${window.Envio.hayServicio() ? "" : `
          <details class="grupo separado" id="avanzado">
            <summary class="grupo__cab">
              <span class="grupo__icono">🔧</span>
              <span class="grupo__texto">
                <span class="grupo__nombre">Dirección del servicio</span>
                <span class="grupo__cuenta">La carga el equipo técnico, una sola vez</span>
              </span>
              <span class="grupo__flecha" aria-hidden="true"></span>
            </summary>
            <div class="grupo__cuerpo">
              <div class="campo">
                <label for="f-servicio">Dirección que termina en /exec
                  <span class="ayuda">Sale de publicar el Apps Script.</span></label>
                <input id="f-servicio" type="url" autocomplete="off" spellcheck="false"
                       value="${esc(window.Envio.leerUrl())}"
                       placeholder="https://script.google.com/macros/s/…/exec">
              </div>
              <button class="boton boton--secundario boton--ancho" id="btn-servicio">Guardar dirección</button>
            </div>
          </details>`}
      </div>`;
  }

  async function pintarConexion() {
    const caja = destino.querySelector("#estado-envio");
    if (!caja) return;

    const e = await window.Envio.estado();
    const t = await window.Terminos.estado();
    caja.textContent = window.Envio.resumir(e);
    caja.className = "estado-envio " + (e.activado && e.conServicio ? "estado-envio--ok" : "estado-envio--espera");

    // El enlace a los términos está en todos los estados. Desde que se aceptan
    // al abrir la app, los paneles de abajo ya no tenían por qué nombrarlos, y
    // quien quisiera volver a leerlos se quedaba sin puerta.
    const enlace = destino.querySelector("#btn-terminos");
    if (enlace) {
      enlace.textContent = !t.aceptados ? "Leer y aceptar los términos de uso"
        : t.desactualizados ? "Los términos cambiaron: leerlos"
        : "Ver los términos que aceptaste";
    }

    const zona = destino.querySelector("#zona-activar");
    if (!zona) return;

    if (!e.conServicio) {
      zona.innerHTML = `<p class="nota">Cuando el servicio esté publicado, acá vas a
        poder activar este teléfono con el código que te dé el equipo técnico.
        Mientras tanto todo se guarda igual y se envía después.</p>`;
      conectarConexion();
      return;
    }

    if (e.activado) {
      zona.innerHTML = `
        <p class="nota">Este teléfono está activado. Si lo perdés, avisale al
          equipo para darlo de baja.</p>
        ${e.pendientes ? `<button class="boton boton--secundario boton--ancho" id="btn-enviar">
          Enviar ahora ${e.pendientes === 1 ? "el registro pendiente"
            : "los " + e.pendientes + " pendientes"}</button>` : ""}
        ${!t.aceptados ? `<p class="nota">Este teléfono se activó antes de
          que la app mostrara los términos de uso, así que no quedó registrada tu
          aceptación. Conviene leerlos y aceptarlos.</p>` : ""}`;
      conectarConexion();
      return;
    }

    // Los términos van antes del código de invitación, no después: activar es el
    // momento en que los datos empiezan a salir del teléfono. Ofrecer el campo y
    // rechazar el canje al final sería hacerle escribir el código para nada.
    if (!t.aceptados || t.desactualizados) {
      // La línea de estado se corrige acá y no en Envio.resumir(): ese no sabe
      // qué versión de los términos está vigente, solo si hay alguna aceptada.
      // Sin esto decía "cargá tu código de invitación" mientras el panel de
      // abajo pedía releer los términos: es la tercera vez que aparece la misma
      // incoherencia entre el estado de arriba y el panel de abajo, así que vale
      // la pena dejarla anotada.
      if (caja) {
        caja.textContent = t.desactualizados
          ? "Los términos de uso cambiaron: conviene leerlos de nuevo."
          : "Este teléfono todavía no está activado. Primero hay que aceptar los términos de uso.";
      }
      zona.innerHTML = `
        <p class="nota">${t.desactualizados
          ? "Los términos de uso cambiaron desde que los aceptaste."
          : "Antes de activar el teléfono hay que leer y aceptar los términos de uso."}
          Mientras tanto podés usar la app igual: todo se guarda en el teléfono.</p>
        <button class="boton boton--ancho" id="btn-terminos-ahora">
          ${t.desactualizados ? "Leer los términos nuevos" : "Leer los términos de uso"}</button>`;
      conectarConexion();
      return;
    }

    zona.innerHTML = `
      <div class="campo">
        <label for="f-invitacion">Código de invitación
          <span class="ayuda">Te lo da el equipo de extensión. Se usa una sola vez, en este teléfono.</span></label>
        <input id="f-invitacion" type="text" autocomplete="off" spellcheck="false"
               maxlength="12" placeholder="XXXX-XXXX">
        <span class="campo__error" id="error-invitacion"></span>
      </div>
      <button class="boton boton--ancho" id="btn-activar">Activar este teléfono</button>`;

    conectarConexion();
  }

  // El código de chacra se escribe arriba, entre los datos del establecimiento,
  // y el canje lo lee de lo GUARDADO, no de lo que hay en pantalla. Si alguien
  // lo tipea y baja derecho a activar —que es lo natural, porque los dos campos
  // están en la misma pantalla— el servicio recibía la chacra vacía y contestaba
  // "antes hay que cargar el código de chacra en la configuración", que es
  // justo lo que la persona acababa de hacer. Así que antes de canjear se
  // guarda lo tipeado.
  async function guardarLoTipeado() {
    leerCabecera();
    if (!completa(borrador)) return false;
    borrador.actualizado = new Date().toISOString();
    await window.BioDB.guardarConfig(borrador);
    await window.BioDB.encolarUnico("config", borrador);
    return true;
  }

  function conectarConexion() {
    const activar = destino.querySelector("#btn-activar");
    if (activar) activar.onclick = async () => {
      const campo = destino.querySelector("#f-invitacion");
      const aviso = destino.querySelector("#error-invitacion");
      aviso.textContent = "";
      activar.disabled = true;
      activar.textContent = "Activando…";

      await guardarLoTipeado();

      // Si de verdad falta, se dice dónde está el campo en vez de mandar a
      // "la configuración", que es esta misma pantalla.
      if (!borrador.codigo) {
        aviso.textContent = "Falta el código de chacra, más arriba en esta misma "
          + "pantalla. Escribilo y volvé a intentar.";
        activar.disabled = false;
        activar.textContent = "Activar este teléfono";
        const campoCodigo = destino.querySelector("#f-codigo");
        if (campoCodigo) campoCodigo.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const r = await window.Envio.canjear(campo.value);

      if (r.ok) {
        brindis(`Teléfono activado${r.persona ? " · " + r.persona : ""}`);
        await window.Envio.sincronizar(false);
        pintarConexion();
        return;
      }
      aviso.textContent = r.error;
      activar.disabled = false;
      activar.textContent = "Activar este teléfono";
    };

    // Irse a leer los términos destruye esta pantalla, y lo tipeado vive en el
    // DOM: sin guardar primero, al volver estaba todo en blanco. Pasó de verdad
    // —cargar el establecimiento entero, los sectores, ir a aceptar los términos
    // y encontrarse el formulario vacío— y es de los errores más caros que puede
    // cometer una app de campo: hace perder quince minutos de tipeo con una mano.
    destino.querySelectorAll("#btn-terminos, #btn-terminos-ahora").forEach((b) => {
      b.onclick = async () => {
        await guardarLoTipeado();
        location.hash = "#/terminos";
      };
    });

    const enviar = destino.querySelector("#btn-enviar");
    if (enviar) enviar.onclick = async () => {
      enviar.disabled = true;
      enviar.textContent = "Enviando…";
      await window.Envio.sincronizar(false);
      pintarConexion();
    };
  }

  // ---------- Eventos ----------

  function conectar() {
    const guardarServicio = destino.querySelector("#btn-servicio");
    if (guardarServicio) guardarServicio.onclick = () => {
      window.Envio.guardarUrl(valor("#f-servicio"));
      brindis("Dirección guardada");
      pintarConexion();
    };

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

    // El código de chacra vive en el bloque de conexión, que solo se dibuja
    // cuando la configuración está completa. Si el campo no está en pantalla hay
    // que dejar el guardado como está: leerlo igual lo borraría cada vez que se
    // agrega un sector con la configuración todavía a medio cargar.
    const campoCodigo = destino.querySelector("#f-codigo");
    if (campoCodigo) {
      borrador.codigo = String(campoCodigo.value || "").trim().toLowerCase().replace(/\s+/g, "");
    }
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
    // Los términos se aceptan al abrir la app, antes de que exista un nombre
    // cargado: la aceptación nació sin responsable y acá se completa.
    await window.Terminos.guardarPersona(borrador.responsable);

    brindis("Configuración guardada");
    if (alGuardar) alGuardar(borrador);
  }

  return { render, completa, superficieTotal, LOCALIDADES, CULTIVOS, RIEGOS, SITUACIONES };
})();
