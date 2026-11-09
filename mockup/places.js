const placeKinds={
 municipal:{label:'Urząd miasta lub gminy',words:'dowod osobisty meldunek gmina miasto urzad akt stanu cywilnego',hint:'W sprawach dowodu osobistego i wielu sprawach gminnych zacznij od urzędu miasta lub gminy.'},
 county:{label:'Starostwo powiatowe',words:'starostwo powiat rejestracja pojazdu samochod prawo jazdy',hint:'Rejestracją pojazdów zajmuje się zwykle starostwo lub urząd miasta na prawach powiatu. Sprawdź właściwy wydział.'},
 tax:{label:'Urząd skarbowy',words:'podatek podatki pit skarbowy',hint:'W sprawach podatkowych wybierz urząd skarbowy i sprawdź jego właściwość.'},
 zus:{label:'ZUS',words:'zus skladki emerytura renta swiadczenia ubezpieczenie',hint:'W sprawach świadczeń i składek możesz zacząć od placówki ZUS.'},
 passport:{label:'Punkt paszportowy',words:'paszport paszportowy',hint:'Paszporty obsługują właściwe punkty paszportowe. Nie wszystkie są oznaczone w danych mapy.'},
 resident:{label:'Obsługa mieszkańców',words:'mieszkancy mieszkaniec obsluga punkt informacja',hint:'Punkty obsługi mieszkańców mogą mieć różny zakres spraw. Potwierdź go przed wizytą.'},
 pharmacy:{label:'Apteka',words:'apteka lek leki recepta',hint:'Wybierz aptekę. Dostępność leku i godziny otwarcia potwierdź bezpośrednio.'},
 primary:{label:'Przychodnia lub POZ',words:'lekarz poz przychodnia lekarz rodzinny zdrowie',hint:'Na mapie mogą być również poradnie specjalistyczne. Potwierdź, czy placówka prowadzi POZ.'},
 hospital:{label:'Szpital',words:'szpital',hint:'Wybierz szpital. W nagłym zagrożeniu życia zadzwoń pod numer 112.'},
 police:{label:'Policja',words:'policja komisariat przestepstwo',hint:'Wybierz jednostkę policji. W nagłym zagrożeniu zadzwoń pod numer 112.'},
 arimr:{label:'ARiMR',words:'arimr rolnik rolnictwo doplaty agencja restrukturyzacji',hint:'W sprawach ARiMR sprawdź, czy wybrana placówka obsługuje Twój teren.'},
 roads:{label:'Drogi wojewódzkie',words:'drogi wojewodzkie zarzad drog wojewodzkich',hint:'Sprawdź właściwy zarząd dróg dla danej drogi i województwa.'},
 atm:{label:'Bankomat',words:'bankomat gotowka wyplata',hint:'Wybierz bankomat. Dostępność urządzenia i ewentualne opłaty potwierdź na miejscu.'}
};
const placesState={center:null,zoom:13,places:[],visible:[],selected:null,controller:null,generation:0,drag:null,drawFrame:0};
const mapPanel=$('#mapPanel'),mapCanvas=$('#placeMap');
let mapReturn=null;
function openMap(){mapReturn=document.activeElement;mapPanel.classList.add('on');syncAccessibility();if(placesState.center)requestAnimationFrame(drawPlaceMap)}
function closeMap(){
 ++placesState.generation;
 if(placesState.controller){placesState.controller.abort();placesState.controller=null;$('#mapStatus').textContent='Wyszukiwanie anulowano.';$('#searchLocation').disabled=false;$('#useLocation').disabled=false}
 stopReading(false);mapPanel.classList.remove('on');syncAccessibility();
 if(mapReturn?.isConnected&&!mapReturn.closest('[inert]'))requestAnimationFrame(()=>mapReturn.focus({preventScroll:true}));
}
$('#openMap').onclick=openMap;
$('#seniorMap').onclick=openMap;
$('#mapBack').onclick=closeMap;

