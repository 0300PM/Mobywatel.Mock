const CACHE_NAME='mobywatels-safety-shell-v1';
const SHELL=[
 '/',
 '/aplikacja',
 '/index.html',
 '/style.css?v=26',
 '/modules.css?v=2',
 '/safety.css?v=1',
 '/tailwind.generated.css?v=1',
 '/safety-guides.json',
 '/i18n.js?v=6',
 '/osoby.js?v=21',
 '/sylwetki.js?v=19',
 '/core.js?v=22',
 '/variants.js?v=21',
 '/scenarios.js?v=23',
 '/agent.js?v=28',
 '/znak-kod.js?v=19',
 '/znak.js?v=23',
 '/accessibility.js?v=2',
 '/preferences.js?v=1',
 '/places.js?v=1',
 '/lmstudio.js?v=1',
 '/modules.js?v=1',
 '/safety.js?v=1',
 '/assets/icon-mobywatel.svg',
 '/assets/card-kdr.png',
 '/assets/card-legitymacja.png',
 '/assets/card-mdowod.png',
 '/assets/card-pojazdy.png',
 '/assets/card-prawo-jazdy.png',
 '/assets/foto-ewa.jpg',
 '/assets/foto-jan.jpg',
 '/assets/foto-kacper.jpg',
 '/assets/foto-marta.jpg'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mobywatels-safety-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/v1/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request,{ignoreSearch:true}).then(cached=>cached||caches.match('/aplikacja'))));
  return;
 }
 event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response})));
});
