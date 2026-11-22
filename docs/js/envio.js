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
  // Publicada el 29/10/2026 desde la cuenta biosalud.ecomarcal@gmail.com, cuando los
  // datos se mudaron ahí para dejar de usar el Drive personal del referente (ver
  // MIGRACION-DRIVE.md). La dirección anterior, del 26/10, salía de un proyecto
  // de la cuenta personal: cambiar de cuenta obliga a implementar de cero, y una
  // implementación nueva siempre tiene otra dirección.
  //
  // Si se vuelve a implementar desde cero, cambia y hay que actualizarla acá. Una
  // nueva VERSIÓN de la misma implementación, en cambio, conserva la dirección.
  const SERVICIO =
    "https://script.google.com/macros/s/AKfycbz7eS03Ot-sRIRSlzra80wfMMAGFIDvAerRgqLfMS8nrAybau_lbGz2ciMSUFianReqDA/exec";

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
    const terminos = await window.BioDB.obtener("config", "terminos");
    return {
      pendientes: cola.length,
      conServicio: hayServicio(),
      conCodigoChacra: !!(config && config.codigo),
      conTerminos: !!(terminos && terminos.valor && terminos.valor.version),
      activado: window.Acceso.tieneAcceso(),
      enLinea: navigator.onLine,
    };
  }

  // Una frase que resume la situación, para el inicio y para Configuración.
  function resumir(e) {
    if (!e.conServicio) return "El servicio todavía no está publicado: todo queda guardado en el teléfono.";
    if (!e.conCodigoChacra) return "Falta el código de chacra que te entrega el equipo técnico.";
    // Antes decía "cargá tu código de invitación" aunque todavía faltaran los
    // términos: la línea de estado y el panel de abajo mandaban a hacer cosas
    // distintas.
    if (!e.conTerminos) return "Este teléfono todavía no está activado. Primero hay que aceptar los términos de uso.";
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

    // Sin términos aceptados no se activa, y el control está acá y no solo en la
    // pantalla: activar es el momento en que los datos empiezan a salir del
    // teléfono, así que es el momento en que el consentimiento tiene que existir.
    const guardado = await window.BioDB.obtener("config", "terminos");
    const terminos = guardado && guardado.valor ? guardado.valor.version : "";
    if (!terminos) {
      return { ok: false, error: "Antes hay que leer y aceptar los términos de uso." };
    }

    const consulta = url
      + "?canjear=" + encodeURIComponent(String(codigo || "").trim())
      + "&chacra=" + encodeURIComponent(config.codigo)
      + "&persona=" + encodeURIComponent(config.responsable || "")
      + "&terminos=" + encodeURIComponent(terminos)
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
      return { ok: false, error: "No se pudo contactar al servicio. Verificá la señal." };
    }
  }

  // ---------- Traer la configuración que ya está en la planilla ----------
  //
  // PARA QUÉ: una chacra puede usarse desde más de un teléfono —el del productor
  // y la notebook, o dos personas del mismo establecimiento— y el segundo no
  // tiene por qué cargar todo de nuevo. Si lo hiciera, además, inventaría sus
  // propios ids de sector y la planilla terminaría con dos ids para el mismo
  // cantero.
  //
  // El servicio ya tenía esta puerta abierta (?config=1) y exige credencial de
  // esa chacra, así que primero se activa el teléfono y recién después se baja.
  async function traerConfig(codigoChacra) {
    const url = leerUrl();
    if (!url) return { ok: false, error: "Todavía no está cargada la dirección del servicio." };
    if (!window.Acceso.tieneAcceso()) {
      return { ok: false, error: "Primero hay que activar este teléfono." };
    }

    const consulta = url
      + "?config=1"
      + "&chacra=" + encodeURIComponent(String(codigoChacra || "").trim())
      + "&credencial=" + encodeURIComponent(window.Acceso.credencial())
      + "&dispositivo=" + encodeURIComponent(window.Acceso.dispositivo());

    try {
      const datos = await (await fetch(consulta)).json();
      if (!datos.ok) return { ok: false, error: datos.error || "El servicio no devolvió la configuración." };
      if (!datos.config || !(datos.config.sectores || []).length) {
        return { ok: false, error: "Esa chacra todavía no tiene una configuración cargada en la planilla." };
      }
      return { ok: true, config: datos.config };
    } catch (err) {
      return { ok: false, error: "No se pudo contactar al servicio. Verificá la señal." };
    }
  }

  // ---------- Vaciar la cola ----------

  let enviando = false;

  // Cuánto se espera al servicio antes de dar el pedido por perdido. Sin tope,
  // un pedido colgado en una señal que va y viene dejaba `enviando` prendido
  // durante minutos, y en ese rato "Enviar ahora" no hacía nada ni avisaba. Es
  // largo a propósito: una foto de 200 KB con una rayita de señal tarda.
  const ESPERA_ENVIO_MS = 90000;

  // SOLO SE SACA DE LA COLA LO QUE SE MANDÓ, NO LO QUE SE CARGÓ MIENTRAS TANTO.
  //
  // Un registro que se vuelve a encolar con su mismo id —un renglón del plan
  // corregido, un monitoreo al que se le marca el aviso— pisa al anterior en la
  // cola. Si eso pasa mientras el anterior está viajando, borrar por id se
  // llevaba la versión nueva, que nunca salió del teléfono. Por eso antes de
  // borrar se mira que en la cola siga estando exactamente lo que se envió.
  async function quitarDeLaCola(enviado) {
    const actual = await window.BioDB.obtener("salida", enviado.id);
    if (actual && actual.creado === enviado.creado) {
      await window.BioDB.borrar("salida", enviado.id);
    }
  }

  // Manda lo pendiente y, si salió bien, se pone al día con la planilla. La
  // bajada no se espera: quien llama solo necesita saber cómo quedó la cola, y
  // lo que llegue de la planilla avisa por su cuenta (evento biosalud:datos).
  async function sincronizar(silencioso = true) {
    const r = await enviar(silencioso);
    if (r.ok) bajar(!silencioso);
    return r;
  }

  async function enviar(silencioso) {
    if (enviando) {
      if (!silencioso) window.Util.brindis("Ya se está enviando: esperá un momento.");
      return { ok: false, motivo: "ya-en-curso" };
    }

    const e = await estado();
    if (!e.conServicio || !e.activado || !e.enLinea) return { ok: false, motivo: "no-corresponde" };

    const cola = await window.BioDB.pendientes();
    if (!cola.length) return { ok: true, enviados: 0 };

    const config = await window.BioDB.leerConfig();
    enviando = true;
    try {
      // LAS FOTOS VIAJAN DE A UNA, APARTE DEL RESTO.
      //
      // Todo lo demás son unos pocos kilobytes y va junto, en un solo pedido.
      // Una foto pesa cien veces más, y mandarlas todas en el mismo cuerpo
      // tiene dos problemas: el pedido se vuelve de varios megas sobre la señal
      // que haya en la chacra, y si falla se reintenta TODO, fotos incluidas.
      // De a una, lo que entra queda guardado y lo que falla vuelve a intentarse
      // solo.
      const fotos = cola.filter((r) => r.tipo === "foto");
      const resto = cola.filter((r) => r.tipo !== "foto");

      let guardados = 0;
      let enviados = 0;

      if (resto.length) {
        const r = await mandar(config.codigo, resto, silencioso);
        if (!r.ok) return r;
        guardados += r.guardados || 0;
        enviados += resto.length;
        for (const x of resto) await quitarDeLaCola(x);
      }

      for (const foto of fotos) {
        const r = await mandar(config.codigo, [foto], silencioso);
        // Si una foto no entra, se corta acá: lo anterior ya quedó guardado y
        // esta sigue en la cola para el próximo intento.
        if (!r.ok) return Object.assign(r, { enviados: enviados, guardados: guardados });
        guardados += r.guardados || 0;
        enviados += 1;
        await quitarDeLaCola(foto);
      }

      if (!silencioso) {
        window.Util.brindis(`${guardados || enviados} registro(s) enviado(s) ✓`);
      }
      return { ok: true, enviados: enviados, guardados: guardados };
    } catch (err) {
      if (!silencioso) window.Util.brindis("No se pudo enviar. Revisá la señal.");
      return { ok: false, motivo: "sin-red" };
    } finally {
      enviando = false;
    }
  }

  // Un pedido al servicio con un lote de registros. No saca nada de la cola:
  // eso lo decide quien lo llama, cuando ya sabe que el lote entró.
  async function mandar(chacra, registros, silencioso) {
    // AbortController está en cualquier navegador de 2019 en adelante; donde no
    // esté, el pedido sale igual, sin tope de espera.
    const corte = window.AbortController ? new AbortController() : null;
    const reloj = corte ? setTimeout(() => corte.abort(), ESPERA_ENVIO_MS) : null;
    let respuesta;
    try {
      respuesta = await fetch(leerUrl(), {
        signal: corte ? corte.signal : undefined,
        method: "POST",
        // texto plano a propósito: evita la consulta previa de CORS, que
        // Apps Script no contesta.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign(
          window.Acceso.identificacion(chacra), { registros: registros })),
      });
    } finally {
      if (reloj) clearTimeout(reloj);
    }
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

    return { ok: true, guardados: datos.guardados };
  }

  // ==========================================================================
  // BAJAR LO QUE ESTÁ EN LA PLANILLA
  //
  // LA PLANILLA ES LA VERSIÓN COMPARTIDA; CADA APARATO GUARDA UNA COPIA.
  //
  // Hasta noviembre de 2026 los datos solo subían: la notebook y el celular de
  // la misma chacra mandaban a la misma planilla, pero cada uno mostraba lo que
  // había cargado él. Ahora, después de cada envío, el aparato baja todo lo de
  // la chacra y lo mezcla con su copia. La copia sigue haciendo falta: en el
  // campo no hay señal y la app tiene que andar igual.
  //
  // Las reglas de la mezcla, de la más fuerte a la más débil:
  //
  //   1. Lo que este aparato todavía no mandó gana siempre. Está en la cola y
  //      es más nuevo que cualquier cosa que tenga la planilla.
  //   2. Lo que está en la planilla reemplaza a la copia de acá. Si otro
  //      aparato corrigió un renglón, se ve la corrección.
  //   3. Un renglón del plan o un tratamiento "Dado de baja" en la planilla se
  //      saca de acá.
  //   4. Lo que está acá y en la planilla figura sin el registro completo (filas
  //      de antes de esta versión) se vuelve a mandar, solo, para completarlo.
  //   5. Lo que está SOLO acá no se sube ni se borra sin preguntar: puede ser un
  //      plan viejo que el productor no quiere ver en los demás aparatos. Queda
  //      anotado y el inicio pregunta qué hacer (ver soloEnEsteAparato).
  //
  // Lo que no se hace nunca: borrar algo de acá porque no está en la planilla.
  // ==========================================================================

  // tipo con el que viaja → almacén de la base
  const COMPARTIDOS = [
    ["plan", "planes"], ["aplicaciones", "aplicaciones"],
    ["monitoreos", "monitoreos"], ["tratamientos", "tratamientos"],
  ];
  const CON_BAJA = ["plan", "tratamientos"];

  // Una bajada pide todo a Apps Script, que tarda un par de segundos. Abrir la
  // app, volver a ella y mandar algo pueden pasar en el mismo minuto: con
  // medio minuto de espera alcanza para no pedir tres veces lo mismo.
  const ENTRE_BAJADAS_MS = 30000;
  let ultimaBajada = 0;
  let bajando = false;

  // Comparar dos registros sin que importe el orden de las claves.
  function huella(x) {
    if (Array.isArray(x)) return "[" + x.map(huella).join(",") + "]";
    if (x && typeof x === "object") {
      return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + huella(x[k])).join(",") + "}";
    }
    return JSON.stringify(x === undefined ? null : x);
  }

  const CLAVE_SINCRONIA = "sincronia";

  async function bajar(forzar) {
    if (bajando) return { ok: false, motivo: "ya-en-curso" };
    if (!forzar && Date.now() - ultimaBajada < ENTRE_BAJADAS_MS) return { ok: false, motivo: "reciente" };
    const url = leerUrl();
    const config = await window.BioDB.leerConfig();
    if (!url || !config || !config.codigo || !window.Acceso.tieneAcceso() || !navigator.onLine) {
      return { ok: false, motivo: "no-corresponde" };
    }

    bajando = true;
    try {
      const consulta = url
        + "?datos=1"
        + "&chacra=" + encodeURIComponent(config.codigo)
        + "&credencial=" + encodeURIComponent(window.Acceso.credencial())
        + "&dispositivo=" + encodeURIComponent(window.Acceso.dispositivo());
      const corte = window.AbortController ? new AbortController() : null;
      const reloj = corte ? setTimeout(() => corte.abort(), ESPERA_ENVIO_MS) : null;
      let datos;
      try {
        datos = await (await fetch(consulta, { signal: corte ? corte.signal : undefined })).json();
      } finally {
        if (reloj) clearTimeout(reloj);
      }

      if (datos.sin_permiso) { window.Acceso.borrarCredencial(); return { ok: false, motivo: "sin-permiso" }; }
      // Un servicio viejo, sin la puerta ?datos=1, contesta solo que existe.
      if (!datos.ok || !Array.isArray(datos.plan)) return { ok: false, motivo: "servicio-viejo" };

      const r = await mezclar(datos, config);
      ultimaBajada = Date.now();
      if (r.cambios) {
        window.dispatchEvent(new CustomEvent("biosalud:datos", { detail: r }));
      }
      // Lo que se encoló para completar la planilla sale en el próximo envío;
      // se pide ya, sin esperar a que el productor cargue otra cosa.
      if (r.completar) setTimeout(() => enviar(true), 500);
      return Object.assign({ ok: true }, r);
    } catch (err) {
      return { ok: false, motivo: "sin-red" };
    } finally {
      bajando = false;
    }
  }

  async function mezclar(datos, config) {
    const cola = await window.BioDB.pendientes();
    const enCola = new Set(cola.map((x) => x.id));
    // Si mientras tanto se cargó algo con ese id, gana lo de acá (regla 1).
    const sigueLibre = async (id) => !(await window.BioDB.obtener("salida", id));

    let cambios = 0;
    let completar = 0;
    const solo = {};

    for (const [tipo, almacen] of COMPARTIDOS) {
      const remotos = datos[tipo] || [];
      const sinRegistro = new Set(((datos.sin_registro || {})[tipo]) || []);
      const locales = await window.BioDB.todos(almacen);
      const porId = {};
      locales.forEach((l) => { porId[l.id] = l; });
      const enPlanilla = new Set(remotos.map((x) => x.id));

      for (const remoto of remotos) {
        if (enCola.has(remoto.id)) continue;
        const local = porId[remoto.id];
        if (CON_BAJA.includes(tipo) && remoto.estado === "Dado de baja") {
          if (local && await sigueLibre(remoto.id)) {
            await window.BioDB.borrar(almacen, remoto.id);
            cambios++;
          }
          continue;
        }
        const nuevo = tipo === "plan" ? Object.assign({}, remoto, { en_planilla: true }) : remoto;
        if (local && huella(local) === huella(nuevo)) continue;
        if (!(await sigueLibre(remoto.id))) continue;
        await window.BioDB.guardar(almacen, nuevo);
        cambios++;
      }

      for (const local of locales) {
        if (enPlanilla.has(local.id) || enCola.has(local.id)) continue;
        if (sinRegistro.has(local.id)) {
          // Regla 4: ya está en la planilla, falta su registro completo.
          if (tipo === "plan" && !local.en_planilla) {
            local.en_planilla = true;
            await window.BioDB.guardar(almacen, local);
          }
          await window.BioDB.encolarCon(local.id, tipo, local);
          completar++;
          continue;
        }
        (solo[tipo] = solo[tipo] || []).push(local.id);
      }
    }

    // La configuración: sectores y datos del establecimiento. Si acá hay una
    // sin mandar, gana la de acá, como con todo lo demás.
    const cfg = datos.config;
    if (cfg && (cfg.sectores || []).length && cfg.nombre && !cola.some((x) => x.tipo === "config")) {
      const campos = ["nombre", "localidad", "responsable", "contacto", "situacion", "sectores"];
      const nueva = Object.assign({}, config);
      campos.forEach((k) => { if (cfg[k] !== undefined) nueva[k] = cfg[k]; });
      if (campos.some((k) => huella(nueva[k]) !== huella(config[k]))) {
        await window.BioDB.guardarConfig(nueva);
        cambios++;
      }
    }

    await window.BioDB.guardar("config", {
      clave: CLAVE_SINCRONIA,
      valor: { ultima: new Date().toISOString(), solo: solo },
    });
    return { cambios, completar, solo };
  }

  // ---------- Lo que está solo en este aparato ----------
  //
  // Se recalcula contra la base, no se confía en lo anotado: desde la última
  // bajada el productor pudo haber borrado algo, o haberlo mandado.
  async function soloEnEsteAparato() {
    const fila = await window.BioDB.obtener("config", CLAVE_SINCRONIA);
    const anotado = (fila && fila.valor && fila.valor.solo) || {};
    const enCola = new Set((await window.BioDB.pendientes()).map((x) => x.id));
    const resultado = { total: 0, porTipo: {}, registros: [] };
    for (const [tipo, almacen] of COMPARTIDOS) {
      for (const id of anotado[tipo] || []) {
        if (enCola.has(id)) continue;
        const r = await window.BioDB.obtener(almacen, id);
        if (!r) continue;
        resultado.registros.push({ tipo, almacen, r });
        resultado.porTipo[tipo] = (resultado.porTipo[tipo] || 0) + 1;
        resultado.total++;
      }
    }
    return resultado;
  }

  async function olvidarSolo() {
    const fila = await window.BioDB.obtener("config", CLAVE_SINCRONIA);
    const valor = Object.assign({}, fila && fila.valor, { solo: {} });
    await window.BioDB.guardar("config", { clave: CLAVE_SINCRONIA, valor: valor });
  }

  // "Subirlos": pasan a estar en la planilla y, desde ahí, en todos los aparatos.
  async function subirSolo() {
    const s = await soloEnEsteAparato();
    for (const x of s.registros) {
      if (x.tipo === "plan" && !x.r.en_planilla) {
        x.r.en_planilla = true;
        await window.BioDB.guardar(x.almacen, x.r);
      }
      await window.BioDB.encolarCon(x.r.id, x.tipo, x.r);
    }
    await olvidarSolo();
    return sincronizar(false);
  }

  // "Quedarme con lo de la planilla": se borran de este aparato y nada más.
  // En la planilla no estaban, así que no hay nada que avisar.
  async function descartarSolo() {
    const s = await soloEnEsteAparato();
    for (const x of s.registros) await window.BioDB.borrar(x.almacen, x.r.id);
    await olvidarSolo();
    window.dispatchEvent(new CustomEvent("biosalud:datos", { detail: { cambios: s.total } }));
    return s.total;
  }

  // Se intenta al abrir la app, cada vez que vuelve la señal y cada vez que se
  // vuelve a la app después de haberla dejado en segundo plano: es lo que pasa
  // cuando alguien carga en la notebook y después abre el celular. Nunca
  // molesta: si no corresponde, no hace nada.
  function arrancar() {
    window.addEventListener("online", () => sincronizar());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sincronizar();
    });
    setTimeout(() => sincronizar(), 1500);
  }

  return {
    leerUrl, guardarUrl, hayServicio, estado, resumir, canjear, traerConfig,
    sincronizar, bajar, soloEnEsteAparato, subirSolo, descartarSolo, arrancar,
  };
})();
