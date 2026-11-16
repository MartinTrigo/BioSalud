// ==========================================================================
// BioSalud ECOMARCAL — ayudas cortas de uso general
// ==========================================================================

window.Util = (function () {

  // Todo lo que escribe el productor pasa por acá antes de volver a la
  // pantalla, para que un apóstrofo o un signo raro no rompa la vista.
  function esc(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Mensaje breve al pie de la pantalla.
  let brindisActivo = null;
  function brindis(texto) {
    if (brindisActivo) brindisActivo.remove();
    const caja = document.createElement("div");
    caja.className = "brindis";
    caja.setAttribute("role", "status");
    caja.textContent = texto;
    document.body.appendChild(caja);
    brindisActivo = caja;
    setTimeout(() => { caja.remove(); if (brindisActivo === caja) brindisActivo = null; }, 3200);
  }

  const numero = (n) => Number(n).toLocaleString("es-AR");

  // Los campos de número son de texto, no <input type="number">.
  //
  // Es una lección de MonAgric: el navegador considera inválido "5,5" en un
  // campo numérico y lo deja vacío sin avisar. En el campo la gente escribe con
  // coma, y también escribe "1.200" para mil doscientos. Así que se recibe
  // texto y se interpreta acá, a la argentina.
  //
  //   "1.200"   → 1200      (el punto separa miles)
  //   "2,5"     → 2.5       (la coma es el decimal)
  //   "1.250,5" → 1250.5
  //   "1.5"     → 1.5       (un punto suelto que no separa miles: es decimal)
  function aNumero(texto) {
    let s = String(texto == null ? "" : texto).trim().replace(/\s/g, "");
    if (!s) return NaN;

    if (s.indexOf(",") >= 0) {
      s = s.replace(/\./g, "").replace(",", ".");        // hay coma: el punto es de miles
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");                          // 1.200 o 1.250.000: miles
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // "1.250 m²" o "0,12 ha" según el tamaño, que es como lo dicen en la chacra.
  function superficie(m2) {
    const n = Number(m2) || 0;
    if (n >= 10000) return numero(Math.round(n / 100) / 100) + " ha";
    return numero(n) + " m²";
  }

  // LA FECHA ES LA DEL TELÉFONO, NO LA DE GREENWICH.
  //
  // Antes esto era new Date().toISOString().slice(0, 10), que da la fecha en
  // hora universal. La Comarca está tres horas atrás, así que desde las 21:00
  // "hoy" ya era mañana: lo que tocaba hoy pasaba a figurar como atrasado, los
  // formularios proponían la fecha del día siguiente, y Registrar aplicación
  // aceptaba una fecha que todavía no había llegado. Justo a la hora en que se
  // suele sentar alguien a anotar lo que hizo en el día.
  function fechaISO(d) {
    const dos = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
  }

  const hoy = () => fechaISO(new Date());

  // EL SEMÁFORO AGROECOLÓGICO
  //
  // Una sola función para dibujarlo en la wiki, el plan y el monitoreo, así
  // el mismo producto se ve igual en las tres pantallas. Los nombres de cada
  // color vienen de datos/biopreparados.json (`semaforo`), no de acá: son
  // criterio del equipo y se corrigen sin tocar el código.
  //
  // Lleva siempre la palabra, no solo el color: al sol, con la pantalla al
  // mínimo, un punto rojo y uno verde se confunden, y una de cada doce
  // personas no distingue esos dos colores.
  function colorDe(f, sem) {
    const id = f && f.semaforo ? f.semaforo.color : "";
    const def = ((sem && sem.colores) || []).find((c) => c.id === id);
    return def ? Object.assign({ id: id }, def)
      : Object.assign({ id: "sin" }, (sem && sem.sin_evaluar) || { nombre: "Sin evaluar", icono: "⚪" });
  }

  function luz(f, sem) {
    const c = colorDe(f, sem);
    return `<span class="luz luz--${esc(c.id)}">${esc(c.nombre)}</span>`;
  }

  // LOS SECTORES SE ELIGEN CON FICHAS, NO CON UNA LISTA.
  //
  // Antes cada sector era un renglón con su casilla, su superficie y su cultivo:
  // con seis sectores eran seis renglones para decir "A y C". Las fichas entran
  // todas en una o dos líneas y se tocan igual de fácil. La marca no depende
  // solo del color: la elegida lleva además un tilde (ver css/estilos.css).
  function chipsSectores(sectores, marcados, clase) {
    const elegidos = marcados || [];
    return `<div class="chips" role="group" aria-label="Sectores">${(sectores || []).map((s) => `
      <label class="chip"><input type="checkbox" class="${esc(clase)}" value="${esc(s.id)}"${
        elegidos.includes(s.id) ? " checked" : ""}><span>${esc(s.nombre)}</span></label>`).join("")}
    </div>`;
  }

  // LOS BANCALES SE ESCRIBEN, NO SE TILDAN.
  //
  // "1, 4, 6", "2-5", "1 al 3 y 7": se entiende cualquiera y se devuelve
  // siempre igual ("1, 4, 6"), para que la planilla no tenga cinco maneras de
  // decir lo mismo. Si lo escrito no son números —hay chacras que les ponen
  // nombre a los bancales— se deja tal cual, sin protestar.
  function bancales(texto) {
    const crudo = String(texto == null ? "" : texto).trim();
    if (!crudo) return { texto: "", numeros: [] };

    const piezas = crudo.toLowerCase()
      .replace(/\s+(al|a|hasta)\s+/g, "-")
      .replace(/\s+y\s+/g, ",")
      .replace(/\s*-\s*/g, "-")
      .split(/[,;\s]+/).filter(Boolean);

    const numeros = new Set();
    for (const p of piezas) {
      const rango = /^(\d+)-(\d+)$/.exec(p);
      if (/^\d+$/.test(p)) numeros.add(Number(p));
      else if (rango && Number(rango[1]) <= Number(rango[2]) && Number(rango[2]) - Number(rango[1]) < 200) {
        for (let n = Number(rango[1]); n <= Number(rango[2]); n++) numeros.add(n);
      } else return { texto: crudo, numeros: [] };
    }
    const lista = [...numeros].sort((a, b) => a - b);
    return { texto: lista.join(", "), numeros: lista };
  }

  return { esc, brindis, numero, aNumero, superficie, hoy, fechaISO, luz, colorDe,
           chipsSectores, bancales };
})();
