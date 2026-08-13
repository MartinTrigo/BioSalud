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

  // "1.250 m²" o "0,12 ha" según el tamaño, que es como lo dicen en la chacra.
  function superficie(m2) {
    const n = Number(m2) || 0;
    if (n >= 10000) return numero(Math.round(n / 100) / 100) + " ha";
    return numero(n) + " m²";
  }

  const hoy = () => new Date().toISOString().slice(0, 10);

  return { esc, brindis, numero, superficie, hoy };
})();
