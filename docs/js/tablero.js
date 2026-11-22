// ==========================================================================
// BioSalud ECOMARCAL — el tablero del inicio
//
// Al abrir la app, antes del menú, lo que dice cómo viene la temporada sin
// tener que entrar a ninguna sección:
//
//   · HOY: qué toca aplicar, qué quedó atrasado y qué biopreparado hay que
//     empezar a preparar para llegar a la primera aplicación del plan.
//   · CUATRO RELOJES: plan cumplido, puntualidad, monitoreo al día y
//     prevención contra respuesta. Cada uno se toca para ver de qué está
//     hecho: nunca un porcentaje solo.
//   · LA TIRA DE DÍAS: una semana para atrás y una para adelante, un renglón
//     por producto, con lo hecho, lo que viene y lo atrasado.
//   · LA CURVA DE SANIDAD: la incidencia de cada plaga en la temporada y,
//     debajo, lo aplicado. Cada plaga se toca para verla por sector.
//   · SABÍAS QUE: un dato por día de las fichas de la wiki.
//
// DE DÓNDE SALEN LOS NÚMEROS
//
// Todo de la base del teléfono, sin pedirle nada al servicio: el tablero
// funciona sin señal, como el resto de la app. Qué está hecho y qué atrasado
// lo cuenta la misma función que dibuja el Seguimiento (Seguimiento.agendaDe):
// el inicio y el Seguimiento no pueden decir cosas distintas.
//
// Lo que no se puede: si alguien cambia de teléfono, el tablero arranca vacío
// aunque la planilla tenga toda la temporada. La planilla es el registro; esto
// es una ayuda para el día a día.
// ==========================================================================

