// ==========================================================================
// BioSalud ECOMARCAL — Registrar una aplicación fuera del plan
//
// POR QUÉ HACE FALTA
//
// El plan dice lo que se va a aplicar y el tratamiento armado desde un
// monitoreo dice lo que la app sugirió. Pero en el campo pasa una tercera cosa,
// y pasa seguido: aparecen pulgones y polilla de la col, el preparado de ajo y
// ají que sugiere la ficha no está hecho, y el productor actúa con lo que tiene
// a mano —un bioinsumo comercial, trichoderma, tierra de diatomeas—. Esa
// decisión era imposible de registrar, y lo que no se registra no se puede
// mirar después: ni las fechas, ni la frecuencia, ni si el problema retrocedió.
//
// QUÉ SE PUEDE REGISTRAR
//
// Cualquier producto, escrito a mano. Se pide el tipo (biopreparado casero,
// bioinsumo comercial, mineral, químico de síntesis) porque es lo que después
// permite leer la planilla: cuánto de lo aplicado fue de la chacra y cuánto
// comprado, y en qué momentos se recurrió a qué.
//
// LOS QUÍMICOS TAMBIÉN
//
// El sello no los admite, y la app lo dice. Pero no los esconde: si alguien
// aplicó un producto de síntesis, que quede registrado es lo que permite
// acompañar la transición. Una app que solo acepta lo correcto enseña a no
// anotar lo otro, y entonces el técnico pierde justo el dato que necesita.
//
// CÓMO SE ATA AL PROBLEMA
//
// El "para qué" ofrece los problemas que se registraron en Monitoreo. Elegir
// uno guarda su clave (ver js/problemas.js), y desde ahí la aplicación aparece
// en la línea de tiempo del problema, entre el monitoreo de antes y el de
// después. Si el problema todavía no se registró, la app lo pide primero: es el
// punto de partida contra el que se va a comparar.
//
// UN REGISTRO POR SECTOR
//
// Igual que las aplicaciones del plan. Así la cuenta del cobre, que es por
// sector, funciona sin cambios, y la planilla queda con una fila por lugar.
// ==========================================================================

