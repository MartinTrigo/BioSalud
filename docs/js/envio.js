// ==========================================================================
// BioSalud ECOMARCAL — envío a la planilla de la chacra
//
// Hasta acá todo lo que el productor carga queda en el teléfono, en una cola.
// Este módulo es el que la vacía: activa el teléfono con un código de
// invitación y después manda los registros pendientes cuando hay señal.
//
// Reglas que no se negocian:
//
//   · SIN CREDENCIAL NO SE MANDA NADA. Queda todo en la cola.
//   · LA COLA NO SE BORRA NUNCA POR UN PROBLEMA DE ACCESO. Si el servicio
//     contesta que este teléfono ya no tiene permiso, se borra la credencial
//     pero los registros se quedan esperando. Lo que el productor cargó
//     caminando el campo no se pierde por un tema administrativo.
//   · SOLO SE SACA DE LA COLA LO QUE EL SERVICIO CONFIRMÓ HABER GUARDADO.
// ==========================================================================

window.Envio = (function () {
  // La dirección del servicio publicado. Va en el código porque tiene que
  // funcionar sin que cada productor configure nada; lo que impide que un
  // desconocido escriba no es esconder esta dirección, es la credencial.
  //
  // Publicada el 26/10/2026. Si se vuelve a implementar desde cero cambia, y
  // hay que actualizarla acá (una nueva VERSIÓN de la misma implementación, en
  // cambio, conserva la dirección).
  const SERVICIO =
    "https://script.google.com/macros/s/AKfycbxbVIBQj9ilOpFCfHHZcFRf0MQrze8KubLpAuHaY0s_EGY4K1jC3BfCco6F_XJ-u6gs/exec";

  const LS_URL = "biosalud_servicio";

  const leerUrl = () => {
    try { return localStorage.getItem(LS_URL) || SERVICIO; } catch (e) { return SERVICIO; }
  };

  const guardarUrl = (u) => {
    try { localStorage.setItem(LS_URL, String(u || "").trim()); } catch (e) { /* incógnito */ }
  };

  const hayServicio = () => !!leerUrl();

  // ---------- Estado, para mostrarlo en pantalla ----------

  async function estado() {
    const config = await window.BioDB.leerConfig();
    const cola = await window.BioDB.pendientes();
    return {
      pendientes: cola.length,
      conServicio: hayServicio(),
      conCodigoChacra: !!(config && config.codigo),
      activado: window.Acceso.tieneAcceso(),
      enLinea: navigator.onLine,
    };
  }

  // Una frase que resume la situación, para el inicio y para Configuración.
  function resumir(e) {
    if (!e.conServicio) return "El servicio todavía no está publicado: todo queda guardado en el teléfono.";
    if (!e.conCodigoChacra) return "Falta el código de chacra que te da el equipo técnico.";
    if (!e.activado) return "Este teléfono todavía no está activado. Cargá tu código de invitación.";
    if (!e.enLinea) return e.pendientes
      ? `Sin señal · ${e.pendientes} ${e.pendientes === 1 ? "registro" : "registros"} por enviar`
      : "Sin señal · al día";
    return e.pendientes
      ? `${e.pendientes} ${e.pendientes === 1 ? "registro" : "registros"} por enviar`
      : "Todo enviado ✓";
  }

  // ---------- Activar el teléfono ----------

  async function canjear(codigo) {
    const url = leerUrl();
    if (!url) return { ok: false, error: "Todavía no está cargada la dirección del servicio." };

    const config = await window.BioDB.leerConfig();
    if (!config || !config.codigo) {
      return { ok: false, error: "Antes hay que cargar el código de chacra en la configuración." };
    }

    const consulta = url
      + "?canjear=" + encodeURIComponent(String(codigo || "").trim())
      + "&chacra=" + encodeURIComponent(config.codigo)
      + "&persona=" + encodeURIComponent(config.responsable || "")
      + "&dispositivo=" + encodeURIComponent(window.Acceso.dispositivo());

    try {
      const respuesta = await fetch(consulta);
      const datos = await respuesta.json();
      if (datos.ok && datos.credencial) {
        window.Acceso.guardarCredencial(datos.credencial);
        return { ok: true, persona: datos.persona };
      }
      return { ok: false, error: datos.error || "El servicio no devolvió una credencial." };
    } catch (err) {
      return { ok: false, error: "No se pudo contactar al servicio. ¿Hay señal?" };
    }
  }

  // ---------- Vaciar la cola ----------

  let enviando = false;

  async function sincronizar(silencioso = true) {
    if (enviando) return { ok: false, motivo: "ya-en-curso" };

    const e = await estado();
    if (!e.conServicio || !e.activado || !e.enLinea) return { ok: false, motivo: "no-corresponde" };

    const cola = await window.BioDB.pendientes();
    if (!cola.length) return { ok: true, enviados: 0 };

    const config = await window.BioDB.leerConfig();
    enviando = true;
    try {
      const respuesta = await fetch(leerUrl(), {
        method: "POST",
        // texto plano a propósito: evita la consulta previa de CORS, que
        // Apps Script no contesta.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign(
          window.Acceso.identificacion(config.codigo), { registros: cola })),
      });
      const datos = await respuesta.json();

      // Dado de baja: se corta el acceso, pero la cola queda intacta.
      if (datos.sin_permiso) {
        window.Acceso.borrarCredencial();
        if (!silencioso) window.Util.brindis(datos.error || "Este teléfono ya no tiene acceso.");
        return { ok: false, motivo: "sin-permiso", error: datos.error };
      }

      if (!datos.ok) {
        if (!silencioso) window.Util.brindis("No se pudo enviar: " + (datos.error || "error del servicio"));
        return { ok: false, motivo: "error", error: datos.error };
      }

      // Recién ahora se saca de la cola, y solo lo que se mandó en este lote.
      for (const r of cola) await window.BioDB.borrar("salida", r.id);

      if (!silencioso) {
        window.Util.brindis(`${datos.guardados || cola.length} registro(s) enviado(s) ✓`);
      }
      return { ok: true, enviados: cola.length, guardados: datos.guardados };
    } catch (err) {
      if (!silencioso) window.Util.brindis("No se pudo enviar. Revisá la señal.");
      return { ok: false, motivo: "sin-red" };
    } finally {
      enviando = false;
    }
  }

  // Se intenta al abrir la app y cada vez que vuelve la señal. Nunca molesta:
  // si no corresponde, no hace nada.
  function arrancar() {
    window.addEventListener("online", () => sincronizar());
    setTimeout(() => sincronizar(), 1500);
  }

  return { leerUrl, guardarUrl, hayServicio, estado, resumir, canjear, sincronizar, arrancar };
})();
