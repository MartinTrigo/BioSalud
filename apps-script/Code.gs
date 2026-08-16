// ==========================================================================
// BioSalud ECOMARCAL — servicio Apps Script
//
// Un solo servicio atiende a todas las chacras: cada registro dice de qué
// chacra viene y se escribe en la planilla de esa chacra. Así cada
// establecimiento tiene sus datos en su propio archivo, pero todos usan el
// mismo enlace y no hay que publicar un servicio por chacra.
//
// EL CONTROL DE ACCESO ESTÁ DESDE EL PRIMER DÍA, A PROPÓSITO.
// En MonAgric se agregó después, y en el medio hubo un período en que
// cualquiera con la dirección del servicio —que está en el código público—
// podía leer los datos de todas las chacras, inventar registros y borrar la
// configuración de una temporada entera. Acá no se repite: nada se lee ni se
// escribe sin credencial.
//
// El detalle del modelo de acceso y cómo operarlo está en SEGURIDAD.md.
//
// PARA SUMAR UNA CHACRA (no hace falta tocar este código):
//   1. Crear una planilla nueva en Drive: "BioSalud · Chacra X".
//   2. En el editor: Configuración del proyecto (engranaje) → Propiedades del
//      script → propiedad CHACRAS con un JSON así:
//        {"radal":"1PrP0F…","esperanza":"1AbC…"}
//   3. Implementar → Administrar implementaciones → lápiz → Nueva versión.
//   4. Crear las invitaciones con crearInvitacion() (ver más abajo).
// ==========================================================================

// Planilla aparte con quién tiene acceso. No es la de ninguna chacra: si una
// chacra pudiera abrirla, vería las huellas de todas las demás.
var PLANILLA_ACCESOS_ID = "";   // ← completar al desplegar

var INVITACIONES_ENCABEZADOS = ["Código", "Chacra", "Para quién", "Estado", "Creada",
                                "Usada el", "Dispositivo"];
var DISPOSITIVOS_ENCABEZADOS = ["Dispositivo", "Chacra", "Persona", "Activo", "Alta",
                                "Última actividad", "Registros", "Huella"];

// Las hojas de datos se van sumando en cada fase: Plan (fase 2), Aplicaciones
// (fase 3), Monitoreos y Tratamientos (fase 5). La configuración va aparte
// porque no se acumula: se reescribe entera.
var HOJAS = {};

// ==========================================================================
// ACCESOS
// ==========================================================================

function hojaAccesos(nombre, encabezados) {
  return hojaSuelta(PLANILLA_ACCESOS_ID, nombre, encabezados);
}

// De la credencial sale siempre la misma huella, pero de la huella no se puede
// volver a la credencial. Así, ni leyendo la planilla de accesos se saca nada
// que sirva para entrar.
function huella(texto) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                      String(texto), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ("0" + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join("");
}

// Sin I, O, 0 ni 1: se confunden al dictarlos por teléfono o leerlos escritos
// a mano en el campo.
function alAzar(largo) {
  var letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var s = "";
  for (var i = 0; i < largo; i++) s += letras.charAt(Math.floor(Math.random() * letras.length));
  return s;
}

function esAdmin(clave) {
  var guardada = PropertiesService.getScriptProperties().getProperty("CLAVE_ADMIN");
  return !!guardada && String(clave || "") === guardada;
}

// Se ejecuta A MANO desde el editor de Apps Script para crear el código que se
// le da a cada productor. No se expone como entrada del servicio: si cualquiera
// pudiera pedir invitaciones, no habría control de acceso.
function crearInvitacion() {
  var chacra = "radal";              // ← editar antes de ejecutar
  var persona = "Marta Quilodrán";   // ← editar antes de ejecutar

  var codigo = alAzar(4) + "-" + alAzar(4);
  hojaAccesos("Invitaciones", INVITACIONES_ENCABEZADOS)
    .appendRow([codigo, chacra, persona, "Nueva", new Date(), "", ""]);
  Logger.log("Código para " + persona + " (" + chacra + "): " + codigo);
  return codigo;
}