window.Tablero = (function () {
  const { esc, hoy, fechaISO, numero } = window.Util;

  // Dentro de estos días, antes o después de lo programado, una aplicación
  // está "en fecha". Los biopreparados se repiten cada 7 a 15 días: dos días de
  // corrimiento todavía es la misma aplicación; cinco ya es otra cosa.
  const EN_FECHA_DIAS = 2;
  // Un sector está "al día" si se monitoreó en la última semana. Es la
  // frecuencia que piden las fichas de plagas para la temporada de crecimiento.
  const MONITOREO_DIAS = 7;
  // La tira: cuántos días para cada lado de hoy.
  const DIAS_TIRA = 7;
  // Cuántos productos entran en la tira antes de que deje de leerse.
  const FILAS_TIRA = 6;
  // Con cuánta anticipación se avisa que hay que empezar un biopreparado.
  const AVISO_PREPARAR_DIAS = 7;

  // La curva de sanidad: cuántas plagas y cuántos productos entran antes de
  // que el dibujo deje de leerse.
  const SERIES_CURVA = 4;
  const PRODUCTOS_CURVA = 5;

  let bio = null;          // datos/biopreparados.json, por el tiempo de elaboración
  let plagas = null;       // datos/plagas.json, para los «sabías que»
  let cuenta = null;       // la última cuenta, para redibujar sin volver a leer
  let destino = null;
  let irA = null;
  let abierto = "";        // qué reloj muestra su detalle; vacío = ninguno
  let plagaAbierta = "";   // qué plaga de la curva muestra su detalle por sector
  let dato = null;         // qué «sabías que» se está mostrando (índice); null = el del día

  // ---------- Fechas ----------

  function masDias(iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return fechaISO(d);
  }

  const diasEntre = (a, b) =>
    Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

  function fechaCorta(iso) {
    const [, m, d] = String(iso || "").split("-");
    return d && m ? `${d}/${m}` : "—";
  }

  // La temporada va de julio a junio (ver Plan.temporadaActual).
  function rangoTemporada(t) {
    const a = parseInt(t, 10);
    return { desde: `${a}-07-01`, hasta: `${a + 1}-06-30` };
  }

  const plural = (n, uno, muchos) => `${numero(n)} ${n === 1 ? uno : muchos}`;

  function mediana(lista) {
    if (!lista.length) return null;
    const o = lista.slice().sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
  }

  // "15 días", "12 a 15 días", "1 semana", "3 a 4 meses": cuántos días hay
  // que esperar, tomando el número más alto. Un texto sin números ("se usa el
  // mismo día", "de días a dos semanas") no da aviso: mejor callarse que
  // inventar un plazo.
  function diasDeElaboracion(texto) {
    const re = /(\d+)(?:\s*a\s*(\d+))?\s*(d[ií]as?|semanas?|mes(?:es)?)/gi;
    let mayor = 0;
    let m;
    while ((m = re.exec(String(texto || "")))) {
      const n = Number(m[2] || m[1]);
      const u = m[3].toLowerCase();
      const dias = u.indexOf("sem") === 0 ? n * 7 : u.indexOf("mes") === 0 ? n * 30 : n;
      mayor = Math.max(mayor, dias);
    }
    return mayor;
  }

  // ---------- Lectura ----------

  async function leer() {
    if (!bio) {
      try { bio = await (await fetch("datos/biopreparados.json")).json(); }
      catch (err) { bio = { fichas: [] }; }   // sin la ficha solo se pierde el aviso de preparar
    }
    if (!plagas) {
      try { plagas = await (await fetch("datos/plagas.json")).json(); }
      catch (err) { plagas = { fichas: [] }; }
    }
    const t = window.Plan.temporadaActual();
    const config = await window.BioDB.leerConfig();
    const planes = (await window.BioDB.todos("planes")).filter((r) => r.temporada === t);
    const tratamientos = (await window.BioDB.todos("tratamientos"))
      .filter((r) => r.temporada === t)
      .map((r) => Object.assign({}, r, { desdeMonitoreo: true }));
    const aplicaciones = await window.BioDB.todos("aplicaciones");
    const monitoreos = await window.BioDB.todos("monitoreos");
    return { t, config, planes, tratamientos, aplicaciones, monitoreos };
  }

  // ---------- Las cuentas ----------

  // Las aplicaciones por sector se juntan en una por producto y día, que es
  // como las piensa quien sale a aplicar (igual que en el Seguimiento).
  function juntar(items) {
    const mapa = new Map();
    items.forEach((o) => {
      const k = o.plan.id + "|" + o.fecha;
      if (!mapa.has(k)) mapa.set(k, { plan: o.plan, fecha: o.fecha, partes: [] });
      mapa.get(k).partes.push(o);
    });
    return [...mapa.values()];
  }

  function calcular(d) {
    const h = hoy();
    const sectores = d.config.sectores || [];
    const renglones = d.planes.concat(d.tratamientos);
    const agenda = window.Seguimiento.agendaDe(renglones, d.aplicaciones, sectores);
    const rango = rangoTemporada(d.t);
    const enTemporada = (f) => f && f >= rango.desde && f <= rango.hasta;
    const necesidad = new Set(renglones.filter((r) => r.modo === "necesidad").map((r) => r.id));

    return {
      h,
      hayPlan: renglones.length > 0,
      hoy: deHoy(agenda, d, h),
      cumplido: cumplido(agenda, h),
      puntualidad: puntualidad(d.aplicaciones, necesidad, enTemporada),
      monitoreo: monitoreo(d.monitoreos, sectores, h),
      prevencion: prevencion(d, necesidad, enTemporada),
      tira: tira(agenda, d.aplicaciones, h),
      sanidad: sanidad(d, enTemporada, h),
      datos: datosCuriosos(d.monitoreos, h),
    };
  }

  // LA CURVA DE SANIDAD: cada plaga a lo largo de la temporada, para toda la
  // chacra, y debajo, con la misma línea de tiempo, lo que se aplicó.
  //
  // Dos franjas y no dos ejes Y: la incidencia es un porcentaje y lo aplicado
  // son litros, y en un mismo par de ejes cualquier cruce de líneas parecería
  // decir algo que no dice.
  //
  // Para la chacra se toma, de cada día, el sector con más incidencia: es el
  // que pide atención, y un promedio lo escondería. El detalle por sector está
  // al tocar la plaga.
  const SEVERIDAD = { Leve: 1, Media: 2, Alta: 3 };

  function sanidad(d, enTemporada, h) {
    // Las recorridas sin novedad cuentan para el reloj de monitoreo, no acá:
    // no son una plaga.
    const mons = d.monitoreos.filter((m) => !m.sin_novedad && enTemporada(m.fecha) && m.fecha <= h);
    const apls = d.aplicaciones.filter((a) => a.estado === "Aplicada"
      && enTemporada(a.fecha_aplicada || a.fecha) && (a.fecha_aplicada || a.fecha) <= h);
    if (!mons.length && !apls.length) return null;

    const series = new Map();
    mons.forEach((m) => {
      const nombre = String(m.deteccion || "Sin identificar").trim();
      const k = m.plaga_id || "otro:" + nombre.toLowerCase();
      if (!series.has(k)) series.set(k, { clave: k, plagaId: m.plaga_id || "", nombre, mons: [] });
      series.get(k).mons.push(m);
    });
    // Cada día con algún monitoreo de esa plaga, la chacra vale lo que el peor
    // sector según lo último que se sabe de cada uno (si tiene menos de un
    // mes). Tomar solo lo monitoreado ese día hacía zigzag: un día se miraba
    // el invernadero con 10 % y la curva "bajaba", aunque la huerta seguía
    // en 45 %.
    const inc = (m) => (m.incidencia === "" || m.incidencia === undefined ? null
      : isNaN(Number(m.incidencia)) ? null : Number(m.incidencia));
    const lista = [...series.values()].map((s) => {
      const ordenados = s.mons.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))
        || String(a.creado).localeCompare(String(b.creado)));
      const dias = [...new Set(ordenados.map((m) => m.fecha))];
      const puntos = dias.map((fecha) => {
        const ultimo = new Map();   // sector → su último monitoreo hasta esa fecha
        ordenados.forEach((m) => {
          if (m.fecha <= fecha && diasEntre(m.fecha, fecha) <= 30) ultimo.set(m.sector_id || m.sector || "", m);
        });
        let valor = null, sev = 0;
        ultimo.forEach((m) => {
          const v = inc(m);
          if (v !== null) valor = valor === null ? v : Math.max(valor, v);
          sev = Math.max(sev, SEVERIDAD[m.severidad] || 0);
        });
        return { fecha, inc: valor, sev };
      });
      return Object.assign(s, { puntos, ultima: dias[dias.length - 1] });
    }).sort((a, b) => b.ultima.localeCompare(a.ultima) || b.mons.length - a.mons.length);

    // Lo aplicado: una marca por producto y día, del tamaño de los litros
    // (sumando los sectores). Sin volumen anotado, la marca más chica.
    const productos = new Map();
    apls.forEach((a) => {
      const nombre = String(a.producto || "Sin nombre").trim();
      const f = a.fecha_aplicada || a.fecha;
      if (!productos.has(nombre)) productos.set(nombre, { nombre, dias: new Map(), veces: 0 });
      const p = productos.get(nombre);
      if (!p.dias.has(f)) { p.dias.set(f, { fecha: f, litros: 0, fuera: !a.plan_id, sectores: [] }); p.veces += 1; }
      const dia = p.dias.get(f);
      dia.litros += Number(String(a.volumen || "").replace(",", ".")) || 0;
      dia.sectores.push(a.sector_id);
    });
    const prods = [...productos.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));

    const fechas = mons.map((m) => m.fecha).concat(apls.map((a) => a.fecha_aplicada || a.fecha)).sort();
    let desde = fechas[0];
    if (diasEntre(desde, h) < 28) desde = masDias(h, -28);   // menos de un mes se ve apretado

    return {
      desde, hasta: h,
      series: lista.slice(0, SERIES_CURVA),
      otrasSeries: Math.max(0, lista.length - SERIES_CURVA),
      productos: prods.slice(0, PRODUCTOS_CURVA),
      otrosProductos: Math.max(0, prods.length - PRODUCTOS_CURVA),
      mons, apls,
      sectores: d.config.sectores || [],
    };
  }

  // SABÍAS QUE: un dato por día, sacado de las fichas de la wiki, que ya
  // pasaron por el equipo del IFAB. No se escribe nada nuevo acá. Si en el
  // último mes se monitoreó una plaga que tiene ficha, primero van sus datos:
  // lo curioso que además sirve para lo que está pasando en la chacra.
  function datosCuriosos(monitoreos, h) {
    const corto = (t) => {
      const s = String(t || "").trim();
      if (!s || s.length > 260) return "";
      return s;
    };
    const vistas = new Set(monitoreos.filter((m) => m.plaga_id && diasEntre(m.fecha, h) <= 30)
      .map((m) => m.plaga_id));
    const lista = [];
    ((plagas && plagas.fichas) || []).forEach((f) => {
      const ruta = "wiki/plagas/" + f.id;
      const cerca = vistas.has(f.id);
      if (corto(f.enemigos)) lista.push({ texto: f.enemigos, titulo: `Enemigos naturales de ${f.nombre.toLowerCase()}`, ruta, nombre: f.nombre, cerca });
      if (corto(f.resumen)) lista.push({ texto: f.resumen, titulo: f.nombre, ruta, nombre: f.nombre, cerca });
      (f.cuidados || []).forEach((c) => { if (corto(c)) lista.push({ texto: c, titulo: f.nombre, ruta, nombre: f.nombre, cerca }); });
    });
    ((bio && bio.fichas) || []).forEach((f) => {
      const ruta = "wiki/manejo/" + f.id;
      if (f.comarca && corto(f.resumen)) lista.push({ texto: f.resumen, titulo: f.nombre, ruta, nombre: f.nombre });
      (f.cuidados || []).forEach((c) => { if (corto(c)) lista.push({ texto: c, titulo: f.nombre, ruta, nombre: f.nombre }); });
    });
    // Los de las plagas vistas, adelante. El resto, en un orden fijo.
    lista.sort((a, b) => (b.cerca ? 1 : 0) - (a.cerca ? 1 : 0));
    const cerca = lista.filter((x) => x.cerca).length;
    // El dato del día: entre los cercanos si hay, si no entre todos. Cambia
    // cada día y es el mismo todo el día, aunque se abra la app diez veces.
    const dia = Math.floor(new Date(h + "T12:00:00") / 864e5);
    const inicial = lista.length ? (cerca ? dia % cerca : dia % lista.length) : 0;
    return { lista, inicial };
  }

  // HOY: lo que toca, lo atrasado y lo que hay que empezar a preparar.
  function deHoy(agenda, d, h) {
    const pendientes = agenda.filter((o) => !o.registro);
    const hoyToca = juntar(pendientes.filter((o) => o.fecha === h));
    const atrasadas = juntar(pendientes.filter((o) => o.fecha < h));
    const proxima = juntar(pendientes.filter((o) => o.fecha > h))[0] || null;
    const hechasHoy = new Set(d.aplicaciones
      .filter((a) => a.estado === "Aplicada" && (a.fecha_aplicada || a.fecha) === h)
      .map((a) => (a.plan_id || a.producto) + "|" + h)).size;

    // PREPARAR A TIEMPO. Solo se mira la PRIMERA aplicación de cada renglón:
    // las siguientes salen de la misma tanda, que se conserva. Avisar en cada
    // repetición sería avisar siempre, y un aviso que está siempre no se lee.
    const fichas = (bio && bio.fichas) || [];
    const preparar = [];
    d.planes.concat(d.tratamientos).forEach((r) => {
      const f = r.producto_id ? fichas.find((x) => x.id === r.producto_id) : null;
      const dias = f ? diasDeElaboracion(f.tiempo) : 0;
      if (dias < 2) return;
      const primera = window.Plan.ocurrencias(r)[0];
      if (!primera || primera <= h) return;
      if (d.aplicaciones.some((a) => a.plan_id === r.id)) return;
      const empezar = masDias(primera, -dias);
      if (empezar > masDias(h, AVISO_PREPARAR_DIAS)) return;
      preparar.push({ producto: r.producto, dias, primera, empezar });
    });
    preparar.sort((a, b) => a.empezar.localeCompare(b.empezar));

    return { hoyToca, atrasadas, proxima, hechasHoy, preparar };
  }

  // PLAN CUMPLIDO: la misma cuenta que el semáforo del Seguimiento. Mide solo
  // lo vencido, y un "no se aplicó" con su motivo cuenta como resuelto: para el
  // Consejo de Garantía es un registro tan válido como una aplicación.
  function cumplido(agenda, h) {
    const vencidas = agenda.filter((o) => o.fecha <= h);
    const resueltas = vencidas.filter((o) => o.registro);
    const aplicadas = resueltas.filter((o) => o.registro.estado === "Aplicada").length;
    return {
      pct: vencidas.length ? (resueltas.length / vencidas.length) * 100 : null,
      vencidas: vencidas.length,
      resueltas: resueltas.length,
      aplicadas,
      noAplicadas: resueltas.length - aplicadas,
      atrasadas: juntar(vencidas.filter((o) => !o.registro && o.fecha < h)),
    };
  }

  // PUNTUALIDAD: cuántos días se corre lo aplicado de lo programado. Lo "ante
  // necesidad" y lo de fuera del plan no tienen fecha programada de verdad, así
  // que no entran.
  function puntualidad(aplicaciones, necesidad, enTemporada) {
    const vistas = new Map();
    aplicaciones.forEach((a) => {
      if (a.estado !== "Aplicada" || !a.ocurrencia_id || !a.fecha_programada || !a.fecha_aplicada) return;
      if (necesidad.has(a.plan_id) || !enTemporada(a.fecha_programada)) return;
      const k = a.plan_id + "|" + a.fecha_programada;
      if (!vistas.has(k)) {
        vistas.set(k, { producto: a.producto, programada: a.fecha_programada,
          aplicada: a.fecha_aplicada, desvio: diasEntre(a.fecha_programada, a.fecha_aplicada) });
      }
    });
    const lista = [...vistas.values()];
    const desvios = lista.map((x) => x.desvio);
    const enFecha = desvios.filter((x) => Math.abs(x) <= EN_FECHA_DIAS).length;
    return {
      pct: lista.length ? (enFecha / lista.length) * 100 : null,
      mediana: mediana(desvios),
      total: lista.length,
      enFecha,
      tarde: lista.filter((x) => x.desvio > EN_FECHA_DIAS).sort((a, b) => b.desvio - a.desvio),
      antes: lista.filter((x) => x.desvio < -EN_FECHA_DIAS).length,
    };
  }

  // MONITOREO AL DÍA: qué sectores se miraron en la última semana.
  function monitoreo(monitoreos, sectores, h) {
    const filas = sectores.map((s) => {
      const ultimo = monitoreos.filter((m) => m.sector_id === s.id)
        .map((m) => m.fecha).sort().pop() || null;
      const dias = ultimo ? diasEntre(ultimo, h) : null;
      return { nombre: s.nombre, ultimo, dias, alDia: dias !== null && dias <= MONITOREO_DIAS };
    });
    // El más atrasado primero; uno que nunca se monitoreó va antes que todos.
    filas.sort((a, b) => (a.dias === null ? -1 : b.dias === null ? 1 : b.dias - a.dias));
    const alDia = filas.filter((f) => f.alDia).length;
    return {
      pct: filas.length ? (alDia / filas.length) * 100 : null,
      alDia,
      filas,
      peor: filas.find((f) => !f.alDia) || null,
      nunca: monitoreos.length === 0,
    };
  }

  // PREVENCIÓN CONTRA RESPUESTA: de todo lo aplicado en la temporada, cuánto
  // estaba en el calendario del plan y cuánto fue para responder a algo: un
  // tratamiento armado desde un monitoreo, un producto del plan "ante
  // necesidad" o una aplicación fuera del plan. Una chacra con el suelo sano
  // debería necesitar cada vez menos de lo segundo.
  function prevencion(d, necesidad, enTemporada) {
    const delPlan = new Set(d.planes.filter((r) => r.modo !== "necesidad").map((r) => r.id));
    const deMonitoreo = new Set(d.tratamientos.map((r) => r.id));
    const veces = new Map();
    d.aplicaciones.forEach((a) => {
      const fecha = a.fecha_aplicada || a.fecha;
      if (a.estado !== "Aplicada" || !enTemporada(fecha)) return;
      const clase = delPlan.has(a.plan_id) ? "plan"
        : deMonitoreo.has(a.plan_id) ? "monitoreo"
        : necesidad.has(a.plan_id) ? "necesidad" : "fuera";
      // Una vez por producto y día, aunque se haya aplicado en varios sectores.
      veces.set((a.plan_id || a.producto) + "|" + fecha, clase);
    });
    const n = { plan: 0, monitoreo: 0, necesidad: 0, fuera: 0 };
    veces.forEach((c) => { n[c] += 1; });
    const total = veces.size;
    return { pct: total ? (n.plan / total) * 100 : null, total, n };
  }

  // LA TIRA: un renglón por producto y una columna por día.
  //
  // Lo hecho se dibuja el día que se aplicó; lo que no se aplicó y lo
  // pendiente, el día que estaba programado. Si en una misma casilla caen dos
  // cosas (dos sectores, uno hecho y otro no), gana la que pide atención.
  const PESO = { atrasada: 5, viene: 4, no: 3, fuera: 2, hecha: 1 };

  function tira(agenda, aplicaciones, h) {
    const desde = masDias(h, -DIAS_TIRA);
    const hasta = masDias(h, DIAS_TIRA);
    const dentro = (f) => f && f >= desde && f <= hasta;
    const filas = new Map();
    const poner = (producto, fecha, estado) => {
      const nombre = String(producto || "Sin nombre").trim();
      if (!filas.has(nombre)) filas.set(nombre, new Map());
      const dias = filas.get(nombre);
      const antes = dias.get(fecha);
      if (!antes || PESO[estado] > PESO[antes]) dias.set(fecha, estado);
    };

    agenda.forEach((o) => {
      if (!dentro(o.fecha)) return;
      if (!o.registro) poner(o.plan.producto, o.fecha, o.fecha < h ? "atrasada" : "viene");
      else if (o.registro.estado !== "Aplicada") poner(o.plan.producto, o.fecha, "no");
    });
    aplicaciones.forEach((a) => {
      const f = a.fecha_aplicada || a.fecha;
      if (a.estado !== "Aplicada" || !dentro(f)) return;
      poner(a.producto, f, a.plan_id ? "hecha" : "fuera");
    });

    // Arriba lo que pide atención: lo atrasado, después lo más cercano.
    const urgencia = (dias) => {
      let mejor = 99;
      dias.forEach((estado, fecha) => {
        if (estado === "atrasada") mejor = Math.min(mejor, -1);
        else if (estado === "viene") mejor = Math.min(mejor, diasEntre(h, fecha));
      });
      return mejor;
    };
    const lista = [...filas.entries()].map(([nombre, dias]) => ({ nombre, dias, u: urgencia(dias) }))
      .sort((a, b) => a.u - b.u || a.nombre.localeCompare(b.nombre));

    const columnas = [];
    for (let i = -DIAS_TIRA; i <= DIAS_TIRA; i++) columnas.push(masDias(h, i));
    return { filas: lista.slice(0, FILAS_TIRA), resto: Math.max(0, lista.length - FILAS_TIRA), columnas };
  }

  // ---------- El dibujo ----------

  const tono = (pct, bien, ojo) => (pct === null ? "sin" : pct >= bien ? "bien" : pct >= ojo ? "ojo" : "flojo");

  // Un reloj: medio círculo que se llena hasta el porcentaje, el valor en
  // grande y abajo, en palabras, de qué está hecho. Es un botón: tocarlo abre
  // el detalle. El mismo dibujo que el tablero de AMA Producción.
  function reloj(id, { pct, valor, titulo, detalle, bien = 85, ojo = 60 }) {
    const lleno = pct === null ? 0 : Math.max(0, Math.min(100, pct));
    const arco = "M 12 62 A 48 48 0 0 1 108 62";
    return `<button type="button" class="reloj reloj--${tono(pct, bien, ojo)}${abierto === id ? " reloj--abierto" : ""}"
        data-reloj="${id}" aria-expanded="${abierto === id}">
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path class="reloj__pista" d="${arco}" pathLength="100"/>
        ${lleno > 0 ? `<path class="reloj__arco" d="${arco}" pathLength="100" stroke-dasharray="${lleno.toFixed(1)} 100"/>` : ""}
      </svg>
      <strong class="reloj__valor">${valor}</strong>
      <span class="reloj__titulo">${titulo}</span>
      <span class="reloj__detalle">${detalle}</span>
    </button>`;
  }

  const pctTexto = (p) => `${Math.round(p)}<small>%</small>`;

  function relojes(c) {
    const { cumplido: cu, puntualidad: pu, monitoreo: mo, prevencion: pr } = c;
    const dias = (n) => (n === 0 ? "0" : (n > 0 ? "+" : "−") + Math.abs(n)) + "<small> d</small>";
    return `<div class="relojes">
      ${reloj("cumplido", {
        pct: cu.pct, bien: 90, titulo: "Plan cumplido",
        valor: cu.pct === null ? "—" : pctTexto(cu.pct),
        detalle: cu.vencidas ? `${numero(cu.resueltas)} de ${plural(cu.vencidas, "que tocaba", "que tocaban")}`
          : "todavía no tocaba nada",
      })}
      ${reloj("puntualidad", {
        pct: pu.pct, titulo: "Puntualidad",
        valor: pu.mediana === null ? "—" : dias(pu.mediana),
        detalle: pu.mediana === null ? "todavía no hay aplicaciones marcadas"
          : `${pu.mediana > 0 ? "de atraso típico" : pu.mediana < 0 ? "de adelanto típico" : "justo a tiempo"} · ${Math.round(pu.pct)}% en fecha`,
      })}
      ${reloj("monitoreo", {
        pct: mo.pct, titulo: "Monitoreo al día",
        valor: mo.pct === null ? "—" : pctTexto(mo.pct),
        detalle: mo.pct === null ? "no hay sectores cargados"
          : !mo.peor ? "todos los sectores, esta semana"
          : mo.peor.dias === null ? `${esc(mo.peor.nombre)}: sin monitorear`
          : `${esc(mo.peor.nombre)}: hace ${plural(mo.peor.dias, "día", "días")}`,
      })}
      ${reloj("prevencion", {
        pct: pr.pct, bien: 75, ojo: 50, titulo: "Prevención",
        valor: pr.pct === null ? "—" : pctTexto(pr.pct),
        detalle: pr.total ? `${numero(pr.n.plan)} de ${plural(pr.total, "aplicación", "aplicaciones")}, con el plan`
          : "todavía no hay aplicaciones",
      })}
    </div>`;
  }

  // ---------- El detalle de cada reloj ----------

  function detalleCumplido(c) {
    const cu = c.cumplido;
    if (!cu.vencidas) {
      return `<p class="nota">Ninguna aplicación del plan llegó todavía a su fecha.
        El reloj empieza a moverse con la primera.</p>`;
    }
    return `
      <p class="nota">De las ${numero(cu.vencidas)} aplicaciones que tocaban hasta hoy
        (contando cada sector): ${plural(cu.aplicadas, "aplicada", "aplicadas")}${
        cu.noAplicadas ? `, ${plural(cu.noAplicadas, "marcada como no aplicada", "marcadas como no aplicadas")}` : ""}${
        cu.vencidas - cu.resueltas ? ` y ${plural(cu.vencidas - cu.resueltas, "sin marcar", "sin marcar")}` : ""}.
        Un «no se aplicó» con su motivo cuenta como cumplido: es un registro válido.</p>
      ${cu.atrasadas.length ? `<ul class="tablero__lista">${cu.atrasadas.slice(0, 5).map((g) => `
        <li><strong>${esc(g.plan.producto)}</strong> · ${esc(fechaCorta(g.fecha))} ·
          ${esc(g.partes.map((p) => p.nombreSector).join(", "))}</li>`).join("")}</ul>
        ${cu.atrasadas.length > 5 ? `<p class="nota">y ${cu.atrasadas.length - 5} más.</p>` : ""}` : ""}
      <button class="boton boton--secundario boton--ancho" data-ir="seguimiento">Abrir el seguimiento</button>`;
  }

  function detallePuntualidad(c) {
    const pu = c.puntualidad;
    if (!pu.total) {
      return `<p class="nota">Cuando marques aplicaciones del plan, acá vas a ver cuántos
        días se corren de lo programado.</p>`;
    }
    return `
      <p class="nota">De ${plural(pu.total, "aplicación marcada", "aplicaciones marcadas")}:
        ${numero(pu.enFecha)} en fecha (hasta ${EN_FECHA_DIAS} días de diferencia)${
        pu.tarde.length ? `, ${numero(pu.tarde.length)} tarde` : ""}${
        pu.antes ? `, ${numero(pu.antes)} antes de tiempo` : ""}. Lo que se aplica «ante
        necesidad» o fuera del plan no tiene fecha programada y no entra.</p>
      ${pu.tarde.length ? `<ul class="tablero__lista">${pu.tarde.slice(0, 4).map((x) => `
        <li><strong>${esc(x.producto)}</strong> · programada el ${esc(fechaCorta(x.programada))},
          aplicada el ${esc(fechaCorta(x.aplicada))} (${plural(x.desvio, "día", "días")} después)</li>`).join("")}</ul>` : ""}`;
  }

  function detalleMonitoreo(c) {
    const mo = c.monitoreo;
    if (!mo.filas.length) return `<p class="nota">Cargá tus sectores en Configuración.</p>`;
    return `
      <p class="nota">Un sector está al día si se monitoreó en los últimos ${MONITOREO_DIAS} días.
        Cuenta cada monitoreo registrado: de una plaga, de un síntoma o una recorrida
        sin novedad.</p>
      <ul class="tablero__lista">${mo.filas.map((f) => `
        <li class="${f.alDia ? "" : "tablero__atrasado"}"><strong>${esc(f.nombre)}</strong> · ${
          f.dias === null ? "sin monitoreos" : f.dias === 0 ? "hoy"
          : `hace ${plural(f.dias, "día", "días")} (${esc(fechaCorta(f.ultimo))})`}</li>`).join("")}</ul>
      <button class="boton boton--secundario boton--ancho" data-ir="monitoreo">Ir a monitoreo</button>`;
  }

  function detallePrevencion(c) {
    const pr = c.prevencion;
    if (!pr.total) {
      return `<p class="nota">Cuando registres aplicaciones, acá vas a ver cuánto de lo aplicado
        estaba en el calendario del plan y cuánto fue para responder a un problema.</p>`;
    }
    const fila = (n, texto) => (n ? `<li><strong>${numero(n)}</strong> ${texto}</li>` : "");
    return `
      <p class="nota">Cada producto aplicado en un día cuenta una vez, aunque haya ido a
        varios sectores. De ${plural(pr.total, "aplicación", "aplicaciones")} de la temporada:</p>
      <ul class="tablero__lista">
        ${fila(pr.n.plan, "con el calendario del plan: prevención")}
        ${fila(pr.n.monitoreo, "de tratamientos armados desde un monitoreo")}
        ${fila(pr.n.necesidad, "de productos del plan «ante necesidad»")}
        ${fila(pr.n.fuera, "fuera del plan")}
      </ul>
      <p class="nota">Un suelo sano y un plan que se cumple deberían pedir cada vez menos
        aplicaciones de respuesta.</p>`;
  }

  const DETALLES = { cumplido: detalleCumplido, puntualidad: detallePuntualidad,
    monitoreo: detalleMonitoreo, prevencion: detallePrevencion };

  // ---------- La tarjeta de hoy ----------

  function tarjetaHoy(c) {
    const x = c.hoy;
    if (!c.hayPlan) {
      return `<div class="tarjeta hoy">
        <h2>Hoy</h2>
        <p>Todavía no cargaste el plan de esta temporada. Con el plan, acá vas a ver
          qué te toca aplicar cada día.</p>
        <button class="boton boton--ancho" data-ir="plan">Registrar el plan</button>
      </div>`;
    }
    const sectores = (g) => g.partes.map((p) => p.nombreSector).join(", ");
    const preparar = x.preparar.slice(0, 2).map((p) => {
      const cuando = p.empezar < c.h ? `ya tendría que estar en preparación`
        : p.empezar === c.h ? `empezalo hoy` : `empezalo antes del ${esc(fechaCorta(p.empezar))}`;
      return `<p class="hoy__preparar">🧪 <strong>${esc(p.producto)}</strong>: tarda
        ${plural(p.dias, "día", "días")} y el plan lo pide el ${esc(fechaCorta(p.primera))}.
        Si no lo tenés hecho, ${cuando}.</p>`;
    }).join("");

    return `<div class="tarjeta hoy">
      <h2>Hoy te toca</h2>
      ${x.hoyToca.length ? `<ul class="hoy__lista">${x.hoyToca.map((g) => `
        <li><strong>${esc(g.plan.producto)}</strong> · ${esc(sectores(g))}</li>`).join("")}</ul>`
        : `<p>Nada del plan para hoy.${x.proxima ? ` Lo próximo: <strong>${esc(x.proxima.plan.producto)}</strong>
          el ${esc(fechaCorta(x.proxima.fecha))}.` : ""}</p>`}
      ${x.atrasadas.length ? `<p class="hoy__atrasado">${plural(x.atrasadas.length, "aplicación atrasada", "aplicaciones atrasadas")}
        sin marcar.</p>` : ""}
      ${x.hechasHoy ? `<p class="nota">Hoy ya registraste ${plural(x.hechasHoy, "aplicación", "aplicaciones")}.</p>` : ""}
      ${preparar}
      <button class="boton boton--secundario boton--ancho" data-ir="seguimiento">Abrir el seguimiento</button>
    </div>`;
  }

  // ---------- La tira de días ----------

  // Cada estado con su forma, no solo su color: al sol y para quien no
  // distingue colores, el círculo lleno, el hueco y la cruz se leen igual.
  function simbolo(estado, x, y) {
    if (estado === "hecha") return `<circle class="tira__hecha" cx="${x}" cy="${y}" r="6"/>`;
    if (estado === "viene") return `<circle class="tira__viene" cx="${x}" cy="${y}" r="5.5"/>`;
    if (estado === "atrasada") return `<circle class="tira__atrasada" cx="${x}" cy="${y}" r="5.5"/>`;
    if (estado === "fuera") return `<path class="tira__fuera" d="M${x} ${y - 7}l7 7-7 7-7-7z"/>`;
    return `<path class="tira__no" d="M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10"/>`;
  }

  const recortar = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

  function tarjetaTira(c) {
    const t = c.tira;
    if (!t.filas.length) {
      return `<div class="tarjeta tira">
        <h2>Dos semanas</h2>
        <p class="nota">Entre la semana pasada y la que viene no hay aplicaciones en el plan
          ni registradas.</p>
      </div>`;
    }
    // El nombre del producto va arriba de su renglón y no a la izquierda: así
    // entra entero y los días usan todo el ancho, con letra que se lee al sol.
    const W = 340, izq = 0, alto = 40, arriba = 18;
    const ancho = (W - izq) / t.columnas.length;
    const X = (i) => +(izq + ancho * i + ancho / 2).toFixed(1);
    const H = arriba + alto * t.filas.length + 20;
    const iHoy = DIAS_TIRA;

    const filas = t.filas.map((f, j) => {
      const y = arriba + alto * j + 27;
      const marcas = t.columnas.map((fecha, i) => (f.dias.has(fecha) ? simbolo(f.dias.get(fecha), X(i), y) : "")).join("");
      return `<text class="tira__producto" x="2" y="${y - 12}">${esc(recortar(f.nombre, 40))}</text>
        <line class="tira__guia" x1="${izq + ancho / 2}" x2="${W - ancho / 2}" y1="${y}" y2="${y}"/>${marcas}`;
    }).join("");

    const dias = t.columnas.map((fecha, i) =>
      `<text class="tira__dia${i === iHoy ? " tira__dia--hoy" : ""}" x="${X(i)}" y="${H - 4}" text-anchor="middle">${Number(fecha.slice(8))}</text>`).join("");

    const resumen = t.filas.map((f) => f.nombre).join(", ");
    return `<div class="tarjeta tira">
      <h2>Dos semanas <small>la pasada y la que viene</small></h2>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Aplicaciones de la semana pasada y la que viene: ${esc(resumen)}.">
        <rect class="tira__hoy" x="${(izq + ancho * iHoy).toFixed(1)}" y="0" width="${ancho.toFixed(1)}" height="${H}" rx="4"/>
        <text class="tira__dia tira__dia--hoy" x="${X(iHoy)}" y="12" text-anchor="middle">hoy</text>
        ${filas}${dias}
      </svg>
      <p class="tira__leyenda">
        <span><svg viewBox="0 0 14 14" aria-hidden="true">${simbolo("hecha", 7, 7)}</svg>hecha</span>
        <span><svg viewBox="0 0 14 14" aria-hidden="true">${simbolo("viene", 7, 7)}</svg>viene</span>
        <span><svg viewBox="0 0 14 14" aria-hidden="true">${simbolo("atrasada", 7, 7)}</svg>atrasada</span>
        <span><svg viewBox="0 0 14 14" aria-hidden="true">${simbolo("no", 7, 7)}</svg>no se aplicó</span>
        <span><svg viewBox="0 0 14 14" aria-hidden="true">${simbolo("fuera", 7, 7)}</svg>fuera del plan</span>
      </p>
      ${t.resto ? `<p class="nota">Y ${plural(t.resto, "producto más", "productos más")} en el seguimiento.</p>` : ""}
    </div>`;
  }

  // ---------- La curva de sanidad ----------

  // Un tope "redondo" para el eje: 10, 20, 25, 50 o 100 %.
  const topeDe = (v) => [10, 20, 25, 50, 100].find((t) => t >= v) || 100;
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function tarjetaSanidad(c) {
    const s = c.sanidad;
    if (!s) return "";
    const W = 340, x0 = 34, x1 = 330;
    const dias = Math.max(1, diasEntre(s.desde, s.hasta));
    const X = (f) => +(x0 + (x1 - x0) * Math.max(0, Math.min(1, diasEntre(s.desde, f) / dias))).toFixed(1);

    // Arriba, la incidencia. Lo monitoreado sin porcentaje va en un carril
    // aparte, "s/%", debajo del cero: dibujarlo en cero diría que no había nada.
    const conInc = s.series.some((x) => x.puntos.some((p) => p.inc !== null));
    const sinInc = s.series.some((x) => x.puntos.some((p) => p.inc === null));
    const yArriba = 14, yCero = 116, yCarril = 132;
    const max = Math.max(0, ...s.series.map((x) => Math.max(0, ...x.puntos.map((p) => p.inc || 0))));
    const tope = topeDe(max);
    const Y = (v) => +(yCero - (yCero - yArriba) * Math.min(1, v / tope)).toFixed(1);
    const radio = (sev) => [3.5, 4, 5, 6.5][sev] || 4;

    let arriba = "";
    if (s.series.length) {
      const guias = [0, 0.5, 1].map((f) => `<line class="curva__guia" x1="${x0}" x2="${x1}" y1="${Y(tope * f)}" y2="${Y(tope * f)}"/>
        <text class="curva__eje" x="${x0 - 5}" y="${Y(tope * f) + 4}" text-anchor="end">${Math.round(tope * f)}%</text>`).join("");
      const lineas = s.series.map((x, i) => {
        const pts = x.puntos.filter((p) => p.inc !== null);
        const linea = pts.length > 1 ? `<polyline class="curva__linea serie-${i}" points="${pts.map((p) => `${X(p.fecha)},${Y(p.inc)}`).join(" ")}"/>` : "";
        const marcas = x.puntos.map((p) => `<circle class="curva__punto serie-${i}${p.inc === null ? " curva__punto--sin" : ""}"
          cx="${X(p.fecha)}" cy="${p.inc === null ? yCarril : Y(p.inc)}" r="${radio(p.sev)}"><title>${esc(x.nombre)} · ${esc(fechaCorta(p.fecha))}${
          p.inc === null ? "" : " · " + p.inc + " %"}${p.sev ? " · severidad " + ["", "leve", "media", "alta"][p.sev] : ""}</title></circle>`).join("");
        return linea + marcas;
      }).join("");
      arriba = `${conInc ? guias : ""}
        ${sinInc ? `<text class="curva__eje" x="${x0 - 5}" y="${yCarril + 4}" text-anchor="end">s/%</text>` : ""}
        ${lineas}`;
    }

    // Abajo, lo aplicado: un renglón por producto, el nombre arriba (como en
    // la tira) y una marca por día, del tamaño de los litros.
    const base = s.series.length ? (sinInc ? yCarril + 16 : yCero + 14) : 8;
    const alto = 32;
    const maxL = Math.max(0, ...s.productos.map((p) => Math.max(0, ...[...p.dias.values()].map((d) => d.litros))));
    const r = (l) => (maxL > 0 && l > 0 ? 3.5 + 5 * Math.sqrt(l / maxL) : 3.5);
    const abajo = s.productos.map((p, j) => {
      const y = base + alto * j + 22;
      return `<text class="curva__producto" x="2" y="${y - 10}">${esc(recortar(p.nombre, 40))}</text>
        <line class="curva__guia" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>
        ${[...p.dias.values()].map((d) => `<circle class="curva__aplicacion${d.fuera ? " curva__aplicacion--fuera" : ""}"
          cx="${X(d.fecha)}" cy="${y}" r="${r(d.litros).toFixed(1)}"><title>${esc(p.nombre)} · ${esc(fechaCorta(d.fecha))}${
          d.litros ? " · " + numero(d.litros) + " L" : ""}</title></circle>`).join("")}`;
    }).join("");
    const yMeses = base + alto * s.productos.length + 16;
    const H = yMeses + 6;

    // Las marcas de los meses y la raya de hoy, que cruza las dos franjas.
    const meses = [];
    const m = new Date(s.desde + "T12:00:00");
    m.setDate(1); m.setMonth(m.getMonth() + 1);
    while (fechaISO(m) <= s.hasta) {
      meses.push(`<line class="curva__mes" x1="${X(fechaISO(m))}" x2="${X(fechaISO(m))}" y1="${yArriba - 6}" y2="${yMeses - 12}"/>
        <text class="curva__eje" x="${X(fechaISO(m)) + 3}" y="${yMeses}">${MESES[m.getMonth()]}</text>`);
      m.setMonth(m.getMonth() + 1);
    }

    const leyenda = s.series.map((x, i) => {
      const u = x.puntos[x.puntos.length - 1];
      return `<button type="button" class="curva__plaga${plagaAbierta === x.clave ? " curva__plaga--abierta" : ""}"
          data-plaga="${esc(x.clave)}" aria-expanded="${plagaAbierta === x.clave}">
        <svg viewBox="0 0 22 10" aria-hidden="true"><line class="curva__linea serie-${i}" x1="1" x2="21" y1="5" y2="5"/></svg>
        <span>${esc(x.nombre)}</span>
        <small>${u.inc === null ? (u.sev ? ["", "leve", "media", "alta"][u.sev] : "") : u.inc + " %"} · ${esc(fechaCorta(u.fecha))}</small>
      </button>`;
    }).join("");

    const abiertaSerie = s.series.find((x) => x.clave === plagaAbierta);
    return `<div class="tarjeta curva">
      <h2>Sanidad de la temporada</h2>
      <p class="nota">${s.series.length
        ? "Arriba, la incidencia de cada plaga en el sector más afectado, y el tamaño del punto es la severidad. Abajo, lo aplicado: el tamaño es el volumen."
        : "Cuando registres monitoreos, arriba vas a ver cómo evoluciona cada plaga. Por ahora, lo aplicado: el tamaño del punto es el volumen."}</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Incidencia de ${esc(s.series.map((x) => x.nombre).join(", ") || "plagas")} y aplicaciones de la temporada.">
        ${meses.join("")}
        ${arriba}
        ${s.series.length && s.productos.length ? `<line class="curva__separador" x1="${x0}" x2="${x1}" y1="${base}" y2="${base}"/>` : ""}
        ${abajo}
        <line class="curva__hoy" x1="${X(s.hasta)}" x2="${X(s.hasta)}" y1="${yArriba - 8}" y2="${yMeses - 12}"/>
      </svg>
      ${s.series.length ? `<div class="curva__leyenda">${leyenda}</div>
        ${abiertaSerie ? detallePlaga(abiertaSerie, s) : `<p class="nota tablero__pista">Tocá una plaga para verla por sector.</p>`}` : ""}
      ${s.otrasSeries || s.otrosProductos ? `<p class="nota">${s.otrasSeries ? `Y ${plural(s.otrasSeries, "problema más", "problemas más")} en Monitoreo. ` : ""}${
        s.otrosProductos ? `Y ${plural(s.otrosProductos, "producto más", "productos más")} aplicados.` : ""}</p>` : ""}
    </div>`;
  }

  // El detalle de una plaga, sector por sector: cómo fue cambiando y qué se
  // aplicó ahí desde que apareció. Se muestra, no se califica: si bajó por lo
  // aplicado, por el clima o por los enemigos naturales lo decide quien conoce
  // el campo (ver js/problemas.js).
  function detallePlaga(x, s) {
    const nombre = (id, texto) => ((s.sectores.find((q) => q.id === id) || {}).nombre) || texto || "Sector sin nombre";
    const porSector = new Map();
    x.mons.forEach((m) => {
      const k = m.sector_id || m.sector || "";
      if (!porSector.has(k)) porSector.set(k, { nombre: nombre(m.sector_id, m.sector), mons: [] });
      porSector.get(k).mons.push(m);
    });
    const valor = (m) => (m.incidencia !== "" && m.incidencia !== undefined ? m.incidencia + " %"
      : m.severidad ? m.severidad.toLowerCase() : "visto");
    const filas = [...porSector.entries()].map(([id, g]) => {
      const mons = g.mons.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const primera = mons[0].fecha;
      // Por producto: cuántas veces y la última, así entra todo en un renglón.
      const porProducto = new Map();
      s.apls.filter((a) => a.sector_id === id && (a.fecha_aplicada || a.fecha) >= primera).forEach((a) => {
        const f = a.fecha_aplicada || a.fecha;
        const p = porProducto.get(a.producto) || { producto: a.producto, veces: 0, ultima: f };
        p.veces += 1;
        if (f > p.ultima) p.ultima = f;
        porProducto.set(a.producto, p);
      });
      const aplicado = [...porProducto.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
      return `<li>
        <strong>${esc(g.nombre)}</strong>
        <span class="curva__evolucion">${mons.slice(-4).map((m) => `${esc(valor(m))} <small>${esc(fechaCorta(m.fecha))}</small>`).join(" → ")}</span>
        <span class="nota">${aplicado.length ? "Aplicado desde que apareció: " + aplicado.map((a) =>
          `${esc(a.producto)} ${a.veces > 1 ? `${a.veces} veces, la última el` : "el"} ${esc(fechaCorta(a.ultima))}`).join("; ")
          : "Sin aplicaciones registradas en este sector desde que apareció."}</span>
      </li>`;
    }).join("");
    return `<div class="tablero__detalle">
      <ul class="curva__sectores">${filas}</ul>
      ${x.plagaId ? `<button class="boton boton--secundario boton--ancho" data-ir="wiki/plagas/${esc(x.plagaId)}">Ver la ficha de ${esc(x.nombre.toLowerCase())}</button>` : ""}
    </div>`;
  }

  // ---------- Sabías que ----------

  function tarjetaDato(c) {
    const l = c.datos.lista;
    if (!l.length) return "";
    const i = (dato === null ? c.datos.inicial : dato) % l.length;
    const x = l[i];
    return `<div class="tarjeta dato">
      <h2>💡 Sabías que…</h2>
      <p class="dato__titulo">${esc(x.titulo)}${x.cerca ? ` <span class="dato__cerca">lo viste en la chacra</span>` : ""}</p>
      <p>${esc(x.texto)}</p>
      <div class="dato__botones">
        <button class="boton boton--secundario" data-ir="${esc(x.ruta)}">Ver la ficha</button>
        <button class="boton boton--secundario" data-otro-dato="${i}">Otro dato</button>
      </div>
    </div>`;
  }

  // ---------- Pantalla ----------

  function pintar() {
    if (!destino || !cuenta) return;
    const detalle = abierto && DETALLES[abierto];
    // Una chacra que recién empieza no tiene nada que medir: cuatro relojes en
    // raya y una tira vacía serían ruido. Solo la invitación a cargar el plan.
    if (!cuenta.hayPlan && !cuenta.prevencion.total && cuenta.monitoreo.nunca) {
      destino.innerHTML = tarjetaHoy(cuenta) + tarjetaDato(cuenta);
      conectar();
      return;
    }
    destino.innerHTML = `
      ${tarjetaHoy(cuenta)}
      <div class="tarjeta tablero">
        <h2>Cómo viene la temporada</h2>
        ${relojes(cuenta)}
        ${detalle ? `<div class="tablero__detalle">${detalle(cuenta)}</div>`
          : `<p class="nota tablero__pista">Tocá un reloj para ver de qué está hecho.</p>`}
      </div>
      ${tarjetaTira(cuenta)}
      ${tarjetaSanidad(cuenta)}
      ${tarjetaDato(cuenta)}`;
    conectar();
  }

  function conectar() {
    destino.querySelectorAll("[data-reloj]").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.reloj;
        abierto = abierto === id ? "" : id;
        pintar();
        const otra = destino.querySelector(`[data-reloj="${id}"]`);
        if (otra) otra.focus();
      };
    });
    destino.querySelectorAll("[data-plaga]").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.plaga;
        plagaAbierta = plagaAbierta === k ? "" : k;
        pintar();
        const otra = [...destino.querySelectorAll("[data-plaga]")].find((x) => x.dataset.plaga === k);
        if (otra) otra.focus();
      };
    });
    destino.querySelectorAll("[data-otro-dato]").forEach((b) => {
      b.onclick = () => {
        dato = Number(b.dataset.otroDato) + 1;
        pintar();
        const otro = destino.querySelector("[data-otro-dato]");
        if (otro) otro.focus();
      };
    });
    destino.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => irA(b.dataset.ir);
    });
  }

  // Lo llama el inicio después de dibujarse. Si algo falla, el tablero dice
  // que no pudo y el menú queda igual: el inicio nunca se cae por esto.
  async function render(contenedor, navegar) {
    destino = contenedor;
    irA = navegar;
    try {
      cuenta = calcular(await leer());
    } catch (err) {
      console.error(err);
      destino.innerHTML = `<p class="nota">No se pudo armar el resumen de la temporada.
        El resto de la app funciona igual. (${esc((err && err.message) || err)})</p>`;
      return;
    }
    pintar();
  }

  return { render, diasDeElaboracion };
})();
