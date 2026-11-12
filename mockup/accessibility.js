const helpPanel=$('#helpPanel');
const helpScroll=$('#helpScroll');
const voiceDraft=$('#voiceDraft');
let helpView='main',helpReturn=null,modalLayer=null,skipModalRestore=false;
const modalReturn=new Map();

function setHelpView(view='main'){
 helpView=view;
 if(view==='reminder'){
  const documentData=DOCS.find(d=>d.id==='dowod');
  $('#exampleDate').textContent=(documentData?.f.find(([key])=>key==='Dowód ważny do')||[])[1]||'Brak przykładowej daty';
 }
 ['main','trusted','safety','reminder'].forEach(name=>{
  const node=name==='main'?$('#helpMain'):$('#'+name+'Screen');
  node.hidden=name!==view;
 });
 helpScroll.scrollTop=0;
 if(helpPanel.classList.contains('on'))requestAnimationFrame(()=>(view==='main'?$('#helpBack'):$('#'+view+'Title')).focus({preventScroll:true}));
}
function openHelp(view='main'){
 if(!helpPanel.classList.contains('on')){
  helpReturn=document.activeElement;
  voiceDraft.value=input.value;
 }
 const chosen=['trusted','safety','reminder'].includes(view)?view:'main';
 setHelpView(chosen);
 helpPanel.classList.add('on');
 syncAccessibility();
 requestAnimationFrame(()=>{
  if(view==='voice'){$('#dictate').focus();return}
  if(chosen==='main')$('#helpBack').focus();
  else $('#'+chosen+'Title').focus();
 });
}
function closeHelp(restore=true){
 cancelDictation();
 stopReading(false);
 skipModalRestore=!restore;
 helpPanel.classList.remove('on');
 syncAccessibility();
 if(restore&&helpReturn?.isConnected&&!helpReturn.closest('[inert]'))requestAnimationFrame(()=>helpReturn.focus({preventScroll:true}));
}
function helpBack(){if(helpView!=='main'){setHelpView('main');requestAnimationFrame(()=>$('#helpBack').focus());return}closeHelp()}
$('#helpBack').onclick=helpBack;
$('#trustedHelp').onclick=()=>setHelpView('trusted');
$('#safetyHelp').onclick=()=>setHelpView('safety');
$('#trustedBack').onclick=()=>setHelpView('main');
$('#safetyBack').onclick=()=>setHelpView('main');
$('#chatHelp').onclick=()=>openHelp();
$('#chatNotice').onclick=()=>openHelp('safety');
$('#chatBack').onclick=goBack;
$('#showSuggestions').onclick=()=>{enterChat();requestAnimationFrame(()=>(VIS.el.querySelector('.sugg button')||input).focus())};
$('#menuBack').onclick=closeMenu;
$('#historyBack').onclick=closeHist;
$('#openExampleDocument').onclick=()=>{closeHelp(false);openDoc('dowod');detailReturn=()=>{openHelp('reminder');helpReturn=$('#exampleReminder')}};
voiceDraft.addEventListener('input',()=>{input.value=voiceDraft.value});
$('#useDraft').onclick=()=>{input.value=voiceDraft.value;closeHelp(false);enterChat();requestAnimationFrame(()=>input.focus())};
$('#sendDraft').onclick=()=>{
 const text=voiceDraft.value.trim();
 if(!text){$('#dictationStatus').textContent='Najpierw podyktuj lub wpisz wiadomość.';voiceDraft.focus();return}
 input.value=text;closeHelp(false);enterChat();$('#composer').requestSubmit();
};