window.Aplicacion = (function () {
  const { esc, brindis, aNumero, superficie, hoy } = window.Util;

  const TIPOS = [
    { id: "casero", nombre: "Biopreparado casero",
      ayuda: "Hecho en la chacra: los de la wiki u otros." },
    { id: "comercial", nombre: "Bioinsumo comercial",
      ayuda: "Comprado: InsectBio, Trichoderma, Bacillus thuringiensis, Beauveria…" },
    { id: "mineral", nombre: "Mineral o natural",
      ayuda: "Tierra de diatomeas, azufre, caolín, ceniza, cal…" },
    { id: "sintesis", nombre: "Químico de síntesis",
      ayuda: "Insecticidas, fungicidas o fertilizantes de síntesis, aunque sean de banda verde." },
    { id: "otro", nombre: "Otro", ayuda: "" },
  ];

  const MOTIVOS = ["Prevención, sin un problema a la vista", "Nutrición o mejora del suelo", "Otro motivo"];

  const CLIMAS = ["Seco", "Nublado", "Ventoso", "Después de lluvia", "Con calor fuerte"];

  // Los del plan, más dos que aparecen con los productos de afuera.
  const metodos = () => window.Plan.METODOS.concat(["Espolvoreo sobre la planta", "Otro"]);

  // Pasado este tiempo, el último monitoreo ya no dice cómo estaba el cultivo
  // al aplicar, y la app sugiere anotar cómo está hoy.
  const DIAS_MONITOREO_VIEJO = 3;

  let bio = null;
  let config = null;
  let monitoreos = [];
  let aplicaciones = [];
  let tratamientos = [];
  let sinEnviar = new Set();
  let destino = null;
  let irA = null;
  let errores = {};
  let tipeado = {};
  let guardadas = null;   // las recién guardadas, para la pantalla de confirmación

  async function render(contenedor, ruta, navegar) {
    destino = contenedor;
    irA = navegar;
    errores = {};
    guardadas = null;
    tipeado = {};

    destino.innerHTML = `<p class="cargando">Cargando…</p>`;
    try {
      if (!bio) bio = await (await fetch("datos/biopreparados.json")).json();
      config = await window.BioDB.leerConfig();
      monitoreos = await window.BioDB.todos("monitoreos");
      aplicaciones = await window.BioDB.todos("aplicaciones");
      tratamientos = await window.BioDB.todos("tratamientos");
      sinEnviar = new Set((await window.BioDB.pendientes()).map((s) => s.id));
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudo abrir el registro.<br><br>
        Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Registrar aplicación", subtitulo: "Error" };
    }

    // Se llega con un monitoreo en la dirección desde el resultado de un
    // monitoreo: el "para qué" ya viene elegido.
    const desde = ruta.split("/")[1];
    if (desde) {
      const m = monitoreos.find((x) => x.id === desde);
      if (m) tipeado.para = "p:" + window.Problemas.clave(m);
    }

    pintar();
    return { titulo: "Registrar aplicación", subtitulo: "Lo que aplicaste fuera del plan" };
  }

  const sector = (id) => (config.sectores || []).find((s) => s.id === id) || null;
  const libres = () => aplicaciones.filter((a) => a.origen === "Fuera del plan");

  function pintar() {
    destino.innerHTML = guardadas ? confirmacion() : formulario() + recientes();
    conectar();
  }

  // ---------- El formulario ----------

  function formulario() {
    const t = tipeado;
    const problemas = window.Problemas.lista(monitoreos, true);
    const sectores = config.sectores || [];
    const elegido = problemaElegido(t.para);
    const marcados = t.sectores || (elegido ? [elegido.ultimo.sector_id] : []);

    return `
      <div class="tarjeta">
        <h2>¿Qué aplicaste?</h2>
        <p class="nota">Para lo que aplicaste y no estaba en el plan: una urgencia,
          un producto comprado, algo que decidiste en el momento. Queda con su
          fecha, y si fue por un problema, en la historia de ese problema.</p>

        <div class="campo">
          <label for="ap-para">¿Para qué?</label>
          <select id="ap-para" class="${mal("para")}">
            <option value="">Elegí…</option>
            ${problemas.length ? `<optgroup label="Un problema que registraste">
              ${problemas.map((p) => `<option value="p:${esc(p.clave)}"${
                "p:" + p.clave === t.para ? " selected" : ""}>${esc(etiquetaProblema(p))}</option>`).join("")}
            </optgroup>` : ""}
            <optgroup label="Sin un problema puntual">
              ${MOTIVOS.map((m) => `<option value="m:${esc(m)}"${
                "m:" + m === t.para ? " selected" : ""}>${esc(m)}</option>`).join("")}
            </optgroup>
          </select>
          ${error("para")}
        </div>
        <div id="ap-zona-para"></div>

        <div class="campo">
          <label for="ap-tipo">Tipo de producto</label>
          <select id="ap-tipo" class="${mal("tipo")}">
            <option value="">Elegí…</option>
            ${TIPOS.map((x) => `<option value="${esc(x.id)}"${x.id === t.tipo ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}
          </select>
          <span class="ayuda" id="ap-tipo-ayuda"></span>
          ${error("tipo")}
        </div>
        <div id="ap-zona-tipo"></div>

        <div class="campo">
          <label for="ap-producto">Producto
            <span class="ayuda">El nombre, como lo conocés. Si ya lo usaste, aparece en la lista.</span></label>
          <input id="ap-producto" type="text" autocomplete="off" list="ap-productos"
                 class="${mal("producto")}" value="${esc(t.producto || "")}" placeholder="InsectBio">
          <datalist id="ap-productos"></datalist>
          ${error("producto")}
        </div>

        <div class="fila">
          <div class="campo">
            <label for="ap-dosis">Dosis</label>
            <input id="ap-dosis" type="text" autocomplete="off" class="${mal("dosis")}"
                   value="${esc(t.dosis || "")}" placeholder="por ejemplo: 5 cc por litro">
            ${error("dosis")}
          </div>
          <div class="campo">
            <label for="ap-metodo">Método</label>
            <select id="ap-metodo" class="${mal("metodo")}">
              <option value="">Elegí…</option>
              ${metodos().map((m) => `<option value="${esc(m)}"${m === t.metodo ? " selected" : ""}>${esc(m)}</option>`).join("")}
            </select>
            ${error("metodo")}
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="ap-fecha">Fecha en que se aplicó</label>
            <input id="ap-fecha" type="date" class="${mal("fecha")}" value="${esc(t.fecha || hoy())}">
            ${error("fecha")}
          </div>
          <div class="campo">
            <label for="ap-bancal">Bancal <span class="ayuda">Opcional</span></label>
            <input id="ap-bancal" type="text" autocomplete="off"
                   value="${esc(t.bancal !== undefined ? t.bancal : (elegido ? elegido.ultimo.bancal || "" : ""))}" placeholder="3">
          </div>
        </div>

        <div class="campo">
          <label>Sectores donde se aplicó</label>
          <ul class="opciones">
            ${sectores.map((s) => `<li>
              <label class="opcion">
                <input type="checkbox" class="ap-sector" value="${esc(s.id)}"${
                  marcados.includes(s.id) ? " checked" : ""}>
                <span><strong>${esc(s.nombre)}</strong> — ${esc(superficie(s.superficie))},
                  ${esc(s.cultivo || "")}</span>
              </label></li>`).join("")}
          </ul>
          ${error("sectores")}
        </div>

        <div class="fila">
          <div class="campo">
            <label for="ap-volumen">Volumen aplicado
              <span class="ayuda">Litros de caldo por sector. Opcional.</span></label>
            <input id="ap-volumen" type="text" inputmode="decimal" autocomplete="off"
                   class="${mal("volumen")}" value="${esc(t.volumen || "")}" placeholder="20">
            ${error("volumen")}
          </div>
          <div class="campo">
            <label for="ap-clima">Clima</label>
            <select id="ap-clima">
              <option value="">Sin anotar…</option>
              ${CLIMAS.map((c) => `<option value="${esc(c)}"${c === t.clima ? " selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="campo">
          <label for="ap-operador">Quién aplicó</label>
          <input id="ap-operador" type="text" autocomplete="off"
                 value="${esc(t.operador !== undefined ? t.operador : (config.responsable || ""))}">
        </div>

        <div class="campo">
          <label for="ap-obs">Observaciones <span class="ayuda">Opcional</span></label>
          <textarea id="ap-obs" rows="2" placeholder="Por qué este producto, qué esperás ver, qué no tenías a mano">${esc(t.observaciones || "")}</textarea>
        </div>

        <button class="boton boton--ancho" id="ap-guardar">Guardar la aplicación</button>
      </div>`;
  }

  function etiquetaProblema(p) {
    const u = p.ultimo;
    const veces = p.cadena.length;
    return `${u.deteccion} · ${u.sector}${u.bancal ? " b." + u.bancal : ""} · ${
      window.Problemas.fechaCorta(u.fecha)}${u.incidencia !== "" && u.incidencia !== undefined
      ? " · " + u.incidencia + " %" : ""}${veces > 1 ? " · " + veces + " controles" : ""}`;
  }

  function problemaElegido(para) {
    if (!para || para.indexOf("p:") !== 0) return null;
    const k = para.slice(2);
    return window.Problemas.lista(monitoreos, false).find((p) => p.clave === k) || null;
  }

  function diasDesde(iso) {
    return Math.round((new Date(hoy() + "T12:00:00") - new Date(iso + "T12:00:00")) / 86400000);
  }

  // Debajo del "para qué": cómo estaba el problema la última vez que se miró,
  // que es el punto de partida contra el que se va a comparar después.
  function pintarPara() {
    const caja = destino.querySelector("#ap-zona-para");
    if (!caja) return;
    const para = valor("#ap-para");
    const p = problemaElegido(para);
    const hayProblemas = window.Problemas.lista(monitoreos, true).length > 0;

    if (p) {
      const u = p.ultimo;
      const dias = diasDesde(u.fecha);
      caja.innerHTML = `
        <div class="tarjeta tarjeta--info-producto">
          <p class="nota"><strong>Cómo estaba la última vez:</strong>
            ${esc(window.Problemas.fechaCorta(u.fecha))}${dias > 0 ? ` (hace ${dias} ${dias === 1 ? "día" : "días"})` : " (hoy)"},
            ${u.incidencia !== "" && u.incidencia !== undefined ? esc(String(u.incidencia)) + " % de incidencia" : "sin incidencia anotada"}${
            u.severidad ? ", severidad " + esc(u.severidad.toLowerCase()) : ""}.</p>
          ${dias > DIAS_MONITOREO_VIEJO ? `<p class="nota">Si podés, anotá cómo está hoy
            antes de aplicar: es el punto de partida para ver después si retrocede.</p>
            <button class="boton boton--secundario boton--ancho" data-seguir="${esc(p.clave)}">
              Anotar cómo está hoy</button>` : ""}
        </div>`;
    } else if (!para && !hayProblemas) {
      caja.innerHTML = `
        <p class="aviso aviso--info">Si aplicaste por una plaga o enfermedad,
          conviene registrarla primero en Monitoreo, con su incidencia y severidad:
          así queda cómo estaba antes de aplicar, y después se puede ver cómo
          evoluciona.</p>
        <button class="boton boton--secundario boton--ancho" data-ir="monitoreo">
          Registrar primero lo que vi</button>`;
    } else {
      caja.innerHTML = "";
    }

    caja.querySelectorAll("[data-seguir]").forEach((b) => {
      b.onclick = () => irA("monitoreo/seguir/" + b.dataset.seguir);
    });
    caja.querySelectorAll("[data-ir]").forEach((b) => { b.onclick = () => irA(b.dataset.ir); });
  }

  // El tipo cambia qué se ofrece en la lista de productos y, si es de síntesis,
  // lo que el sello dice de eso.
  function pintarTipo() {
    const tipo = valor("#ap-tipo");
    const def = TIPOS.find((x) => x.id === tipo);
    const ayuda = destino.querySelector("#ap-tipo-ayuda");
    if (ayuda) ayuda.textContent = def ? def.ayuda : "";

    const caja = destino.querySelector("#ap-zona-tipo");
    if (caja) caja.innerHTML = tipo === "sintesis" ? `
      <p class="aviso aviso--error"><strong>El sello ECOMARCAL no admite productos
        de síntesis química</strong>, aunque sean de banda verde. Registrarlo igual
        es lo que corresponde: le da al equipo técnico el dato para acompañarte, y
        a vos la historia de qué pasó con el problema.</p>` : "";

    const lista = destino.querySelector("#ap-productos");
    if (lista) lista.innerHTML = sugerencias(tipo)
      .map((n) => `<option value="${esc(n)}"></option>`).join("");
  }

  // Los biopreparados de la wiki, si es casero; y siempre lo que ya se usó
  // antes con ese tipo, así InsectBio se escribe una sola vez.
  function sugerencias(tipo) {
    const usados = libres().filter((a) => !tipo || a.tipo_producto === nombreTipo(tipo))
      .map((a) => a.producto);
    const wiki = tipo === "casero" || !tipo ? (bio.fichas || []).map((f) => f.nombre) : [];
    return [...new Set(usados.concat(wiki))].sort((a, b) => a.localeCompare(b));
  }

  const nombreTipo = (id) => (TIPOS.find((x) => x.id === id) || { nombre: "" }).nombre;
  const fichaPorNombre = (n) => (bio.fichas || [])
    .find((f) => f.nombre.toLowerCase() === String(n).trim().toLowerCase()) || null;

  // Al elegir un producto conocido se completan dosis y método, pero solo si
  // están vacíos: lo que el productor ya escribió no se pisa.
  function alElegirProducto() {
    const nombre = valor("#ap-producto").trim();
    if (!nombre) return;
    const anterior = libres().filter((a) => a.producto.toLowerCase() === nombre.toLowerCase())
      .sort((a, b) => String(b.creado).localeCompare(String(a.creado)))[0];
    const f = fichaPorNombre(nombre);
    const sug = anterior
      ? { dosis: anterior.dosis, metodo: anterior.metodo, volumen: anterior.volumen }
      : f && f.sugerencia ? { dosis: f.sugerencia.dosis, metodo: f.sugerencia.metodo } : null;
    if (!sug) return;

    const poner = (id, v) => {
      const campo = destino.querySelector(id);
      if (campo && !campo.value && v) campo.value = v;
    };
    poner("#ap-dosis", sug.dosis);
    poner("#ap-metodo", metodos().includes(sug.metodo) ? sug.metodo : "");
    poner("#ap-volumen", sug.volumen);

    if (f && !valor("#ap-tipo")) {
      destino.querySelector("#ap-tipo").value = "casero";
      pintarTipo();
    }
  }

  const error = (c) => (errores[c] ? `<span class="campo__error">${esc(errores[c])}</span>` : "");
  const mal = (c) => (errores[c] ? " mal" : "");
  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  function leer() {
    return {
      para: valor("#ap-para"),
      tipo: valor("#ap-tipo"),
      producto: valor("#ap-producto").trim(),
      dosis: valor("#ap-dosis").trim(),
      metodo: valor("#ap-metodo"),
      fecha: valor("#ap-fecha"),
      bancal: valor("#ap-bancal").trim(),
      sectores: [...destino.querySelectorAll(".ap-sector:checked")].map((c) => c.value),
      volumen: valor("#ap-volumen").trim(),
      clima: valor("#ap-clima"),
      operador: valor("#ap-operador").trim(),
      observaciones: valor("#ap-obs").trim(),
    };
  }

  // ---------- Guardar ----------

  // Un segundo toque sobre "Guardar" mientras el primero todavía escribe en la
  // base dejaba la aplicación duplicada en cada sector.
  let guardando = false;

  async function guardar() {
    if (guardando) return;
    const l = leer();
    errores = {};
    if (!l.para) errores.para = "Elegí para qué fue.";
    if (!l.tipo) errores.tipo = "Elegí el tipo de producto.";
    if (!l.producto) errores.producto = "Escribí qué producto aplicaste.";
    if (!l.dosis) errores.dosis = "Indicá la dosis, aunque sea aproximada.";
    if (!l.metodo) errores.metodo = "Elegí cómo lo aplicaste.";
    if (!l.fecha) errores.fecha = "Falta la fecha.";
    if (l.fecha && l.fecha > hoy()) errores.fecha = "Es una fecha que todavía no llegó.";
    if (!l.sectores.length) errores.sectores = "Marcá al menos un sector.";
    if (l.volumen && !(aNumero(l.volumen) > 0)) errores.volumen = "Escribí solo el número de litros. Por ejemplo: 20";

    if (Object.keys(errores).length) {
      tipeado = l;
      pintar();
      const primero = destino.querySelector(".mal, .campo__error");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const p = problemaElegido(l.para);
    // El monitoreo que valía como "estado inicial" al momento de aplicar: el
    // último de ese problema hasta la fecha de la aplicación.
    const previo = p ? p.cadena.filter((m) => m.fecha <= l.fecha).pop() || null : null;
    const ficha = fichaPorNombre(l.producto);
    const nuevas = [];

    guardando = true;
    try {
    for (const sid of l.sectores) {
      const sec = sector(sid);
      const id = window.BioDB.nuevoId();
      const datos = {
        id: id,
        // Lo libre no tiene ocurrencia del plan: se le da una propia, que nunca
        // va a coincidir con un id derivado de renglón, fecha y sector.
        ocurrencia_id: "libre|" + id,
        plan_id: "",
        origen: "Fuera del plan",
        fecha: l.fecha,
        fecha_programada: "",
        fecha_aplicada: l.fecha,
        producto: l.producto,
        producto_id: ficha ? ficha.id : null,
        tipo_producto: nombreTipo(l.tipo),
        dosis: l.dosis,
        metodo: l.metodo,
        sector: sec ? sec.nombre : "",
        sector_id: sid,
        bancal: l.bancal,
        superficie: sec ? sec.superficie : "",
        volumen: l.volumen,
        operador: l.operador,
        clima: l.clima,
        estado: "Aplicada",
        motivo: p ? p.ultimo.deteccion : l.para.slice(2),
        problema_id: p ? p.clave : "",
        monitoreo_id: previo ? previo.id : "",
        observaciones: l.observaciones,
        creado: new Date().toISOString(),
      };
      await window.BioDB.guardar("aplicaciones", datos);
      await window.BioDB.encolarCon(datos.id, "aplicaciones", datos);
      aplicaciones.push(datos);
      sinEnviar.add(datos.id);
      nuevas.push(datos);
    }
    } finally {
      guardando = false;
    }

    guardadas = { lista: nuevas, leido: l, problema: p };
    brindis(`${l.producto} registrado`);
    pintar();
    window.scrollTo(0, 0);
    window.Envio.sincronizar(true).then(actualizarCola);
  }

  // ---------- Después de guardar ----------
  //
  // Lo habitual es que en una misma salida al campo se aplique más de una
  // cosa: el bioinsecticida, trichoderma, diatomeas. Por eso la confirmación
  // ofrece cargar otro producto con el mismo día, lugar y motivo, en vez de
  // obligar a llenar todo de nuevo.

  function confirmacion() {
    const { lista, leido, problema } = guardadas;
    const a = lista[0];
    return `
      <div class="tarjeta">
        <h2>Quedó registrado</h2>
        <p class="aviso aviso--ok">${esc(a.producto)} · ${esc(a.dosis)} · ${esc(a.metodo)}<br>
          ${esc(window.Problemas.fechaCorta(a.fecha_aplicada))} en ${esc(lista.map((x) => x.sector).join(", "))}${
          a.bancal ? ", bancal " + esc(a.bancal) : ""}.<br>
          Se sube a la planilla de tu chacra cuando haya señal.</p>
        ${leido.tipo === "sintesis" ? `<p class="nota">Quedó anotado como producto de
          síntesis. El equipo técnico lo va a ver en la planilla.</p>` : ""}

        <button class="boton boton--ancho" id="ap-otro">Registrar otro producto
          del mismo día</button>
        <p class="nota">Mantiene la fecha, los sectores, el bancal y el motivo.</p>
        ${problema ? `<button class="boton boton--secundario boton--ancho" data-ver-problema="${
          esc(problema.ultimo.id)}">Ver cómo viene ${esc(problema.ultimo.deteccion.toLowerCase())}</button>` : ""}
        <button class="boton boton--secundario boton--ancho" data-ir="seguimiento">Ir al Seguimiento</button>
        <button class="boton--peligro centrado" data-ir="inicio">Volver al inicio</button>
      </div>`;
  }

  // ---------- Lo ya registrado fuera del plan ----------

  function recientes() {
    const lista = libres().sort((a, b) =>
      String(b.fecha_aplicada).localeCompare(String(a.fecha_aplicada)) ||
      String(b.creado).localeCompare(String(a.creado)));
    if (!lista.length) return "";
    return `
      <details class="grupo separado">
        <summary class="grupo__cab">
          <span class="grupo__icono">💧</span>
          <span class="grupo__texto">
            <span class="grupo__nombre">Lo que registraste fuera del plan</span>
            <span class="grupo__cuenta">${lista.length} ${lista.length === 1 ? "aplicación" : "aplicaciones"}</span>
          </span>
          <span class="grupo__flecha" aria-hidden="true"></span>
        </summary>
        <div class="grupo__cuerpo">
          <ul class="agenda">${lista.slice(0, 30).map((a) => filaLibre(a, sinEnviar)).join("")}</ul>
          <p class="nota">Lo que ya subió a la planilla no se puede deshacer desde
            el teléfono: si hay que corregirlo, avisale al equipo técnico.</p>
        </div>
      </details>`;
  }

  // La comparte el Seguimiento, para que se vea igual en los dos lugares.
  function filaLibre(a, cola) {
    return `
      <li class="agenda__item agenda__item--hecho">
        <div class="agenda__cab">
          <span class="agenda__fecha">${esc(window.Problemas.fechaCorta(a.fecha_aplicada))}</span>
          <span class="agenda__texto">
            <strong>${esc(a.producto)}</strong>
            <span class="agenda__detalle">${esc([a.sector + (a.bancal ? " b." + a.bancal : ""),
              a.dosis, a.metodo, a.tipo_producto].filter(Boolean).join(" · "))}${
              a.motivo ? ` · <span class="agenda__origen">${esc(a.motivo)}</span>` : ""}</span>
          </span>
        </div>
        ${cola.has(a.id)
          ? `<button class="boton--peligro centrado" data-deshacer-libre="${esc(a.id)}">Deshacer</button>`
          : `<span class="agenda__subido">Ya subió a la planilla</span>`}
      </li>`;
  }

  async function deshacer(id, alTerminar) {
    const todas = await window.BioDB.todos("aplicaciones");
    const a = todas.find((x) => x.id === id);
    if (!a) return false;
    if (!confirm(`¿Deshacer el registro de ${a.producto} del ${window.Problemas.fechaCorta(a.fecha_aplicada)}?`)) return false;
    await window.BioDB.borrar("aplicaciones", id);
    await window.BioDB.borrar("salida", id);
    brindis("Registro deshecho");
    if (alTerminar) alTerminar();
    return true;
  }

  // ---------- Eventos ----------

  function conectar() {
    const para = destino.querySelector("#ap-para");
    if (para) {
      para.onchange = () => {
        pintarPara();
        // Elegir un problema marca su sector y su bancal, si todavía no se
        // tocaron: es casi siempre donde se aplicó.
        const p = problemaElegido(para.value);
        if (p) {
          const casillas = [...destino.querySelectorAll(".ap-sector")];
          if (!casillas.some((c) => c.checked)) {
            casillas.forEach((c) => { c.checked = c.value === p.ultimo.sector_id; });
          }
          const bancal = destino.querySelector("#ap-bancal");
          if (bancal && !bancal.value) bancal.value = p.ultimo.bancal || "";
        }
      };
      pintarPara();
    }

    const tipo = destino.querySelector("#ap-tipo");
    if (tipo) { tipo.onchange = pintarTipo; pintarTipo(); }

    const producto = destino.querySelector("#ap-producto");
    if (producto) producto.onchange = alElegirProducto;

    const guardarBtn = destino.querySelector("#ap-guardar");
    if (guardarBtn) guardarBtn.onclick = guardar;

    const otro = destino.querySelector("#ap-otro");
    if (otro) otro.onclick = () => {
      const l = guardadas.leido;
      tipeado = {
        para: l.para, fecha: l.fecha, sectores: l.sectores, bancal: l.bancal,
        clima: l.clima, operador: l.operador,
      };
      guardadas = null;
      errores = {};
      pintar();
      window.scrollTo(0, 0);
    };

    destino.querySelectorAll("[data-ver-problema]").forEach((b) => {
      b.onclick = () => irA("monitoreo/ver/" + b.dataset.verProblema);
    });

    destino.querySelectorAll("[data-ir]").forEach((b) => { b.onclick = () => irA(b.dataset.ir); });

    destino.querySelectorAll("[data-deshacer-libre]").forEach((b) => {
      b.onclick = () => deshacer(b.dataset.deshacerLibre, () => {
        aplicaciones = aplicaciones.filter((a) => a.id !== b.dataset.deshacerLibre);
        sinEnviar.delete(b.dataset.deshacerLibre);
        tipeado = leer();
        pintar();
      });
    });
  }

  // El envío puede terminar cuando el productor ya está en otra pantalla: en
  // ese caso no se repinta nada, o se escribiría encima de la otra sección.
  async function actualizarCola() {
    sinEnviar = new Set((await window.BioDB.pendientes()).map((s) => s.id));
    if (location.hash.indexOf("#/aplicacion") !== 0) return;
    if (!guardadas) {
      // Si está escribiendo, no se toca la pantalla: repintar conserva lo
      // tipeado, pero le saca el foco al campo y cierra el teclado en la mitad
      // de una palabra.
      const foco = document.activeElement;
      if (foco && destino.contains(foco) && /^(INPUT|SELECT|TEXTAREA)$/.test(foco.tagName)) return;
      tipeado = leer();
    }
    pintar();
  }

  return { render, filaLibre, deshacer };
})();
