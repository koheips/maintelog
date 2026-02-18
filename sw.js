// メンテログ service worker
// キャッシュ更新対策として version 付きキャッシュ名を使用
const CACHE_PREFIX = "maintelog_cache_";
const CACHE_NAME = CACHE_PREFIX + "maintelog_cache_v4_20260218023801";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME) return caches.delete(k);
          return Promise.resolve(false);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンのみ対象
  if (url.origin !== self.location.origin) return;

  // HTML はネット優先 失敗時キャッシュ
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // それ以外はキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