const caseList=[
 {label:'Dowód osobisty — termin ważności',words:'dowod dokument waznosc termin',run:()=>setHelpView('reminder')},
 {label:'Potrzebuję pomocy bliskiej osoby',words:'pomoc bliska osoba zaufana pelnomocnictwo',run:()=>setHelpView('trusted')},
 {label:'Czy to bezpieczne?',words:'bezpieczenstwo oszustwo sms haslo kod',run:()=>setHelpView('safety')},
 {label:'Zgubiony portfel',words:'zgubilam zgubilem dokumenty portfel',topic:rodz('Zgubiłam portfel','Zgubiłem portfel')},
 {label:'Zastrzeżenie numeru PESEL',words:'zastrzec pesel',topic:'Zastrzeż mój PESEL'},
 {label:'Przykładowe sprawy i terminy',words:'przypomnienia sprawy termin wizyta',topic:'Co mam do załatwienia?'},
 {label:'Wniosek o dowód osobisty',words:'wniosek nowy dowod',topic:'Mój dowód traci ważność'},
 {label:'Słowniczek urzędowy',words:'slowniczek definicja wniosek pelnomocnictwo termin waznosci',run:()=>{setHelpView('main');requestAnimationFrame(()=>{$('#glossaryHeading').focus();$('#glossaryHeading').scrollIntoView({block:'nearest'})})}}
];
function renderSearch(){
 const query=norm($('#caseSearch').value.trim());
 const items=caseList.filter(item=>!query||norm(item.label+' '+item.words).includes(query));
 const results=$('#searchResults');results.replaceChildren();
 items.forEach(item=>{
  const button=document.createElement('button');button.type='button';
  const label=document.createElement('span');label.textContent=item.label;
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='›';
  button.append(label,arrow);
  button.onclick=()=>{if(item.run){item.run();return}closeHelp(false);startTopic(item.topic)};
  results.append(button);
 });
 $('#searchStatus').textContent=items.length?'Znaleziono spraw: '+items.length+'.':'Nie znaleziono sprawy. Spróbuj innych słów lub wpisz pytanie do asystenta.';
}
$('#caseSearch').addEventListener('input',renderSearch);
renderSearch();

