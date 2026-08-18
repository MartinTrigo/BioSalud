// ==========================================================================
// BioSalud ECOMARCAL — Info / Wiki
//
// Dos ejes, porque son las dos maneras en que un productor llega hasta acá:
//
//   · "Veo algo raro en el campo"  → Enfermedades y plagas
//   · "Qué preparo y cómo"         → Manejo y tratamientos
//
// Los dos ejes están cruzados: desde una plaga se llega a los tratamientos que
// la controlan, y desde un biopreparado se ve contra qué plagas se usa.
//
// El contenido no está en el código: vive en datos/plagas.json y en
// datos/biopreparados.json, para que una ficha se corrija sin tocar
// programación y sin volver a publicar la app entera.
// ==========================================================================

window.Wiki = (function () {
  const { esc } = window.Util;

  let bio = null;      // datos/biopreparados.json
  let plagas = null;   // datos/plagas.json
  let destino = null;
  let irA = null;      // para navegar dentro de la wiki

  // Se leen una sola vez por sesión. El service worker ya los tiene guardados
  // en el teléfono, así que esto funciona sin señal.
  async function cargar() {
    if (bio && plagas) return true;
    const [a, b] = await Promise.all([
      fetch("datos/biopreparados.json").then((r) => r.json()),
      fetch("datos/plagas.json").then((r) => r.json()),
    ]);
    bio = a;
    plagas = b;
    return true;
  }

  const ficha = (id) => bio.fichas.find((f) => f.id === id);
  const plaga = (id) => plagas.fichas.find((f) => f.id === id);

  // Qué plagas menciona a este biopreparado. Se calcula al vuelo: así el cruce
  // se declara una sola vez, del lado de la plaga, y no hay dos listas que
  // puedan quedar desincronizadas.
  const plagasQueTrata = (idBio) =>
    plagas.fichas.filter((p) => (p.tratamientos || []).includes(idBio));

  // ---------- Entrada ----------

  async function render(contenedor, ruta, navegar) {
    destino = contenedor;
    irA = navegar;

    destino.innerHTML = `<p class="cargando">Cargando fichas…</p>`;
    try {
      await cargar();
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudieron leer las fichas.
        Si es la primera vez que abrís la app, hace falta señal una vez para que
        queden guardadas en el teléfono.<br><br>Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Info / Wiki", subtitulo: "Material de consulta" };
    }

    const partes = (ruta || "").split("/").filter(Boolean);   // wiki/plagas/pulgones
    const eje = partes[1] || "";
    const id = partes[2] || "";

    if (eje === "plagas" && id) return verPlaga(id);
    if (eje === "plagas") return listaPlagas();
    if (eje === "manejo" && id) return verBiopreparado(id);
    if (eje === "manejo") return listaBiopreparados();
    return portada();
  }

  function conectar() {
    destino.querySelectorAll("[data-wiki]").forEach((b) => {
      b.onclick = () => irA(b.dataset.wiki);
    });
  }

  // ---------- Portada: los dos ejes ----------

  function portada() {
    destino.innerHTML = `
      <p class="nota">Dos caminos para lo mismo: entrar por el problema que ves
        en el campo, o por la solución que querés preparar.</p>

      <div class="menu">
        <button class="menu__boton" data-wiki="wiki/plagas">
          <span class="menu__icono">🔬</span>
          <span>
            <span class="menu__titulo">Enfermedades y plagas</span>
            <span class="menu__detalle">Qué es, qué daño hace, cómo se monitorea
              y a partir de cuándo conviene intervenir · ${plagas.fichas.length} fichas</span>
          </span>
        </button>

        <button class="menu__boton" data-wiki="wiki/manejo">
          <span class="menu__icono">🧪</span>
          <span>
            <span class="menu__titulo">Manejo y tratamientos</span>
            <span class="menu__detalle">Biopreparados: qué lleva, cómo se hace,
              cómo se aplica y qué cuidados tiene · ${bio.fichas.length} recetas</span>
          </span>
        </button>
      </div>

      <div class="tarjeta separado">
        <h2>${esc(bio.recomendaciones.titulo)}</h2>
        <ul class="lista">
          ${bio.recomendaciones.puntos.map((p) => `<li>${esc(p)}</li>`).join("")}
        </ul>
      </div>

      <p class="nota nota--pie">Las fichas están redactadas por el equipo del IFAB
        a partir de bibliografía del INTA. Cada una dice de dónde sale, para que
        puedas ir al documento original.</p>`;
    conectar();
    return { titulo: "Info / Wiki", subtitulo: "Material de consulta" };
  }

  // ---------- Eje 1: enfermedades y plagas ----------

  function listaPlagas() {
    const porGrupo = plagas.grupos.map((g) => {
      const fichas = plagas.fichas.filter((f) => f.grupo === g.id);
      return `
        <div class="tarjeta">
          <h2>${g.icono} ${esc(g.nombre)}</h2>
          <p class="nota">${esc(g.descripcion)}</p>
          ${fichas.length ? `<ul class="indice">
            ${fichas.map((f) => `
              <li><button class="indice__item" data-wiki="wiki/plagas/${esc(f.id)}">
                <span class="indice__nombre">${esc(f.nombre)}</span>
                <span class="indice__cientifico">${esc(f.cientifico)}</span>
              </button></li>`).join("")}
          </ul>` : `<p class="vacio">Todavía sin fichas cargadas.</p>`}
        </div>`;
    }).join("");

    destino.innerHTML = porGrupo + pendientes(plagas.pendiente) + `
      <button class="boton boton--secundario boton--ancho" data-wiki="wiki">Volver a Info / Wiki</button>`;
    conectar();
    return { titulo: "Enfermedades y plagas", subtitulo: "Qué es y qué hacer" };
  }

  function verPlaga(id) {
    const p = plaga(id);
    if (!p) return listaPlagas();

    const tratamientos = (p.tratamientos || []).map(ficha).filter(Boolean);

    destino.innerHTML = `
      <div class="tarjeta">
        <h2>${esc(p.nombre)}</h2>
        <p class="cientifico">${esc(p.cientifico)} · ${esc(p.orden)}</p>
        <p class="resumen-ficha">${esc(p.resumen)}</p>
      </div>

      ${bloque("Cultivos que afecta", `<p>${esc(p.cultivos)}</p>`)}
      ${bloque("Daño que produce", `<p>${esc(p.dano)}</p>`)}
      ${bloque("Ciclo de vida", `<p>${esc(p.ciclo)}</p>`)}
      ${bloque("Cómo se monitorea", lista(p.monitoreo))}

      ${p.umbral ? bloque("Cuándo intervenir", `
        <p class="nota">Son referencias orientativas. Se ajustan con la experiencia
          de cada chacra.</p>
        <dl class="umbrales">
          ${p.umbral.map((u) => `
            <dt>${esc(u.momento)}</dt><dd>${esc(u.valor)}</dd>`).join("")}
        </dl>`) : ""}

      ${bloque("Prevención y manejo cultural", `
        <p class="nota">De menor a mayor intervención: esto va primero, siempre.</p>
        ${lista(p.prevencion)}`)}

      ${p.enemigos ? bloque("Enemigos naturales", `<p>${esc(p.enemigos)}</p>`) : ""}
      ${p.entomopatogenos ? bloque("Entomopatógenos", `<p>${esc(p.entomopatogenos)}</p>`) : ""}

      ${tratamientos.length ? bloque("Biopreparados que se usan", `
        <ul class="indice">
          ${tratamientos.map((t) => `
            <li><button class="indice__item" data-wiki="wiki/manejo/${esc(t.id)}">
              <span class="indice__nombre">${esc(t.nombre)}</span>
              <span class="indice__cientifico">${esc(t.resumen)}</span>
            </button></li>`).join("")}
        </ul>`) : ""}

      ${p.cuidados ? bloque("A tener en cuenta", lista(p.cuidados), "tarjeta--cuidado") : ""}
      ${citas(p.fuente, plagas.fuentes)}

      <button class="boton boton--secundario boton--ancho" data-wiki="wiki/plagas">Volver a la lista</button>`;
    conectar();
    return { titulo: p.nombre, subtitulo: p.cientifico };
  }

  // ---------- Eje 2: manejo y tratamientos ----------

  function listaBiopreparados() {
    const porCategoria = bio.categorias.map((c) => {
      const fichas = bio.fichas.filter((f) => f.categoria === c.id);
      if (!fichas.length) return "";
      return `
        <div class="tarjeta">
          <h2>${c.icono} ${esc(c.nombre)}</h2>
          <p class="nota">${esc(c.descripcion)}</p>
          <ul class="indice">
            ${fichas.map((f) => `
              <li><button class="indice__item" data-wiki="wiki/manejo/${esc(f.id)}">
                <span class="indice__nombre">${esc(f.nombre)}${f.comarca
                  ? ` <span class="sello-comarca" title="Probado en la Comarca Andina">Comarca</span>` : ""}</span>
                <span class="indice__cientifico">${esc(f.resumen)}</span>
              </button></li>`).join("")}
          </ul>
        </div>`;
    }).join("");

    destino.innerHTML = `
      <p class="nota">Las marcadas como <span class="sello-comarca">Comarca</span>
        se vienen elaborando y probando acá, en talleres de la AER INTA El Bolsón.</p>
      ${porCategoria}
      ${pendientes(bio.pendiente)}
      <button class="boton boton--secundario boton--ancho" data-wiki="wiki">Volver a Info / Wiki</button>`;
    conectar();
    return { titulo: "Manejo y tratamientos", subtitulo: "Biopreparados, por función" };
  }

  function verBiopreparado(id) {
    const f = ficha(id);
    if (!f) return listaBiopreparados();

    const categoria = bio.categorias.find((c) => c.id === f.categoria) || {};
    const contra = plagasQueTrata(f.id);

    destino.innerHTML = `
      <div class="tarjeta">
        <h2>${esc(f.nombre)}</h2>
        <p class="cientifico">${categoria.icono || ""} ${esc(categoria.nombre || "")}${f.comarca
          ? ` · <span class="sello-comarca">Comarca</span>` : ""}</p>
        <p class="resumen-ficha">${esc(f.resumen)}</p>
        <dl class="datos-rapidos">
          ${f.rinde ? `<div><dt>Rinde</dt><dd>${esc(f.rinde)}</dd></div>` : ""}
          ${f.tiempo ? `<div><dt>Tiempo</dt><dd>${esc(f.tiempo)}</dd></div>` : ""}
          ${f.carencia ? `<div><dt>Carencia</dt><dd>${esc(f.carencia)}</dd></div>` : ""}
        </dl>
        ${f.etiquetas ? `<p class="etiquetas">${f.etiquetas.map((e) =>
          `<span class="etiqueta">${esc(e)}</span>`).join("")}</p>` : ""}
      </div>

      ${f.revisar ? `<p class="aviso aviso--error"><strong>Dato a verificar.</strong>
        ${esc(f.revisar)}</p>` : ""}

      ${bloque("Qué lleva", lista(f.ingredientes))}
      ${bloque("Cómo se prepara", pasos(f.preparacion))}
      ${f.uso ? bloque("Para qué sirve", `<p>${esc(f.uso)}</p>`) : ""}

      ${f.dosis ? bloque("Cómo se aplica", `
        <dl class="umbrales">
          ${f.dosis.map((d) => `<dt>${esc(d.cuando)}</dt><dd>${esc(d.cuanto)}</dd>`).join("")}
        </dl>`) : ""}

      ${f.conservacion ? bloque("Cuánto dura", `<p>${esc(f.conservacion)}</p>`) : ""}
      ${f.cuidados ? bloque("Cuidados y riesgos", lista(f.cuidados), "tarjeta--cuidado") : ""}

      ${contra.length ? bloque("Se usa contra", `
        <ul class="indice">
          ${contra.map((p) => `
            <li><button class="indice__item" data-wiki="wiki/plagas/${esc(p.id)}">
              <span class="indice__nombre">${esc(p.nombre)}</span>
              <span class="indice__cientifico">${esc(p.cientifico)}</span>
            </button></li>`).join("")}
        </ul>`) : ""}

      ${citas(f.fuente, bio.fuentes)}

      <button class="boton boton--secundario boton--ancho" data-wiki="wiki/manejo">Volver a la lista</button>`;
    conectar();
    return { titulo: f.nombre, subtitulo: categoria.nombre || "Biopreparado" };
  }

  // ---------- Piezas comunes ----------

  const bloque = (titulo, cuerpo, clase) =>
    `<div class="tarjeta ${clase || ""}"><h2>${esc(titulo)}</h2>${cuerpo}</div>`;

  const lista = (items) =>
    `<ul class="lista">${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

  const pasos = (items) =>
    `<ol class="pasos">${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;

  const citas = (ids, tabla) => !ids || !ids.length ? "" : `
    <div class="tarjeta tarjeta--fuente">
      <h2>De dónde sale</h2>
      <ul class="lista">
        ${ids.map((i) => `<li>${esc(tabla[i] || i)}</li>`).join("")}
      </ul>
    </div>`;

  const pendientes = (items) => !items || !items.length ? "" : `
    <div class="tarjeta tarjeta--pendiente">
      <h2>Lo que falta cargar</h2>
      ${lista(items)}
    </div>`;

  return { render };
})();
