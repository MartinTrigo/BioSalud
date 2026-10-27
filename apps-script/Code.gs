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
// PARA SUMAR UNA CHACRA no hace falta tocar este código ni abrir el editor:
// en la planilla "BioSalud · Accesos", menú BioSalud → Dar de alta una chacra.
// Eso crea la planilla, le arma las hojas, la registra y devuelve el código de
// invitación. Ver el apartado del menú, más abajo.
// ==========================================================================

// ---------- Lo que se configura sin tocar el código ----------
//
// Nada de esto vive acá adentro: va en Configuración del proyecto (engranaje)
// → Propiedades del script. Así el repositorio, que es público, no lleva
// identificadores ni claves.
//
//   ACCESOS      id de la planilla "BioSalud · Accesos"
//   CHACRAS      {"codigo":"id de su planilla", …}
//   CLAVE_ADMIN  clave de administración, larga y al azar
//
function propiedad(nombre) {
  return PropertiesService.getScriptProperties().getProperty(nombre) || "";
}

// Planilla aparte con quién tiene acceso. No es la de ninguna chacra: si una
// chacra pudiera abrirla, vería las huellas de todas las demás.
function planillaAccesos() {
  var id = propiedad("ACCESOS");
  if (!id) throw new Error("Falta la propiedad ACCESOS con el id de la planilla de accesos.");
  return id;
}

var INVITACIONES_ENCABEZADOS = ["Código", "Chacra", "Para quién", "Estado", "Creada",
                                "Usada el", "Dispositivo"];
// Las dos últimas columnas se agregaron después, y van al final a propósito: la
// huella se busca por su posición (índice 7) en permitido(), así que correrla
// dejaría a todos los teléfonos sin acceso de golpe.
var DISPOSITIVOS_ENCABEZADOS = ["Dispositivo", "Chacra", "Persona", "Activo", "Alta",
                                "Última actividad", "Registros", "Huella",
                                "Términos aceptados", "Aceptados el"];

// ---------- Las hojas de datos de cada chacra ----------
//
// La configuración va aparte, más abajo, porque no se acumula: se reescribe
// entera. Estas cuatro sí se acumulan, una fila por registro.
//
// Cada fila arranca con el Id que puso el teléfono. Es lo que permite que un
// reintento no duplique, y lo que ata una aplicación con su renglón del plan o
// un tratamiento con el monitoreo que lo originó.

// Los sectores viajan como lista; en la planilla van en una sola celda.
function comoTexto(valor) {
  if (Array.isArray(valor)) return valor.join(", ");
  return valor === undefined || valor === null ? "" : String(valor);
}

