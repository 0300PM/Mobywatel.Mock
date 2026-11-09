const PREFERENCE_KEY='mobywatels.accessibility.v1';
const normalDefaults={font:'standard',contrast:false,simple:false,motion:false,reading:false};
const seniorDefaults={font:'large',contrast:false,simple:true,motion:true,reading:false};
function cleanPreferences(value,defaults){
 const source=value&&typeof value==='object'?value:{};
 return {font:['standard','large','extra'].includes(source.font)?source.font:defaults.font,contrast:typeof source.contrast==='boolean'?source.contrast:defaults.contrast,simple:typeof source.simple==='boolean'?source.simple:defaults.simple,motion:typeof source.motion==='boolean'?source.motion:defaults.motion,reading:typeof source.reading==='boolean'?source.reading:defaults.reading};
}
function loadPreferences(){
 try{
  const saved=JSON.parse(localStorage.getItem(PREFERENCE_KEY)||'null')||{};
  return {senior:saved.senior===true,normal:cleanPreferences(saved.normal,normalDefaults),seniorSettings:cleanPreferences(saved.seniorSettings,seniorDefaults)};
 }catch(error){return {senior:false,normal:{...normalDefaults},seniorSettings:{...seniorDefaults}}}
}
let preferences=loadPreferences(),accessFromHelp=false,accessHelpReturn=null;
function currentPreferences(){return preferences.senior?preferences.seniorSettings:preferences.normal}
function savePreferences(){
 try{localStorage.setItem(PREFERENCE_KEY,JSON.stringify(preferences));$('#preferenceStatus').textContent='Ustawienia zapisano na tym urządzeniu.'}
 catch(error){$('#preferenceStatus').textContent='Nie udało się zapisać ustawień. Będą działać do zamknięcia strony.'}
}
function applyPreferences(){
 const settings=currentPreferences();
 app.dataset.font=settings.font;
 app.classList.toggle('access-contrast',settings.contrast);
 app.classList.toggle('simple-menu',settings.simple);
 app.classList.toggle('reduce-motion',settings.motion);
 app.classList.toggle('reading-enabled',settings.reading);
 app.classList.toggle('senior-profile',preferences.senior);
 const concise=settings.font!=='standard'||settings.simple;
 if(!window.LANG||window.LANG==='pl'){
  input.placeholder=concise?'Wpisz pytanie':'Co chcesz załatwić?';
  $('.composer-label').textContent=concise?'Napisz pytanie':'Wpisz, czego potrzebujesz';
  $('#showSuggestions').textContent=concise?'Propozycje':'Pokaż propozycje';
 }
 ['homeSenior','panelSenior'].forEach(id=>$('#'+id).checked=preferences.senior);
 ['homeSeniorState','panelSeniorState'].forEach(id=>$('#'+id).textContent=preferences.senior?'Włączone':'Wyłączone');
 document.querySelectorAll('input[name="accessFont"]').forEach(input=>input.checked=input.value===settings.font);
 $('#highContrast').checked=settings.contrast;
 $('#simpleMenu').checked=settings.simple;
 $('#reduceMotion').checked=settings.motion;
 $('#readingEnabled').checked=settings.reading;
 if(!settings.reading&&typeof stopReading==='function')stopReading(false);
 requestAnimationFrame(layout);
}
function changeProfile(enabled){preferences.senior=enabled;applyPreferences();savePreferences();announce(enabled?'Profil Dla seniora włączony.':'Profil Dla seniora wyłączony. Przywrócono wcześniejsze ustawienia.')}
['homeSenior','panelSenior'].forEach(id=>$('#'+id).addEventListener('change',event=>changeProfile(event.target.checked)));
document.querySelectorAll('input[name="accessFont"]').forEach(input=>input.addEventListener('change',()=>{currentPreferences().font=input.value;applyPreferences();savePreferences()}));
[['highContrast','contrast'],['simpleMenu','simple'],['reduceMotion','motion'],['readingEnabled','reading']].forEach(([id,key])=>$('#'+id).addEventListener('change',event=>{currentPreferences()[key]=event.target.checked;applyPreferences();savePreferences()}));
window.addEventListener('storage',event=>{if(event.key===PREFERENCE_KEY){preferences=loadPreferences();applyPreferences()}});

function openAccess(fromHelp=false){
 accessFromHelp=fromHelp;
 $('#accessScroll').scrollTop=0;
 $('#accessPanel').classList.add('on');
 syncAccessibility();
}
function closeAccess(){
 stopReading(false);
 $('#accessPanel').classList.remove('on');
 if(accessFromHelp){accessFromHelp=false;const previous=accessHelpReturn;accessHelpReturn=null;openHelp();helpReturn=previous;requestAnimationFrame(()=>$('#helpAccess').focus());return}
 syncAccessibility();
}
$('#openAccess').onclick=()=>openAccess();
$('#accessBack').onclick=closeAccess;
$('#helpAccess').onclick=()=>{accessHelpReturn=helpReturn;closeHelp(false);openAccess(true)};
$('#seniorDocuments').onclick=()=>{const home=$('#homeContent');home.scrollTo({top:$('#stackwrap').offsetTop,behavior:scrollBehavior()});requestAnimationFrame(()=>{const target=VARIANT==='stos'?$('#stack .card-open'):$('#alt button');target?.focus({preventScroll:true})})};
$('#seniorAssistant').onclick=()=>{enterChat();requestAnimationFrame(()=>input.focus())};
$('#seniorReminders').onclick=()=>{const home=$('#homeContent');home.scrollTo({top:$('#reminders').offsetTop,behavior:scrollBehavior()});requestAnimationFrame(()=>$('#exampleReminder').focus({preventScroll:true}))};
$('#seniorHelp').onclick=()=>openHelp();

const screenInstructions={
 home:'Na ekranie głównym wybierz dokument, mapę placówek lub pomoc. Możesz także wpisać albo podyktować pytanie do asystenta. Dokumenty są przykładowe.',
 access:'Włącz profil Dla seniora albo dostosuj osobno wielkość tekstu, kontrast, menu, animacje i przyciski odczytu. Zmiany są zapisywane na tym urządzeniu.',
 map:'Wpisz miejscowość lub użyj swojej lokalizacji. Wybierz Pokaż miejsca. Następnie wybierz sprawę lub rodzaj placówki i otwórz szczegóły z listy. Informacje z mapy mogą być niepełne, sprawdź je przed wizytą.',
 document:'To przykładowy dokument. Wybierz szczegóły, aby zobaczyć dane w pokazie, lub wróć do ekranu głównego. Nie sprawdzono rejestrów ani tożsamości.'
};
app.addEventListener('click',event=>{
 const control=event.target.closest('.reading-control');
 if(!control)return;
 if(event.target.closest('[data-stop]')){stopReading();return}
 if(!event.target.closest('[data-read]'))return;
 const view=control.dataset.reading;
 if(view==='chat'){
  const answer=[...VIS.el.querySelectorAll('.msg.bot')].pop();
  if(!answer){control.querySelector('.speech-status').textContent='Nie ma jeszcze odpowiedzi do odczytania.';return}
  readText(answer.textContent);
 }else if(screenInstructions[view])readText(screenInstructions[view]);
});
applyPreferences();
