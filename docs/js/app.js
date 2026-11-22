// ==========================================================================
// BioSalud ECOMARCAL — armazón de la app
//
// Maneja la navegación entre secciones y el bloqueo del menú hasta que la
// configuración del establecimiento esté completa.
// ==========================================================================

(function () {
  const { esc, superficie } = window.Util;

  // La versión que se muestra al pie es la del caché del service worker (el
  // número de CACHE en sw.js), que es lo único que cambia con cada publicación.
  // Antes había acá un texto fijo que decía "0.1.0 · fase 1" desde el primer
  // día: no servía para saber si un teléfono tenía o no el último arreglo, que
  // es para lo único que alguien mira ese renglón.
  const PREFIJO_CACHE = "biosalud-";

  const vista = document.getElementById("vista");
  const titulo = document.getElementById("titulo-vista");
  const subtitulo = document.getElementById("subtitulo-vista");
  const botonVolver = document.getElementById("btn-volver");

  let config = null;
  let instalador = null;   // evento de instalación que ofrece Android

  // Las secciones que todavía no están programadas se muestran igual, con la
  // fase en la que llegan: así el productor sabe qué va a poder hacer y no
  // parece que la app estuviera rota.
  const SECCIONES = {
    plan: {
      icono: "🌱",
      titulo: "Registrar Plan de Salud",
      detalle: "Productos, dosis, frecuencia y sectores",
      subtitulo: "Plan de aplicaciones de la temporada",
      listo: true,          // la atiende js/plan.js
    },
    seguimiento: {
      icono: "✅",
      titulo: "Seguimiento de plan",
      detalle: "Qué corresponde aplicar hoy y qué quedó pendiente",
      subtitulo: "Checklist de aplicaciones",
      listo: true,          // la atiende js/seguimiento.js
    },
    aplicacion: {
      icono: "💧",
      titulo: "Registrar aplicación",
      detalle: "Lo que aplicaste fuera del plan: urgencias, productos comprados",
      subtitulo: "Aplicación fuera del plan",
      listo: true,          // la atiende js/aplicacion.js
    },
    monitoreo: {
      icono: "🔍",
      titulo: "Monitoreo de campo",
      detalle: "Síntomas, plagas, incidencia y severidad",
      subtitulo: "Observación a campo",
      listo: true,          // la atiende js/monitoreo.js
    },
    wiki: {
      icono: "📖",
      titulo: "Info / Wiki",
      detalle: "Biopreparados y plagas de la Comarca",
      subtitulo: "Material de consulta",
      listo: true,          // esta sección ya está: la atiende js/wiki.js
      // Única sección que no espera a la configuración: es material de lectura
      // y no necesita saber nada del establecimiento.
      sinConfig: true,
    },
  };

  // ---------- Navegación ----------

  const rutaActual = () => (location.hash || "#/inicio").replace("#/", "");

  function ir(ruta) {
    location.hash = "#/" + ruta;
  }

  // Si una pantalla falla al dibujarse, se dice. Sin esto la app se quedaba en
  // "Cargando…" para siempre, o mostrando la pantalla anterior con el título de
  // la nueva, y no había forma de saber qué había pasado ni de contarlo.
  async function mostrar(evento) {
    try {
      await dibujar();
    } catch (err) {
      console.error(err);
      encabezado("BioSalud", "Algo falló");
      botonVolver.hidden = false;
      vista.innerHTML = `<p class="aviso aviso--error">No se pudo abrir esta pantalla.
        Lo que ya cargaste sigue guardado en el teléfono.<br><br>
        Detalle: ${esc((err && err.message) || err)}</p>
        <button class="boton boton--ancho" id="btn-reintentar">Volver a intentar</button>`;
      document.getElementById("btn-reintentar").onclick = () => location.reload();
    }

    // Al cambiar de pantalla el foco pasa al contenido nuevo. Quien usa lector
    // de pantalla o teclado quedaba parado en un botón que ya no existe, sin
    // enterarse de que la pantalla había cambiado. Solo al navegar: en la
    // primera carga no hay nada de dónde venir.
    if (evento && evento.type === "hashchange") {
      try { vista.focus({ preventScroll: true }); } catch (e) { /* navegador viejo */ }
    }
  }

  async function dibujar() {
    const ruta = rutaActual();
    const base = ruta.split("/")[0];      // "wiki/plagas/pulgones" → "wiki"
    config = await window.BioDB.leerConfig();
    const habilitada = window.Config.completa(config);

    // EL RECORRIDO DE ALGUIEN QUE ABRE LA APP POR PRIMERA VEZ
    //
    //   términos → configuración → el resto de la app
    //
    // y, saliéndose de la fila, la Info / Wiki, que se lee sin aceptar ni
    // cargar nada (ver js/terminos.js y SECCIONES.wiki más arriba).
    //
    // Si los términos no se pueden leer —la primera vez sin señal y sin caché—
    // la app no queda trabada: se sigue de largo. El portón es el orden de las
    // pantallas, no la protección de los datos; eso lo hace el canje, que sin
    // términos aceptados no activa el teléfono.
    const sinTerminos = await faltanTerminos();
    const deLectura = base === "terminos" || (SECCIONES[base] || {}).sinConfig;

    botonVolver.hidden = ruta === "inicio" || (sinTerminos && base === "terminos");
    window.scrollTo(0, 0);

    if (sinTerminos && !deLectura) {
      ir("terminos");
      return;
    }

    // Nadie entra a una sección con la configuración incompleta, ni siquiera
    // escribiendo la dirección a mano. La wiki es la excepción: se puede leer
    // desde el primer momento.
    const libre = base === "inicio" || base === "config" || base === "terminos"
                  || (SECCIONES[base] || {}).sinConfig;
    if (!libre && !habilitada) {
      ir("config");
      return;
    }

    if (base === "config") {
      encabezado("Configuración", "Datos de tu establecimiento");
      await window.Config.render(vista, () => ir("inicio"));
      return;
    }

    // Los términos se leen sin haber cargado nada: son justamente lo que hay que
    // leer antes de decidir si se carga algo.
    if (base === "terminos") {
      const cabecera = await window.Terminos.render(vista, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    // La wiki maneja sus propias sub-pantallas y devuelve qué poner en la
    // cabecera, que cambia según se esté viendo el índice o una ficha.
    if (base === "wiki") {
      const cabecera = await window.Wiki.render(vista, ruta, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    if (base === "plan") {
      const cabecera = await window.Plan.render(vista, ruta, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    if (base === "monitoreo") {
      const cabecera = await window.Monitoreo.render(vista, ruta, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    if (base === "aplicacion") {
      const cabecera = await window.Aplicacion.render(vista, ruta, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    if (base === "seguimiento") {
      const cabecera = await window.Seguimiento.render(vista, ruta, ir);
      encabezado(cabecera.titulo, cabecera.subtitulo);
      return;
    }

    if (SECCIONES[base]) {
      const s = SECCIONES[base];
      encabezado(s.titulo, s.subtitulo);
      enConstruccion(s);
      return;
    }

    encabezado("BioSalud", "Salud del suelo y los cultivos");
    inicio(habilitada);
  }

  // Nunca aceptó nada. Los términos que cambiaron no cuentan acá: a quien ya
  // viene usando la app se le avisa en Configuración, no se le cierra la puerta.
  async function faltanTerminos() {
    try {
      const t = await window.Terminos.estado();
      return !t.aceptados;
    } catch (err) {
      return false;
    }
  }

  function encabezado(t, sub) {
    titulo.textContent = t;
    subtitulo.textContent = sub;
    document.title = t === "BioSalud" ? "BioSalud ECOMARCAL" : t + " · BioSalud ECOMARCAL";
  }

  // ---------- Inicio ----------

  function inicio(habilitada) {
    const menu = Object.entries(SECCIONES).map(([ruta, s]) => {
      const abierta = habilitada || s.sinConfig;
      return `
      <button class="menu__boton" data-ir="${ruta}" ${abierta ? "" : "disabled"}>
        <span class="menu__icono">${s.icono}</span>
        <span>
          <span class="menu__titulo">${esc(s.titulo)}</span>
          <span class="menu__detalle">${abierta ? esc(s.detalle) : "Completá primero la configuración"}</span>
        </span>
      </button>`;
    }).join("");

    // Con la configuración completa el inicio arranca con el tablero (hoy,
    // relojes y la tira de días, ver js/tablero.js) y el menú baja a una
    // grilla de dos columnas. Antes de eso el menú sigue como lista, con la
    // explicación de cada sección, que es lo que necesita quien recién empieza.
    vista.innerHTML = `
      ${habilitada ? resumen(config) + `<div id="solo-aca"></div><section id="tablero-inicio" aria-label="Resumen de la temporada">
        <p class="cargando">Armando el resumen…</p></section>` : `
        <p class="aviso aviso--info">
          <strong>Empezá por la configuración.</strong> Cargá los datos de tu
          establecimiento y tus sectores de riego. Hasta que estén, las secciones
          de planificación y registro quedan bloqueadas. La <strong>Info / Wiki</strong>
          se puede leer desde ahora.
        </p>`}

      <div class="menu${habilitada ? " menu--grilla" : ""}">
        ${menu}
        <button class="menu__boton menu__boton--config" data-ir="config">
          <span class="menu__icono">⚙️</span>
          <span>
            <span class="menu__titulo">Configuración</span>
            <span class="menu__detalle">Establecimiento, localidad y sectores de riego</span>
          </span>
        </button>
        <!-- El manual es una página aparte, como la guía de AMA Producción:
             se lee entera, con índice, y se puede pasar por mensaje. -->
        <a class="menu__boton menu__boton--ancho" href="ayuda/">
          <span class="menu__icono">❓</span>
          <span>
            <span class="menu__titulo">Manual de uso</span>
            <span class="menu__detalle">Cómo usar la app y qué significa el semáforo agroecológico</span>
          </span>
        </a>
      </div>

      <!-- Va en el inicio y no escondida en Configuración: es donde se la ve
           sin buscarla. Funciona aunque falte la configuración (ver js/sugerencias.js). -->
      <button class="boton boton--secundario boton--ancho separado" id="btn-sugerencia">
        💬 Enviar una sugerencia</button>

      ${instalador ? `<button class="boton boton--secundario boton--ancho separado"
                        id="btn-instalar">Instalar en el celular</button>` : ""}

      <p class="estado-inicio" id="estado-inicio"></p>

      <p class="nota nota--pie">
        Esta aplicación funciona sin señal: todo lo que cargues queda guardado en
        el teléfono y se envía a la planilla de tu chacra cuando haya conexión.
      </p>`;

    // El estado del envío se consulta después de dibujar, para no demorar la
    // pantalla por algo que es informativo.
    window.Envio.estado().then((e) => {
      const linea = document.getElementById("estado-inicio");
      if (linea) linea.textContent = window.Envio.resumir(e);
    });

    vista.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => ir(b.dataset.ir);
    });

    const tablero = document.getElementById("tablero-inicio");
    if (tablero) window.Tablero.render(tablero, ir);

    const soloAca = document.getElementById("solo-aca");
    if (soloAca) avisoSoloAca(soloAca);

    document.getElementById("btn-sugerencia").onclick = () => window.Sugerencias.abrir();

    const instalar = document.getElementById("btn-instalar");
    if (instalar) instalar.onclick = async () => {
      instalador.prompt();
      await instalador.userChoice;
      instalador = null;
      mostrar();
    };
  }

  // ---------- Lo que está en este aparato y no en la planilla ----------
  //
  // Aparece cuando la app baja la planilla y encuentra registros que solo
  // tiene este aparato (ver Envio.mezclar, regla 5). Pasa una vez, al estrenar
  // la versión que comparte los datos: cada aparato venía guardando su propio
  // plan. La decisión es del productor y no se puede adivinar: en la notebook
  // lo que quiere es subirlo; en un celular con un plan viejo, sacarlo.
  const NOMBRES_SOLO = {
    plan: ["renglón del plan", "renglones del plan"],
    aplicaciones: ["aplicación", "aplicaciones"],
    monitoreos: ["monitoreo", "monitoreos"],
    tratamientos: ["tratamiento", "tratamientos"],
  };

  async function avisoSoloAca(caja) {
    let s;
    try { s = await window.Envio.soloEnEsteAparato(); } catch (err) { return; }
    if (!document.body.contains(caja)) return;
    if (!s.total) { caja.innerHTML = ""; return; }

    const partes = Object.keys(NOMBRES_SOLO).filter((t) => s.porTipo[t])
      .map((t) => `${s.porTipo[t]} ${NOMBRES_SOLO[t][s.porTipo[t] === 1 ? 0 : 1]}`);
    const plan = s.registros.filter((x) => x.tipo === "plan").map((x) => x.r.producto);
    const muestra = [...new Set(plan)].slice(0, 6);

    caja.innerHTML = `
      <div class="aviso aviso--info solo-aca">
        <p><strong>Este aparato tiene datos que no están en la planilla de la chacra.</strong>
          ${esc(partes.join(", "))}.${muestra.length ? ` En el plan: ${esc(muestra.join(", "))}${plan.length > muestra.length ? "…" : ""}.` : ""}</p>
        <p class="nota">Ahora todos los aparatos de la chacra ven lo mismo: lo que
          está en la planilla. Si esto es lo que querés que vean todos, subilo. Si
          es un plan viejo o de prueba, sacalo de este aparato.</p>
        <button class="boton boton--ancho" id="solo-subir">Subirlo a la planilla</button>
        <button class="boton boton--secundario boton--ancho separado" id="solo-sacar">
          Sacarlo de este aparato</button>
      </div>`;

    caja.querySelector("#solo-subir").onclick = async () => {
      await window.Envio.subirSolo();
      window.Util.brindis("Subiendo a la planilla…");
      mostrar();
    };
    caja.querySelector("#solo-sacar").onclick = async () => {
      if (!confirm(`¿Sacar de este aparato ${partes.join(", ")}? No están en la planilla, así que no quedan en ningún otro lado.`)) return;
      const n = await window.Envio.descartarSolo();
      window.Util.brindis(`${n} ${n === 1 ? "registro sacado" : "registros sacados"} de este aparato`);
      mostrar();
    };
  }

  function resumen(c) {
    const total = window.Config.superficieTotal(c);
    return `
      <div class="resumen">
        <h2>${esc(c.nombre)}</h2>
        <p class="nota">${esc(c.localidad)}${c.situacion ? " · " + esc(c.situacion) : ""}</p>
        <dl>
          <div><dt>Sectores:</dt><dd>${c.sectores.length}</dd></div>
          <div><dt>Superficie:</dt><dd>${superficie(total)}</dd></div>
          <div><dt>Responsable:</dt><dd>${esc(c.responsable)}</dd></div>
        </dl>
      </div>`;
  }

  // ---------- Secciones que todavía no están ----------

  function enConstruccion(s) {
    vista.innerHTML = `
      <div class="tarjeta">
        <h2>${s.icono} ${esc(s.titulo)}</h2>
        <p>${s.queVa}</p>
        <p class="aviso aviso--info al-final">
          Esta sección llega en la <strong>fase ${s.fase}</strong> del desarrollo.
        </p>
      </div>
      <button class="boton boton--ancho" data-ir="inicio">Volver al inicio</button>`;

    vista.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => ir(b.dataset.ir);
    });
  }

  // ---------- Arranque ----------

  // La flecha sube un nivel, no salta al inicio: desde una ficha de plaga
  // vuelve a la lista de plagas, y recién desde ahí al inicio.
  botonVolver.onclick = () => {
    const partes = rutaActual().split("/");
    if (partes.length > 1) { partes.pop(); ir(partes.join("/")); return; }
    ir("inicio");
  };
  window.addEventListener("hashchange", mostrar);

  // LLEGARON DATOS DE LA PLANILLA (ver Envio.bajar).
  //
  // El inicio se redibuja: es un resumen y no hay nada a medio escribir. Las
  // demás pantallas no, porque redibujar se lleva lo que se esté tipeando; ahí
  // alcanza con avisar, y la próxima vez que se abra la sección ya lee lo nuevo.
  window.addEventListener("biosalud:datos", () => {
    const base = rutaActual().split("/")[0];
    if (base === "inicio" || base === "") { mostrar(); return; }
    if (["plan", "seguimiento", "monitoreo", "aplicacion"].includes(base)) {
      window.Util.brindis("Llegaron cambios de la planilla. Volvé a entrar a la sección para verlos.");
    }
  });

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    instalador = evento;
    if (rutaActual() === "inicio") mostrar();
  });

  function mostrarVersion() {
    const pie = document.getElementById("pie-version");
    if (!pie || !window.caches) return;
    caches.keys().then((nombres) => {
      const numeros = nombres.filter((n) => n.indexOf(PREFIJO_CACHE) === 0)
        .map((n) => parseInt(n.slice(PREFIJO_CACHE.length).replace(/\D/g, ""), 10))
        .filter((n) => !isNaN(n));
      if (numeros.length) pie.textContent = "versión " + Math.max.apply(null, numeros);
    }).catch(() => { /* sin acceso al caché: el renglón queda vacío */ });
  }
  mostrarVersion();

  window.BioDB.abrir()
    .then(() => { window.Envio.arrancar(); return mostrar(); })
    .catch((err) => {
      vista.innerHTML = `<p class="aviso aviso--error">No se pudo abrir el almacenamiento
        del teléfono, así que la app no puede guardar nada. Suele pasar en modo
        incógnito o con el almacenamiento del navegador bloqueado.<br><br>
        Detalle: ${esc(err.message || err)}</p>`;
    });

  // Si algún archivo de logo faltara, se muestra la sigla en un recuadro de
  // texto en vez de una imagen rota. Va acá y no como atributo en el HTML
  // porque la política de contenido no admite código suelto en la página.
  function cuidarLogos() {
    document.querySelectorAll(".logo img").forEach((img) => {
      const falló = () => img.parentNode.classList.add("logo--texto") || img.remove();
      if (img.complete) { if (!img.naturalWidth) falló(); return; }
      img.addEventListener("error", falló);
    });
  }
  cuidarLogos();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
    // Cuando termina de instalarse una versión nueva, el renglón del pie se
    // pone al día sin esperar a que se vuelva a abrir la app.
    navigator.serviceWorker.addEventListener("controllerchange", mostrarVersion);
  }
})();
