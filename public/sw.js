/*
 * Service worker do Jokenpô.
 * - Página (navegação): rede primeiro, com a última versão em cache como reserva offline.
 * - Demais arquivos do próprio site (JS, CSS, ícones): cache primeiro. Os nomes dos arquivos
 *   do build mudam a cada versão (hash), então o cache nunca serve código velho por engano.
 * - Firebase e outros domínios: não passam por aqui (o jogo online precisa de rede de qualquer jeito).
 * Com isso, depois da primeira visita, o modo contra o computador funciona sem internet.
 */

const CACHE = 'jokenpo-v3';

/*
 * `ignoreVary`: o JS e o CSS do build são pedidos com `crossorigin`, o que envia o cabeçalho Origin.
 * Se o servidor responder com `Vary: Origin`, o cache só devolveria a resposta para o mesmo Origin
 * da pré-carga (que não tem Origin), e a página não abriria offline. Para arquivos estáticos do
 * próprio site, a resposta é a mesma para qualquer Origin.
 */
const MATCH = { ignoreVary: true };

const SHELL = ['./', './manifest.webmanifest', './icons/favicon.svg', './icons/favicon-32.png', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

/** Guarda a página e os arquivos que ela referencia (JS e CSS com hash), para já funcionar offline. */
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const page = await cache.match('./', MATCH);
  const html = page ? await page.text() : '';
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map(([, url]) => url);
  await cache.addAll(assets);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./', MATCH)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
