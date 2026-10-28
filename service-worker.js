/* Manifest version: AcOEkxZb */
// Published service worker: caches the app for offline use. A new deploy changes service-worker-assets.js, which makes the
// browser install a new worker; it waits until the page asks it to take over (see js/pwa.js).
self.importScripts('./service-worker-assets.js');

const scope = self.registration.scope;
const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html$/, /\.js$/, /\.json$/, /\.css$/, /\.woff2?$/, /\.png$/, /\.svg$/, /\.ico$/, /\.dat$/, /\.webmanifest$/];
const offlineAssetsExclude = [/^service-worker\.js$/, /^data\//];
const assetsByUrl = new Map(self.assetsManifest.assets.map(a => [new URL(a.url, scope).href, a]));

self.addEventListener('install', event => event.waitUntil(onInstall()));
self.addEventListener('activate', event => event.waitUntil(onActivate()));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});

const requestFor = asset => new Request(new URL(asset.url, scope).href, { integrity: asset.hash, cache: 'no-cache' });

async function onInstall() {
    const cache = await caches.open(cacheName);
    const appShell = self.assetsManifest.assets
        .filter(a => offlineAssetsInclude.some(p => p.test(a.url)) && !offlineAssetsExclude.some(p => p.test(a.url)));
    await cache.addAll(appShell.map(requestFor));

    // Game data: the index plus the newest snapshot in English. Other languages and older snapshots are cached on first use.
    const indexAsset = self.assetsManifest.assets.find(a => a.url === 'data/versions.json');
    await cache.add(requestFor(indexAsset));
    const latest = (await (await cache.match(new URL(indexAsset.url, scope).href)).json()).versions[0].id;
    const data = self.assetsManifest.assets.filter(a => a.url === `data/${latest}/gamedata.json` || a.url === `data/${latest}/loc/english.json`);
    await cache.addAll(data.map(requestFor));
}

async function onActivate() {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(cacheNamePrefix) && k !== cacheName).map(k => caches.delete(k)));
}

async function onFetch(event) {
    if (event.request.method !== 'GET') return fetch(event.request);

    // The app is a single page: every navigation (including deep links) gets index.html.
    const url = event.request.mode === 'navigate' ? new URL('index.html', scope).href : event.request.url;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url);
    if (cached) return cached;

    const asset = assetsByUrl.get(url);
    if (!asset) return fetch(event.request);
    const response = await fetch(requestFor(asset));
    if (response.ok) await cache.put(url, response.clone());
    return response;
}