// Canjea el código por una credencial. El código queda usado y no sirve más.
function canjearInvitacion(chacra, codigo, persona, dispositivo) {
  codigo = String(codigo || "").trim().toUpperCase();
  if (!codigo || !chacra) return rechazo("Falta el código o la chacra.");
  if (!dispositivo) return rechazo("Falta el identificador del teléfono.");

  // Sin el candado, dos personas canjeando el mismo código en el mismo momento
  // podrían quedar las dos adentro.
  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    var hoja = hojaAccesos("Invitaciones", INVITACIONES_ENCABEZADOS);
    if (hoja.getLastRow() < 2) return rechazo("Ese código no existe.");

    var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, INVITACIONES_ENCABEZADOS.length)
                    .getValues();

    for (var i = 0; i < filas.length; i++) {
      if (String(filas[i][0]).trim().toUpperCase() !== codigo) continue;

      if (String(filas[i][1]).toLowerCase() !== String(chacra).toLowerCase()) {
        return rechazo("Ese código es de otra chacra.");
      }
      if (String(filas[i][3]).toLowerCase() === "usado") {
        return rechazo("Ese código ya se usó en otro teléfono.");
      }

      var credencial = alAzar(8) + "-" + alAzar(8) + "-" + alAzar(8);
      var quien = persona || String(filas[i][2] || "");
      registrarDispositivo(chacra, dispositivo, quien, credencial);

      hoja.getRange(i + 2, 4, 1, 4).setValues([["Usado", filas[i][4], new Date(), dispositivo]]);
      return { ok: true, credencial: credencial, persona: quien };
    }
    return rechazo("Ese código no existe.");
  } finally {
    candado.releaseLock();
  }
}

function registrarDispositivo(chacra, dispositivo, persona, credencial) {
  hojaAccesos("Dispositivos", DISPOSITIVOS_ENCABEZADOS)
    .appendRow([dispositivo, chacra, persona, "SÍ", new Date(), new Date(), 0,
                huella(credencial)]);
}

// Comprueba que el teléfono esté registrado, activo y sea de esa chacra.
// Para dar de baja uno: poner NO en la columna "Activo" de su fila.
function permitido(chacra, credencial, dispositivo) {
  if (!credencial) return rechazo("Este teléfono todavía no tiene acceso.");

  var hoja = SpreadsheetApp.openById(PLANILLA_ACCESOS_ID).getSheetByName("Dispositivos");
  if (!hoja || hoja.getLastRow() < 2) return rechazo("Este teléfono todavía no tiene acceso.");

  var buscada = huella(credencial);
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, DISPOSITIVOS_ENCABEZADOS.length)
                  .getValues();

  for (var i = 0; i < filas.length; i++) {
    if (String(filas[i][7]) !== buscada) continue;
    if (String(filas[i][1]).toLowerCase() !== String(chacra).toLowerCase()) {
      return rechazo("Esa credencial no es de esta chacra.");
    }
    if (String(filas[i][3]).toUpperCase().indexOf("S") !== 0) {
      return rechazo("Este teléfono fue dado de baja. Pedí un código nuevo.");
    }
    return { ok: true, fila: i + 2, persona: String(filas[i][2] || "") };
  }
  return rechazo("Credencial desconocida. Pedí un código nuevo.");
}

// Deja constancia de que ese teléfono estuvo activo y cuánto cargó.
function marcarActividad(fila, cuantos) {
  try {
    var hoja = SpreadsheetApp.openById(PLANILLA_ACCESOS_ID).getSheetByName("Dispositivos");
    hoja.getRange(fila, 6).setValue(new Date());
    if (cuantos) {
      var previos = Number(hoja.getRange(fila, 7).getValue()) || 0;
      hoja.getRange(fila, 7).setValue(previos + cuantos);
    }
  } catch (err) { /* que no se pierda un registro por no poder anotar la visita */ }
}

function rechazo(motivo) {
  return { ok: false, sin_permiso: true, error: motivo };
}

// ==========================================================================
// A QUÉ PLANILLA ESCRIBE CADA CHACRA
// ==========================================================================

function planillaDe(chacra) {
  var mapa = {};
  try {
    mapa = JSON.parse(PropertiesService.getScriptProperties().getProperty("CHACRAS") || "{}");
  } catch (err) { mapa = {}; }

  var id = mapa[String(chacra || "").toLowerCase()];
  if (!id) throw new Error("Chacra desconocida: " + chacra);
  return SpreadsheetApp.openById(id);
}

function chacrasConocidas() {
  try {
    return Object.keys(JSON.parse(
      PropertiesService.getScriptProperties().getProperty("CHACRAS") || "{}"));
  } catch (err) { return []; }
}

