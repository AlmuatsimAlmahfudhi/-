// عامل خدمة بسيط: يخزن الصفحات والملفات الثابتة لتعمل الواجهة دون إنترنت
const CACHE = "alsun-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // واجهات API: الشبكة أولاً (البيانات حية)، عدا ملفات النطق فهي ثابتة
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/ai/tts")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  );
});
