// ==========================================================================
// BioSalud ECOMARCAL — Seguimiento del plan
//
// El plan dice qué se va a aplicar. Esta sección dice qué toca HOY, qué quedó
// atrasado y qué viene esta semana, y permite ir marcando lo que se hizo.
//
// CÓMO SE IDENTIFICA UNA APLICACIÓN QUE NO ESTÁ GUARDADA
//
// Las ocurrencias del plan se calculan, no se guardan: es una decisión vieja y
// buena, porque así corregir un renglón no puede romper nada (ver DECISIONES.md).
// Pero para marcar una aplicación como hecha hace falta poder nombrarla, y ese
// nombre tiene que sobrevivir a que la lista se vuelva a calcular en cada
// pantallazo.
//
// Por eso el identificador es derivado y no inventado:
//
//     id = renglón del plan + fecha programada + sector
//
// Siempre da lo mismo para la misma aplicación, así que lo registrado vuelve a
// encontrar su lugar sin guardar ninguna lista intermedia. Y si mañana se
// corrige la frecuencia del renglón, las aplicaciones ya registradas siguen
// apareciendo como hechas donde corresponde; las que dejaron de existir
// simplemente no se recalculan, y lo registrado queda igual en la planilla,
// que es lo que de verdad pasó en el campo.
//
// POR QUÉ SE PUEDE MARCAR "NO SE APLICÓ"
//
// Si la única opción fuera "hecho", el semáforo mentiría: todo lo que no se
// aplicó por lluvia, por falta de insumo o porque no hizo falta quedaría igual
// que lo que se olvidó. Para el Consejo de Garantía, un "no se aplicó, llovió
// tres días" es un registro tan válido como una aplicación.
// ==========================================================================

