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
  const { esc, brindis, numero, aNumero, superficie, hoy } = window.Util;

  // Qué se considera "esta semana". Siete días es lo que entra en una vista sin
  // que haya que hacer scroll hasta perder el hilo.
  const DIAS_SEMANA = 7;

  const CLIMAS = ["Seco", "Nublado", "Ventoso", "Después de lluvia", "Con calor fuerte"];

  let bio = null;          // datos/biopreparados.json, para la cuenta del cobre
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
      if (!bio) bio = await (await fetch("datos/biopreparados.json")).json();
      config = await window.BioDB.leerConfig();
      // La agenda sale del plan de la temporada MÁS los tratamientos armados
      // desde un monitoreo: los dos son lo mismo para quien tiene que aplicar
      // —un producto que se repite cada tantos días en ciertos sectores—, y
      // separarlos obligaría al productor a mirar dos listas para saber qué le
      // toca hoy. De dónde salió cada uno se marca con `desdeMonitoreo`.
      const plan = (await window.BioDB.todos("planes"))
        .filter((r) => r.temporada === window.Plan.temporadaActual());
      const tratamientos = (await window.BioDB.todos("tratamientos"))
        .filter((r) => r.temporada === window.Plan.temporadaActual())
        .map((r) => Object.assign({}, r, { desdeMonitoreo: true }));
      renglones = plan.concat(tratamientos);
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
    return window.Util.fechaISO(d);
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

  // LO QUE ESTÁ LISTO PARA CUANDO HAGA FALTA.
  //
  // Los renglones marcados "ante necesidad" no tienen fechas, así que no entran
  // en la agenda: aparecerían atrasados todos los días, que es exactamente lo
  // que no son. Pero tienen que estar a la vista, por dos razones: para que el
  // productor sepa qué insumo le conviene tener preparado, y para poder
  // registrar la aplicación el día que la haga.
  //
  // Se les arma una ocurrencia con la fecha de hoy, así el registro usa el
  // mismo camino que el resto —el id derivado de renglón, fecha y sector— y la
  // planilla recibe una fila igual a cualquier otra.
  function listosANecesidad() {
    const h = hoy();
    const lista = [];
    renglones.filter((r) => r.modo === "necesidad").forEach((r) => {
      (r.sectores || []).forEach((s) => {
        const id = idDe(r.id, h, s);
        lista.push({
          id: id,
          plan: r,
          fecha: h,
          sector: s,
          nombreSector: nombreSector(s),
          registro: registroDe(id),
          aNecesidad: true,
        });
      });
    });
    return lista;
  }

  // Para buscar una ocurrencia por id hay que mirar en las dos listas.
  const todas = () => agenda().concat(listosANecesidad());

  // UN RENGLÓN POR APLICACIÓN, NO POR SECTOR.
  //
  // La agenda se calcula por sector, porque así se registra y así lo necesita
  // la cuenta del cobre. Pero mostrarla así hacía que "biofertilizante en A, B
  // y C" fueran tres cuadros iguales con tres botones, y la lista de una semana
  // no entraba en la pantalla. Acá se juntan los sectores de un mismo producto
  // y un mismo día en un solo renglón: se marca una vez, y adentro se puede
  // destildar el sector donde no se aplicó. Por debajo sigue quedando un
  // registro por sector, igual que antes.
  function juntar(items, claveDe) {
    const mapa = new Map();
    items.forEach((o) => {
      const k = claveDe ? claveDe(o) : o.plan.id + "|" + o.fecha;
      if (!mapa.has(k)) {
        mapa.set(k, { clave: k, plan: o.plan, fecha: o.fecha, aNecesidad: !!o.aNecesidad, partes: [] });
      }
      mapa.get(k).partes.push(o);
    });
    return [...mapa.values()];
  }

  const sectoresDe = (g) => (g.partes.length === 1 ? "Sector " : "Sectores ")
    + g.partes.map((p) => p.nombreSector).join(", ");

  function pintar() {
    if (!renglones.length) {
      destino.innerHTML = `
        <p class="aviso aviso--info">Todavía no hay plan cargado para la temporada
          ${esc(window.Plan.temporadaActual())}. El seguimiento sale de ahí: primero
          armá la batería de productos y después acá vas a ver qué te toca cada día.</p>
        <button class="boton boton--ancho" data-ir="plan">Ir a Registrar Plan de Salud</button>
        ${fueraDelPlan()}`;
      conectar();
      return;
    }

    const h = hoy();
    const limite = enDias(DIAS_SEMANA);
    const lista = agenda();
    const pendientes = lista.filter((o) => !o.registro);

    const atrasadas = juntar(pendientes.filter((o) => o.fecha < h));
    const deHoy = juntar(pendientes.filter((o) => o.fecha === h));
    const semana = juntar(pendientes.filter((o) => o.fecha > h && o.fecha <= limite));
    const despues = juntar(pendientes.filter((o) => o.fecha > limite));

    const todosLosListos = listosANecesidad();
    const listos = juntar(todosLosListos.filter((o) => !o.registro));
    const yaHoy = todosLosListos.filter((o) => o.registro).length;

    destino.innerHTML = `
      ${semaforo(lista, h)}

      ${cobreAplicado()}

      ${todosLosListos.length ? `
        <div class="tarjeta grupo-agenda grupo-agenda--listo">
          <h2>Listo para cuando haga falta
            <span class="grupo-agenda__cuenta">${listos.length}</span></h2>
          <p class="nota">Sin fecha: se aplican cuando el monitoreo lo pide, y
            nunca figuran como atrasados.</p>
          <ul class="agenda">${listos.map(fila).join("")}</ul>
          ${yaHoy ? `<p class="nota">Hoy ya registraste ${yaHoy}
            ${yaHoy === 1 ? "aplicación" : "aplicaciones"} de estos.</p>` : ""}
        </div>` : ""}

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

      ${fueraDelPlan()}

      <button class="boton boton--secundario boton--ancho" data-ir="plan">Ver o corregir el plan y los tratamientos</button>`;

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

  // ---------- Cobre efectivamente aplicado ----------
  //
  // Acá la cuenta sale de lo aplicado y no de lo previsto, que es la diferencia
  // que importa: el tope del Anexo III se mide sobre lo que entró al suelo. El
  // plan sigue mostrando su proyección, porque enterarse en febrero de que el
  // plan se pasaba no sirve de nada.
  //
  // Solo aparece si hay cobre registrado. Una tarjeta que dice "0 kg" en una
  // chacra que no usa cobre es ruido en una pantalla que se mira con una mano.

  function cobreAplicado() {
    const ficha = (id) => (bio.fichas || []).find((f) => f.id === id);

    // Si no se anotó el volumen, se cae al previsto del renglón del plan.
    const litrosDelPlan = (r) => {
      const renglon = renglones.find((x) => x.id === r.plan_id);
      return renglon ? renglon.litros_por_aplicacion : 0;
    };

    const { aplicaciones, estimados, sinDato } =
      window.Cobre.aplicacionesRegistradas(registradas, litrosDelPlan);

    const tope = window.Cobre.limite(bio);
    const filas = window.Cobre.porSector(aplicaciones, config.sectores || [], ficha, tope);
    if (!filas.length) return "";

    const peor = window.Cobre.peor(filas);
    const clase = peor.estado === "pasado" ? "aviso--error"
                : peor.estado === "ok" ? "aviso--ok" : "aviso--info";
    const titulo = peor.estado === "pasado"
      ? `Ya se pasó el tope de cobre en ${peor.nombre}.`
      : peor.estado === "cerca"
      ? `En ${peor.nombre} vas por el ${Math.round(peor.porcentaje)} % del tope de cobre.`
      : peor.estado === "sin-superficie"
      ? `Falta la superficie de ${peor.nombre} para saber cuánto es por hectárea.`
      : "El cobre aplicado está dentro del tope.";

    return `
      <div class="tarjeta cobre">
        <h2>Cobre aplicado</h2>
        <p class="aviso ${clase}">${esc(titulo)}</p>
        <ul class="cobre__sectores">${filas.map(filaCobre).join("")}</ul>
        <p class="nota">Surge de las aplicaciones que marcaste, no del plan.
          ${estimados ? `En ${estimados} ${estimados === 1 ? "aplicación" : "aplicaciones"}
            no anotaste el volumen, así que se usó el previsto del plan.` : ""}
          ${sinDato ? `Hay ${sinDato} ${sinDato === 1 ? "aplicación" : "aplicaciones"}
            sin volumen ni previsto, que ${sinDato === 1 ? "quedó" : "quedaron"} afuera
            de la cuenta.` : ""}</p>
      </div>`;
  }

  // Se dibuja igual que en el plan: el número contra el tope y la barra, que es
  // lo que deja ver de un vistazo si está cerca.
  function filaCobre(f) {
    const tope = window.Cobre.limite(bio);
    return `
      <li class="cobre__sector cobre__sector--${esc(f.estado)}">
        <div class="cobre__linea">
          <strong>${esc(f.nombre)}</strong>
          <span>${f.kg_por_ha === null
            ? numero(Math.round(f.gramos)) + " g en total"
            : numero(Math.round(f.kg_por_ha * 100) / 100) + " de "
              + numero(tope) + " kg/ha"}</span>
        </div>
        ${f.kg_por_ha === null ? "" : `<progress class="cobre__barra" max="${esc(String(tope))}"
          value="${esc(String(Math.min(tope, f.kg_por_ha)))}"></progress>`}
        <span class="cobre__detalle">${f.kg_por_ha === null
          ? "Este sector no tiene superficie cargada, así que no se puede saber cuánto es por hectárea."
          : esc(superficie(f.superficie) + " · " + numero(Math.round(f.gramos)) +
                " g de cobre aplicados · " + f.productos.map((p) => p.nombre).join(", "))}</span>
      </li>`;
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

  // Cerrado, el renglón es una sola línea con el botón al costado: lo que hay
  // que leer —qué, dónde, cuánto— y nada más. El formulario se abre debajo.
  function fila(g) {
    const abiertaAca = abierto === g.clave;
    return `
      <li class="agenda__item${abiertaAca ? " agenda__item--abierto" : ""}">
        <div class="agenda__cab">
          <span class="agenda__fecha">${g.aNecesidad ? "s/f" : esc(fechaCorta(g.fecha))}</span>
          <span class="agenda__texto">
            <strong>${esc(g.plan.producto)}</strong>
            <span class="agenda__detalle">${esc(sectoresDe(g))} · ${esc(g.plan.dosis)}
              · ${esc(g.plan.metodo)}${g.plan.desdeMonitoreo
                ? ` · <span class="agenda__origen">sale de un monitoreo</span>` : ""}</span>
          </span>
          ${abiertaAca ? "" : `<button class="boton boton--secundario agenda__marcar"
            data-marcar="${esc(g.clave)}">${g.aNecesidad ? "Lo apliqué" : "Marcar"}</button>`}
        </div>
        ${abiertaAca ? formulario(g) : ""}
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

  function formulario(g) {
    const o = g.partes[0];
    const sec = g.partes.length === 1 ? sector(o.sector) : null;
    const variosSectores = g.partes.map((p) => ({ id: p.sector, nombre: p.nombreSector }));
    return `
      <div class="agenda__form">
        ${g.partes.length > 1 ? `
          <div class="campo">
            <span class="campo__titulo">Dónde se aplicó
              <span class="ayuda">Vienen todos marcados. Destildá el sector donde
                no: queda pendiente.</span></span>
            ${window.Util.chipsSectores(variosSectores, variosSectores.map((s) => s.id), "a-sector")}
            ${error("sectores")}
          </div>` : ""}
        <div class="fila">
          <div class="campo">
            <label for="a-fecha">Fecha en que se aplicó</label>
            <input id="a-fecha" type="date" class="${mal("fecha")}" value="${esc(hoy())}">
            ${error("fecha")}
            ${o.fecha < hoy() ? `<span class="ayuda">Se propone la de hoy.
              Estaba programada para el ${esc(fechaCorta(o.fecha))}: si la aplicaste
              ese día, cambiala.</span>` : ""}
          </div>
          <div class="campo">
            <label for="a-volumen">Volumen aplicado
              <span class="ayuda">Litros de caldo${g.partes.length > 1 ? " en cada sector" : ""}. Opcional.</span></label>
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

        <button class="boton boton--ancho" data-guardar="${esc(g.clave)}">Se aplicó</button>
        <button class="boton boton--secundario boton--ancho" data-no-aplico="${esc(g.clave)}">
          No se aplicó</button>
        <button class="boton--peligro centrado" data-cerrar="1">Cancelar</button>
      </div>`;
  }

  const error = (c) => (errores[c] ? `<span class="campo__error">${esc(errores[c])}</span>` : "");
  const mal = (c) => (errores[c] ? " mal" : "");

  // ---------- Lo ya registrado ----------

  function hechas(lista) {
    // Juntas igual que la agenda: lo que se marcó de una vez en tres sectores
    // se lee como una sola línea.
    const resueltas = juntar(lista.filter((o) => o.registro)
      .sort((a, b) => String(b.registro.creado).localeCompare(String(a.registro.creado))),
      (o) => [o.plan.id, o.fecha, o.registro.estado, o.registro.fecha_aplicada].join("|"));
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
            ${resueltas.map((g) => {
              const o = g.partes[0];
              const r = o.registro;
              // Solo se deshace lo que todavía no salió del teléfono.
              const enCola = g.partes.map((p) => p.registro.id).filter((id) => sinEnviar.has(id));
              return `
                <li class="agenda__item agenda__item--hecho">
                  <div class="agenda__cab">
                    <span class="agenda__fecha">${esc(fechaCorta(r.fecha_aplicada || o.fecha))}</span>
                    <span class="agenda__texto">
                      <strong>${esc(o.plan.producto)}</strong>
                      <span class="agenda__detalle">${esc(sectoresDe(g))} ·
                        ${esc(r.estado)}${r.operador ? " · " + esc(r.operador) : ""}
                        ${r.fecha_aplicada && r.fecha_aplicada !== o.fecha
                          ? " · programada el " + esc(fechaCorta(o.fecha)) : ""}${
                        enCola.length ? "" : " · ya en la planilla"}</span>
                    </span>
                    ${enCola.length
                      ? `<button class="boton--peligro agenda__marcar" data-deshacer="${esc(enCola.join(","))}">Deshacer</button>`
                      : ""}
                  </div>
                </li>`;
            }).join("")}
          </ul>
          <p class="nota">Lo que ya subió a la planilla no se puede deshacer desde
            el teléfono: si hay que corregirlo, avisale al equipo técnico.</p>
        </div>
      </details>`;
  }

  // ---------- Lo aplicado fuera del plan ----------
  //
  // No entra en el semáforo: el cumplimiento se mide contra lo planificado, y
  // una aplicación de urgencia no cumple ni incumple nada. Pero sí tiene que
  // estar a la vista acá, porque esta es la pantalla de "qué se aplicó", y
  // sí entra en la cuenta del cobre, que es sobre todo lo que tocó el suelo.

  function fueraDelPlan() {
    const libres = registradas.filter((a) => a.origen === "Fuera del plan")
      .sort((a, b) => String(b.fecha_aplicada).localeCompare(String(a.fecha_aplicada)) ||
        String(b.creado).localeCompare(String(a.creado)));
    // Juntas por aplicación: lo que se hizo en tres sectores es un renglón.
    const grupos = window.Aplicacion.juntarLibres(libres);
    return `
      <div class="tarjeta">
        <h2>Fuera del plan${grupos.length ? ` <span class="grupo-agenda__cuenta">${grupos.length}</span>` : ""}</h2>
        <p class="nota">No cuenta para el cumplimiento, pero queda registrado.</p>
        ${grupos.length ? `<ul class="agenda">${grupos.slice(0, 5)
          .map((g) => window.Aplicacion.filaLibre(g, sinEnviar)).join("")}</ul>
          ${grupos.length > 5 ? `<p class="nota">Y ${grupos.length - 5} más, en Registrar aplicación.</p>` : ""}` : ""}
        <button class="boton boton--secundario boton--ancho" data-ir="aplicacion">
          Registrar una aplicación fuera del plan</button>
      </div>`;
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

    destino.querySelectorAll("[data-deshacer-libre]").forEach((b) => {
      b.onclick = () => window.Aplicacion.deshacer(b.dataset.deshacerLibre, () => {
        const idos = b.dataset.deshacerLibre.split(",");
        registradas = registradas.filter((a) => !idos.includes(a.id));
        idos.forEach((id) => sinEnviar.delete(id));
        pintar();
      });
    });
  }

  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  // ---------- Guardar ----------

  // Mientras se está guardando no se atiende otro toque: en un teléfono lento
  // el segundo toque sobre "Se aplicó" llegaba antes de que la pantalla
  // cambiara, y la misma aplicación quedaba registrada dos veces.
  let guardando = false;

  async function registrar(clave, estado) {
    if (guardando) return;
    // Solo lo que sigue pendiente: lo ya registrado no suma otra fila.
    const g = juntar(todas().filter((x) => !x.registro)).find((x) => x.clave === clave);
    if (!g) { abierto = null; pintar(); return; }

    // Con un solo sector no hay fichas que mirar: es ese.
    const marcados = [...destino.querySelectorAll(".a-sector:checked")].map((c) => c.value);
    const partes = g.partes.length === 1 ? g.partes
      : g.partes.filter((p) => marcados.includes(p.sector));

    errores = {};
    const fecha = valor("#a-fecha");
    if (estado === "Aplicada" && !fecha) errores.fecha = "Indicá la fecha en que se aplicó.";
    if (!partes.length) errores.sectores = "Marcá al menos un sector.";
    if (Object.keys(errores).length) { pintar(); return; }

    const comunes = {
      volumen: valor("#a-volumen").trim(),
      operador: valor("#a-operador").trim(),
      clima: valor("#a-clima"),
      observaciones: valor("#a-obs").trim(),
    };

    guardando = true;
    try {
      for (const o of partes) await registrarUna(o, estado, fecha, comunes);
    } finally {
      guardando = false;
    }

    abierto = null;
    const donde = partes.length > 1 ? ` en ${partes.length} sectores` : "";
    brindis(estado === "Aplicada"
      ? `${g.plan.producto} marcado como aplicado${donde}`
      : `${g.plan.producto} marcado como no aplicado${donde}`);
    pintar();

    // Si hay señal, sube sola; si no, queda en la cola.
    window.Envio.sincronizar(true).then(() => actualizarCola());
  }

  // Un registro por sector, como siempre: así la cuenta del cobre y la planilla
  // no cambian aunque en pantalla se marque todo junto.
  async function registrarUna(o, estado, fecha, comunes) {
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
      volumen: comunes.volumen,
      operador: comunes.operador,
      clima: comunes.clima,
      estado: estado,
      observaciones: comunes.observaciones,
      creado: new Date().toISOString(),
    };

    await window.BioDB.guardar("aplicaciones", datos);
    // Con su propio id: si el envío se reintenta, la planilla no duplica la fila.
    await window.BioDB.encolarCon(datos.id, "aplicaciones", datos);

    registradas.push(datos);
    sinEnviar.add(datos.id);
  }

  // Llegan los ids de todos los sectores de ese renglón, separados por coma.
  async function deshacer(ids) {
    const lista = String(ids).split(",")
      .map((id) => registradas.find((a) => a.id === id)).filter(Boolean);
    if (!lista.length) return;
    const r = lista[0];
    const donde = lista.length > 1 ? ` en ${lista.map((a) => a.sector).join(", ")}` : "";
    if (!confirm(`¿Deshacer el registro de ${r.producto} del ${fechaCorta(r.fecha_programada)}${donde}?`)) return;

    for (const a of lista) {
      await window.BioDB.borrar("aplicaciones", a.id);
      await window.BioDB.borrar("salida", a.id);
      sinEnviar.delete(a.id);
    }
    registradas = registradas.filter((a) => !lista.includes(a));
    brindis("Registro deshecho");
    pintar();
  }

  async function actualizarCola() {
    const cola = await window.BioDB.pendientes();
    sinEnviar = new Set(cola.map((s) => s.id));
    // Si el envío termina con el productor ya en otra pantalla, no se pinta
    // encima de ella.
    if (location.hash.indexOf("#/seguimiento") !== 0) return;
    // Tampoco si ya abrió el formulario de la aplicación siguiente: repintar lo
    // dibuja de cero y se lleva la fecha, el volumen y las observaciones que
    // estuviera escribiendo. Con poca señal el envío tarda varios segundos, que
    // es justo lo que se tarda en tocar "Marcar" en el renglón de abajo. La
    // lista se pone al día sola en el próximo pantallazo.
    if (abierto) return;
    pintar();
  }

  return { render };
})();
