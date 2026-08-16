// ==========================================================================
// BioSalud ECOMARCAL — acceso del teléfono
//
// La dirección del servicio de las planillas va escrita en el código, que es
// público. Sin nada más, cualquiera que la encontrara podría leer los datos de
// todas las chacras, inventar aplicaciones que nunca se hicieron o borrar la
// configuración de un establecimiento entero. En MonAgric se comprobó
// ejecutándolo: no era teoría.
//
// Por eso cada teléfono canjea UNA VEZ un código de invitación que le da el
// equipo de extensión, y recibe a cambio una credencial larga y al azar que
// queda guardada en ese aparato. Desde ahí, cada pedido viaja con ella.
//
// Del lado del servicio se guarda solo la huella SHA-256 de la credencial:
// alcanza para comprobarla, pero no permite reconstruirla. Ni leyendo la
// planilla de accesos se saca nada útil.
//
// Si un teléfono se pierde o alguien deja la chacra, se lo da de baja en una
// fila de la planilla y deja de poder cargar, sin afectar a nadie más.
//
// El canje se usa a partir de la fase 4, cuando exista el servicio. Lo que ya
// funciona hoy es el identificador del aparato, que se estampa en cada registro
// que queda en la cola: así, cuando esos registros suban, se sabe de qué
// teléfono salieron.
// ==========================================================================

window.Acceso = (function () {
  const LS = {
    dispositivo: "biosalud_dispositivo",
    credencial: "biosalud_credencial",
  };

  const leer = (clave) => {
    try { return localStorage.getItem(clave) || ""; } catch (e) { return ""; }
  };

  const escribir = (clave, valor) => {
    try { localStorage.setItem(clave, valor); } catch (e) { /* modo incógnito */ }
  };

  // Identificador de este teléfono. Se crea una sola vez y no cambia: sirve
  // para ver desde cuántos aparatos se está cargando y para dar de baja uno
  // solo. Se puede inventar, así que sirve para DETECTAR cosas raras, no para
  // impedirlas: la que impide es la credencial.
  function dispositivo() {
    let id = leer(LS.dispositivo);
    if (!id) {
      id = "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      escribir(LS.dispositivo, id);
    }
    return id;
  }

  const credencial = () => leer(LS.credencial);
  const tieneAcceso = () => !!credencial();

  const guardarCredencial = (valor) => escribir(LS.credencial, String(valor || ""));

  // Cuando el servicio contesta que este teléfono ya no tiene permiso, se borra
  // la credencial pero NUNCA la cola de registros: lo que el productor cargó en
  // el campo no se pierde por un problema de acceso. Queda esperando a que
  // active de nuevo con un código.
  const borrarCredencial = () => escribir(LS.credencial, "");

  // Lo que acompaña a cada pedido para identificarse.
  const identificacion = (codigoChacra) => ({
    chacra: codigoChacra || "",
    credencial: credencial(),
    dispositivo: dispositivo(),
  });

  return {
    dispositivo, credencial, tieneAcceso,
    guardarCredencial, borrarCredencial, identificacion,
  };
})();
