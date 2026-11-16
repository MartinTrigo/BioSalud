// ==========================================================================
// BioSalud ECOMARCAL — Problemas: un mismo pulgón visto varias veces
//
// QUÉ ES UN PROBLEMA
//
// Un monitoreo es una foto: qué había en un sector un día dado. Pero lo que le
// importa al productor —y al técnico— es la película: si los pulgones que vio
// el martes en el bancal 3 avanzaron o retrocedieron después de las
// aplicaciones. Para eso los monitoreos tienen que poder encadenarse.
//
// La cadena se arma con un solo dato: `problema_id`. El primer monitoreo de un
// problema no lo tiene (o lo tiene vacío), y su propio id pasa a ser el nombre
// del problema; cada monitoreo de seguimiento guarda ese id. No hace falta un
// almacén aparte de "problemas" ni una migración de la base: un problema es
// simplemente el conjunto de monitoreos que comparten esa clave.
//
// Las aplicaciones se atan al problema de dos maneras, porque llegan por dos
// caminos:
//
//   · La que se registra a mano (Registrar aplicación) guarda el mismo
//     `problema_id`.
//   · La que sale de un tratamiento armado desde un monitoreo ya está atada a
//     ese monitoreo por el renglón del tratamiento: se la encuentra por ahí.
//
// POR QUÉ LA EVOLUCIÓN SE MUESTRA Y NO SE CALIFICA
//
// La app dice "la incidencia pasó de 40 % a 15 %" y no "el tratamiento
// funcionó". Entre una cosa y la otra están el clima, los enemigos naturales y
// el ciclo de la plaga, y atribuir la mejora al producto es justamente la
// conclusión que tiene que sacar quien conoce el campo, no un programa.
// ==========================================================================