let healthPromise=null;
function voiceHealth(){
 if(!healthPromise)healthPromise=fetch('/api/health',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})).finally(()=>{healthPromise=null});
 return healthPromise;
}
const DICTATION_MAX_MS=60000,DICTATION_MAX_BYTES=4*1024*1024,DICTATION_MAX_TRIES=2;
const dictation={phase:'idle',generation:0,recorder:null,stream:null,recognition:null,request:null,timer:null,tries:0};
function stopDictationTimer(){if(dictation.timer){clearTimeout(dictation.timer);dictation.timer=null}}
function finishRecording(){if(dictation.recorder?.state==='recording')dictation.recorder.stop();else if(dictation.recognition)dictation.recognition.stop()}
function startDictationTimer(){stopDictationTimer();dictation.timer=setTimeout(()=>{if(dictation.phase!=='recording')return;finishRecording()},DICTATION_MAX_MS)}
function dictationState(phase,message){
 dictation.phase=phase;
 if(phase!=='recording')stopDictationTimer();
 const button=$('#dictate');
 button.textContent=phase==='recording'?'Zakończ nagrywanie':phase==='processing'?'Rozpoznaję…':phase==='requesting'?'Uruchamiam mikrofon…':'Powiedz, czego potrzebujesz';
 button.disabled=phase==='requesting'||phase==='processing';
 $('#cancelDictation').hidden=phase==='idle';
 if(message!==undefined)$('#dictationStatus').textContent=message;
}
function appendDictation(text){
 const value=text.trim();
 if(!value){dictationState('idle','Nie udało się rozpoznać wypowiedzi. Spróbuj ponownie albo wpisz wiadomość.');return}
 voiceDraft.value=[voiceDraft.value.trim(),value].filter(Boolean).join(' ');
 input.value=voiceDraft.value;
 dictationState('idle','Sprawdź i popraw rozpoznany tekst. Nie został wysłany.');
 voiceDraft.focus();
}
function releaseStream(){if(dictation.stream){dictation.stream.getTracks().forEach(track=>track.stop());dictation.stream=null}}
function cancelDictation(){
 stopDictationTimer();
 ++dictation.generation;
 if(dictation.request)dictation.request.abort();
 dictation.request=null;
 if(dictation.recognition){try{dictation.recognition.abort()}catch(e){}dictation.recognition=null}
 if(dictation.recorder&&dictation.recorder.state!=='inactive'){try{dictation.recorder.stop()}catch(e){}}
 dictation.recorder=null;releaseStream();
 dictationState('idle','Nagrywanie anulowane. Możesz wpisać wiadomość.');
}
function microphoneError(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return 'Brak zgody na mikrofon. Zezwól na dostęp w ustawieniach przeglądarki albo wpisz wiadomość.';
 if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'Nie znaleziono mikrofonu. Podłącz urządzenie albo wpisz wiadomość.';
 if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return 'Mikrofon jest zajęty przez inną aplikację. Zwolnij go albo wpisz wiadomość.';
 return 'Mikrofon nie jest dostępny w tej przeglądarce. Wpisz wiadomość ręcznie.';
}
async function recordOnServer(generation){
 if(!window.isSecureContext){dictationState('idle','Mikrofon działa tylko przez HTTPS albo na localhost. Wpisz wiadomość ręcznie.');return}
 let stream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}
 catch(e){if(generation===dictation.generation)dictationState('idle',microphoneError(e));return}
 if(generation!==dictation.generation){stream.getTracks().forEach(track=>track.stop());return}
 dictation.stream=stream;
 let recorder;
 try{recorder=new MediaRecorder(stream)}
 catch(e){releaseStream();dictationState('idle','Nagrywanie nie jest dostępne. Wpisz wiadomość ręcznie.');return}
 const chunks=[];dictation.recorder=recorder;
 recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
 recorder.onerror=()=>{if(generation!==dictation.generation)return;releaseStream();dictation.recorder=null;dictationState('idle','Nagrywanie nie powiodło się. Spróbuj ponownie albo wpisz wiadomość.')};
 recorder.onstop=async()=>{
  releaseStream();dictation.recorder=null;
  if(generation!==dictation.generation)return;
  if(!chunks.length){dictationState('idle','Nie zapisano dźwięku. Spróbuj ponownie albo wpisz wiadomość.');return}
  dictationState('processing','Rozpoznaję nagranie. Poczekaj na tekst do sprawdzenia.');
  const blob=new Blob(chunks,{type:(recorder.mimeType||'audio/webm').split(';')[0]});
  if(blob.size>DICTATION_MAX_BYTES){dictationState('idle','Nagranie jest za duże. Nagraj krótszą wypowiedź albo wpisz wiadomość.');return}
  const controller=new AbortController();dictation.request=controller;dictation.tries=0;
  try{
   for(dictation.tries=1;dictation.tries<=DICTATION_MAX_TRIES;dictation.tries++){
    const response=await fetch('/api/stt?lang=pl',{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:controller.signal});
    const result=await response.json().catch(()=>({}));
    if(response.ok){
     if(generation===dictation.generation)appendDictation(result.text||'');
     return;
    }
    if(response.status<500&&response.status!==429)throw new Error('stt');
    if(dictation.tries<DICTATION_MAX_TRIES)dictationState('processing','Rozpoznawanie mowy nie odpowiedziało. Ponawiam raz.');
   }
   throw new Error('stt');
  }catch(e){
   if(generation===dictation.generation&&e.name!=='AbortError')dictationState('idle','Nie udało się rozpoznać nagrania. Spróbuj ponownie albo wpisz wiadomość.');
  }
  finally{if(dictation.request===controller)dictation.request=null}
 };
 try{recorder.start();dictationState('recording','Mikrofon nagrywa. Gdy skończysz, wybierz „Zakończ nagrywanie”. Nagranie zatrzyma się po minucie.');startDictationTimer()}
 catch(e){releaseStream();dictation.recorder=null;dictationState('idle','Nagrywanie nie jest dostępne. Wpisz wiadomość ręcznie.')}
}
function recordInBrowser(generation,Recognition){
 let heard='';
 const recognition=new Recognition();dictation.recognition=recognition;
 recognition.lang='pl-PL';recognition.continuous=false;recognition.interimResults=false;
 recognition.onresult=event=>{heard=Array.from(event.results).filter(result=>result.isFinal).map(result=>result[0].transcript).join(' ')};
 recognition.onerror=event=>{if(generation!==dictation.generation)return;dictation.recognition=null;dictationState('idle',event?.error==='not-allowed'||event?.error==='service-not-allowed'?'Brak zgody na mikrofon. Zezwól na dostęp w ustawieniach przeglądarki albo wpisz wiadomość.':'Nie udało się rozpoznać mowy. Spróbuj ponownie albo wpisz wiadomość.')};
 recognition.onend=()=>{if(generation!==dictation.generation||dictation.recognition!==recognition)return;dictation.recognition=null;appendDictation(heard)};
 try{recognition.start();dictationState('recording','Mikrofon słucha. Gdy skończysz, wybierz „Zakończ nagrywanie”. Nagranie zatrzyma się po minucie.');startDictationTimer()}
 catch(e){dictation.recognition=null;dictationState('idle','Rozpoznawanie mowy nie jest dostępne. Wpisz wiadomość ręcznie.')}
}
async function startDictation(){
 if(dictation.phase==='recording'){
  if(dictation.recorder?.state==='recording')dictation.recorder.stop();
  else if(dictation.recognition){dictationState('processing','Rozpoznaję wypowiedź.');dictation.recognition.stop()}
  else dictationState('idle','Nagrywanie już się zakończyło. Sprawdź tekst w polu wiadomości albo wpisz ją ręcznie.');
  return;
 }
 if(dictation.phase!=='idle')return;
 const generation=++dictation.generation;
 dictationState('requesting','Sprawdzam dostępność rozpoznawania mowy.');
 const health=await voiceHealth();
 if(generation!==dictation.generation)return;
 if(health.stt&&navigator.mediaDevices?.getUserMedia&&window.MediaRecorder){await recordOnServer(generation);return}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(Recognition){recordInBrowser(generation,Recognition);return}
 dictationState('idle','Rozpoznawanie mowy jest niedostępne w tej przeglądarce lub konfiguracji. Wpisz wiadomość ręcznie.');
}
$('#dictate').onclick=startDictation;
$('#cancelDictation').onclick=cancelDictation;