// ==========================================================================
// ENTRADAS DEL SERVICIO
// ==========================================================================

// Todo va envuelto: si algo falla, Apps Script devuelve una página HTML de
// error que no dice nada. Así al menos vuelve el motivo en el JSON.
function doGet(e) {
  try {
    return atender((e && e.parameter) || {});
  } catch (err) {
    return respuesta({ ok: false, error: String(err), donde: "doGet" });
  }
}

function atender(p) {
  var chacra = p.chacra || "";

  // Lo único abierto: canjear el código de invitación.
  if (p.canjear) {
    return respuesta(canjearInvitacion(chacra, p.canjear, p.persona || "", p.dispositivo || ""));
  }

  // Todo lo que entregue datos de una chacra exige credencial de esa chacra.
  if (p.config) {
    var permiso = esAdmin(p.clave) ? { ok: true }
                                   : permitido(chacra, p.credencial, p.dispositivo);
    if (!permiso.ok) return respuesta(permiso);
    return respuesta({ ok: true, config: leerConfig(chacra) });
  }

  // Sin credencial solo se sabe que el servicio existe. Ni siquiera se listan
  // las chacras: eso ya sería contar quiénes están adentro.
  return respuesta({ ok: true, servicio: "BioSalud", hora: new Date().toISOString() });
}

function doPost(e) {
  try {
    var cuerpo = JSON.parse(e.postData.contents);
    var chacra = cuerpo.chacra || "";
    var registros = cuerpo.registros || [];

    // Nada se escribe sin credencial.
    var permiso = esAdmin(cuerpo.clave)
      ? { ok: true, fila: 0 }
      : permitido(chacra, cuerpo.credencial, cuerpo.dispositivo);
    if (!permiso.ok) return respuesta(permiso);

    var libro = planillaDe(chacra);
    var guardados = 0;

    var candado = LockService.getScriptLock();
    candado.waitLock(20000);
    try {
      registros.forEach(function (r) {
        if (r.tipo === "config") { guardarConfig(libro, r.datos); guardados++; }
      });

      // Las hojas que se acumulan (aplicaciones, monitoreos) entran por acá a
      // partir de la fase 3, agrupadas por tipo y sin repetir ids.
      var porTipo = {};
      registros.forEach(function (r) {
        if (!HOJAS[r.tipo]) return;
        (porTipo[r.tipo] = porTipo[r.tipo] || []).push(r);
      });

      Object.keys(porTipo).forEach(function (tipo) {
        var def = HOJAS[tipo];
        var hoja = obtenerHoja(libro, def);
        var existentes = idsExistentes(hoja);
        var filas = [];
        porTipo[tipo].forEach(function (r) {
          if (existentes[r.id]) return;      // reintento de algo que ya llegó
          existentes[r.id] = true;
          filas.push(def.fila(r));
        });
        if (filas.length) {
          hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, def.encabezados.length)
              .setValues(filas);
          guardados += filas.length;
        }
      });
    } finally {
      candado.releaseLock();
    }

    if (permiso.fila) marcarActividad(permiso.fila, guardados);
    return respuesta({ ok: true, recibidos: registros.length, guardados: guardados });
  } catch (err) {
    return respuesta({ ok: false, error: String(err) });
  }
}

// ==========================================================================
// CONFIGURACIÓN DEL ESTABLECIMIENTO (hoja Config)
// ==========================================================================
// Formato plano y legible, una fila por dato:
//   Sección | Clave | Valor 1 | Valor 2 | Valor 3 | Valor 4
// Ejemplos:
//   establecimiento | nombre     | Chacra El Radal
//   establecimiento | localidad  | Mallín Ahogado
//   sector          | A          | 1200 | 8 | Hortícola | Goteo

var CONFIG_ENCABEZADOS = ["Sección", "Clave", "Valor 1", "Valor 2", "Valor 3", "Valor 4"];
var CONFIG_COLS = CONFIG_ENCABEZADOS.length;