function classifyPlace(tags){
 const name=norm([tags.name,tags['name:pl'],tags.operator,tags.branch].filter(Boolean).join(' '));
 const amenity=tags.amenity||'',health=tags.healthcare||'',office=tags.office||'',government=tags.government||'';
 if(/starostw|powiatow(y|e|ego) (urzad|wydzial)/.test(name))return 'county';
 if(/urzad skarbowy|izba administracji skarbowej/.test(name)||government==='tax'||office==='tax')return 'tax';
 if(/zaklad ubezpieczen spolecznych|\bzus\b/.test(name))return 'zus';
 if(/paszport/.test(name)||government==='passport')return 'passport';
 if(/restrukturyzacji i modernizacji rolnictwa|\barimr\b/.test(name))return 'arimr';
 if(/zarzad drog wojewodzkich|wojewodzki zarzad drog/.test(name))return 'roads';
 if(/obslug[ai] mieszkanc|punkt obslugi mieszkanc|centrum obslugi mieszkanc/.test(name))return 'resident';
 if(amenity==='pharmacy'||health==='pharmacy')return 'pharmacy';
 if(amenity==='hospital'||health==='hospital')return 'hospital';
 if(amenity==='police')return 'police';
 if(amenity==='atm'||tags.atm==='yes')return 'atm';
 if(['doctors','clinic'].includes(amenity)||['doctor','clinic','centre'].includes(health))return 'primary';
 if(amenity==='townhall'||/urzad (miasta|gminy|miasta i gminy)|urzad miejski/.test(name))return 'municipal';
 return null;
}
function placeAddress(tags){
 const street=[tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(' ');
 const locality=[tags['addr:postcode'],tags['addr:city']||tags['addr:place']].filter(Boolean).join(' ');
 if(!street&&!locality)return 'Brak adresu w danych OpenStreetMap';
 return (street?'':'Adres niepełny: ')+[street,locality].filter(Boolean).join(', ');
}
function distanceKm(a,b){
 const radians=value=>value*Math.PI/180,lat=radians(b.lat-a.lat),lon=radians(b.lon-a.lon);
 const h=Math.sin(lat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lon/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
}
function parsePlaces(elements,center){
 const seen=new Set(),found=[];
 for(const element of elements){
  if(!element||!element.tags||!['node','way','relation'].includes(element.type)||!Number.isSafeInteger(element.id)||element.id<=0)continue;
  const point=element.center||element,lat=point.lat,lon=point.lon;
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)continue;
  const kind=classifyPlace(element.tags);if(!kind)continue;
  const id=String(element.type||'')+'/'+String(element.id||'');if(seen.has(id))continue;seen.add(id);
  const name=element.tags['name:pl']||element.tags.name||placeKinds[kind].label+' — brak nazwy w OSM';
  found.push({id,kind,name,lat,lon,tags:element.tags,address:placeAddress(element.tags),distance:distanceKm(center,{lat,lon})});
 }
 placesState.limitHit=found.length>200;
 return found.sort((a,b)=>a.distance-b.distance).slice(0,200);
}
function overpassQuery(lat,lon){
 const around='(around:6000,'+lat.toFixed(6)+','+lon.toFixed(6)+')';
 return '[out:json][timeout:25];('+[
  'nwr["amenity"~"^(townhall|pharmacy|doctors|clinic|hospital|police|atm)$"]'+around+';',
  'nwr["healthcare"~"^(doctor|clinic|centre|hospital|pharmacy)$"]'+around+';',
  'nwr["office"~"^(government|tax)$"]'+around+';',
  'nwr["atm"="yes"]'+around+';',
  'nwr["name"~"starostwo|urząd skarbowy|urząd miasta|urząd gminy|urząd miejski|paszport|ZUS|ubezpieczeń społecznych|ARiMR|restrukturyzacji i modernizacji rolnictwa|zarząd dróg wojewódzkich|obsługi mieszkańców",i]'+around+';'
 ].join('')+');out center;';
}
function beginPlaceRequest(){
 if(placesState.controller)placesState.controller.abort();
 placesState.generation++;
 placesState.controller=new AbortController();
 $('#mapResults').hidden=true;$('#mapStatus').textContent='Szukam miejsc. To może potrwać kilkanaście sekund.';
 $('#searchLocation').disabled=true;$('#useLocation').disabled=true;
 return {generation:placesState.generation,controller:placesState.controller};
}
function finishPlaceRequest(request){
 if(request.generation!==placesState.generation)return;
 placesState.controller=null;$('#searchLocation').disabled=false;$('#useLocation').disabled=false;
}
function placeError(error,request){
 if(request.generation!==placesState.generation)return;
 const message=error.message==='not-found'?'Nie znaleziono tej miejscowości. Sprawdź pisownię lub wpisz pełniejszy adres.':error.message==='rate-limit'?'Usługa map jest chwilowo przeciążona. Odczekaj i spróbuj ponownie.':error.message==='location-denied'?'Nie udało się uzyskać lokalizacji. Sprawdź uprawnienia albo wpisz miejscowość.':'Nie udało się pobrać danych mapy. Sprawdź połączenie i spróbuj ponownie. Nie pokazujemy przykładowych placówek.';
 $('#mapStatus').textContent=message;
}
async function fetchPlaces(center,label,request){
 const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({data:overpassQuery(center.lat,center.lon)}),signal:request.controller.signal});
 if(response.status===429)throw new Error('rate-limit');
 if(!response.ok)throw new Error('overpass');
 const data=await response.json();
 if(!Array.isArray(data.elements))throw new Error('overpass');
 if(request.generation!==placesState.generation)return;
 placesState.center=center;placesState.zoom=13;placesState.places=parsePlaces(data.elements,center);placesState.selected=null;
 $('#searchedLocation').textContent='Wyniki do około 6 km od: '+label+'.';
 $('#mapResults').hidden=false;
 $('#mapStatus').textContent='Pobrano dane OpenStreetMap. Możesz wybrać sprawę lub placówkę.';
 $('#placeTask').value='';$('#placeType').value='';$('#placeFilter').value='';
 $('#taskHint').textContent='Wybór sprawy podpowie rodzaj placówki. Sprawdź zakres obsługi przed wizytą.';
 filterPlaces();requestAnimationFrame(drawPlaceMap);
}
async function searchLocation(){
 const query=$('#placeLocation').value.trim();
 if(!query){$('#mapStatus').textContent='Wpisz miejscowość lub adres, albo użyj lokalizacji urządzenia.';$('#placeLocation').focus();return}
 const request=beginPlaceRequest(),timer=setTimeout(()=>request.controller.abort(),35000);
 try{
  const params=new URLSearchParams({q:query,format:'jsonv2',limit:'1',countrycodes:'pl','accept-language':'pl'});
  const response=await fetch('https://nominatim.openstreetmap.org/search?'+params,{signal:request.controller.signal});
  if(response.status===429)throw new Error('rate-limit');
  if(!response.ok)throw new Error('location');
  const data=await response.json(),first=Array.isArray(data)?data[0]:null;
  const center={lat:Number(first?.lat),lon:Number(first?.lon)};
  if(!first||!Number.isFinite(center.lat)||!Number.isFinite(center.lon)||Math.abs(center.lat)>85||Math.abs(center.lon)>180)throw new Error('not-found');
  await fetchPlaces(center,first.display_name||query,request);
 }catch(error){placeError(error,request)}
 finally{clearTimeout(timer);finishPlaceRequest(request)}
}
function currentLocation(){
 if(!navigator.geolocation){$('#mapStatus').textContent='Lokalizacja nie jest dostępna. Wpisz miejscowość.';return}
 const request=beginPlaceRequest(),timer=setTimeout(()=>request.controller.abort(),35000);
 navigator.geolocation.getCurrentPosition(async position=>{
  try{
   if(request.generation!==placesState.generation)return;
   const center={lat:position.coords.latitude,lon:position.coords.longitude};
   if(!Number.isFinite(center.lat)||!Number.isFinite(center.lon)||Math.abs(center.lat)>85||Math.abs(center.lon)>180)throw new Error('location-denied');
   await fetchPlaces(center,'Twojej przybliżonej lokalizacji',request);
  }catch(error){placeError(error,request)}
  finally{clearTimeout(timer);finishPlaceRequest(request)}
 },()=>{clearTimeout(timer);placeError(new Error('location-denied'),request);finishPlaceRequest(request)},{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
}
$('#changeLocation').onclick=()=>{$('#mapScroll').scrollTo({top:0,behavior:scrollBehavior()});$('#placeLocation').focus({preventScroll:true})};
$('#searchLocation').onclick=searchLocation;
$('#useLocation').onclick=currentLocation;
$('#placeLocation').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchLocation()}});
$('#placeTask').addEventListener('change',event=>{const kind=event.target.value;$('#placeType').value=kind;$('#taskHint').textContent=kind?placeKinds[kind].hint:'Wybór sprawy podpowie rodzaj placówki. Sprawdź zakres obsługi przed wizytą.';filterPlaces()});
$('#placeType').addEventListener('change',event=>{if(event.target.value!==$('#placeTask').value){$('#placeTask').value='';$('#taskHint').textContent='Sprawdź zakres obsługi przed wizytą.'}filterPlaces()});
$('#placeFilter').addEventListener('input',filterPlaces);
function filterPlaces(){
 const type=$('#placeType').value,query=norm($('#placeFilter').value.trim());
 placesState.visible=placesState.places.filter(place=>{
  if(type&&place.kind!==type)return false;
  if(!query)return true;
  return norm(place.name+' '+place.address+' '+placeKinds[place.kind].label+' '+placeKinds[place.kind].words).includes(query);
 });
 if(!placesState.visible.some(place=>place.id===placesState.selected))placesState.selected=null;
 $('#placeCount').textContent=placesState.visible.length+' miejsc'+(placesState.limitHit?' (maks. 200 najbliższych)':'');
 renderPlaceList();if(placesState.center)drawPlaceMap();
}
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element}
function safeWeb(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null}catch(error){return null}}
function addDetail(container,label,value,href){
 const row=node('div',undefined,'place-detail-row'),term=node('dt',label),description=node('dd');
 if(href){const link=node('a',value);link.href=href;if(href.startsWith('http')){link.target='_blank';link.rel='noopener noreferrer'}description.append(link)}else description.textContent=value;
 row.append(term,description);container.append(row);
}
function placeDetails(place){
 const tags=place.tags,details=node('div',undefined,'place-details'),list=node('dl');
 addDetail(list,'Adres',place.address);
 addDetail(list,'Godziny otwarcia',tags.opening_hours?'Zapis w OSM: '+tags.opening_hours:'Brak danych w OpenStreetMap');
 const phone=tags['contact:phone']||tags.phone;
 const phoneLink=phone&&phone.replace(/[^+0-9*#]/g,'');
 addDetail(list,'Telefon',phone||'Brak danych w OpenStreetMap',phoneLink?'tel:'+phoneLink:null);
 const web=tags['contact:website']||tags.website,url=web&&safeWeb(web);
 addDetail(list,'Strona internetowa',web||'Brak danych w OpenStreetMap',url);
 const email=tags['contact:email']||tags.email;
 if(email)addDetail(list,'E-mail',email,/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'mailto:'+encodeURIComponent(email):null);
 const access={yes:'Dostępna według OSM',limited:'Częściowo dostępna według OSM',no:'Niedostępna według OSM',designated:'Dostosowana według OSM'};
 addDetail(list,'Dostępność architektoniczna',access[tags.wheelchair]||'Brak danych w OpenStreetMap');
 if(tags['wheelchair:description'])addDetail(list,'Uwagi o dostępności',tags['wheelchair:description']);
 if(tags.opening_hours&&/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/.test(tags.opening_hours))list.append(node('p','Skróty dni: Mo – pon., Tu – wt., We – śr., Th – czw., Fr – pt., Sa – sob., Su – niedz.','place-detail-note'));
 details.append(list,node('p','Godziny, kontakt i dostępność mogą być nieaktualne. Potwierdź je przed wizytą.','place-detail-note'));
 const actions=node('div',undefined,'place-actions'),route=node('a','Wyznacz dojazd','assist-button primary'),show=node('button','Pokaż na mapie','assist-button secondary');
 route.href='https://www.openstreetmap.org/directions?to='+encodeURIComponent(place.lat+','+place.lon);route.target='_blank';route.rel='noopener noreferrer';
 show.type='button';show.onclick=()=>{placesState.center={lat:place.lat,lon:place.lon};drawPlaceMap();mapCanvas.scrollIntoView({block:'center',behavior:'auto'});mapCanvas.focus({preventScroll:true})};
 actions.append(route,show);details.append(actions);return details;
}
function selectPlace(id,scroll){
 placesState.selected=placesState.selected===id&&!scroll?null:id;
 renderPlaceList();drawPlaceMap();
 if(scroll){const target=[...$('#placeList').querySelectorAll('[data-place-id]')].find(item=>item.dataset.placeId===id);target?.scrollIntoView({block:'nearest',behavior:'auto'});target?.focus({preventScroll:true})}
}
function renderPlaceList(){
 const list=$('#placeList');list.replaceChildren();
 if(!placesState.visible.length){list.append(node('p','Nie znaleziono pasujących miejsc w danych OpenStreetMap. Zmień filtr, spróbuj innej miejscowości lub sprawdź w urzędzie.','no-places'));return}
 placesState.visible.forEach((place,index)=>{
  const card=node('article',undefined,'place-card'),button=node('button',undefined,'place-summary');
  button.type='button';button.dataset.placeId=place.id;button.setAttribute('aria-expanded',String(place.id===placesState.selected));
  const number=node('span',String(index+1),'place-number'),copy=node('span',undefined,'place-copy'),name=node('strong',place.name),kind=node('small',placeKinds[place.kind].label+' · ok. '+place.distance.toLocaleString('pl-PL',{maximumFractionDigits:1})+' km w linii prostej'),address=node('small',place.address),arrow=node('span','›','feature-arrow');
  arrow.setAttribute('aria-hidden','true');copy.append(name,kind,address);button.append(number,copy,arrow);button.onclick=()=>selectPlace(place.id,false);card.append(button);
  if(place.id===placesState.selected)card.append(placeDetails(place));
  list.append(card);
 });
}
function project(point,zoom){
 const size=256*2**zoom,lat=Math.max(-85,Math.min(85,point.lat))*Math.PI/180;
 return {x:(point.lon+180)/360*size,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*size};
}
function unproject(x,y,zoom){
 const size=256*2**zoom,wrapped=((x%size)+size)%size,clamped=Math.max(0,Math.min(size,y));
 return {lon:wrapped/size*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*clamped/size)))*180/Math.PI};
}
function drawPlaceMap(){
 if(!placesState.center||$('#mapResults').hidden)return;
 const width=mapCanvas.clientWidth,height=mapCanvas.clientHeight;if(!width||!height)return;
 const zoom=placesState.zoom,size=2**zoom,center=project(placesState.center,zoom),left=center.x-width/2,top=center.y-height/2;
 const tiles=$('#mapTiles'),markers=$('#mapMarkers');tiles.replaceChildren();markers.replaceChildren();$('#mapTileStatus').textContent='';
 for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++)for(let y=Math.floor(top/256);y<=Math.floor((top+height)/256);y++){
  if(y<0||y>=size)continue;
  const image=document.createElement('img'),tileX=((x%size)+size)%size;
  image.alt='';image.draggable=false;image.style.left=(x*256-left)+'px';image.style.top=(y*256-top)+'px';
  image.onerror=()=>{image.remove();$('#mapTileStatus').textContent='Nie udało się pobrać części mapy. Nadal możesz korzystać z listy miejsc.'};
  image.src='https://tile.openstreetmap.org/'+zoom+'/'+tileX+'/'+y+'.png';tiles.append(image);
 }
 placesState.visible.forEach((place,index)=>{
  const point=project(place,zoom);let x=point.x-left,y=point.y-top;const world=256*size;
  if(x<-world/2)x+=world;if(x>world/2)x-=world;
  if(x<-20||x>width+20||y<-20||y>height+20)return;
  const marker=node('button',String(index+1),'map-marker'+(place.id===placesState.selected?' selected':''));
  marker.type='button';marker.style.left=x+'px';marker.style.top=y+'px';marker.setAttribute('aria-label','Pokaż szczegóły: '+place.name);marker.onclick=()=>selectPlace(place.id,true);markers.append(marker);
 });
 $('#mapZoomIn').disabled=zoom>=18;$('#mapZoomOut').disabled=zoom<=5;
}
function zoomPlaceMap(change){placesState.zoom=Math.max(5,Math.min(18,placesState.zoom+change));drawPlaceMap()}
$('#mapZoomIn').onclick=()=>zoomPlaceMap(1);
$('#mapZoomOut').onclick=()=>zoomPlaceMap(-1);
mapCanvas.addEventListener('keydown',event=>{
 if(event.target!==mapCanvas)return;
 const keys={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]};
 if(keys[event.key]){event.preventDefault();const center=project(placesState.center,placesState.zoom),offset=keys[event.key];placesState.center=unproject(center.x+offset[0],center.y+offset[1],placesState.zoom);drawPlaceMap()}
 else if(event.key==='+'||event.key==='='){event.preventDefault();zoomPlaceMap(1)}
 else if(event.key==='-'){event.preventDefault();zoomPlaceMap(-1)}
});
mapCanvas.addEventListener('pointerdown',event=>{
 if(event.target.closest('button')||!placesState.center)return;
 placesState.drag={x:event.clientX,y:event.clientY,center:project(placesState.center,placesState.zoom)};
 mapCanvas.setPointerCapture(event.pointerId);
});
mapCanvas.addEventListener('pointermove',event=>{
 const drag=placesState.drag;if(!drag)return;
 placesState.center=unproject(drag.center.x-(event.clientX-drag.x),drag.center.y-(event.clientY-drag.y),placesState.zoom);
 if(!placesState.drawFrame)placesState.drawFrame=requestAnimationFrame(()=>{placesState.drawFrame=0;drawPlaceMap()});
});
function endMapDrag(){placesState.drag=null}
mapCanvas.addEventListener('pointerup',endMapDrag);mapCanvas.addEventListener('pointercancel',endMapDrag);
if(window.ResizeObserver)new ResizeObserver(()=>{if(mapPanel.classList.contains('on')&&placesState.center)drawPlaceMap()}).observe(mapCanvas);
