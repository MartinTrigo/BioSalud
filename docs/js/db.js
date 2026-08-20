// ==========================================================================
// BioSalud ECOMARCAL — base de datos local (IndexedDB)
//
// Todo lo que el productor carga se guarda primero acá, en el teléfono. Así la
// app funciona completa en el campo aunque no haya señal. Después, cuando hay
// conexión, la cola de "salida" se envía a la planilla de la chacra.
//
// Los almacenes de las fases que todavía no están programadas (planes,
// ocurrencias, aplicaciones, monitoreos, tratamientos) se crean igual desde
// ahora: así, cuando se sumen esas secciones, no hay que migrar la base de los
// celulares que ya tengan la app instalada.
// ==========================================================================

window.BioDB = (function () {
  const NOMBRE = "biosalud";
  const VERSION = 1;

  // Cada almacén con sus índices. Para agregar uno nuevo más adelante: sumarlo
  // acá y subir VERSION en uno.
  const ESQUEMA = {
    config:       { clave: "clave", indices: [] },
    planes:       { clave: "id", indices: ["estado", "creado"] },
    ocurrencias:  { clave: "id", indices: ["plan_id", "fecha", "estado"] },
    aplicaciones: { clave: "id", indices: ["fecha", "ocurrencia_id"] },
    monitoreos:   { clave: "id", indices: ["fecha", "sector"] },
    tratamientos: { clave: "id", indices: ["monitoreo_id", "estado"] },
    salida:       { clave: "id", indices: ["tipo"] },
  };

  let conexion = null;

  function abrir() {
    if (conexion) return Promise.resolve(conexion);

    return new Promise((resolver, rechazar) => {
      const pedido = indexedDB.open(NOMBRE, VERSION);

      pedido.onupgradeneeded = (evento) => {
        const db = evento.target.result;
        for (const [nombre, def] of Object.entries(ESQUEMA)) {
          const almacen = db.objectStoreNames.contains(nombre)
            ? evento.target.transaction.objectStore(nombre)
            : db.createObjectStore(nombre, { keyPath: def.clave });

          def.indices.forEach((campo) => {
            if (!almacen.indexNames.contains(campo)) almacen.createIndex(campo, campo);
          });
        }
      };

      pedido.onsuccess = () => { conexion = pedido.result; resolver(conexion); };
      pedido.onerror = () => rechazar(pedido.error);
      pedido.onblocked = () => rechazar(new Error("Hay otra pestaña de la app abierta con una versión distinta."));
    });
  }

  // Envuelve una operación sobre un almacén y espera a que la transacción
  // termine de verdad, no solo a que el pedido responda.
  function operar(almacen, modo, hacer) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction(almacen, modo);
      const pedido = hacer(tx.objectStore(almacen));
      let resultado;
      if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };
      tx.oncomplete = () => resolver(resultado);
      tx.onabort = tx.onerror = () => rechazar(tx.error);
    }));
  }

  const guardar  = (almacen, dato)  => operar(almacen, "readwrite", (a) => a.put(dato));
  const obtener  = (almacen, clave) => operar(almacen, "readonly",  (a) => a.get(clave));
  const todos    = (almacen)        => operar(almacen, "readonly",  (a) => a.getAll()).then((r) => r || []);
  const borrar   = (almacen, clave) => operar(almacen, "readwrite", (a) => a.delete(clave));
  const contar   = (almacen)        => operar(almacen, "readonly",  (a) => a.count());

  // ---------- Configuración del establecimiento ----------
  //
  // Va como un único documento: es más simple y se envía a la planilla de una
  // sola vez, reemplazando lo anterior en lugar de sumar filas repetidas.

  const CLAVE_CONFIG = "establecimiento";

  function leerConfig() {
    return obtener("config", CLAVE_CONFIG).then((fila) => (fila ? fila.valor : null));
  }

  function guardarConfig(datos) {
    return guardar("config", {
      clave: CLAVE_CONFIG,
      valor: datos,
      actualizado: new Date().toISOString(),
    });
  }

  // ---------- Cola de envío ----------
  //
  // Se usa a partir de la fase de sincronización. Cada registro lleva su
  // propio id, así un reintento nunca duplica filas en la planilla.

  // Cada registro lleva el identificador del teléfono desde que se crea, no
  // desde que se envía: así queda constancia de dónde salió aunque se suba
  // semanas después.
  function sobre(tipo, datos) {
    return {
      id: nuevoId(),
      tipo: tipo,
      datos: datos,
      dispositivo: window.Acceso.dispositivo(),
      creado: new Date().toISOString(),
      intentos: 0,
    };
  }

  function encolar(tipo, datos) {
    return guardar("salida", sobre(tipo, datos));
  }

  // Para lo que ya tiene identidad propia: un renglón del plan, una aplicación.
  // La cola usa ESE id en vez de inventar uno, así volver a encolar el mismo
  // registro lo reemplaza en lugar de sumarlo, y en la planilla no aparece
  // dos veces aunque se toque "guardar" tres veces seguidas.
  function encolarCon(id, tipo, datos) {
    return guardar("salida", Object.assign(sobre(tipo, datos), { id: id }));
  }

  // Para lo que se corrige en vez de acumularse, como la configuración: la
  // versión nueva reemplaza a la anterior que todavía no se envió, así la
  // planilla no recibe tres configuraciones distintas de la misma chacra.
  function encolarUnico(tipo, datos) {
    return abrir().then((db) => new Promise((resolver, rechazar) => {
      const tx = db.transaction("salida", "readwrite");
      const almacen = tx.objectStore("salida");
      const cursor = almacen.index("tipo").openCursor(IDBKeyRange.only(tipo));

      cursor.onsuccess = (evento) => {
        const puntero = evento.target.result;
        if (puntero) { puntero.delete(); puntero.continue(); return; }
        almacen.put(sobre(tipo, datos));
      };

      tx.oncomplete = () => resolver(true);
      tx.onabort = tx.onerror = () => rechazar(tx.error);
    }));
  }

  const pendientes = () => todos("salida");

  // ---------- Identificadores ----------

  function nuevoId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  return {
    abrir, guardar, obtener, todos, borrar, contar,
    leerConfig, guardarConfig,
    encolar, encolarCon, encolarUnico, pendientes,
    nuevoId,
  };
})();
