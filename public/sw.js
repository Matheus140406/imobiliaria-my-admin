// Service worker enxuto, só para viabilizar o Background Sync do cadastro
// offline de imóveis. Sem Workbox, sem cache de assets — fora de escopo
// para o admin. Quando o Background Sync não está disponível (ex: Safari
// /iOS), a sincronização acontece de outra forma: um listener de "online"
// na própria página (ver src/components/SincronizadorOffline.tsx).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Não interceptamos nenhum request: este service worker existe apenas para
// registrar o Background Sync, não para funcionar como cache/proxy.
self.addEventListener("fetch", () => {});

self.addEventListener("sync", (event) => {
  if (event.tag !== "sync-imoveis-pendentes") return;

  event.waitUntil(avisarClientesParaSincronizar());
});

async function avisarClientesParaSincronizar() {
  const clientList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  for (const client of clientList) {
    client.postMessage({ type: "sync-imoveis-pendentes" });
  }
}