const instructions='To nieoficjalny prototyp z fikcyjnymi danymi. Na ekranie głównym wybierz dokument albo przykładowe przypomnienie. Możesz też wpisać wiadomość do asystenta. Jeśli używasz głosu, sprawdź i popraw rozpoznany tekst przed wysłaniem. Przed potwierdzeniem przeczytaj podsumowanie. Aktualne informacje i skutki czynności sprawdź w urzędzie lub na gov.pl. Nie podawaj nikomu haseł ani kodów.';
let readToken=0,lastReading='',readingAudio=null,readingRequest=null;
function readingState(active,message){
 $('#stopReading').disabled=!active;
 $('#replayReading').disabled=!lastReading;
 if(message!==undefined){$('#readingStatus').textContent=message;document.querySelectorAll('.speech-status').forEach(node=>node.textContent=message)}
}
function stopReading(report=true){
 ++readToken;
 if(readingRequest)readingRequest.abort();
 readingRequest=null;
 if(readingAudio){readingAudio.pause();if(readingAudio.src.startsWith('blob:'))URL.revokeObjectURL(readingAudio.src);readingAudio=null}
 try{window.speechSynthesis?.cancel()}catch(e){}
 readingState(false,report?'Odczyt zatrzymany.':undefined);
}
async function serverReading(text,token){
 const health=await voiceHealth();
 if(token!==readToken)return;
 if(!health.tts){readingState(false,'Odczyt nie jest dostępny. Możesz przeczytać tekst na ekranie.');return}
 const controller=new AbortController();readingRequest=controller;
 try{
  const response=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang:'pl'}),signal:controller.signal});
  if(!response.ok)throw new Error('tts');
  const blob=await response.blob();if(token!==readToken)return;
  const url=URL.createObjectURL(blob),audio=new Audio(url);readingAudio=audio;
  audio.onended=()=>{URL.revokeObjectURL(url);if(token===readToken){readingAudio=null;readingState(false,'Odczyt zakończony.')}};
  audio.onerror=()=>{URL.revokeObjectURL(url);if(token===readToken)readingState(false,'Nie udało się odtworzyć dźwięku.');};
  await audio.play();
 }catch(e){if(token===readToken)readingState(false,'Nie udało się odtworzyć dźwięku. Możesz przeczytać tekst na ekranie.');}
 finally{if(readingRequest===controller)readingRequest=null}
}
function readText(text){
 stopReading(false);lastReading=text;const token=readToken;
 readingState(true,'Trwa odczyt. Możesz go zatrzymać.');
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){serverReading(text,token);return}
 try{
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='pl-PL';
  const voice=speechSynthesis.getVoices().find(item=>item.lang.toLowerCase().startsWith('pl'));
  if(voice)utterance.voice=voice;
  utterance.onend=()=>{if(token===readToken)readingState(false,'Odczyt zakończony.')};
  utterance.onerror=()=>{if(token===readToken)serverReading(text,token)};
  speechSynthesis.speak(utterance);
 }catch(e){serverReading(text,token)}
}
$('#readInstructions').onclick=()=>readText(instructions);
$('#readAnswer').onclick=()=>{
 const nodes=[...VIS.el.children].filter(node=>node.matches('.msg.bot,.ui'));
 if(!nodes.length){$('#readingStatus').textContent='Nie ma jeszcze odpowiedzi do odczytania.';return}
 const clone=nodes[nodes.length-1].cloneNode(true);
 clone.querySelectorAll('button,summary').forEach(node=>node.remove());
 const text=clone.textContent.replace(/\s+/g,' ').trim();
 if(text)readText(text);else $('#readingStatus').textContent='Nie ma jeszcze odpowiedzi do odczytania.';
};
$('#stopReading').onclick=()=>stopReading();
$('#replayReading').onclick=()=>{if(lastReading)readText(lastReading)};