window.Seguimiento = (function () {
  const { esc, brindis, aNumero, superficie, hoy } = window.Util;

  // Qué se considera "esta semana". Siete días es lo que entra en una vista sin
  // que haya que hacer scroll hasta perder el hilo.
  const DIAS_SEMANA = 7;

  const CLIMAS = ["Seco", "Nublado", "Ventoso", "Después de lluvia", "Con calor fuerte"];

  let config = null;
  let renglones = [];      // los renglones del plan de la temporada
  let registradas = [];    // lo que ya se marcó, de la base local
  let sinEnviar = new Set();  // ids que todavía están en la cola de salida
  let destino = null;
  let irA = null;
  let abierto = null;      // id de la ocurrencia con el formulario abierto
  let errores = {};
  let verTodo = false;     // mostrar también lo que viene después de esta semana

  const idDe = (planId, fecha, sector) => planId + "|" + fecha + "|" + sector;

  // ---------- Pantalla ----------

  async function render(contenedor, ruta, navegar) {
    destino = contenedor;
    irA = navegar;
    errores = {};
    abierto = null;

    destino.innerHTML = `<p class="cargando">Cargando el plan…</p>`;
    try {
      config = await window.BioDB.leerConfig();
      renglones = (await window.BioDB.todos("planes"))
        .filter((r) => r.temporada === window.Plan.temporadaActual());
      registradas = await window.BioDB.todos("aplicaciones");
      const cola = await window.BioDB.pendientes();
      sinEnviar = new Set(cola.map((s) => s.id));
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudo leer el seguimiento.<br><br>
        Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Seguimiento", subtitulo: "Error" };
    }

    pintar();
    return {
      titulo: "Seguimiento de plan",
      subtitulo: "Temporada " + window.Plan.temporadaActual(),
    };
  }

  // ---------- La agenda ----------

  function enDias(n) {
    const d = new Date(hoy() + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const registroDe = (id) => registradas.find((a) => a.ocurrencia_id === id);

  const sector = (id) => (config.sectores || []).find((s) => s.id === id) || null;
  const nombreSector = (id) => (sector(id) || { nombre: "Sector que ya no está" }).nombre;

  // Todas las aplicaciones de la temporada, una por renglón, fecha y sector.
  function agenda() {
    const lista = [];
    renglones.forEach((r) => {
      const fechas = window.Plan.ocurrencias(r);
      (r.sectores || []).forEach((s) => {
        fechas.forEach((fecha) => {
          const id = idDe(r.id, fecha, s);
          lista.push({
            id: id,
            plan: r,
            fecha: fecha,
            sector: s,
            nombreSector: nombreSector(s),
            registro: registroDe(id),
          });
        });
      });
    });
    // Por fecha, y dentro del día por producto, que es como se recorre la chacra.
    return lista.sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || String(a.plan.producto).localeCompare(String(b.plan.producto)));
  }

  function pintar() {
    if (!renglones.length) {
      destino.innerHTML = `
        <p class="aviso aviso--info">Todavía no hay plan cargado para la temporada
          ${esc(window.Plan.temporadaActual())}. El seguimiento sale de ahí: primero
          armá la batería de productos y después acá vas a ver qué te toca cada día.</p>
        <button class="boton boton--ancho" data-ir="plan">Ir a Registrar Plan de Salud</button>`;
      conectar();
      return;
    }

    const h = hoy();
    const limite = enDias(DIAS_SEMANA);
    const lista = agenda();
    const pendientes = lista.filter((o) => !o.registro);

    const atrasadas = pendientes.filter((o) => o.fecha < h);
    const deHoy = pendientes.filter((o) => o.fecha === h);
    const semana = pendientes.filter((o) => o.fecha > h && o.fecha <= limite);
    const despues = pendientes.filter((o) => o.fecha > limite);

    destino.innerHTML = `
      ${semaforo(lista, h)}

      ${grupo("Atrasado", atrasadas, "grupo-agenda--atrasado",
        "Pasó la fecha y no está marcado. Si no se aplicó, conviene decirlo igual.")}

      ${grupo("Hoy", deHoy, "grupo-agenda--hoy",
        "Lo que toca aplicar hoy.")}

      ${grupo("Esta semana", semana, "grupo-agenda--semana",
        `Los próximos ${DIAS_SEMANA} días, para poder preparar lo que haga falta.`)}

      ${!atrasadas.length && !deHoy.length && !semana.length ? `
        <p class="aviso aviso--ok">No hay nada atrasado ni pendiente para esta semana.</p>` : ""}

      ${despues.length ? `
        <div class="tarjeta">
          <h2>Más adelante</h2>
          <p class="nota">Quedan ${despues.length} ${despues.length === 1
            ? "aplicación" : "aplicaciones"} después de esta semana.</p>
          ${verTodo ? `<ul class="agenda">${despues.map(fila).join("")}</ul>` : `
            <button class="boton boton--secundario boton--ancho" id="btn-ver-todo">
              Ver todas</button>`}
        </div>` : ""}

      ${hechas(lista)}

      <button class="boton boton--secundario boton--ancho" data-ir="plan">Ver el plan de la temporada</button>`;

    conectar();
  }

  // ---------- Semáforo de cumplimiento ----------
  //
  // Mide solo lo que ya venció: lo que todavía no llegó no se cumple ni se
  // incumple, y contarlo daría un porcentaje bajo que no significa nada en
  // octubre y mejora solo porque pasa el tiempo.

  function semaforo(lista, h) {
    const vencidas = lista.filter((o) => o.fecha <= h);
    if (!vencidas.length) {
      return `<div class="tarjeta">
        <h2>Cumplimiento</h2>
        <p class="nota">La temporada todavía no empezó: no hay ninguna aplicación
          vencida para medir.</p>
      </div>`;
    }

    const resueltas = vencidas.filter((o) => o.registro);
    const aplicadas = resueltas.filter((o) => o.registro.estado === "Aplicada").length;
    const noAplicadas = resueltas.length - aplicadas;
    const porcentaje = Math.round((resueltas.length / vencidas.length) * 100);
    const estado = porcentaje >= 90 ? "ok" : porcentaje >= 60 ? "medio" : "bajo";

    return `
      <div class="tarjeta semaforo semaforo--${estado}">
        <h2>Cumplimiento</h2>
        <div class="semaforo__cifra">
          <strong>${porcentaje} %</strong>
          <span>${resueltas.length} de ${vencidas.length} aplicaciones vencidas,
            registradas</span>
        </div>
        <progress class="semaforo__barra" max="${vencidas.length}" value="${resueltas.length}"></progress>
        <p class="nota">${aplicadas} ${aplicadas === 1 ? "aplicada" : "aplicadas"}${
          noAplicadas ? ` · ${noAplicadas} marcada${noAplicadas === 1 ? "" : "s"} como no aplicada${noAplicadas === 1 ? "" : "s"}` : ""
        }${vencidas.length - resueltas.length ? ` · ${vencidas.length - resueltas.length} sin marcar` : ""}.</p>
      </div>`;
  }

  // ---------- Grupos de la agenda ----------

  function grupo(titulo, items, clase, bajada) {
    if (!items.length) return "";
    return `
      <div class="tarjeta grupo-agenda ${clase}">
        <h2>${esc(titulo)} <span class="grupo-agenda__cuenta">${items.length}</span></h2>
        <p class="nota">${esc(bajada)}</p>
        <ul class="agenda">${items.map(fila).join("")}</ul>
      </div>`;
  }

  function fila(o) {
    const abiertaAca = abierto === o.id;
    return `
      <li class="agenda__item${abiertaAca ? " agenda__item--abierto" : ""}">
        <div class="agenda__cab">
          <span class="agenda__fecha">${esc(fechaCorta(o.fecha))}</span>
          <span class="agenda__texto">
            <strong>${esc(o.plan.producto)}</strong>
            <span class="agenda__detalle">${esc(o.nombreSector)} · ${esc(o.plan.dosis)}
              · ${esc(o.plan.metodo)}</span>
          </span>
        </div>
        ${abiertaAca ? formulario(o) : `
          <button class="boton boton--secundario boton--ancho" data-marcar="${esc(o.id)}">
            Marcar</button>`}
      </li>`;
  }

  function fechaCorta(iso) {
    const [a, m, d] = String(iso || "").split("-");
    return d && m ? `${d}/${m}` : "—";
  }

  // ---------- El formulario de registro ----------
  //
  // Se abre uno por vez, debajo de la aplicación que se está marcando. Todo
  // viene propuesto: la fecha de hoy y el responsable de la configuración, que
  // es lo que va a ser cierto nueve de cada diez veces.

  function formulario(o) {
    const sec = sector(o.sector);
    return `
      <div class="agenda__form">
        <div class="fila">
          <div class="campo">
            <label for="a-fecha">Fecha en que se aplicó</label>
            <input id="a-fecha" type="date" class="${mal("fecha")}" value="${esc(hoy())}">
            ${error("fecha")}
            ${o.fecha < hoy() ? `<span class="ayuda">Viene propuesta la de hoy.
              Estaba programada para el ${esc(fechaCorta(o.fecha))}: si la aplicaste
              ese día, cambiala.</span>` : ""}
          </div>
          <div class="campo">
            <label for="a-volumen">Volumen aplicado
              <span class="ayuda">Litros de caldo. Opcional.</span></label>
            <input id="a-volumen" type="text" inputmode="decimal" autocomplete="off"
                   value="${esc(o.plan.litros_por_aplicacion || "")}" placeholder="20">
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="a-operador">Quién aplicó</label>
            <input id="a-operador" type="text" autocomplete="off"
                   value="${esc((config || {}).responsable || "")}">
          </div>
          <div class="campo">
            <label for="a-clima">Clima</label>
            <select id="a-clima">
              <option value="">Sin anotar…</option>
              ${CLIMAS.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="campo">
          <label for="a-obs">Observaciones <span class="ayuda">Opcional</span></label>
          <textarea id="a-obs" rows="2" placeholder="Qué se vio, qué se ajustó"></textarea>
        </div>

        ${sec ? `<p class="nota">Sector ${esc(sec.nombre)}, ${esc(superficie(sec.superficie))},
          ${esc(sec.cultivo || "")}.</p>` : ""}

        <button class="boton boton--ancho" data-guardar="${esc(o.id)}">Se aplicó</button>
        <button class="boton boton--secundario boton--ancho" data-no-aplico="${esc(o.id)}">
          No se aplicó</button>
        <button class="boton--peligro centrado" data-cerrar="1">Cancelar</button>
      </div>`;
  }

  const error = (c) => (errores[c] ? `<span class="campo__error">${esc(errores[c])}</span>` : "");
  const mal = (c) => (errores[c] ? " mal" : "");

  // ---------- Lo ya registrado ----------

  function hechas(lista) {
    const resueltas = lista.filter((o) => o.registro)
      .sort((a, b) => String(b.registro.creado).localeCompare(String(a.registro.creado)));
    if (!resueltas.length) return "";

    return `
      <details class="grupo separado">
        <summary class="grupo__cab">
          <span class="grupo__icono">✅</span>
          <span class="grupo__texto">
            <span class="grupo__nombre">Lo que ya registraste</span>
            <span class="grupo__cuenta">${resueltas.length} ${resueltas.length === 1
              ? "aplicación" : "aplicaciones"}</span>
          </span>
          <span class="grupo__flecha" aria-hidden="true"></span>
        </summary>
        <div class="grupo__cuerpo">
          <ul class="agenda">
            ${resueltas.map((o) => {
              const r = o.registro;
              const enCola = sinEnviar.has(r.id);
              return `
                <li class="agenda__item agenda__item--hecho">
                  <div class="agenda__cab">
                    <span class="agenda__fecha">${esc(fechaCorta(r.fecha_aplicada || o.fecha))}</span>
                    <span class="agenda__texto">
                      <strong>${esc(o.plan.producto)}</strong>
                      <span class="agenda__detalle">${esc(o.nombreSector)} ·
                        ${esc(r.estado)}${r.operador ? " · " + esc(r.operador) : ""}
                        ${r.fecha_aplicada && r.fecha_aplicada !== o.fecha
                          ? " · programada el " + esc(fechaCorta(o.fecha)) : ""}</span>
                    </span>
                  </div>
                  ${enCola
                    ? `<button class="boton--peligro centrado" data-deshacer="${esc(r.id)}">Deshacer</button>`
                    : `<span class="agenda__subido">Ya subió a la planilla</span>`}
                </li>`;
            }).join("")}
          </ul>
          <p class="nota">Lo que ya subió a la planilla no se puede deshacer desde
            el teléfono: si hay que corregirlo, avisale al equipo técnico.</p>
        </div>
      </details>`;
  }

  // ---------- Eventos ----------

  function conectar() {
    destino.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => irA(b.dataset.ir);
    });

    const verTodas = destino.querySelector("#btn-ver-todo");
    if (verTodas) verTodas.onclick = () => { verTodo = true; pintar(); };

    destino.querySelectorAll("[data-marcar]").forEach((b) => {
      b.onclick = () => {
        abierto = b.dataset.marcar;
        errores = {};
        pintar();
        const form = destino.querySelector(".agenda__form");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });

    const cerrar = destino.querySelector("[data-cerrar]");
    if (cerrar) cerrar.onclick = () => { abierto = null; errores = {}; pintar(); };

    const guardar = destino.querySelector("[data-guardar]");
    if (guardar) guardar.onclick = () => registrar(guardar.dataset.guardar, "Aplicada");

    const noAplico = destino.querySelector("[data-no-aplico]");
    if (noAplico) noAplico.onclick = () => registrar(noAplico.dataset.noAplico, "No aplicada");

    destino.querySelectorAll("[data-deshacer]").forEach((b) => {
      b.onclick = () => deshacer(b.dataset.deshacer);
    });
  }

  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  // ---------- Guardar ----------

  async function registrar(id, estado) {
    const o = agenda().find((x) => x.id === id);
    if (!o) return;

    errores = {};
    const fecha = valor("#a-fecha");
    if (estado === "Aplicada" && !fecha) errores.fecha = "Poné la fecha en que se aplicó.";
    if (Object.keys(errores).length) { pintar(); return; }

    const sec = sector(o.sector);
    const datos = {
      id: window.BioDB.nuevoId(),
      ocurrencia_id: o.id,
      plan_id: o.plan.id,
      fecha: estado === "Aplicada" ? fecha : o.fecha,   // índice de la base
      fecha_programada: o.fecha,
      fecha_aplicada: estado === "Aplicada" ? fecha : "",
      producto: o.plan.producto,
      producto_id: o.plan.producto_id || null,
      dosis: o.plan.dosis,
      metodo: o.plan.metodo,
      sector: o.nombreSector,
      sector_id: o.sector,
      superficie: sec ? sec.superficie : "",
      volumen: valor("#a-volumen").trim(),
      operador: valor("#a-operador").trim(),
      clima: valor("#a-clima"),
      estado: estado,
      observaciones: valor("#a-obs").trim(),
      creado: new Date().toISOString(),
    };

    await window.BioDB.guardar("aplicaciones", datos);
    // Con su propio id: si el envío se reintenta, la planilla no duplica la fila.
    await window.BioDB.encolarCon(datos.id, "aplicaciones", datos);

    registradas.push(datos);
    sinEnviar.add(datos.id);
    abierto = null;
    brindis(estado === "Aplicada"
      ? `${o.plan.producto} marcado como aplicado`
      : `${o.plan.producto} marcado como no aplicado`);
    pintar();

    // Si hay señal, sube sola; si no, queda en la cola.
    window.Envio.sincronizar(true).then(() => actualizarCola());
  }

  async function deshacer(idRegistro) {
    const r = registradas.find((a) => a.id === idRegistro);
    if (!r) return;
    if (!confirm(`¿Deshacer el registro de ${r.producto} del ${fechaCorta(r.fecha_programada)}?`)) return;

    await window.BioDB.borrar("aplicaciones", idRegistro);
    await window.BioDB.borrar("salida", idRegistro);
    registradas = registradas.filter((a) => a.id !== idRegistro);
    sinEnviar.delete(idRegistro);
    brindis("Registro deshecho");
    pintar();
  }

  async function actualizarCola() {
    const cola = await window.BioDB.pendientes();
    sinEnviar = new Set(cola.map((s) => s.id));
    pintar();
  }

  return { render };
})();
