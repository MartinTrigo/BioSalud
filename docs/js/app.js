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
      detalle: "Bioinsumos, biopreparados y plagas de la Comarca",
      subtitulo: "Material de consulta",
      fase: 6,
      queVa: `Fichas de cada bioinsumo y biopreparado: cómo se prepara, para
        qué sirve, cómo se aplica, qué cuidados y riesgos tiene. Y las plagas y
        enfermedades más comunes de la Comarca Andina, para consultar en el
        campo aunque no haya señal.`,
    },
  };

  // ---------- Navegación ----------

  const rutaActual = () => (location.hash || "#/inicio").replace("#/", "");

  function ir(ruta) {
    location.hash = "#/" + ruta;
  }

  async function mostrar() {
    const ruta = rutaActual();
    config = await window.BioDB.leerConfig();
    const habilitada = window.Config.completa(config);

    botonVolver.hidden = ruta === "inicio";
    window.scrollTo(0, 0);

    // Nadie entra a una sección con la configuración incompleta, ni siquiera
    // escribiendo la dirección a mano.
    if (ruta !== "inicio" && ruta !== "config" && !habilitada) {
      ir("config");
      return;
    }

    if (ruta === "config") {
      encabezado("Configuración", "Datos de tu establecimiento");
      await window.Config.render(vista, () => ir("inicio"));
      return;
    }

    if (SECCIONES[ruta]) {
      const s = SECCIONES[ruta];
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
    const menu = Object.entries(SECCIONES).map(([ruta, s]) => `
      <button class="menu__boton" data-ir="${ruta}" ${habilitada ? "" : "disabled"}>
        <span class="menu__icono">${s.icono}</span>
        <span>
          <span class="menu__titulo">${esc(s.titulo)}</span>
          <span class="menu__detalle">${habilitada ? esc(s.detalle) : "Completá primero la configuración"}</span>
        </span>
      </button>`).join("");

    vista.innerHTML = `
      ${habilitada ? resumen(config) : `
        <p class="aviso aviso--info">
          <strong>Empezá por la configuración.</strong> Cargá los datos de tu
          establecimiento y tus sectores de riego. Hasta que estén, el resto de
          las secciones queda bloqueado.
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

      ${instalador ? `<button class="boton boton--secundario boton--ancho" id="btn-instalar"
                        style="margin-top:16px">Instalar en el celular</button>` : ""}

      <p class="nota" style="margin-top:24px">
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
        <p class="aviso aviso--info" style="margin:16px 0 0">
          Esta sección llega en la <strong>fase ${s.fase}</strong> del desarrollo.
        </p>
      </div>
      <button class="boton boton--ancho" data-ir="inicio">Volver al inicio</button>`;

    vista.querySelectorAll("[data-ir]").forEach((b) => {
      b.onclick = () => ir(b.dataset.ir);
    });
  }

  // ---------- Arranque ----------

  botonVolver.onclick = () => ir("inicio");
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

  // La app arranca siempre desde lo guardado en el teléfono, así abre al toque
  // y funciona sin señal. La contra es que, cuando publicamos una versión
  // nueva, el celular seguiría mostrando la vieja hasta la próxima vez que la
  // abra. Por eso, apenas la versión nueva toma el control, se recarga sola:
  // el productor no tiene que hacer nada ni enterarse de que existe una
  // actualización.
  if ("serviceWorker" in navigator) {
    let recargando = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargando) return;      // sin esto, dos avisos seguidos harían un bucle
      recargando = true;
      location.reload();
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
  }
})();