function activeLayer(){
 for(const id of ['zx','qrx','helpPanel','accessPanel','mapPanel','safetyPanel','letterPanel','familyPanel','detail']){const node=$('#'+id);if(node?.classList.contains('on'))return node}
 if(app.classList.contains('todo'))return $('#todo');
 if(app.classList.contains('hist'))return $('#hmenu');
 if(app.classList.contains('menu'))return $('#lmenu');
 return null;
}
function modalFocus(layer){
 const selectors={helpPanel:'#helpBack',accessPanel:'#accessBack',mapPanel:'#mapBack',safetyPanel:'#safetyModuleBack',letterPanel:'#letterBack',familyPanel:'#familyBack',detail:'#dclose',todo:'#todoClose',hmenu:'#historyBack',lmenu:'#menuBack',qrx:'.qclose',zx:'.qclose'};
 return layer.querySelector(selectors[layer.id]||'button')||layer;
}
function syncAccessibility(){
 const next=activeLayer();
 const previous=modalLayer;
 if(next!==previous){
  if(next)modalReturn.set(next,document.activeElement);
  modalLayer=next;
 }
 [...app.children].forEach(node=>{
  if(node.id==='appStatus'){node.inert=false;return}
  if(next){node.inert=node!==next;return}
  const closed=(node.id==='lmenu'&&!app.classList.contains('menu'))||(node.id==='hmenu'&&!app.classList.contains('hist'))||(node.id==='todo'&&!app.classList.contains('todo'))||(['detail','helpPanel','accessPanel','mapPanel','safetyPanel','letterPanel','familyPanel','qrx','zx'].includes(node.id)&&!node.classList.contains('on'))||node.id==='voice'||(node.id==='chat'&&!app.classList.contains('chatting'))||(node.id==='homeContent'&&app.classList.contains('chatting'))||(node.id==='title'&&app.classList.contains('chatting'));
  node.inert=closed;
 });
 $('#stackwrap').inert=app.classList.contains('chatting')||VARIANT!=='stos';
 $('#alt').inert=app.classList.contains('chatting')||VARIANT==='stos';
 if(next!==previous){
  if(next)requestAnimationFrame(()=>{if(modalLayer===next&&!next.contains(document.activeElement))modalFocus(next).focus({preventScroll:true})});
  else if(previous&&!skipModalRestore){
   const target=modalReturn.get(previous);
   if(target?.isConnected&&!target.closest('[inert]'))requestAnimationFrame(()=>target.focus({preventScroll:true}));
  }
  skipModalRestore=false;
 }
}
function focusableIn(layer){
 return [...layer.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],summary,[tabindex]:not([tabindex="-1"])')].filter(node=>!node.closest('[hidden],[inert]')&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
}
document.addEventListener('keydown',event=>{
 const layer=activeLayer();
 if(event.key==='Escape'){
  if(layer){
   event.preventDefault();event.stopImmediatePropagation();
   if(layer.id==='helpPanel')helpBack();
   else if(layer.id==='accessPanel')closeAccess();
   else if(layer.id==='mapPanel')closeMap();
   else if(layer.id==='safetyPanel')closeSafety();
   else if(layer.id==='letterPanel')closeLetter();
   else if(layer.id==='familyPanel')closeFamily();
   else if(layer.id==='detail')closeDetail();
   else if(layer.id==='todo')closeTodo();
   else if(layer.id==='hmenu')closeHist();
   else if(layer.id==='lmenu')closeMenu();
   else if(layer.id==='qrx')pFinish({ok:false});
   else if(layer.id==='zx')zFinish({ok:false});
   return;
  }
  if(app.classList.contains('chatting')){event.preventDefault();event.stopImmediatePropagation();goBack()}
 }
 if(event.key==='Tab'&&layer){
  const items=focusableIn(layer);if(!items.length){event.preventDefault();return}
  const first=items[0],last=items[items.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===first||!layer.contains(current))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(current===last||!layer.contains(current))){event.preventDefault();first.focus()}
 }
},true);
document.addEventListener('focusin',event=>{
 let node=event.target.parentElement;
 while(node&&node!==app){
  if(node.scrollHeight>node.clientHeight&&['auto','scroll'].includes(getComputedStyle(node).overflowY)){
   const container=node.getBoundingClientRect(),target=event.target.getBoundingClientRect();
   if(target.top<container.top+5)node.scrollTop-=container.top+5-target.top;
   else if(target.bottom>container.bottom-5)node.scrollTop+=target.bottom-container.bottom+5;
  }
  node=node.parentElement;
 }
});
new MutationObserver(syncAccessibility).observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
syncAccessibility();
