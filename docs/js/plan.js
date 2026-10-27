// ==========================================================================
// BioSalud ECOMARCAL — Registrar Plan de Salud
//
// El productor arma la batería de productos de la temporada. Cada renglón dice
// qué aplica, en qué dosis, con qué método, en qué sectores, desde cuándo,
// hasta cuándo y cada cuántos días.
//
// LAS OCURRENCIAS SE CALCULAN, NO SE GUARDAN.
//
// De "cada 15 días entre octubre y marzo" salen 11 aplicaciones fechadas. Esas
// fechas son las que después el Seguimiento muestra como pendientes o
// atrasadas. Se calculan cada vez a partir de la regla, en vez de generarse y
// guardarse una sola vez.
//
// Es a propósito: si estuvieran guardadas, cada corrección del plan obligaría a
// regenerarlas cuidando de no pisar las que ya se aplicaron, y ahí es donde los
// datos se desincronizan. Calculándolas, editar un renglón no puede romper
// nada. Lo que sí se guarda es lo que se aplicó de verdad, que es un hecho y no
// una previsión.
//
// Cada renglón se guarda en el teléfono apenas se agrega, sin esperar al botón
// de abajo: en el campo la app se cierra sola y nadie quiere volver a cargar
// todo. El botón de guardar es el que da el plan por cerrado y lo manda a la
// planilla.
// ==========================================================================