var HOJAS = {
  // Fase 2 — los renglones del plan de salud de la temporada.
  plan: {
    nombre: "Plan",
    encabezados: ["Id", "Temporada", "Producto", "Categoría", "Dosis",
                  "Litros por aplicación", "Método",
                  "Sectores", "Desde", "Hasta", "Cada (días)", "Motivo",
                  "Estado", "Observaciones", "Cargado por", "Recibido"],
    fila: function (r) {
      var d = r.datos;
      return [r.id, comoTexto(d.temporada), comoTexto(d.producto), comoTexto(d.categoria),
              comoTexto(d.dosis), d.litros_por_aplicacion || "", comoTexto(d.metodo),
              comoTexto(d.sectores),
              comoTexto(d.desde), comoTexto(d.hasta), d.cada_dias || "",
              comoTexto(d.motivo), comoTexto(d.estado) || "Activo",
              comoTexto(d.observaciones), comoTexto(r.dispositivo), new Date()];
    },
  },

  // Fase 3 — lo que se aplicó de verdad. Es el corazón del seguimiento: la
  // fecha programada y la real van juntas para poder ver el desvío.
  aplicaciones: {
    nombre: "Aplicaciones",
    encabezados: ["Id", "Plan Id", "Fecha programada", "Fecha aplicada", "Producto",
                  "Dosis", "Método", "Sector", "Superficie (m²)", "Volumen aplicado",
                  "Operador", "Clima", "Estado", "Observaciones", "Cargado por", "Recibido"],
    fila: function (r) {
      var d = r.datos;
      return [r.id, comoTexto(d.plan_id), comoTexto(d.fecha_programada),
              comoTexto(d.fecha_aplicada), comoTexto(d.producto), comoTexto(d.dosis),
              comoTexto(d.metodo), comoTexto(d.sector), d.superficie || "",
              comoTexto(d.volumen), comoTexto(d.operador), comoTexto(d.clima),
              comoTexto(d.estado) || "Aplicada", comoTexto(d.observaciones),
              comoTexto(r.dispositivo), new Date()];
    },
  },

  // Fase 5 — las fotos del monitoreo. La imagen va a Drive y acá queda el
  // enlace: una planilla no guarda archivos, y además así el técnico puede
  // abrir la foto desde la fila sin descargar nada pesado.
  fotos: {
    nombre: "Fotos",
    encabezados: ["Id", "Monitoreo Id", "Fecha", "Sector", "Qué se observó",
                  "Archivo", "Enlace", "Tamaño (KB)", "Medidas", "Cargado por", "Recibido"],
    fila: function (r) {
      var d = r.datos;
      return [r.id, comoTexto(d.monitoreo_id), comoTexto(d.fecha), comoTexto(d.sector),
              comoTexto(d.deteccion), comoTexto(d.archivo), comoTexto(d.enlace),
              d.bytes ? Math.round(d.bytes / 1024) : "",
              (d.ancho && d.alto) ? d.ancho + " × " + d.alto : "",
              comoTexto(r.dispositivo), new Date()];
    },
  },

  // Fase 5 — lo que se ve caminando el campo.
  monitoreos: {
    nombre: "Monitoreos",
    encabezados: ["Id", "Fecha", "Sector", "Bancal", "Cultivo", "Qué se observó",
                  "Tipo", "Incidencia (%)", "Severidad", "Plantas revisadas",
                  "Avisó al técnico", "Observaciones", "Cargado por", "Recibido"],
    fila: function (r) {
      var d = r.datos;
      return [r.id, comoTexto(d.fecha), comoTexto(d.sector), comoTexto(d.bancal),
              comoTexto(d.cultivo), comoTexto(d.deteccion), comoTexto(d.tipo),
              d.incidencia === undefined ? "" : d.incidencia, comoTexto(d.severidad),
              d.revisadas || "", d.aviso_tecnico ? "SÍ" : "NO",
              comoTexto(d.observaciones), comoTexto(r.dispositivo), new Date()];
    },
  },

  // Fase 5 — el plan de tratamiento que sale de un monitoreo. Lleva quién lo
  // validó: una recomendación sanitaria no queda sin firma.
  tratamientos: {
    nombre: "Tratamientos",
    encabezados: ["Id", "Monitoreo Id", "Fecha", "Problema", "Producto", "Dosis",
                  "Método", "Sectores", "Desde", "Hasta", "Cada (días)",
                  "Sugerido por", "Validado por", "Validado el", "Estado",
                  "Observaciones", "Cargado por", "Recibido"],
    fila: function (r) {
      var d = r.datos;
      return [r.id, comoTexto(d.monitoreo_id), comoTexto(d.fecha), comoTexto(d.problema),
              comoTexto(d.producto), comoTexto(d.dosis), comoTexto(d.metodo),
              comoTexto(d.sectores), comoTexto(d.desde), comoTexto(d.hasta),
              d.cada_dias || "", comoTexto(d.sugerido_por) || "App",
              comoTexto(d.validado_por), comoTexto(d.validado_el),
              comoTexto(d.estado) || "Propuesto", comoTexto(d.observaciones),
              comoTexto(r.dispositivo), new Date()];
    },
  },
};

// ==========================================================================
// ACCESOS
// ==========================================================================

function hojaAccesos(nombre, encabezados) {
  return hojaSuelta(planillaAccesos(), nombre, encabezados);
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
  var guardada = propiedad("CLAVE_ADMIN");
  return !!guardada && String(clave || "") === guardada;
}

