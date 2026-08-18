// ==========================================================================
// BioSalud ECOMARCAL — armazón de la app
//
// Maneja la navegación entre secciones y el bloqueo del menú hasta que la
// configuración del establecimiento esté completa.
// ==========================================================================

(function () {
  const { esc, superficie } = window.Util;

  const VERSION = "0.1.0 · fase 1";

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
      fase: 2,
      queVa: `Acá vas a armar el plan de la temporada: elegís de la lista los
        bioinsumos, biopreparados o insumos que vas a aplicar, con su dosis,
        el método (fertirriego, mochila, bomba), cada cuánto se repite y en qué
        sectores. Con eso la app arma sola el calendario de aplicaciones.`,
    },
    seguimiento: {
      icono: "✅",
      titulo: "Seguimiento de plan",
      detalle: "Qué toca aplicar hoy y qué quedó pendiente",
      subtitulo: "Checklist de aplicaciones",
      fase: 3,
      queVa: `Acá vas a ver qué te toca aplicar hoy, esta semana y qué quedó
        atrasado. Marcás lo que fuiste haciendo, anotás la fecha real y las
        condiciones, y queda registrado en la planilla de tu chacra.`,
    },
    monitoreo: {
      icono: "🔍",
      titulo: "Monitoreo de campo",
      detalle: "Síntomas, plagas, incidencia y severidad",
      subtitulo: "Observación a campo",
      fase: 5,
      queVa: `Caminás la chacra y registrás lo que ves: síntoma, signo o
        presencia de plaga, en qué sector y bancal, con su incidencia y
        severidad. La app te sugiere un tratamiento posible y te ofrece avisar
        al equipo de extensión para armarlo juntos.`,
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

  async function mostrar() {
    const ruta = rutaActual();
    const base = ruta.split("/")[0];      // "wiki/plagas/pulgones" → "wiki"
    config = await window.BioDB.leerConfig();
    const habilitada = window.Config.completa(config);

    botonVolver.hidden = ruta === "inicio";
    window.scrollTo(0, 0);

    // Nadie entra a una sección con la configuración incompleta, ni siquiera
    // escribiendo la dirección a mano. La wiki es la excepción: se puede leer
    // desde el primer momento.
    const libre = base === "inicio" || base === "config"
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

    // La wiki maneja sus propias sub-pantallas y devuelve qué poner en la
    // cabecera, que cambia según se esté viendo el índice o una ficha.
    if (base === "wiki") {
      const cabecera = await window.Wiki.render(vista, ruta, ir);
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

    vista.innerHTML = `
      ${habilitada ? resumen(config) : `
        <p class="aviso aviso--info">
          <strong>Empezá por la configuración.</strong> Cargá los datos de tu
          establecimiento y tus sectores de riego. Hasta que estén, las secciones
          de planificación y registro quedan bloqueadas. La <strong>Info / Wiki</strong>
          se puede leer desde ahora.
        </p>`}

      <div class="menu">
        ${menu}
        <button class="menu__boton menu__boton--config" data-ir="config">
          <span class="menu__icono">⚙️</span>
          <span>
            <span class="menu__titulo">Configuración</span>
            <span class="menu__detalle">Establecimiento, localidad y sectores de riego</span>
          </span>
        </button>
      </div>

      ${instalador ? `<button class="boton boton--secundario boton--ancho separado"
                        id="btn-instalar">Instalar en el celular</button>` : ""}

      <p class="nota nota--pie">
        Esta aplicación funciona sin señal: todo lo que cargues queda guardado en
        el teléfono y se envía a la planilla de tu chacra cuando haya conexión.
      </p>`;

    vista.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => ir(b.dataset.ir);
    });

    const instalar = document.getElementById("btn-instalar");
    if (instalar) instalar.onclick = async () => {
      instalador.prompt();
      await instalador.userChoice;
      instalador = null;
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

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    instalador = evento;
    if (rutaActual() === "inicio") mostrar();
  });

  document.getElementById("pie-version").textContent = "versión " + VERSION;

  window.BioDB.abrir()
    .then(mostrar)
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
  }
})();
