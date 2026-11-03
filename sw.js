/* Kompendium Lektora jako aplikacja: najpierw sieć, a bez internetu ostatnio zapisana wersja.
   Dzięki temu każda poprawka wgrana do repozytorium jest widoczna od razu, gdy jest zasięg. */
var CACHE = "kompendium-v1";
var START = [
  "./", "index.html", "vademecum.html", "manual.html", "skill-sety.html", "teacher-planner-2026-27.html",
  "formularz-obserwacji.html", "podsumowanie-nauki.html", "do-druku/vademecum-do-podpisu.html",
  "assets/style.css", "assets/print.css", "assets/kompendium.js", "manifest.webmanifest",
  "assets/ikony/icon-192.png", "assets/ikony/apple-touch-icon.png", "assets/ikony/favicon-32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(START.map(function (u) { return c.add(new Request(u, { credentials: "include" })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    // zapisujemy tylko zwykłe odpowiedzi strony; przekierowania na logowanie Cloudflare Access omijamy
    if (res.ok && res.type === "basic" && !res.redirected) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
    });
  }));
});