window.Problemas = (function () {
  const { esc } = window.Util;

  // Cuánto tiempo un problema se ofrece para seguirlo. Pasados cuatro meses lo
  // más probable es que sea otra camada, otro cultivo u otra temporada.
  const DIAS_ABIERTO = 120;

  const clave = (m) => (m && (m.problema_id || m.id)) || "";

  const porFecha = (a, b) =>
    String(a.fecha).localeCompare(String(b.fecha)) ||
    String(a.creado).localeCompare(String(b.creado));

  // Todos los monitoreos de un problema, del primero al último.
  function cadena(monitoreos, k) {
    return (monitoreos || []).filter((m) => clave(m) === k).sort(porFecha);
  }

  function haceDias(iso, n) {
    const d = new Date(window.Util.hoy() + "T12:00:00");
    d.setDate(d.getDate() - n);
    return String(iso) >= window.Util.fechaISO(d);
  }

  // Un renglón por problema, con su último monitoreo, los más recientes arriba.
  function lista(monitoreos, soloRecientes) {
    const ultimos = {};
    (monitoreos || []).forEach((m) => {
      const k = clave(m);
      if (!ultimos[k] || porFecha(ultimos[k], m) < 0) ultimos[k] = m;
    });
    return Object.keys(ultimos).map((k) => ({
      clave: k,
      ultimo: ultimos[k],
      cadena: cadena(monitoreos, k),
    }))
      .filter((p) => !soloRecientes || haceDias(p.ultimo.fecha, DIAS_ABIERTO))
      .sort((a, b) => porFecha(b.ultimo, a.ultimo));
  }

  // Lo mismo que se vio antes en el mismo sector: candidato a seguimiento.
  function parecidos(monitoreos, que, otro, sectorId) {
    return lista(monitoreos, true).filter((p) => {
      const u = p.ultimo;
      if (u.sector_id !== sectorId) return false;
      if (que && que !== "__otro") return u.plaga_id === que;
      return !u.plaga_id && otro &&
        String(u.deteccion).trim().toLowerCase() === String(otro).trim().toLowerCase();
    });
  }

  function aplicacionesDe(k, monitoreos, aplicaciones, tratamientos) {
    const ids = new Set(cadena(monitoreos, k).map((m) => m.id));
    const planes = new Set((tratamientos || [])
      .filter((t) => ids.has(t.monitoreo_id)).map((t) => t.id));
    return (aplicaciones || [])
      .filter((a) => a.estado === "Aplicada")
      .filter((a) => a.problema_id === k || ids.has(a.monitoreo_id) || planes.has(a.plan_id))
      .map((a) => Object.assign({}, a, { fecha: a.fecha_aplicada || a.fecha }))
      .sort(porFecha);
  }

  function fechaCorta(iso) {
    const [, m, d] = String(iso || "").split("-");
    return d && m ? `${d}/${m}` : "—";
  }

  const tieneIncidencia = (m) => m.incidencia !== "" && m.incidencia !== undefined &&
    m.incidencia !== null && !Number.isNaN(Number(m.incidencia));

  // La frase de arriba: de cuánto a cuánto, en cuántos días.
  function tendencia(c) {
    const conDato = c.filter(tieneIncidencia);
    if (c.length < 2) return "";
    if (conDato.length < 2) {
      return "Hay más de un monitoreo, pero no alcanzan los que tienen incidencia anotada para ver hacia dónde va.";
    }
    const a = conDato[0];
    const b = conDato[conDato.length - 1];
    const dias = Math.round((new Date(b.fecha) - new Date(a.fecha)) / 86400000);
    const lapso = dias > 0 ? ` en ${dias} ${dias === 1 ? "día" : "días"}` : "";
    const ia = Number(a.incidencia);
    const ib = Number(b.incidencia);
    if (ib === 0) return `No se encontró en el último monitoreo: pasó de ${ia} % a 0 %${lapso}.`;
    if (ib < ia) return `Bajó de ${ia} % a ${ib} % de incidencia${lapso}.`;
    if (ib > ia) return `Subió de ${ia} % a ${ib} % de incidencia${lapso}.`;
    return `Sigue en ${ib} % de incidencia${lapso}.`;
  }

  function claseTendencia(c) {
    const conDato = c.filter(tieneIncidencia);
    if (conDato.length < 2) return "";
    const ia = Number(conDato[0].incidencia);
    const ib = Number(conDato[conDato.length - 1].incidencia);
    return ib < ia ? "evolucion--baja" : ib > ia ? "evolucion--sube" : "";
  }

  // La línea de tiempo: monitoreos y aplicaciones mezclados por fecha, que es
  // como se lee la historia en el campo ("vi, apliqué, volví a mirar").
  function evolucion(k, monitoreos, aplicaciones, tratamientos, actual) {
    const c = cadena(monitoreos, k);
    const apps = aplicacionesDe(k, monitoreos, aplicaciones, tratamientos);
    if (c.length < 2 && !apps.length) return "";

    const hechos = c.map((m) => ({ tipo: "m", fecha: m.fecha, creado: m.creado, m: m }))
      .concat(apps.map((a) => ({ tipo: "a", fecha: a.fecha, creado: a.creado, a: a })))
      .sort(porFecha);

    const frase = tendencia(c);

    return `
      <div class="tarjeta evolucion ${claseTendencia(c)}">
        <h2>Cómo viene evolucionando</h2>
        ${frase ? `<p class="evolucion__frase">${esc(frase)}</p>` : ""}
        <p class="nota">${c.length} ${c.length === 1 ? "monitoreo" : "monitoreos"} ·
          ${apps.length} ${apps.length === 1 ? "aplicación registrada" : "aplicaciones registradas"}.
          La app muestra lo anotado; si la mejora es por las aplicaciones, el
          clima o los enemigos naturales, lo juzgás vos con el técnico.</p>
        <ol class="linea-tiempo">
          ${hechos.map((h) => h.tipo === "m" ? filaMonitoreo(h.m, actual) : filaAplicacion(h.a)).join("")}
        </ol>
      </div>`;
  }

  function filaMonitoreo(m, actual) {
    const inc = tieneIncidencia(m) ? Math.max(0, Math.min(100, Number(m.incidencia))) : null;
    return `
      <li class="linea-tiempo__item linea-tiempo__item--monitoreo${m.id === actual ? " linea-tiempo__item--actual" : ""}">
        <span class="linea-tiempo__fecha">${esc(fechaCorta(m.fecha))}</span>
        <span class="linea-tiempo__texto">
          <strong>🔍 ${inc === null ? "Monitoreo sin incidencia anotada" : inc + " % de incidencia"}</strong>
          ${inc === null ? "" : `<progress class="linea-tiempo__barra" max="100" value="${inc}"></progress>`}
          <span class="agenda__detalle">${m.severidad ? "Severidad " + esc(m.severidad.toLowerCase()) : "Severidad sin anotar"}${
            m.bancal ? " · bancal " + esc(m.bancal) : ""}${
            m.revisadas ? " · " + esc(String(m.revisadas)) + " plantas" : ""}${
            m.id === actual ? " · el que estás viendo" : ""}</span>
        </span>
      </li>`;
  }

  function filaAplicacion(a) {
    return `
      <li class="linea-tiempo__item linea-tiempo__item--aplicacion">
        <span class="linea-tiempo__fecha">${esc(fechaCorta(a.fecha))}</span>
        <span class="linea-tiempo__texto">
          <strong>💧 ${esc(a.producto)}</strong>
          <span class="agenda__detalle">${esc([a.dosis, a.metodo, a.sector].filter(Boolean).join(" · "))}${
            a.plan_id ? " · del tratamiento" : ""}</span>
        </span>
      </li>`;
  }

  return { clave, cadena, lista, parecidos, aplicacionesDe, evolucion, tendencia, fechaCorta, DIAS_ABIERTO };
})();
