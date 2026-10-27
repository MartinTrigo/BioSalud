// ==========================================================================
// BioSalud ECOMARCAL — service worker
//
// Guarda la app en el teléfono para que funcione en el campo sin señal.
//
// Estrategia: RED PRIMERO CON PACIENCIA CORTA, caché de respaldo.
//
// En MonAgric aprendimos que "caché primero" deja a los teléfonos con la
// versión vieja para siempre, porque nunca vuelven a preguntar. Por eso acá se
// pide siempre a la red.
//
// Pero la red de la Comarca no es "hay o no hay": muchas veces hay una señal
// débil que tarda quince segundos en contestar, y eso es peor que no tener
// nada, porque la app queda colgada esperando. Por eso se espera solo unos
// segundos: si el servidor no contestó, se usa lo guardado y listo. Con buena
// señal siempre llega lo último; con señal mala o nula, la app abre igual.
//
// IMPORTANTE: al cambiar un archivo de la lista, subir el número de CACHE.
// ==========================================================================

const CACHE = "biosalud-v19";

// Cuánto se espera a la red antes de usar lo guardado en el teléfono.
const ESPERA_MS = 3000;

const ARCHIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/estilos.css",
  "js/util.js",
  "js/acceso.js",
  "js/db.js",
  "js/envio.js",
  "js/config.js",
  "js/wiki.js",
  "js/cobre.js",
  "js/plan.js",
  "js/app.js",
  "datos/biopreparados.json",
  "datos/plagas.json",
  "img/logo-ifab.png",
  "img/logo-ecomarcal.jpg",
  "img/icono-192.png",
  "img/icono-512.png",

  // Fotos de las fichas de plagas. Viajan con la app a propósito: el momento
  // en que hacen falta —comparar lo que se ve en el campo con una imagen— es
  // justo el peor momento de señal. Son 1,1 MB en total.
  "img/fichas/polilla-col-adulto.webp",
  "img/fichas/polilla-col-detalle.webp",
  "img/fichas/polilla-tomate-dano.webp",
  "img/fichas/polilla-tomate-adulto.webp",
  "img/fichas/polilla-tomate-trampa.webp",
  "img/fichas/mosca-cebolla-larvas.webp",
  "img/fichas/mosca-cebolla-plantin.webp",
  "img/fichas/mosca-cebolla-adulto.webp",
  "img/fichas/pulgones-alados.webp",
  "img/fichas/pulgones-colonia.webp",
  "img/fichas/pulgones-papa.webp",
  "img/fichas/trips-adulto.webp",
  "img/fichas/trips-flor.webp",
  "img/fichas/mosca-blanca-adultos.webp",
  "img/fichas/mosca-blanca-ninfas.webp",
  "img/fichas/aranuela-roja-hembra.webp",
  "img/fichas/aranuela-roja-huevos.webp",
];

self.addEventListener("install", (evento) => {
  // El "cache: reload" obliga a bajar cada archivo del servidor en vez de
  // tomarlo del caché del navegador. Sin eso, al publicar una versión nueva el
  // teléfono puede guardar una mezcla de archivos viejos y nuevos, que es peor
  // que quedarse con la versión vieja entera: la app queda rota.
  const pedidos = ARCHIVOS.map((url) => new Request(url, { cache: "reload" }));

  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(pedidos))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function conPaciencia(pedido) {
  return new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error("la red tardó demasiado")), ESPERA_MS);
    fetch(pedido).then(
      (respuesta) => { clearTimeout(reloj); resolver(respuesta); },
      (error) => { clearTimeout(reloj); rechazar(error); }
    );
  });
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  // Los pedidos al servicio de las planillas van siempre a la red, sin pasar
  // por acá: guardar respuestas de datos en el caché daría información vieja
  // como si fuera actual.
  if (new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    conPaciencia(pedido)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido).then((guardada) => guardada || caches.match("index.html")))
  );
});






