// ==========================================================================
// BioSalud ECOMARCAL — Monitoreo de campo
//
// El productor camina la chacra y registra lo que ve: qué, en qué sector y
// bancal, con qué incidencia y severidad. Después la app le acerca lo que la
// ficha de esa plaga dice, y le ofrece avisarle al equipo de extensión.
//
// POR QUÉ LA SUGERENCIA NO COMPARA NÚMEROS
//
// DECISIONES.md describe el motor como "umbral de incidencia y severidad →
// tratamientos ordenados por prioridad", con la idea de comparar lo observado
// contra un número. Al ir a escribirlo apareció el problema: los umbrales de
// datos/plagas.json NO son números, son frases, y en varios casos la frase dice
// justamente que no hay número. La mosca de la cebolla: "No hay umbral numérico
// estandarizado". Los pulgones: "la detección de los primeros alados, antes de
// que se instale la colonia".
//
// Inventar esos números para que el motor pudiera compararlos sería fabricar
// precisión en una recomendación fitosanitaria, que es exactamente contra lo que
// advierten los términos de uso. Así que la app hace algo más modesto y más
// honesto: pone lo observado al lado del umbral de la ficha, con sus mismas
// palabras, y deja la comparación donde puede hacerse bien, que es en la cabeza
// de quien está parado en el cultivo.
//
// Lo que la app sí aporta, y no es poco: traer la ficha correcta al momento
// exacto en que hace falta, con la prevención antes que el tratamiento —el orden
// que pide el protocolo del SPG— y con el estado de cada preparado frente al
// sello. Y dejar el registro hecho.
//
// EL CONTACTO CON EL TÉCNICO VA PRIMERO
//
// Es un compromiso escrito en los términos de uso y una de las cuatro
// condiciones que DECISIONES.md le puso a la sugerencia. No está escondido al
// final: está arriba, antes que cualquier producto.
// ==========================================================================