// Crea el código que se le da a cada productor. No se expone como entrada del
// servicio: si cualquiera pudiera pedir invitaciones, no habría control de
// acceso. Se llama desde el menú de la planilla (ver más abajo).
//
// Se niega a inventar una invitación para una chacra que no existe. Pasó una
// vez: una fila escrita a mano en la hoja Invitaciones, para una chacra que
// todavía no estaba dada de alta. El canje la habría aceptado igual —solo
// compara el código y la chacra de esa fila— y el teléfono se habría quedado
// con una credencial válida para una chacra sin planilla: todo lo que cargara
// en el campo se iba a quedar en la cola, sin que nadie se enterara hasta
// revisar por qué esa chacra nunca subía nada.
function nuevaInvitacion(chacra, persona) {
  chacra = String(chacra || "").trim().toLowerCase();
  if (!chacra) throw new Error("Falta el código de la chacra.");

  var mapa = {};
  try { mapa = JSON.parse(propiedad("CHACRAS") || "{}"); } catch (err) { mapa = {}; }
  if (!mapa[chacra]) {
    throw new Error("No hay ninguna chacra con el código «" + chacra + "». " +
                    "Primero hay que darla de alta.");
  }

  var codigo = alAzar(4) + "-" + alAzar(4);
  hojaAccesos("Invitaciones", INVITACIONES_ENCABEZADOS)
    .appendRow([codigo, chacra, persona, "Nueva", new Date(), "", ""]);
  Logger.log("Código para " + persona + " (" + chacra + "): " + codigo);
  return codigo;
}

// ==========================================================================
// SUMAR UNA CHACRA, DESDE EL MENÚ DE LA PLANILLA
//
// Antes había que crear la planilla a mano, copiar su id, pegarlo en la
// propiedad CHACRAS y volver a ejecutar prepararPlanillas. Con diez chacras eso
// son cuarenta pasos y una oportunidad de equivocarse en cada uno.
//
// crearChacra() hace todo junto: crea la planilla dentro de la carpeta Chacras,
// le arma las hojas, la registra en CHACRAS y devuelve el código de invitación
// para el productor.
//
// POR QUÉ UN MENÚ Y NO UN FORMULARIO EN LA APP
//
// La app está publicada en una URL pública: un formulario de alta ahí dentro
// dejaría que cualquiera cree planillas en el Drive del equipo y registre
// chacras. El menú va en la planilla de accesos, que es donde ya se administran
// las invitaciones y los dispositivos, y la autorización la da Google: solo
// quien puede abrir esa planilla ve el menú. Así no hace falta inventar un
// segundo mecanismo de acceso ni que una clave de administración ande dando
// vueltas en un teléfono.
//
// Y sobre todo: nadie tiene que editar código para sumar una chacra. Los datos
// se escriben en las ventanitas del menú, no en estas líneas, así que tampoco
// quedan datos de chacras reales en un repositorio público.
// ==========================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("BioSalud")
    .addItem("Dar de alta una chacra", "menuAltaDeChacra")
    .addItem("Nueva invitación para una chacra", "menuNuevaInvitacion")
    .addSeparator()
    .addItem("Revisar la configuración del servicio", "revisarConfiguracion")
    .addToUi();
}

