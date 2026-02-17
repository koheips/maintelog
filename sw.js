/* メンテログ sw v3
  最低限のオフライン起動
  キャッシュ名に版を含め 更新で旧キャッシュを破棄
*/

const CACHE_VERSION = "maintelog_cache_2026-02-17_v3fix";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_VERSION ? Promise.resolve() : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);

      // HTML は更新を優先
      const isHTML = req.headers.get("accept")?.includes("text/html") || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
      if (isHTML) {
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || caches.match("./index.html");
        }
      }

      // それ以外は キャッシュ優先 + 背景更新
      if (cached) {
        event.waitUntil(
          (async () => {
            try {
              const fresh = await fetch(req);
              cache.put(req, fresh.clone());
            } catch {
              // ignore
            }
          })()
        );
        return cached;
      }

      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached;
      }
    })()
  );
});