window.Monitoreo = (function () {
  const { esc, brindis, numero, aNumero, hoy } = window.Util;

  const SEVERIDADES = ["Leve", "Media", "Alta"];

  // ---------- Fotos ----------
  //
  // Una foto de celular pesa entre 3 y 6 MB, y acá se suben desde la chacra con
  // la señal que haya. Se achican ANTES de salir del teléfono: 1280 px de lado
  // mayor alcanzan para que un técnico vea una mancha o una colonia, y dejan el
  // archivo en 100 a 200 KB. Es la misma idea que tools/preparar-fotos.py hace
  // con las fotos de la wiki, pero en el navegador y en el momento.
  //
  // No se guarda copia en el teléfono. La foto vive en la cola hasta que sube, y
  // después queda solo el enlace: llenar de imágenes el almacenamiento del peor
  // celular de la chacra sería ganarse que el productor desinstale la app.
  const MAX_LADO = 1280;
  const CALIDAD = 0.75;
  const MAX_FOTOS = 4;

  let fotos = [];   // las de este monitoreo, todavía sin guardar

  // El archivo se lee como data: y no con URL.createObjectURL, porque la CSP de
  // la app permite img-src 'self' data: y una URL blob: quedaría bloqueada.
  function leerImagen(archivo) {
    if (window.createImageBitmap) {
      return createImageBitmap(archivo, { imageOrientation: "from-image" })
        .catch(() => porLector(archivo));
    }
    return porLector(archivo);
  }

  function porLector(archivo) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => {
        const img = new Image();
        img.onload = () => resolver(img);
        img.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
        img.src = lector.result;
      };
      lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));
      lector.readAsDataURL(archivo);
    });
  }

  async function achicar(archivo) {
    const img = await leerImagen(archivo);
    const ancho = img.width;
    const alto = img.height;
    const escala = Math.max(ancho, alto) > MAX_LADO ? MAX_LADO / Math.max(ancho, alto) : 1;
    const w = Math.max(1, Math.round(ancho * escala));
    const h = Math.max(1, Math.round(alto * escala));

    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext("2d").drawImage(img, 0, 0, w, h);

    // WebP pesa bastante menos que JPEG a igual calidad, pero no está en todos
    // los Android viejos: cuando no está, toDataURL devuelve PNG sin avisar, y
    // un PNG de 1280 px es peor que el JPEG. Por eso se comprueba y se cae a
    // JPEG a propósito.
    let datos = lienzo.toDataURL("image/webp", CALIDAD);
    let tipo = "image/webp";
    if (datos.indexOf("data:image/webp") !== 0) {
      datos = lienzo.toDataURL("image/jpeg", CALIDAD);
      tipo = "image/jpeg";
    }

    const base64 = datos.slice(datos.indexOf(",") + 1);
    return {
      datos: base64,
      tipo: tipo,
      ancho: w,
      alto: h,
      bytes: Math.round(base64.length * 3 / 4),
      vista: datos,          // para la miniatura, mientras dure la pantalla
    };
  }

  let bio = null;        // datos/biopreparados.json
  let plagas = null;     // datos/plagas.json
  let equipo = null;     // datos/equipo.json
  let config = null;
  let registros = [];
  let destino = null;
  let irA = null;
  let errores = {};
  let verDetalle = null;   // id del monitoreo cuyo resultado se está mostrando

  async function render(contenedor, ruta, navegar) {
    destino = contenedor;
    irA = navegar;
    errores = {};
    fotos = [];

    destino.innerHTML = `<p class="cargando">Cargando…</p>`;
    try {
      if (!bio) bio = await (await fetch("datos/biopreparados.json")).json();
      if (!plagas) plagas = await (await fetch("datos/plagas.json")).json();
      if (!equipo) equipo = await (await fetch("datos/equipo.json")).json();
      config = await window.BioDB.leerConfig();
      registros = (await window.BioDB.todos("monitoreos"))
        .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    } catch (err) {
      destino.innerHTML = `<p class="aviso aviso--error">No se pudo abrir el monitoreo.<br><br>
        Detalle: ${esc(err.message || err)}</p>`;
      return { titulo: "Monitoreo de campo", subtitulo: "Error" };
    }

    pintar();
    return { titulo: "Monitoreo de campo", subtitulo: "Observación a campo" };
  }

  const ficha = (id) => (plagas.fichas || []).find((f) => f.id === id);
  const preparado = (id) => (bio.fichas || []).find((f) => f.id === id);
  const sector = (id) => (config.sectores || []).find((s) => s.id === id) || null;

  function pintar() {
    const detalle = verDetalle ? registros.find((r) => r.id === verDetalle) : null;

    destino.innerHTML = detalle ? resultado(detalle) : `
      ${formulario()}
      ${historial()}`;

    conectar();
  }

  // ---------- El registro ----------

  function formulario() {
    const sectores = config.sectores || [];
    const porGrupo = (plagas.grupos || []).map((g) => {
      const fichas = (plagas.fichas || []).filter((f) => f.grupo === g.id);
      if (!fichas.length) return "";
      return `<optgroup label="${esc(g.icono + " " + g.nombre)}">
        ${fichas.map((f) => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join("")}
      </optgroup>`;
    }).join("");

    return `
      <div class="tarjeta">
        <h2>¿Qué viste?</h2>
        <p class="nota">Registrá lo que encontraste recorriendo la chacra. Si no
          estás seguro de qué es, elegí "otra cosa" y describilo: el equipo técnico
          lo va a ver igual.</p>

        <div class="campo">
          <label for="m-que">Qué observaste</label>
          <select id="m-que" class="${mal("que")}">
            <option value="">Elegí…</option>
            ${porGrupo}
            <option value="__otro">✍️ Otra cosa, la describo yo</option>
          </select>
          ${error("que")}
        </div>

        <div id="m-zona-ficha"></div>

        <div class="campo" id="m-campo-otro" hidden>
          <label for="m-otro">¿Qué viste?
            <span class="ayuda">Describilo con tus palabras: en qué parte de la planta, de qué color, si está en una zona o en todo el lote.</span></label>
          <input id="m-otro" type="text" autocomplete="off" placeholder="Manchas marrones en las hojas de abajo">
          ${error("otro")}
        </div>

        <div class="fila">
          <div class="campo">
            <label for="m-fecha">Fecha</label>
            <input id="m-fecha" type="date" class="${mal("fecha")}" value="${esc(hoy())}">
            ${error("fecha")}
          </div>
          <div class="campo">
            <label for="m-sector">Sector</label>
            <select id="m-sector" class="${mal("sector")}">
              <option value="">Elegí…</option>
              ${sectores.map((s) => `<option value="${esc(s.id)}">${esc(s.nombre)}</option>`).join("")}
            </select>
            ${error("sector")}
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="m-bancal">Bancal <span class="ayuda">Opcional</span></label>
            <input id="m-bancal" type="text" autocomplete="off" placeholder="3">
          </div>
          <div class="campo">
            <label for="m-revisadas">Plantas revisadas
              <span class="ayuda">Cuántas miraste para decir esto.</span></label>
            <input id="m-revisadas" type="text" inputmode="numeric" autocomplete="off" placeholder="20">
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="m-incidencia">Incidencia
              <span class="ayuda">De las que revisaste, qué porcentaje tenía el problema.</span></label>
            <input id="m-incidencia" type="text" inputmode="decimal" class="${mal("incidencia")}"
                   autocomplete="off" placeholder="%">
            ${error("incidencia")}
          </div>
          <div class="campo">
            <label for="m-severidad">Severidad
              <span class="ayuda">Qué tan afectada está cada planta.</span></label>
            <select id="m-severidad">
              <option value="">Sin anotar…</option>
              ${SEVERIDADES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="campo">
          <label for="m-obs">Observaciones <span class="ayuda">Opcional</span></label>
          <textarea id="m-obs" rows="2" placeholder="Hace cuánto lo venís viendo, si avanza, qué hiciste"></textarea>
        </div>

        <div class="campo">
          <label for="m-foto">Fotos
            <span class="ayuda">Hasta ${MAX_FOTOS}. Es lo que más ayuda a un diagnóstico
              a distancia: sacá una de cerca del daño y otra de la planta entera.</span></label>
          <input id="m-foto" type="file" accept="image/*" capture="environment" multiple>
          <div id="m-fotos"></div>
        </div>

        <button class="boton boton--ancho" id="m-guardar">Guardar y ver qué hacer</button>
      </div>`;
  }

  // Mientras se elige qué se vio, se adelanta cómo se monitorea esa plaga: es el
  // dato que sirve ANTES de contar, no después.
  function pintarFicha() {
    const caja = destino.querySelector("#m-zona-ficha");
    const campoOtro = destino.querySelector("#m-campo-otro");
    if (!caja) return;

    const elegido = valor("#m-que");
    if (campoOtro) campoOtro.hidden = elegido !== "__otro";

    const f = elegido && elegido !== "__otro" ? ficha(elegido) : null;
    if (!f) { caja.innerHTML = ""; return; }

    caja.innerHTML = `
      <div class="tarjeta tarjeta--info-producto">
        <p class="resumen-ficha">${esc(f.resumen)}</p>
        ${f.monitoreo && f.monitoreo.length ? `<p class="nota"><strong>Cómo se monitorea.</strong>
          ${esc(f.monitoreo.join(" "))}</p>` : ""}
        <button class="boton--peligro boton--editar" data-plaga="${esc(f.id)}">Ver la ficha completa</button>
      </div>`;
  }

  // Las miniaturas se dibujan aparte del formulario, así elegir una foto no
  // repinta —y no borra— lo que ya se escribió en los otros campos.
  function pintarFotos() {
    const caja = destino.querySelector("#m-fotos");
    if (!caja) return;

    const total = fotos.reduce((s, f) => s + f.bytes, 0);
    caja.innerHTML = !fotos.length ? "" : `
      <ul class="fotos-tomadas">
        ${fotos.map((f, i) => `
          <li>
            <img src="${f.vista}" alt="Foto ${i + 1} del monitoreo">
            <span class="fotos-tomadas__peso">${esc(String(Math.round(f.bytes / 1024)))} KB</span>
            <button class="boton--peligro" data-quitar-foto="${i}">Quitar</button>
          </li>`).join("")}
      </ul>
      <p class="nota">${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"} ·
        ${esc(String(Math.round(total / 1024)))} KB en total. Se achican acá antes de
        salir: la original de tu celular no viaja. En el teléfono no queda copia.</p>`;

    caja.querySelectorAll("[data-quitar-foto]").forEach((b) => {
      b.onclick = () => { fotos.splice(Number(b.dataset.quitarFoto), 1); pintarFotos(); };
    });
  }

  async function tomarFotos(archivos) {
    const caja = destino.querySelector("#m-fotos");
    const lugar = MAX_FOTOS - fotos.length;
    if (lugar <= 0) {
      if (caja) caja.insertAdjacentHTML("beforeend",
        `<p class="aviso aviso--info">Ya hay ${MAX_FOTOS} fotos: quitá una para sumar otra.</p>`);
      return;
    }

    if (caja) caja.insertAdjacentHTML("beforeend", `<p class="nota" id="m-achicando">Achicando…</p>`);
    for (const archivo of [...archivos].slice(0, lugar)) {
      try {
        fotos.push(await achicar(archivo));
      } catch (err) {
        brindis("No se pudo usar una de las fotos");
      }
    }
    pintarFotos();
  }

  const error = (c) => (errores[c] ? `<span class="campo__error">${esc(errores[c])}</span>` : "");
  const mal = (c) => (errores[c] ? " mal" : "");
  const valor = (id) => (destino.querySelector(id) || {}).value || "";

  async function guardar() {
    errores = {};
    const que = valor("#m-que");
    const otro = valor("#m-otro").trim();
    const fecha = valor("#m-fecha");
    const sectorId = valor("#m-sector");
    const incidencia = aNumero(valor("#m-incidencia"));

    if (!que) errores.que = "Elegí qué observaste.";
    if (que === "__otro" && !otro) errores.otro = "Describí lo que viste.";
    if (!fecha) errores.fecha = "Falta la fecha.";
    if (!sectorId) errores.sector = "Elegí en qué sector.";
    if (valor("#m-incidencia") && (Number.isNaN(incidencia) || incidencia < 0 || incidencia > 100)) {
      errores.incidencia = "La incidencia va de 0 a 100.";
    }

    if (Object.keys(errores).length) {
      pintar();
      const primero = destino.querySelector(".mal, .campo__error");
      if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const f = que === "__otro" ? null : ficha(que);
    const sec = sector(sectorId);
    const grupo = f ? (plagas.grupos || []).find((g) => g.id === f.grupo) : null;

    const datos = {
      id: window.BioDB.nuevoId(),
      fecha: fecha,
      sector: sec ? sec.nombre : "",
      sector_id: sectorId,
      bancal: valor("#m-bancal").trim(),
      cultivo: sec ? sec.cultivo || "" : "",
      deteccion: f ? f.nombre : otro,
      plaga_id: f ? f.id : null,
      tipo: grupo ? grupo.nombre : "Sin identificar",
      incidencia: valor("#m-incidencia") ? incidencia : "",
      severidad: valor("#m-severidad"),
      revisadas: aNumero(valor("#m-revisadas")) || "",
      aviso_tecnico: false,
      observaciones: valor("#m-obs").trim(),
      creado: new Date().toISOString(),
    };

    datos.fotos = fotos.length;

    await window.BioDB.guardar("monitoreos", datos);
    await window.BioDB.encolarCon(datos.id, "monitoreos", datos);

    // Cada foto va a la cola como su propio registro, no adentro del monitoreo:
    // así viaja en un pedido aparte y, si una falla, no arrastra a las demás ni
    // al monitoreo, que es el dato que no se puede perder.
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      await window.BioDB.encolar("foto", {
        monitoreo_id: datos.id,
        fecha: datos.fecha,
        sector: datos.sector,
        deteccion: datos.deteccion,
        numero: i + 1,
        tipo_imagen: f.tipo,
        ancho: f.ancho,
        alto: f.alto,
        bytes: f.bytes,
        contenido: f.datos,
      });
    }
    const cuantas = fotos.length;
    fotos = [];

    registros.unshift(datos);

    brindis(cuantas
      ? `Monitoreo registrado · ${cuantas} ${cuantas === 1 ? "foto" : "fotos"} en camino`
      : "Monitoreo registrado");
    verDetalle = datos.id;
    pintar();
    window.scrollTo(0, 0);
    window.Envio.sincronizar(true);
  }

  // ---------- Qué hacer con lo que se vio ----------

  function resultado(r) {
    const f = r.plaga_id ? ficha(r.plaga_id) : null;
    const tratamientos = f ? (f.tratamientos || []).map(preparado).filter(Boolean) : [];

    return `
      <div class="tarjeta">
        <h2>${esc(r.deteccion)}</h2>
        <p class="nota">${esc(r.sector)}${r.bancal ? ", bancal " + esc(r.bancal) : ""} ·
          ${esc(fechaCorta(r.fecha))}${r.incidencia !== "" ? " · " + esc(String(r.incidencia)) + " % de incidencia" : ""}${
          r.severidad ? " · severidad " + esc(r.severidad.toLowerCase()) : ""}</p>
        <p class="aviso aviso--ok">Quedó registrado y se va a subir a la planilla de
          tu chacra.${r.fotos ? ` Las ${r.fotos === 1 ? "foto va" : r.fotos + " fotos van"}
          en pedidos aparte: si hay poca señal pueden tardar más que el registro.` : ""}</p>
      </div>

      ${avisoTecnico(r)}

      ${!f ? `<div class="tarjeta">
        <h2>Esto no está en la wiki</h2>
        <p>Lo que describiste no corresponde a ninguna de las ${plagas.fichas.length}
          fichas cargadas, así que la app no tiene nada que acercarte. El equipo
          técnico sí: avisale con el botón de arriba.</p>
      </div>` : `
        ${f.umbral && f.umbral.length ? `<div class="tarjeta">
          <h2>Qué dice la ficha sobre cuándo intervenir</h2>
          <p class="nota">La app no compara esto con lo que anotaste: los umbrales
            publicados no son números exactos y varios dicen que no hay uno. La
            comparación la hacés vos, que estás viendo el cultivo.</p>
          <dl class="umbrales">
            ${f.umbral.map((u) => `<dt>${esc(u.momento)}</dt><dd>${esc(u.valor)}</dd>`).join("")}
          </dl>
          ${r.incidencia !== "" || r.revisadas ? `<p class="nota"><strong>Vos anotaste:</strong>
            ${r.incidencia !== "" ? esc(String(r.incidencia)) + " % de incidencia" : "sin incidencia anotada"}${
            r.revisadas ? ", sobre " + esc(String(r.revisadas)) + " plantas revisadas" : ""}${
            r.severidad ? ", severidad " + esc(r.severidad.toLowerCase()) : ""}.</p>` : ""}
        </div>` : ""}

        <div class="tarjeta">
          <h2>Primero, esto</h2>
          <p class="nota">El protocolo del SPG pide que el control sea preventivo
            antes que nada: acciones mecánicas, físicas y biológicas.</p>
          <ul class="lista">${(f.prevencion || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          ${f.enemigos ? `<p class="nota"><strong>Enemigos naturales.</strong> ${esc(f.enemigos)}</p>` : ""}
        </div>

        ${tratamientos.length ? `<div class="tarjeta">
          <h2>Si eso no alcanza</h2>
          <p class="nota">Biopreparados que la bibliografía regional asocia a esta
            plaga. <strong>Son orientativos</strong>: no reemplazan a alguien que
            vea tu campo, y conviene consultarlos antes de aplicar.</p>
          <ul class="indice">
            ${tratamientos.map((t) => {
              const cobre = window.Cobre.lleva(t);
              return `<li><button class="indice__item" data-preparado="${esc(t.id)}">
                <span class="indice__nombre">${esc(t.nombre)}${cobre
                  ? ` <span class="sello-comarca sello-comarca--cuidado">lleva cobre</span>` : ""}</span>
                <span class="indice__cientifico">${esc(t.resumen)}</span>
              </button></li>`;
            }).join("")}
          </ul>
          <p class="nota">Antes de sumar cualquiera de estos a tu plan, fijate la
            cuenta del cobre y qué admite el sello.</p>
        </div>` : ""}

        ${f.cuidados && f.cuidados.length ? `<div class="tarjeta tarjeta--cuidado">
          <h2>A tener en cuenta</h2>
          <ul class="lista">${f.cuidados.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        </div>` : ""}`}

      <button class="boton boton--secundario boton--ancho" id="m-volver">Registrar otra cosa</button>`;
  }

  // El aviso al técnico va arriba de todo y con el texto ya armado: en el campo,
  // con una mano, nadie escribe un correo de cero.
  function avisoTecnico(r) {
    const cuerpo = [
      `Monitoreo en ${(config || {}).nombre || "mi chacra"}` +
        ((config || {}).codigo ? ` (${config.codigo})` : ""),
      "",
      `Qué vi: ${r.deteccion}`,
      `Sector: ${r.sector}${r.bancal ? ", bancal " + r.bancal : ""}`,
      `Fecha: ${fechaCorta(r.fecha)}`,
      r.incidencia !== "" ? `Incidencia: ${r.incidencia} %` : null,
      r.revisadas ? `Plantas revisadas: ${r.revisadas}` : null,
      r.severidad ? `Severidad: ${r.severidad}` : null,
      r.observaciones ? `Observaciones: ${r.observaciones}` : null,
      "",
      `Responsable: ${(config || {}).responsable || ""}`,
      (config || {}).contacto ? `Contacto: ${config.contacto}` : null,
      // Los "" son renglones en blanco a propósito; los null son datos que no
      // están. Filtrar por "" se comía las separaciones y el correo llegaba como
      // un bloque corrido.
    ].filter((l) => l !== null).join("\n");

    const enlace = "mailto:" + encodeURIComponent(equipo.correo)
      + "?subject=" + encodeURIComponent("BioSalud · monitoreo: " + r.deteccion)
      + "&body=" + encodeURIComponent(cuerpo);

    return `
      <div class="tarjeta tarjeta--aviso-tecnico">
        <h2>📣 Avisale al equipo de extensión</h2>
        <p>${esc(equipo.cuando_avisar)}</p>
        <a class="boton boton--ancho" href="${esc(enlace)}" id="m-avisar">
          Escribirle a ${esc(equipo.referente)}</a>
        <p class="nota">Se abre tu aplicación de correo con todo lo que anotaste ya
          escrito. ${r.aviso_tecnico ? "Ya marcaste que avisaste." : ""}</p>
        ${!r.aviso_tecnico ? `<button class="boton--peligro centrado" data-avise="${esc(r.id)}">
          Ya avisé por otra vía</button>` : ""}
      </div>`;
  }

  function fechaCorta(iso) {
    const [a, m, d] = String(iso || "").split("-");
    return d && m ? `${d}/${m}` : "—";
  }

  // ---------- Lo ya registrado ----------

  function historial() {
    if (!registros.length) return "";
    return `
      <details class="grupo separado">
        <summary class="grupo__cab">
          <span class="grupo__icono">🔍</span>
          <span class="grupo__texto">
            <span class="grupo__nombre">Lo que registraste</span>
            <span class="grupo__cuenta">${registros.length} ${registros.length === 1
              ? "monitoreo" : "monitoreos"}</span>
          </span>
          <span class="grupo__flecha" aria-hidden="true"></span>
        </summary>
        <div class="grupo__cuerpo">
          <ul class="indice">
            ${registros.slice(0, 20).map((r) => `
              <li><button class="indice__item" data-ver="${esc(r.id)}">
                <span class="indice__nombre">${esc(r.deteccion)}</span>
                <span class="indice__cientifico">${esc(fechaCorta(r.fecha))} ·
                  ${esc(r.sector)}${r.incidencia !== "" ? " · " + esc(String(r.incidencia)) + " %" : ""}${
                  r.aviso_tecnico ? " · avisado" : ""}</span>
              </button></li>`).join("")}
          </ul>
        </div>
      </details>`;
  }

  // ---------- Eventos ----------

  function conectar() {
    const que = destino.querySelector("#m-que");
    if (que) que.onchange = pintarFicha;

    const foto = destino.querySelector("#m-foto");
    if (foto) foto.onchange = async () => {
      await tomarFotos(foto.files || []);
      foto.value = "";   // así se puede volver a elegir la misma foto
    };
    if (destino.querySelector("#m-fotos")) pintarFotos();

    const guardarBtn = destino.querySelector("#m-guardar");
    if (guardarBtn) guardarBtn.onclick = guardar;

    const volver = destino.querySelector("#m-volver");
    if (volver) volver.onclick = () => {
      verDetalle = null; errores = {}; fotos = []; pintar(); window.scrollTo(0, 0);
    };

    destino.querySelectorAll("[data-ver]").forEach((b) => {
      b.onclick = () => { verDetalle = b.dataset.ver; pintar(); window.scrollTo(0, 0); };
    });

    const verPlaga = destino.querySelector("[data-plaga]");
    if (verPlaga) verPlaga.onclick = () => { location.hash = "#/wiki/plagas/" + verPlaga.dataset.plaga; };

    destino.querySelectorAll("[data-preparado]").forEach((b) => {
      b.onclick = () => { location.hash = "#/wiki/manejo/" + b.dataset.preparado; };
    });

    destino.querySelectorAll("[data-avise]").forEach((b) => {
      b.onclick = () => marcarAvisado(b.dataset.avise);
    });

    // Tocar el botón de correo cuenta como aviso: no hay forma de saber si
    // después lo mandó, pero sí de registrar que abrió el correo con el dato.
    const avisar = destino.querySelector("#m-avisar");
    if (avisar) avisar.onclick = () => marcarAvisado(verDetalle, true);

    if (destino.querySelector("#m-que")) pintarFicha();
  }

  async function marcarAvisado(id, silencioso) {
    const r = registros.find((x) => x.id === id);
    if (!r || r.aviso_tecnico) return;
    r.aviso_tecnico = true;
    await window.BioDB.guardar("monitoreos", r);
    await window.BioDB.encolarCon(r.id, "monitoreos", r);
    if (!silencioso) { brindis("Anotado que avisaste"); pintar(); }
    window.Envio.sincronizar(true);
  }

  return { render };
})();