// Pregunta una cosa por vez. Devuelve null si cancelan, para poder cortar sin
// dejar nada a medio crear.
function preguntar(titulo, texto) {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(titulo, texto, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return String(r.getResponseText() || "").trim();
}

function menuAltaDeChacra() {
  var ui = SpreadsheetApp.getUi();

  var codigo = preguntar("Dar de alta una chacra (1 de 3)",
    "Código corto de la chacra, sin espacios ni acentos.\n\n" +
    "Es lo que el productor escribe en la app. Por ejemplo: radal");
  if (codigo === null) return;
  if (!codigo) { ui.alert("Sin código corto no se puede dar de alta."); return; }

  var nombre = preguntar("Dar de alta una chacra (2 de 3)",
    "Nombre de la chacra, como va a figurar en la planilla.\n\n" +
    "Por ejemplo: Chacra El Radal");
  if (nombre === null) return;

  var persona = preguntar("Dar de alta una chacra (3 de 3)",
    "Quién va a cargar desde el celular.\n\n" +
    "Con este nombre se crea la primera invitación.");
  if (persona === null) return;

  try {
    ui.alert("Chacra dada de alta", crearChacra(codigo, nombre, persona), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("No se pudo dar de alta", String(err.message || err), ui.ButtonSet.OK);
  }
}

function menuNuevaInvitacion() {
  var ui = SpreadsheetApp.getUi();

  var chacra = preguntar("Nueva invitación (1 de 2)",
    "Código corto de la chacra que ya está dada de alta.\n\n" +
    "Tiene que ser una de las que figuran en la hoja Invitaciones.");
  if (chacra === null) return;

  var persona = preguntar("Nueva invitación (2 de 2)",
    "Para quién es. Queda anotado en la hoja Invitaciones.");
  if (persona === null) return;

  try {
    var codigo = nuevaInvitacion(chacra, persona);
    ui.alert("Invitación creada",
      "Código para " + (persona || "esa persona") + ", chacra " + chacra + ":\n\n" +
      "        " + codigo + "\n\n" +
      "Vale para un solo teléfono. En la app se escribe junto con el código de " +
      "la chacra.", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("No se pudo crear la invitación", String(err.message || err), ui.ButtonSet.OK);
  }
}

function crearChacra(codigo, nombre, persona) {
  codigo = String(codigo || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!codigo) throw new Error("Falta el código corto de la chacra.");

  var mapa = {};
  try { mapa = JSON.parse(propiedad("CHACRAS") || "{}"); } catch (err) { mapa = {}; }
  if (mapa[codigo]) throw new Error("Ya existe una chacra con el código " + codigo + ".");

  var carpeta = carpetaDeChacras();
  var libro = SpreadsheetApp.create("BioSalud · " + (nombre || codigo));

  // create() la deja en la raíz del Drive; hay que moverla a su carpeta.
  var archivo = DriveApp.getFileById(libro.getId());
  carpeta.addFile(archivo);
  DriveApp.getRootFolder().removeFile(archivo);

  armarHojas(libro);

  mapa[codigo] = libro.getId();
  PropertiesService.getScriptProperties().setProperty("CHACRAS", JSON.stringify(mapa));

  var invitacion = nuevaInvitacion(codigo, persona || "");

  var resumen =
    "Chacra dada de alta.\n\n" +
    "  código      " + codigo + "\n" +
    "  planilla    " + libro.getUrl() + "\n" +
    "  invitación  " + invitacion + "\n\n" +
    "Ya funciona: CHACRAS es una propiedad del script y se lee en cada pedido,\n" +
    "así que no hace falta implementar una versión nueva.\n\n" +
    "Falta compartirle la planilla a la chacra como lectora, para que pueda\n" +
    "mirar sus propios datos.";
  Logger.log(resumen);
  return resumen;
}

// La carpeta "Chacras" dentro de la carpeta de datos. Si no existe, se crea.
// ==========================================================================
// LAS FOTOS DEL MONITOREO
//
// La app las achica a 1280 px antes de mandarlas, así que lo que llega acá pesa
// entre 100 y 200 KB. Se guardan en Drive, una carpeta por chacra, y en la
// planilla queda el enlace.
//
// NO SE COMPARTEN SOLAS. El archivo queda con los permisos que tenga la carpeta,
// que hoy es el Drive del equipo: el técnico las abre, el productor ve el enlace
// en su planilla pero no el contenido. Darles acceso es una decisión de quién
// puede ver las fotos de la chacra de otro, y esa no la toma el código.
// ==========================================================================

function carpetaDeFotos(chacra) {
  var padre = propiedad("CARPETA_DATOS");
  if (!padre) throw new Error("Falta la propiedad CARPETA_DATOS para guardar las fotos.");

  var raiz = DriveApp.getFolderById(padre);
  var busca = raiz.getFoldersByName("Fotos");
  var fotos = busca.hasNext() ? busca.next() : raiz.createFolder("Fotos");

  var codigo = String(chacra || "sin-chacra").toLowerCase();
  var suya = fotos.getFoldersByName(codigo);
  return suya.hasNext() ? suya.next() : fotos.createFolder(codigo);
}

// Escribe la imagen en Drive y devuelve con qué nombre quedó y dónde. El nombre
// lleva fecha, chacra y monitoreo para que la carpeta se pueda mirar de frente,
// sin tener que cruzarla con la planilla.
function guardarFoto(chacra, datos) {
  if (!datos || !datos.contenido) throw new Error("La foto llegó sin contenido.");

  var tipo = String(datos.tipo_imagen || "image/jpeg");
  var extension = tipo.indexOf("webp") >= 0 ? "webp" : "jpg";
  var corto = String(datos.monitoreo_id || "").slice(0, 8);
  var nombre = [String(datos.fecha || "sin-fecha"), String(chacra || "chacra"),
                corto, String(datos.numero || 1)].join("-") + "." + extension;

  var blob = Utilities.newBlob(Utilities.base64Decode(datos.contenido), tipo, nombre);
  var archivo = carpetaDeFotos(chacra).createFile(blob);

  return { archivo: nombre, enlace: archivo.getUrl() };
}

function carpetaDeChacras() {
  var id = propiedad("CARPETA_CHACRAS");
  if (id) return DriveApp.getFolderById(id);

  var padre = propiedad("CARPETA_DATOS");
  if (!padre) {
    throw new Error("Falta la propiedad CARPETA_CHACRAS (o CARPETA_DATOS) " +
                    "con el id de la carpeta de Drive donde van las planillas.");
  }
  var raiz = DriveApp.getFolderById(padre);
  var busca = raiz.getFoldersByName("Chacras");
  var carpeta = busca.hasNext() ? busca.next() : raiz.createFolder("Chacras");
  PropertiesService.getScriptProperties().setProperty("CARPETA_CHACRAS", carpeta.getId());
  return carpeta;
}

// ==========================================================================
// PREPARAR LAS PLANILLAS
//
// Se ejecuta A MANO desde el editor, una vez al desplegar y otra vez cada vez
// que se suma una chacra. Deja todas las hojas creadas con sus encabezados.
//
// No hace falta correrla para que la app funcione —el servicio crea la hoja
// que necesita cuando le llega el primer registro—, pero conviene: así la
// planilla ya se ve armada cuando el productor entra a mirarla, y los
// encabezados salen del mismo código que después escribe las filas, con lo
// cual no pueden quedar corridos.
//
// Es idempotente: correrla dos veces no rompe ni duplica nada.
// ==========================================================================

// ==========================================================================
// REVISAR QUE ESTÉ TODO BIEN CARGADO
//
// Se ejecuta desde el editor antes que nada. En vez de comparar los
// identificadores a ojo, los usa: abre cada cosa y dice cómo se llama. Si un id
// está mal escrito o le quedó pegado un "?usp=sharing", falla acá y no cuando
// un productor esté cargando datos en el campo.
// ==========================================================================

function revisarConfiguracion() {
  var lineas = [];

  function probar(nombre, obligatoria, comprobar) {
    var valor = propiedad(nombre);
    if (!valor) {
      lineas.push((obligatoria ? "FALTA    " : "opcional ") + nombre);
      return;
    }
    try {
      lineas.push("ok       " + nombre + "  →  " + comprobar(valor));
    } catch (err) {
      lineas.push("MAL      " + nombre + "  →  " + err.message);
    }
  }

  probar("ACCESOS", true, function (id) {
    return "planilla «" + SpreadsheetApp.openById(id).getName() + "»";
  });

  probar("CARPETA_DATOS", true, function (id) {
    return "carpeta «" + DriveApp.getFolderById(id).getName() + "»";
  });

  probar("CLAVE_ADMIN", true, function (v) {
    if (v.length < 12) return "cargada, pero es corta: conviene una de 20 o más caracteres";
    return "cargada (" + v.length + " caracteres, no se muestra)";
  });

  probar("CHACRAS", true, function (v) {
    var mapa = JSON.parse(v);
    var codigos = Object.keys(mapa);
    if (!codigos.length) return "vacía todavía. Menú BioSalud → Dar de alta una chacra.";
    return codigos.map(function (c) {
      try {
        return c + " = «" + SpreadsheetApp.openById(mapa[c]).getName() + "»";
      } catch (err) {
        return c + " = ID QUE NO ABRE";
      }
    }).join(" · ");
  });

  var resumen = "REVISIÓN DE LA CONFIGURACIÓN\n\n" + lineas.join("\n") +
    "\n\nSi está todo en «ok», seguí con prepararPlanillas() y después Implementar.";
  Logger.log(resumen);
  return resumen;
}


function prepararPlanillas() {
  var hechas = [];

  // 1. La planilla de accesos
  hojaAccesos("Invitaciones", INVITACIONES_ENCABEZADOS);
  hojaAccesos("Dispositivos", DISPOSITIVOS_ENCABEZADOS);
  limpiarHojaSobrante(SpreadsheetApp.openById(planillaAccesos()));
  hechas.push("Accesos: Invitaciones y Dispositivos");

  // 2. La planilla de cada chacra
  var codigos = chacrasConocidas();
  if (!codigos.length) {
    hechas.push("Sin chacras todavía: cargá la propiedad CHACRAS y volvé a ejecutar.");
  }

  codigos.forEach(function (codigo) {
    var libro = planillaDe(codigo);
    armarHojas(libro);
    hechas.push(codigo + " → " + libro.getName());
  });

  var resumen = hechas.join("\n");
  Logger.log(resumen);
  return resumen;
}

// Deja una planilla de chacra con todas sus hojas y encabezados.
function armarHojas(libro) {
  // La configuración: sin filas, solo el encabezado, porque no se acumula.
  var config = libro.getSheetByName("Config") || libro.insertSheet("Config");
  ponerEncabezados(config, CONFIG_ENCABEZADOS);
  config.autoResizeColumns(1, CONFIG_ENCABEZADOS.length);

  // Las que sí se acumulan, una fila por registro.
  Object.keys(HOJAS).forEach(function (tipo) {
    obtenerHoja(libro, HOJAS[tipo]);
  });

  limpiarHojaSobrante(libro);
  return libro;
}

// La hoja vacía que Google crea sola con cada planilla nueva.
function limpiarHojaSobrante(libro) {
  ["Hoja 1", "Hoja1", "Sheet1"].forEach(function (nombre) {
    var sobrante = libro.getSheetByName(nombre);
    if (sobrante && libro.getSheets().length > 1 && sobrante.getLastRow() === 0) {
      libro.deleteSheet(sobrante);
    }
  });
}

// Canjea el código por una credencial. El código queda usado y no sirve más.
function canjearInvitacion(chacra, codigo, persona, dispositivo, terminos) {
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
      registrarDispositivo(chacra, dispositivo, quien, credencial, terminos);

      hoja.getRange(i + 2, 4, 1, 4).setValues([["Usado", filas[i][4], new Date(), dispositivo]]);
      return { ok: true, credencial: credencial, persona: quien };
    }
    return rechazo("Ese código no existe.");
  } finally {
    candado.releaseLock();
  }
}

// La versión de los términos que la persona aceptó queda en su fila, junto con
// la fecha. Es el único lugar donde tiene sentido: el consentimiento es de una
// persona en un teléfono, no de la chacra, y acá es donde lo va a buscar quien
// tenga que verificarlo.
function registrarDispositivo(chacra, dispositivo, persona, credencial, terminos) {
  hojaAccesos("Dispositivos", DISPOSITIVOS_ENCABEZADOS)
    .appendRow([dispositivo, chacra, persona, "SÍ", new Date(), new Date(), 0,
                huella(credencial), String(terminos || "sin versión"), new Date()]);
}

// Comprueba que el teléfono esté registrado, activo y sea de esa chacra.
// Para dar de baja uno: poner NO en la columna "Activo" de su fila.
function permitido(chacra, credencial, dispositivo) {
  if (!credencial) return rechazo("Este teléfono todavía no tiene acceso.");

  var hoja = SpreadsheetApp.openById(planillaAccesos()).getSheetByName("Dispositivos");
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
    var hoja = SpreadsheetApp.openById(planillaAccesos()).getSheetByName("Dispositivos");
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
    mapa = JSON.parse(propiedad("CHACRAS") || "{}");
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
    return respuesta(canjearInvitacion(chacra, p.canjear, p.persona || "",
                                       p.dispositivo || "", p.terminos || ""));
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

      // Las fotos se escriben en Drive ANTES de armar su fila, porque la fila es
      // justamente el enlace al archivo. Si Drive falla, se corta el registro
      // entero y la foto se queda en la cola del teléfono para el próximo
      // intento: es preferible a dejar una fila que apunta a ningún lado.
      registros.forEach(function (r) {
        if (r.tipo !== "foto") return;
        var puesta = guardarFoto(chacra, r.datos);
        r.datos.archivo = puesta.archivo;
        r.datos.enlace = puesta.enlace;
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
    return hoja;
  }

  return asegurarEncabezados(hoja, encabezados);
}

function obtenerHoja(libro, def) {
  var hoja = libro.getSheetByName(def.nombre);
  if (!hoja) {
    hoja = libro.insertSheet(def.nombre);
    ponerEncabezados(hoja, def.encabezados);
    hoja.autoResizeColumns(1, def.encabezados.length);
    return hoja;
  }
  asegurarEncabezados(hoja, def.encabezados);
  return hoja;
}

// ==========================================================================
// PONER EL ENCABEZADO AL DÍA SIN ROMPER LO QUE YA ESTÁ
//
// Una sola función para las hojas de cada chacra y para las de accesos, porque
// el problema es el mismo y la primera versión lo resolvió a medias: rehacía el
// encabezado solo si la hoja estaba vacía. Cuando se sumaron las columnas de los
// términos aceptados, Dispositivos ya tenía dos teléfonos, así que las columnas
// nuevas se quedaban sin nombre y los valores de los canjes siguientes entraban
// ahí, en silencio.
//
// Las tres situaciones, en orden:
//
//   · El encabezado ya coincide          → no se toca nada.
//   · La hoja no tiene datos             → se rehace entero.
//   · La hoja tiene datos y lo que está
//     es el PRINCIPIO de lo nuevo        → se agregan las que faltan, al final.
//   · Cualquier otra diferencia          → no se toca nada.
//
// Lo último es a propósito: con filas cargadas, mover una columna desalinea
// datos que ya no se pueden recuperar. Es mejor que quede un encabezado viejo y
// se note, a que la función adivine.
// ==========================================================================
function asegurarEncabezados(hoja, encabezados) {
  var actuales = hoja.getLastColumn()
    ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String) : [];

  if (actuales.join("|") === encabezados.join("|")) return hoja;

  if (hoja.getLastRow() <= 1) {
    hoja.clear();
    ponerEncabezados(hoja, encabezados);
    hoja.autoResizeColumns(1, encabezados.length);
    return hoja;
  }

  var esPrefijo = actuales.length < encabezados.length;
  for (var i = 0; i < actuales.length && esPrefijo; i++) {
    if (actuales[i] !== encabezados[i]) esPrefijo = false;
  }
  if (esPrefijo) {
    var faltan = encabezados.slice(actuales.length);
    hoja.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan])
        .setFontWeight("bold").setBackground("#16632F").setFontColor("#FFFFFF");
    hoja.autoResizeColumns(1, encabezados.length);
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
