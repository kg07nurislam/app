const CACHE_NAME = "kvantoy-app-shell-v1";
const SHELL = ["./", "./index.html", "./css/app.css", "./js/app.js", "./manifest.json", "./assets/icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && event.request.method === "GET") {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    })));
  }
});
self.addEventListener("message", event => {
  if (event.data?.type === "CACHE_POSTS" && Array.isArray(event.data.posts)) {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put("./cached-posts.json", new Response(JSON.stringify(event.data.posts), {headers:{"Content-Type":"application/json"}}))));
  }
});