function leerConfig(chacra) {
  var libro = planillaDe(chacra);
  var hoja = libro.getSheetByName("Config");
  var cfg = { chacra: chacra, planilla: libro.getUrl(), sectores: [] };
  if (!hoja || hoja.getLastRow() < 2) return cfg;

  hoja.getRange(2, 1, hoja.getLastRow() - 1, CONFIG_COLS).getValues().forEach(function (f) {
    var seccion = String(f[0]), clave = String(f[1]);
    if (!seccion) return;
    if (seccion === "establecimiento") cfg[clave] = String(f[2] || "");
    else if (seccion === "sector") {
      cfg.sectores.push({
        nombre: clave, superficie: Number(f[2]) || 0, bancales: Number(f[3]) || 0,
        cultivo: String(f[4] || ""), riego: String(f[5] || ""),
      });
    }
  });
  return cfg;
}

// La configuración se reescribe entera, así que antes se guarda una copia: si
// llega una vacía o mal armada, la anterior queda a un clic sin depender del
// historial de Google.
function respaldarConfig(libro) {
  try {
    var hoja = libro.getSheetByName("Config");
    if (!hoja || hoja.getLastRow() < 2) return;
    var vieja = libro.getSheetByName("Config anterior");
    if (vieja) libro.deleteSheet(vieja);
    libro.setActiveSheet(hoja);
    hoja.copyTo(libro).setName("Config anterior").hideSheet();
  } catch (err) { /* si no se puede respaldar, igual se guarda la nueva */ }
}

function guardarConfig(libro, cfg) {
  // Una configuración sin nombre o sin sectores es casi seguro un error: no se
  // pisa lo que había con eso.
  if (!cfg || !cfg.nombre || !(cfg.sectores || []).length) {
    throw new Error("Configuración incompleta: no se guarda para no pisar la anterior.");
  }

  respaldarConfig(libro);

  var hoja = libro.getSheetByName("Config") || libro.insertSheet("Config");
  ponerEncabezados(hoja, CONFIG_ENCABEZADOS);

  var completar = function (fila) {
    while (fila.length < CONFIG_COLS) fila.push("");
    return fila;
  };

  var filas = [];
  ["nombre", "localidad", "responsable", "contacto", "situacion"].forEach(function (k) {
    filas.push(completar(["establecimiento", k, cfg[k] || ""]));
  });
  (cfg.sectores || []).forEach(function (s) {
    filas.push(completar(["sector", s.nombre, s.superficie || 0, s.bancales || 0,
                          s.cultivo || "", s.riego || ""]));
  });

  if (hoja.getLastRow() > 1) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, CONFIG_COLS).clearContent();
  }
  hoja.getRange(2, 1, filas.length, CONFIG_COLS).setValues(filas);
}

// ==========================================================================
// AUXILIARES
// ==========================================================================

function hojaSuelta(planillaId, nombre, encabezados) {
  var libro = SpreadsheetApp.openById(planillaId);
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    var primera = libro.getSheets()[0];
    hoja = (libro.getSheets().length === 1 && primera.getLastRow() === 0)
      ? primera.setName(nombre)
      : libro.insertSheet(nombre);
    ponerEncabezados(hoja, encabezados);
    hoja.autoResizeColumns(1, encabezados.length);
  }
  return hoja;
}

function obtenerHoja(libro, def) {
  var hoja = libro.getSheetByName(def.nombre);
  if (!hoja) {
    hoja = libro.insertSheet(def.nombre);
    ponerEncabezados(hoja, def.encabezados);
    hoja.autoResizeColumns(1, def.encabezados.length);
    return hoja;
  }
  // Si las columnas cambiaron y la hoja todavía no tiene datos, se rehace el
  // encabezado: si no, las filas nuevas entrarían corridas de lugar.
  if (hoja.getLastRow() <= 1) {
    var actuales = hoja.getLastColumn()
      ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].join("|") : "";
    if (actuales !== def.encabezados.join("|")) {
      hoja.clear();
      ponerEncabezados(hoja, def.encabezados);
    }
  }
  return hoja;
}

function ponerEncabezados(hoja, encabezados) {
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
      .setFontWeight("bold").setBackground("#16632F").setFontColor("#FFFFFF");
  hoja.setFrozenRows(1);
}

// Solo se miran las últimas mil filas: alcanza para descartar un reintento y no
// se hace más lento a medida que la planilla crece.
function idsExistentes(hoja) {
  var mapa = {};
  var ultima = hoja.getLastRow();
  if (ultima < 2) return mapa;
  var desde = Math.max(2, ultima - 1000);
  hoja.getRange(desde, 1, ultima - desde + 1, 1).getValues().forEach(function (f) {
    if (f[0]) mapa[f[0]] = true;
  });
  return mapa;
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