window.Plan = (function () {
  const { esc, brindis, numero, aNumero, superficie } = window.Util;

  // El para qué no se pregunta: ya lo dice el tipo de bioinsumo elegido en el
  // paso 1, y preguntarlo de nuevo abajo era pedir dos veces lo mismo.

  const METODOS = [
    "Fertirriego",
    "Mochila (foliar)",
    "Mochila (al suelo)",
    "Bomba / pulverizadora",
    "Al suelo, en seco",
    "Riego manual",
  ];

  // Fertirriego solo tiene sentido donde el agua llega por cañería.
  const RIEGOS_QUE_PERMITEN_FERTIRRIEGO = ["Goteo", "Microaspersión", "Aspersión"];

  let bio = null;        // datos/biopreparados.json
  let config = null;
  let renglones = [];    // lo guardado en el teléfono
  let editando = null;   // id del renglón en edición
  let categoria = "";    // paso 1: para qué se va a usar
  let elegido = "";      // paso 2: cuál producto
  let errores = {};
  let destino = null;

  // ---------- Temporada ----------
  // En la Comarca el ciclo va de julio a junio, así que a mitad de año no
  // cambia de temporada en medio de un plan.
  function temporadaActual() {
    const hoy = new Date();
    const a = hoy.getFullYear();
    const inicio = hoy.getMonth() + 1 >= 7 ? a : a - 1;
    return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
  }

  // ---------- Ocurrencias ----------
  // De la regla del renglón a la lista de fechas. Lo usa el resumen de esta
  // pantalla y lo va a usar el Seguimiento.
  function ocurrencias(r) {
    const fechas = [];
    if (!r.desde || !r.hasta || !r.cada_dias) return fechas;

    const desde = new Date(r.desde + "T12:00:00");
    const hasta = new Date(r.hasta + "T12:00:00");
    const paso = Number(r.cada_dias);
    if (isNaN(desde) || isNaN(hasta) || !(paso > 0) || hasta < desde) return fechas;

    const cursor = new Date(desde);
    // El tope evita que un "cada 1 día" durante diez años cuelgue la app.
    while (cursor <= hasta && fechas.length < 400) {
      fechas.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + paso);
    }
    return fechas;
  }

  const totalOcurrencias = () =>
    renglones.reduce((suma, r) => suma + ocurrencias(r).length, 0);

  // ---------- Pantalla ----------

  async function render(contenedor, ruta, navegar) {
    destino = contenedor;
    errores = {};
    editando = null;
    categoria = "";
    elegido = "";

    destino.innerHTML = `<p class="cargando">Cargando…</p>`;
    try {
      if (!bio) bio = await (await fetch("datos/biopreparados.json")).json();
      config = await window.BioDB.leerConfig();
      renglones = (await window.BioDB.todos("planes"))
        .filter((r) => r.temporada === temporadaActual())
        .sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudo abrir el plan.<br><br>
        Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Plan de Salud", subtitulo: "Error" };
    }

    pintar();
    return { titulo: "Plan de Salud", subtitulo: "Temporada " + temporadaActual() };
  }

  const ficha = (id) => (bio.fichas || []).find((f) => f.id === id);

  function pintar() {
    const enEdicion = editando ? renglones.find((r) => r.id === editando) : null;
    const sectores = config.sectores || [];

    destino.innerHTML = `
      ${renglones.length ? resumen() : `<p class="aviso aviso--info">
        Armá acá la batería de productos que vas a usar esta temporada. Se suma
        de a uno: elegís el producto y completás dosis, método, sectores y cada
        cuánto se repite.</p>`}

      ${renglones.length ? `<ul class="renglones">${renglones.map(filaRenglon).join("")}</ul>` : ""}

      ${avisoCobre()}

      <div class="tarjeta">
        <h2>${enEdicion ? "Editar renglón" : "Agregar un producto al plan"}</h2>
        ${selectorProducto()}
        ${(elegido || categoria === "__otro") ? formulario(enEdicion, sectores) : `<p class="nota">
          ${categoria ? "Elegí cuál para completar sus datos."
                      : "Empezá por el tipo: eso achica la lista."}</p>`}
      </div>

      ${renglones.length ? `<button class="boton boton--ancho" id="btn-guardar-plan">
        Guardar plan de la temporada</button>
        <p class="nota nota--pie">Cada renglón ya quedó guardado en el teléfono.
        Este botón da el plan por cerrado y lo deja listo para subir a la planilla
        de tu chacra.</p>` : ""}
    `;
    conectar();
  }

  function resumen() {
    const total = totalOcurrencias();
    return `
      <div class="resumen">
        <h2>Temporada ${esc(temporadaActual())}</h2>
        <dl>
          <div><dt>Productos:</dt><dd>${renglones.length}</dd></div>
          <div><dt>Aplicaciones:</dt><dd>${total}</dd></div>
        </dl>
      </div>`;
  }

  function filaRenglon(r) {
    const n = ocurrencias(r).length;
    const detalle = [
      r.dosis,
      r.metodo,
      "sectores " + (r.sectores || []).map(nombreSector).join(", "),
    ].filter(Boolean).join(" · ");

    return `
      <li class="renglon">
        <div class="renglon__datos">
          <span class="renglon__producto">${esc(r.producto)}</span>
          <span class="renglon__motivo">${esc(r.motivo || "")}</span>
          <span class="renglon__detalle">${esc(detalle)}</span>
          <span class="renglon__periodo">${esc(fechaCorta(r.desde))} a ${esc(fechaCorta(r.hasta))}
            · cada ${esc(String(r.cada_dias))} días
            · <strong>${n} ${n === 1 ? "aplicación" : "aplicaciones"}</strong></span>
        </div>
        <div class="renglon__acciones">
          <button class="boton--peligro boton--editar" data-editar="${esc(r.id)}">Editar</button>
          <button class="boton--peligro" data-borrar="${esc(r.id)}">Borrar</button>
        </div>
      </li>`;
  }

  const nombreSector = (id) => {
    const s = (config.sectores || []).find((x) => x.id === id);
    return s ? s.nombre : "?";
  };

  function fechaCorta(iso) {
    if (!iso) return "—";
    const [a, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  // ---------- Cobre ----------
  //
  // La cuenta la hace js/cobre.js; acá solo se la alimenta con el plan y se la
  // dibuja. Se muestra dos veces a propósito: arriba el acumulado de toda la
  // temporada, y abajo, mientras se completa el renglón, cómo queda si se
  // agrega. Es la diferencia entre enterarse y poder decidir.

  const limiteCobre = () => window.Cobre.limite(bio);

  function cobreDe(lista) {
    return window.Cobre.porSector(
      window.Cobre.aplicacionesDelPlan(lista, (r) => ocurrencias(r).length),
      config.sectores || [], ficha, limiteCobre());
  }

  // Dos decimales: con 6 kg de tope, el tercero no cambia ninguna decisión y
  // hace más difícil de leer el número en el campo.
  const kg = (n) => numero(Math.round(n * 100) / 100);

  // La barra va con <progress> y no con un div al que se le calcula el ancho:
  // la app tiene una CSP que prohíbe los estilos en línea —y está bien que la
  // tenga—, así que un style="width:…" quedaría bloqueado por el navegador y
  // la barra no se vería. Además <progress> se anuncia solo en los lectores de
  // pantalla.
  function filaCobre(f) {
    const tope = limiteCobre();

    return `
      <li class="cobre__sector cobre__sector--${esc(f.estado)}">
        <div class="cobre__linea">
          <strong>${esc(f.nombre)}</strong>
          <span>${f.kg_por_ha === null
            ? numero(Math.round(f.gramos)) + " g en total"
            : kg(f.kg_por_ha) + " de " + numero(tope) + " kg/ha"}</span>
        </div>
        ${f.kg_por_ha === null ? "" : `<progress class="cobre__barra" max="${esc(String(tope))}"
          value="${esc(String(Math.min(tope, f.kg_por_ha)))}"></progress>`}
        <span class="cobre__detalle">${f.kg_por_ha === null
          ? "Este sector no tiene superficie cargada, así que no se puede saber cuánto es por hectárea."
          : esc(superficie(f.superficie) + " · " + numero(Math.round(f.gramos)) +
                " g de cobre en la temporada · " +
                f.productos.map((p) => p.nombre).join(", "))}</span>
      </li>`;
  }

  function avisoCobre() {
    const filas = cobreDe(renglones);
    if (!filas.length) return "";

    const peor = window.Cobre.peor(filas);
    const clase = peor.estado === "pasado" ? "aviso--error"
                : peor.estado === "ok" ? "aviso--ok" : "aviso--info";

    const titulo = peor.estado === "pasado"
      ? `Este plan se pasa del tope de cobre en ${peor.nombre}.`
      : peor.estado === "cerca"
      ? `En ${peor.nombre} el plan llega al ${Math.round(peor.porcentaje)} % del tope de cobre.`
      : peor.estado === "sin-superficie"
      ? "Falta la superficie de un sector para poder calcular el cobre por hectárea."
      : "El cobre del plan queda dentro del tope.";

    return `
      <div class="tarjeta cobre">
        <h2>Cobre que proyecta este plan</h2>
        <p class="aviso ${clase}">${esc(titulo)}</p>
        <ul class="cobre__sectores">${filas.map(filaCobre).join("")}</ul>
        <p class="nota">Son ${esc(String(limiteCobre()))} kg de cobre por hectárea y
        por año, contando bordelés, Visosa y cualquier otro preparado con cobre.
        Esto es lo que daría <strong>si se cumple el plan entero</strong>. Lo que
        llevás aplicado de verdad está en Seguimiento de plan.</p>
      </div>`;
  }

  // ---------- Selector de producto ----------

  // Se elige en dos pasos y no en una sola lista: veinticuatro productos en un
  // desplegable, en un celular, es una lista que no se puede leer. Primero el
  // tipo de bioinsumo, y eso deja entre uno y ocho para elegir.
  function selectorProducto() {
    // Los preparados de base no se aplican solos: no se ofrecen.
    const cats = (bio.categorias || []).filter((c) =>
      c.id !== "base" && (bio.fichas || []).some((f) => f.categoria === c.id));

    const deLaCategoria = categoria && categoria !== "__otro"
      ? (bio.fichas || []).filter((f) => f.categoria === categoria) : [];

    const cat = cats.find((c) => c.id === categoria);

    return `
      <div class="campo">
        <label for="f-categoria">Paso 1 · Tipo de bioinsumo</label>
        <select id="f-categoria" class="${mal("categoria")}">
          <option value="">Elegí el tipo…</option>
          ${cats.map((c) => {
            const n = (bio.fichas || []).filter((f) => f.categoria === c.id).length;
            return `<option value="${esc(c.id)}"${c.id === categoria ? " selected" : ""}>
              ${esc(c.icono + " " + c.nombre)} (${n})</option>`;
          }).join("")}
          <option value="__otro"${categoria === "__otro" ? " selected" : ""}>
            ✍️ Otro producto que no está en la wiki</option>
        </select>
        ${cat ? `<p class="nota">${esc(cat.descripcion)}</p>` : ""}
        ${error("categoria")}
      </div>

      ${categoria && categoria !== "__otro" ? `
        <div class="campo">
          <label for="f-producto">Paso 2 · ¿Cuál?</label>
          <select id="f-producto" class="${mal("producto")}">
            <option value="">${deLaCategoria.length === 1
              ? "Hay uno solo…" : "Elegí entre los " + deLaCategoria.length + "…"}</option>
            ${deLaCategoria.map((f) => `<option value="${esc(f.id)}"${f.id === elegido ? " selected" : ""}>
              ${esc(f.nombre)}${f.comarca ? " · probado en la Comarca" : ""}</option>`).join("")}
          </select>
          ${error("producto")}
        </div>` : ""}`;
  }

  // ---------- Formulario del renglón ----------

  function formulario(enEdicion, sectores) {
    const f = categoria === "__otro" ? null : ficha(elegido);
    const r = enEdicion || {};
    const sug = (f && f.sugerencia) || {};
    const marcados = new Set(r.sectores || []);

    // Los preparados con cobre se avisan acá, al armar el plan, y no cuando ya
    // se aplicaron: el tope es anual, así que la única forma de no pasarse es
    // verlo antes.
    const cobre = window.Cobre.lleva(f) ? f.cobre : null;

    return `
      ${f ? `<div class="tarjeta tarjeta--info-producto">
        <p class="resumen-ficha">${esc(f.resumen)}</p>
        ${f.uso ? `<p class="nota"><strong>Para qué sirve.</strong> ${esc(f.uso)}</p>` : ""}
        ${f.carencia ? `<p class="nota"><strong>Carencia.</strong> ${esc(f.carencia)}</p>` : ""}
        ${f.dosis ? `<p class="nota"><strong>Dosis de la bibliografía:</strong>
          ${f.dosis.map((d) => esc(d.cuando + ": " + d.cuanto)).join(" · ")}</p>` : ""}
        <button class="boton--peligro boton--editar" data-ficha="${esc(f.id)}">Ver la ficha completa</button>
      </div>` : ""}

      ${cobre ? `<p class="aviso aviso--error"><strong>Lleva cobre.</strong> El sello
        lo admite, pero hasta <strong>${esc(String(limiteCobre()))} kg de cobre por
        hectárea y por año</strong>, sumando todos los preparados con cobre.
        ${esc(cobre.detalle)}</p>` : ""}

      ${categoria === "__otro" ? `
        <div class="campo">
          <label for="f-otro">¿Qué producto?
            <span class="ayuda">Un insumo que no está en la wiki: un fertilizante comercial, un producto de banda verde, algo que preparás vos.</span></label>
          <input id="f-otro" class="${mal("otro")}" type="text" value="${esc(r.producto || "")}"
                 autocomplete="off" placeholder="Nombre del producto">
          ${error("otro")}
        </div>` : ""}

      <div class="fila">
        <div class="campo">
          <label for="f-dosis">Dosis</label>
          <input id="f-dosis" class="${mal("dosis")}" type="text" autocomplete="off"
                 value="${esc(r.dosis || sug.dosis || "")}" placeholder="por ejemplo: 2 % o 200 cc por mochila">
          ${error("dosis")}
        </div>
        <div class="campo">
          <label for="f-metodo">Método</label>
          <select id="f-metodo" class="${mal("metodo")}">
            ${opciones(METODOS, r.metodo || sug.metodo, "Elegí…")}
          </select>
          ${error("metodo")}
        </div>
      </div>

      <div class="campo">
        <label>Sectores donde se aplica</label>
        ${sectores.length ? `<ul class="opciones">
          ${sectores.map((s) => `<li>
            <label class="opcion">
              <input type="checkbox" class="f-sector" value="${esc(s.id)}"${marcados.has(s.id) ? " checked" : ""}>
              <span><strong>${esc(s.nombre)}</strong> — ${esc(superficie(s.superficie))},
                ${esc(s.cultivo)}${s.riego ? " · riego por " + esc(s.riego.toLowerCase()) : ""}</span>
            </label></li>`).join("")}
        </ul>` : `<p class="vacio">No tenés sectores cargados.</p>`}
        ${error("sectores")}
        <p class="nota" id="aviso-riego"></p>
      </div>

      <div class="fila">
        <div class="campo">
          <label for="f-desde">Desde</label>
          <input id="f-desde" class="${mal("desde")}" type="date" value="${esc(r.desde || "")}">
          ${error("desde")}
        </div>
        <div class="campo">
          <label for="f-hasta">Hasta</label>
          <input id="f-hasta" class="${mal("hasta")}" type="date" value="${esc(r.hasta || "")}">
          ${error("hasta")}
        </div>
      </div>

      <div class="campo">
        <label for="f-cada">Cada cuántos días se repite
          ${sug.cada_dias ? `<span class="ayuda">La bibliografía sugiere cada ${sug.cada_dias} días.</span>`
            : `<span class="ayuda">La fuente de este producto no indica una frecuencia: definila con el equipo técnico.</span>`}</label>
        <input id="f-cada" class="${mal("cada")}" type="text" inputmode="numeric"
               value="${esc(r.cada_dias || sug.cada_dias || "")}" placeholder="15">
        ${error("cada")}
      </div>

      <p class="aviso aviso--ok" id="cuenta-aplicaciones">Completá las fechas para ver cuántas aplicaciones son.</p>

      ${cobre ? `
        <div class="campo">
          <label for="f-litros">Litros de caldo por aplicación, en cada sector
            <span class="ayuda">Cuánto preparás cada vez. La receta rinde
              ${esc(String(cobre.litros_receta))} litros. De acá sale la cuenta del
              cobre: diluirlo después no cambia cuánto cobre hay.</span></label>
          <input id="f-litros" class="${mal("litros")}" type="text" inputmode="decimal"
                 value="${esc(String(r.litros_por_aplicacion || cobre.litros_receta))}"
                 placeholder="${esc(String(cobre.litros_receta))}">
          ${error("litros")}
        </div>
        <div id="cuenta-cobre"></div>` : ""}

      <div class="campo">
        <label for="f-obs">Observaciones <span class="ayuda">Opcional</span></label>
        <textarea id="f-obs" rows="2">${esc(r.observaciones || "")}</textarea>
      </div>

      <button class="boton boton--secundario boton--ancho" id="btn-renglon">
        ${enEdicion ? "Guardar cambios" : "Agregar al plan"}
      </button>
      ${enEdicion ? `<button class="boton--peligro centrado" id="btn-cancelar">Cancelar</button>` : ""}`;
  }

  function opciones(lista, elegida, vacio) {
    return `<option value="">${esc(vacio)}</option>` + lista.map((v) =>
      `<option value="${esc(v)}"${v === elegida ? " selected" : ""}>${esc(v)}</option>`).join("");
  }

  const error = (c) => (errores[c] ? `<span class="campo__error">${esc(errores[c])}</span>` : "");
  const mal = (c) => (errores[c] ? " mal" : "");

  // ---------- Eventos ----------

  function conectar() {
    const cat = destino.querySelector("#f-categoria");
    if (cat) cat.onchange = () => {
      categoria = cat.value;
      elegido = "";              // cambiar de tipo descarta el producto anterior
      errores = {};
      pintar();
    };

    const sel = destino.querySelector("#f-producto");
    if (sel) sel.onchange = () => { elegido = sel.value; errores = {}; pintar(); };

    const btn = destino.querySelector("#btn-renglon");
    if (btn) btn.onclick = guardarRenglon;

    const cancelar = destino.querySelector("#btn-cancelar");
    if (cancelar) cancelar.onclick = () => {
      editando = null; categoria = ""; elegido = ""; errores = {}; pintar();
    };

    const guardar = destino.querySelector("#btn-guardar-plan");
    if (guardar) guardar.onclick = cerrarPlan;

    const verFicha = destino.querySelector("[data-ficha]");
    if (verFicha) verFicha.onclick = () => { location.hash = "#/wiki/manejo/" + verFicha.dataset.ficha; };

    destino.querySelectorAll("[data-editar]").forEach((b) => {
      b.onclick = () => {
        const r = renglones.find((x) => x.id === b.dataset.editar);
        editando = r.id;
        // Se reponen los dos pasos para que el formulario se abra igual que
        // cuando se cargó.
        categoria = r.producto_id ? (ficha(r.producto_id) || {}).categoria || "__otro" : "__otro";
        elegido = r.producto_id || "";
        errores = {};
        pintar();
        destino.querySelector("#f-categoria").scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });

    destino.querySelectorAll("[data-borrar]").forEach((b) => {
      b.onclick = async () => {
        const r = renglones.find((x) => x.id === b.dataset.borrar);
        if (!confirm(`¿Borrar ${r.producto} del plan?`)) return;
        await window.BioDB.borrar("planes", r.id);
        renglones = renglones.filter((x) => x.id !== r.id);
        if (editando === r.id) { editando = null; elegido = ""; }
        brindis("Renglón borrado");
        pintar();
      };
    });

    // La cuenta de aplicaciones y el aviso de riego se actualizan mientras se
    // completa, no al guardar: es lo que hace que el plan se vuelva concreto.
    ["#f-desde", "#f-hasta", "#f-cada", "#f-litros"].forEach((id) => {
      const el = destino.querySelector(id);
      if (el) el.oninput = actualizarCuenta;
    });
    destino.querySelectorAll(".f-sector").forEach((c) => { c.onchange = avisarRiego; });
    const metodo = destino.querySelector("#f-metodo");
    if (metodo) metodo.onchange = avisarRiego;

    actualizarCuenta();
    avisarRiego();
  }

  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  const sectoresMarcados = () =>
    [...destino.querySelectorAll(".f-sector:checked")].map((c) => c.value);

  function actualizarCuenta() {
    const caja = destino.querySelector("#cuenta-aplicaciones");
    if (!caja) return;
    const n = ocurrencias({
      desde: valor("#f-desde"), hasta: valor("#f-hasta"),
      cada_dias: aNumero(valor("#f-cada")),
    }).length;

    if (!n) {
      caja.textContent = "Completá desde, hasta y cada cuántos días para ver cuántas aplicaciones son.";
      caja.className = "aviso aviso--info";
      actualizarCobre();
      return;
    }
    const porSector = sectoresMarcados().length || 1;
    caja.innerHTML = `Son <strong>${n} ${n === 1 ? "aplicación" : "aplicaciones"}</strong>` +
      (porSector > 1 ? ` en cada uno de los ${porSector} sectores` : "") + ".";
    caja.className = "aviso aviso--ok";
    actualizarCobre();
  }

  // Mientras se completa el renglón: cómo queda el cobre de la temporada si se
  // agrega. Se suma lo ya guardado más este borrador, porque el tope es de la
  // temporada entera y el número de un renglón suelto no dice nada.
  function actualizarCobre() {
    const caja = destino.querySelector("#cuenta-cobre");
    if (!caja) return;

    const borrador = {
      id: editando || "__borrador",
      producto_id: elegido,
      producto: (ficha(elegido) || {}).nombre || "",
      sectores: sectoresMarcados(),
      litros_por_aplicacion: aNumero(valor("#f-litros")),
      desde: valor("#f-desde"),
      hasta: valor("#f-hasta"),
      cada_dias: aNumero(valor("#f-cada")),
    };

    const filas = cobreDe(
      renglones.filter((r) => r.id !== borrador.id).concat([borrador]))
      .filter((f) => borrador.sectores.indexOf(f.sector) >= 0);

    if (!filas.length) {
      caja.innerHTML = `<p class="nota">Completá los litros, los sectores y las
        fechas para ver cuánto cobre suma.</p>`;
      return;
    }

    const peor = window.Cobre.peor(filas);
    const clase = peor.estado === "pasado" ? "aviso--error"
                : peor.estado === "ok" ? "aviso--ok" : "aviso--info";
    const titulo = peor.estado === "pasado"
      ? `Así la temporada se pasa del tope en ${peor.nombre}.`
      : peor.estado === "sin-superficie"
      ? `Falta la superficie de ${peor.nombre} para saber cuánto es por hectárea.`
      : `Con este renglón, el sector más cargado queda en ${Math.round(peor.porcentaje)} % del tope.`;

    caja.innerHTML = `
      <p class="aviso ${clase}">${esc(titulo)}</p>
      <ul class="cobre__sectores">${filas.map(filaCobre).join("")}</ul>`;
  }

  // Fertirriego en un sector sin cañería no se puede hacer. Se avisa, no se
  // impide: puede estar por instalarlo.
  function avisarRiego() {
    const caja = destino.querySelector("#aviso-riego");
    if (!caja) return;
    actualizarCuenta();

    if (valor("#f-metodo") !== "Fertirriego") { caja.textContent = ""; return; }
    const sinRiego = sectoresMarcados()
      .map((id) => (config.sectores || []).find((s) => s.id === id))
      .filter((s) => s && RIEGOS_QUE_PERMITEN_FERTIRRIEGO.indexOf(s.riego) < 0);

    caja.textContent = sinRiego.length
      ? `Ojo: ${sinRiego.map((s) => s.nombre).join(", ")} no ${sinRiego.length === 1 ? "tiene" : "tienen"} riego por cañería cargado, así que ahí no se podría aplicar por fertirriego.`
      : "";
  }

  async function guardarRenglon() {
    errores = {};
    const f = categoria === "__otro" ? null : ficha(elegido);

    const cobre = window.Cobre.lleva(f) ? f.cobre : null;
    const litros = cobre ? aNumero(valor("#f-litros")) : null;

    const nombre = f ? f.nombre : valor("#f-otro").trim();
    const dosis = valor("#f-dosis").trim();
    const metodo = valor("#f-metodo");
    const sectores = sectoresMarcados();
    const desde = valor("#f-desde");
    const hasta = valor("#f-hasta");
    const cada = aNumero(valor("#f-cada"));

    if (!categoria) errores.categoria = "Elegí el tipo de bioinsumo.";
    else if (categoria !== "__otro" && !elegido) errores.producto = "Elegí cuál de la lista.";
    if (categoria === "__otro" && !nombre) errores.otro = "Escribí el nombre del producto.";
    if (!dosis) errores.dosis = "Poné la dosis, aunque sea aproximada.";
    if (!metodo) errores.metodo = "Elegí con qué lo vas a aplicar.";
    if (!sectores.length) errores.sectores = "Marcá al menos un sector.";
    if (!desde) errores.desde = "Falta la fecha de inicio.";
    if (!hasta) errores.hasta = "Falta la fecha de fin.";
    if (desde && hasta && hasta < desde) errores.hasta = "La fecha de fin es anterior a la de inicio.";
    if (Number.isNaN(cada) || cada <= 0) errores.cada = "Poné cada cuántos días se repite. Por ejemplo: 15";
    // Sin los litros no hay cuenta de cobre posible, y es justo el producto en
    // el que no se puede dejar pasar.
    if (cobre && (Number.isNaN(litros) || litros <= 0)) {
      errores.litros = "Poné cuántos litros de caldo preparás por aplicación. Por ejemplo: "
        + cobre.litros_receta;
    }

    if (Object.keys(errores).length) {
      pintar();
      const primero = destino.querySelector(".mal, .campo__error");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // El motivo sale del tipo elegido en el paso 1: es la misma información y
    // así la planilla la sigue recibiendo sin preguntarla dos veces.
    const tipo = (bio.categorias || []).find((c) => c.id === categoria);

    const datos = {
      temporada: temporadaActual(),
      producto_id: f ? f.id : null,
      producto: nombre,
      categoria: f ? f.categoria : "otro",
      motivo: tipo ? tipo.nombre : "Otro bioinsumo",
      dosis: dosis,
      litros_por_aplicacion: cobre ? litros : null,
      metodo: metodo,
      sectores: sectores,
      desde: desde,
      hasta: hasta,
      cada_dias: cada,
      observaciones: valor("#f-obs").trim(),
      estado: "Activo",
    };

    if (editando) {
      const i = renglones.findIndex((r) => r.id === editando);
      renglones[i] = Object.assign({}, renglones[i], datos);
      await window.BioDB.guardar("planes", renglones[i]);
      brindis(`${nombre} actualizado`);
      editando = null;
    } else {
      const nuevo = Object.assign({ id: window.BioDB.nuevoId(), creado: new Date().toISOString() }, datos);
      renglones.push(nuevo);
      await window.BioDB.guardar("planes", nuevo);
      brindis(`${nombre} agregado · ${ocurrencias(nuevo).length} aplicaciones`);
    }

    categoria = "";
    elegido = "";
    pintar();
    window.scrollTo(0, 0);
  }

  // Deja el plan listo para subir. Cada renglón viaja como una fila de la hoja
  // Plan, con su propio id, así un reintento no duplica.
  async function cerrarPlan() {
    for (const r of renglones) {
      await window.BioDB.encolarCon(r.id, "plan", r);
    }
    brindis(`Plan guardado · ${renglones.length} productos, ${totalOcurrencias()} aplicaciones`);
  }

  return { render, ocurrencias, temporadaActual };
})();
