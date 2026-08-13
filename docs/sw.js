// ==========================================================================
// BioSalud ECOMARCAL — service worker
//
// Guarda la app entera en el teléfono la primera vez que se abre con señal.
// Después arranca y funciona completa en el campo, sin conexión.
//
// IMPORTANTE: cada vez que se cambia un archivo de esta lista hay que subir el
// número de CACHE. Si no, los celulares siguen usando la versión vieja.
// ==========================================================================

const CACHE = "biosalud-v4";

const ARCHIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/estilos.css",
  "js/util.js",
  "js/db.js",
  "js/config.js",
  "js/app.js",
  "img/logo-ifab.png",
  "img/logo-ecomarcal.jpg",
  "img/icono-192.png",
  "img/icono-512.png",
];

self.addEventListener("install", (evento) => {
  // El "cache: reload" es importante: obliga a bajar cada archivo del servidor
  // en vez de tomarlo del caché del navegador. Sin eso, al publicar una versión
  // nueva el teléfono puede guardar una mezcla de archivos viejos y nuevos, que
  // es peor que quedarse con la versión vieja entera: la app queda rota.
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

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  // Al abrir la app: siempre la pantalla guardada, haya señal o no.
  if (pedido.mode === "navigate") {
    evento.respondWith(
      caches.match("index.html").then((guardada) => guardada || fetch(pedido))
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido).then((guardada) => {
      if (guardada) return guardada;
      return fetch(pedido).then((respuesta) => {
        // Solo se guarda lo propio de la app; nada de terceros.
        if (respuesta.ok && pedido.url.startsWith(self.registration.scope)) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return respuesta;
      });
    })
  );
});
