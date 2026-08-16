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

  const hoy = () => new Date().toISOString().slice(0, 10);

  return { esc, brindis, numero, aNumero, superficie, hoy };
})();
