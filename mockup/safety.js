const safetyPanel=document.querySelector('#safetyPanel');
const safetyContent=document.querySelector('#safetyContent');
const safetyLang=()=>window.LANG==='en'?'en':'pl';
const safetyCopy={
 pl:{home:'Bezpieczny Obywatel',homeSummary:'Instrukcje kryzysowe, pomoc i plecak ewakuacyjny',back:'Wstecz',mode:'Tryb awaryjny',exitMode:'Wyłącz tryb awaryjny',large:'Duży tekst',contrast:'Wysoki kontrast',statusTitle:'Aktualny status bezpieczeństwa',unknown:'Nieznany — aplikacja nie pobiera bieżących alertów ani danych lokalnych.',checkRCB:'Sprawdź komunikaty RCB',checkIMGW:'Sprawdź ostrzeżenia IMGW',emergencyTitle:'Potrzebuję pomocy',emergencyText:'Jeśli życie lub zdrowie jest bezpośrednio zagrożone, nie czekaj na AI. Zadzwoń pod 112.',call112:'Zadzwoń pod 112',emergencyHint:'Połączenie wykona się tylko po Twoim świadomym kliknięciu i zależy od urządzenia.',whatTitle:'Co zrobić w tej sytuacji?',scenarioLabel:'Wybierz zagrożenie',steps:'Kroki działania',checklist:'Checklista',avoid:'Czego unikać',mistakes:'Najczęstsze błędy',source:'Oficjalne źródła',reviewed:'Poradniki sprawdzono: 8 listopada 2026. To informacje ogólne, nie lokalne ostrzeżenia.',sourceCaution:'Sprawdź aktualne polecenia służb; mogą mieć pierwszeństwo przed poradnikiem.',prepareTitle:'Przygotuj się na kryzys',bagTitle:'Mój plecak ewakuacyjny',bagIntro:'Zaznaczenia zapisują się lokalnie w tej przeglądarce. Nie wpisuj nazw leków ani danych medycznych.',bagProgress:'Ukończono',bagSuggestTitle:'Sugestie na podstawie profilu',profileTitle:'Mój profil bezpieczeństwa',profileIntro:'Wszystko jest opcjonalne. Zapisujemy tylko ogólne potrzeby na tym urządzeniu — bez nazwisk, adresów, diagnoz i nazw leków.',household:'Liczba osób w gospodarstwie domowym',children:'W gospodarstwie są dzieci',seniors:'Uwzględnij potrzeby seniorów',mobility:'Ktoś może potrzebować pomocy w poruszaniu się',pets:'W gospodarstwie są zwierzęta',medicines:'Ktoś regularnie potrzebuje leków',equipment:'Ktoś używa niezbędnego sprzętu medycznego lub pomocniczego',saveProfile:'Zapisz profil',clearProfile:'Wyczyść profil',profileSaved:'Profil zapisano lokalnie.',profileCleared:'Profil wyczyszczono.',profileError:'Nie udało się zapisać. Zmiany pozostaną do zamknięcia strony.',callsTitle:'Numery alarmowe',numbersNote:'112 jest ogólnym numerem alarmowym. Pozostałe numery również działają w Polsce; wybierz właściwy do sytuacji.',police:'Policja',fire:'Państwowa Straż Pożarna',medical:'Ratownictwo medyczne',gas:'Pogotowie gazowe',aiTitle:'Asystent AI — dodatkowa pomoc',aiIntro:'Opisz sytuację lub wybierz zagrożenie. Najpierw przeczytaj statyczne, źródłowe kroki powyżej. AI może się mylić i nie zna bieżących alertów.',situation:'Co się wydarzyło?',situationHint:'Nie wpisuj danych osobowych, haseł ani szczegółów medycznych.',danger:'Czy jesteś teraz w bezpośrednim niebezpieczeństwie?',unknownDanger:'Nie wiem / wolę nie odpowiadać',dangerNo:'Nie',dangerYes:'Tak — jestem w bezpośrednim niebezpieczeństwie',dangerNow:'Bezpośrednie zagrożenie: dzwoń teraz pod 112. Nie czekaj na odpowiedź asystenta.',location:'Przybliżona lokalizacja (opcjonalnie)',locationPlaceholder:'Np. miejscowość lub dzielnica',shareLocation:'Dołącz tę lokalizację do zapytania wysyłanego do skonfigurowanego modelu AI',photo:'Dodaj zdjęcie (opcjonalnie)',photoHint:'Podgląd pozostaje w tej przeglądarce. W tej wersji zdjęcie nie jest wysyłane ani analizowane przez AI — opisz je słowami.',removePhoto:'Usuń zdjęcie',submitAI:'Poproś AI o krótkie wskazówki',askBag:'Poproś AI o sugestie do plecaka',aiWait:'Przygotowuję dodatkowe wskazówki…',aiUnavailable:'AI jest niedostępne. Skorzystaj z widocznych statycznych instrukcji i oficjalnych źródeł.',aiWarning:'Odpowiedź AI jest dodatkowa i niezweryfikowana. Nie zastępuje poleceń służb.',aiActions:'Proponowane działania',aiChecklist:'Dodatkowa checklista',aiAvoid:'Unikaj',aiEmergency:'AI wskazuje na możliwą pilność. Jeśli życie lub zdrowie jest zagrożone, zadzwoń 112.',aiNoDescription:'Opisz krótko sytuację przed wysłaniem.',aiDirectStop:'Przy bezpośrednim zagrożeniu nie wysyłamy opisu do AI. Zadzwoń 112 teraz.',aiDirectStatus:'Nie wysyłamy opisu do AI. Zadzwoń 112 teraz.',error:'Nie udało się pobrać poradnika. Jeśli strona działa offline, połącz się raz z internetem, aby zapisać poradniki.',offline:'Poradniki są dołączone do aplikacji i mogą być dostępne offline po wcześniejszym wczytaniu strony.',none:'Brak zaznaczonych pozycji.',more:'Zaznacz pozycje z listy, aby zobaczyć postęp.',notMedical:'To nie jest porada medyczna. W nagłym zagrożeniu zadzwoń 112.'},
 en:{home:'Safe Citizen',homeSummary:'Emergency guidance, help and an evacuation bag',back:'Back',mode:'Emergency mode',exitMode:'Exit emergency mode',large:'Large text',contrast:'High contrast',statusTitle:'Current safety status',unknown:'Unknown — this app does not retrieve live alerts or local data.',checkRCB:'Check government safety updates',checkIMGW:'Check IMGW weather warnings',emergencyTitle:'I need help',emergencyText:'If life or health is in immediate danger, do not wait for AI. Call 112.',call112:'Call 112',emergencyHint:'A call is placed only after your deliberate tap and depends on your device.',whatTitle:'What should I do?',scenarioLabel:'Choose a hazard',steps:'Action steps',checklist:'Checklist',avoid:'What to avoid',mistakes:'Common mistakes',source:'Official sources',reviewed:'Guidance reviewed: 8 November 2026. General information, not local alerts.',sourceCaution:'Check current instructions from authorities; they take precedence over this guidance.',prepareTitle:'Prepare for an emergency',bagTitle:'My evacuation bag',bagIntro:'Your selections are saved locally in this browser. Do not enter medicine names or medical details.',bagProgress:'Completed',bagSuggestTitle:'Profile-based suggestions',profileTitle:'My safety profile',profileIntro:'Everything is optional. Only general needs are saved on this device — no names, addresses, diagnoses or medicine names.',household:'People in the household',children:'Children are in the household',seniors:'Include older adults’ needs',mobility:'Someone may need mobility assistance',pets:'Pets are in the household',medicines:'Someone regularly needs medicines',equipment:'Someone uses essential medical or assistive equipment',saveProfile:'Save profile',clearProfile:'Clear profile',profileSaved:'Profile saved locally.',profileCleared:'Profile cleared.',profileError:'Could not save. Changes will remain until this page closes.',callsTitle:'Emergency numbers',numbersNote:'112 is the general emergency number. Other numbers also operate in Poland; choose the right one for the situation.',police:'Police',fire:'State Fire Service',medical:'Emergency medical services',gas:'Gas emergency service',aiTitle:'AI assistant — additional help',aiIntro:'Describe what happened or choose a hazard. Read the sourced static steps above first. AI can be wrong and has no live alerts.',situation:'What happened?',situationHint:'Do not enter personal data, passwords or medical details.',danger:'Are you in immediate danger right now?',unknownDanger:'Not sure / prefer not to say',dangerNo:'No',dangerYes:'Yes — I am in immediate danger',dangerNow:'Immediate danger: call 112 now. Do not wait for the assistant.',location:'Approximate location (optional)',locationPlaceholder:'For example, town or district',shareLocation:'Include this location in the request sent to the configured AI model',photo:'Add a photo (optional)',photoHint:'The preview stays in this browser. In this version the photo is not sent to or analysed by AI — describe it in words.',removePhoto:'Remove photo',submitAI:'Ask AI for brief guidance',askBag:'Ask AI for evacuation-bag suggestions',aiWait:'Preparing additional guidance…',aiUnavailable:'AI is unavailable. Use the visible static instructions and official sources.',aiWarning:'The AI response is additional and unverified. It does not replace instructions from authorities.',aiActions:'Suggested actions',aiChecklist:'Additional checklist',aiAvoid:'Avoid',aiEmergency:'AI indicates possible urgency. If life or health is at risk, call 112.',aiNoDescription:'Briefly describe the situation before sending.',aiDirectStop:'For immediate danger, the description is not sent to AI. Call 112 now.',aiDirectStatus:'The description is not sent to AI. Call 112 now.',error:'Could not load the guidance. If offline, connect once so the guides can be saved.',offline:'Guides are bundled with the app and may be available offline after the page has been loaded once.',none:'No items selected.',more:'Select items from the list to track progress.',notMedical:'This is not medical advice. Call 112 in an emergency.'}
};
const sText=key=>safetyCopy[safetyLang()][key]||key;
const sEsc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sLocal=value=>value&&typeof value==='object'?(value[safetyLang()]||value.pl||''):String(value??'');
const PROFILE_KEY='mobywatels.safety.profile.v1';
const PACK_KEY='mobywatels.safety.pack.v1';
const SCENARIO_KEY='mobywatels.safety.scenarios.v1';
let safetyData=null,selectedScenario='powodz',profileState={household:1,children:false,seniors:false,mobility:false,pets:false,medicines:false,equipment:false},profileSaved=false,packState={},scenarioChecks={},photoUrl=null;
function readStorage(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch(error){return fallback}}
function loadSafetyState(){
 const savedProfile=readStorage(PROFILE_KEY,null);
 if(savedProfile&&typeof savedProfile==='object'){
  profileState.household=Number.isInteger(savedProfile.household)&&savedProfile.household>=1&&savedProfile.household<=12?savedProfile.household:1;
  ['children','seniors','mobility','pets','medicines','equipment'].forEach(key=>profileState[key]=savedProfile[key]===true);
  profileSaved=true;
 }
 const savedPack=readStorage(PACK_KEY,{});if(savedPack&&typeof savedPack==='object')packState=savedPack;
 const savedChecks=readStorage(SCENARIO_KEY,{});if(savedChecks&&typeof savedChecks==='object')scenarioChecks=savedChecks;
}
loadSafetyState();
function sourceMarkup(ids){
 const items=(ids||[]).map(id=>safetyData.sources[id]).filter(Boolean);
 if(!items.length)return '';
 return `<h4>${sEsc(sText('source'))}</h4><ul class="safety-source-list">${items.map(item=>`<li><a href="${sEsc(item.url)}" target="_blank" rel="noopener noreferrer">${sEsc(sLocal(item.name))}</a></li>`).join('')}</ul>`;
}
function renderStepList(items,tag='ol',className=''){
 return `<${tag}${className?` class="${className}"`:''}>${items.map(item=>`<li>${sEsc(sLocal(item))}</li>`).join('')}</${tag}>`;
}
function renderScenarioGuide(id){
 if(!safetyData)return;
 const scenario=safetyData.scenarios.find(item=>item.id===id)||safetyData.scenarios[0];
 selectedScenario=scenario.id;
 const guide=document.querySelector('#safetyGuide');if(!guide)return;
 const checks=scenarioChecks[scenario.id]&&typeof scenarioChecks[scenario.id]==='object'?scenarioChecks[scenario.id]:{};
 guide.innerHTML=`<div class="safety-guide-head"><span class="safety-risk-mark" aria-hidden="true">${sEsc(scenario.icon)}</span><div><h4>${sEsc(sLocal(scenario.title))}</h4><p>${sEsc(sLocal(scenario.summary))}</p></div></div>
  <h4>${sEsc(sText('steps'))}</h4>${renderStepList(scenario.steps)}
  <h4>${sEsc(sText('checklist'))}</h4><ul class="safety-check-list">${scenario.checklist.map((item,index)=>`<li><label><input type="checkbox" data-scenario-check="${index}" ${checks[index]===true?'checked':''}><span>${sEsc(sLocal(item))}</span></label></li>`).join('')}</ul>
  <h4>${sEsc(sText('avoid'))}</h4>${renderStepList(scenario.avoid,'ul','safety-avoid-list')}
  <h4>${sEsc(sText('mistakes'))}</h4>${renderStepList(scenario.mistakes,'ul')}
  ${sourceMarkup(scenario.sources)}<p class="safety-source-caution">${sEsc(sText('sourceCaution'))}</p>`;
 guide.querySelectorAll('[data-scenario-check]').forEach(input=>input.addEventListener('change',()=>{
  if(!scenarioChecks[scenario.id]||typeof scenarioChecks[scenario.id]!=='object')scenarioChecks[scenario.id]={};
  scenarioChecks[scenario.id][input.dataset.scenarioCheck]=input.checked;
  try{localStorage.setItem(SCENARIO_KEY,JSON.stringify(scenarioChecks))}catch(error){}
 }));
}
function packItems(){
 if(!safetyData)return [];
 return safetyData.backpack.filter(item=>!item.profile||profileState[item.profile]===true);
}
function updatePackSummary(){
 const items=packItems(),checked=items.filter(item=>packState[item.id]===true),missing=items.filter(item=>packState[item.id]!==true);
 const progress=document.querySelector('#safetyPackProgress'),suggestion=document.querySelector('#safetyPackSuggestion'),ask=document.querySelector('#safetyPackAsk');
 if(progress)progress.textContent=`${sText('bagProgress')}: ${checked.length}/${items.length}`;
 if(suggestion){
  suggestion.textContent=missing.length?`${missing.length} ${safetyLang()==='en'?'items not yet checked':'pozycji nie jest jeszcze zaznaczonych'}: ${missing.map(item=>sLocal(item.text)).join('; ')}.`:sText('none');
 }
 if(ask)ask.disabled=!missing.length;
}
function renderPack(){
 const list=document.querySelector('#safetyPackList');if(!list||!safetyData)return;
 list.replaceChildren();
 packItems().forEach(item=>{
  const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
  label.className='safety-pack-item';input.type='checkbox';input.checked=packState[item.id]===true;input.dataset.packId=item.id;text.textContent=sLocal(item.text);label.append(input,text);list.append(label);
  input.addEventListener('change',()=>{packState[item.id]=input.checked;try{localStorage.setItem(PACK_KEY,JSON.stringify(packState))}catch(error){}updatePackSummary()});
 });
 updatePackSummary();
}
function updateProfileInputs(){
 const household=document.querySelector('#safetyHousehold');if(household)household.value=String(profileState.household);
 ['children','seniors','mobility','pets','medicines','equipment'].forEach(key=>{const input=document.querySelector(`[name="safety-${key}"]`);if(input)input.checked=profileState[key]===true});
}
function renderSafetyPanel(){
 if(!safetyData)return;
 const lang=safetyLang();safetyPanel.lang=lang;
 document.querySelector('#safetyModuleTitle').textContent=sText('home');
 document.querySelector('#safetyBackText').textContent=sText('back');
 document.querySelector('#safetyMode').textContent=sText('mode');
 document.querySelector('#safetyExitMode').textContent=sText('exitMode');
 document.querySelector('#safetyLarge').textContent=sText('large');
 document.querySelector('#safetyContrast').textContent=sText('contrast');
 const scenarioOptions=safetyData.scenarios.map(item=>`<option value="${sEsc(item.id)}">${sEsc(sLocal(item.title))}</option>`).join('');
 safetyContent.innerHTML=`<section class="safety-status-card" aria-labelledby="safetyStatusTitle"><div class="safety-card-heading"><span class="safety-status-dot" aria-hidden="true"></span><div><h3 id="safetyStatusTitle">${sEsc(sText('statusTitle'))}</h3><p class="safety-status-unknown" role="status">${sEsc(sText('unknown'))}</p></div></div><div class="safety-source-actions"><a href="https://www.gov.pl/web/rcb" target="_blank" rel="noopener noreferrer">${sEsc(sText('checkRCB'))}</a><a href="https://meteo.imgw.pl/" target="_blank" rel="noopener noreferrer">${sEsc(sText('checkIMGW'))}</a></div></section>
 <section class="safety-emergency-card" aria-labelledby="safetyEmergencyTitle"><div><p class="safety-kicker">${sEsc(sText('emergencyTitle'))}</p><h3 id="safetyEmergencyTitle">${sEsc(sText('emergencyText'))}</h3><p>${sEsc(sText('emergencyHint'))}</p></div><a class="safety-call-button" href="tel:112"><span aria-hidden="true">112</span><span>${sEsc(sText('call112'))}</span></a></section>
 <section class="assist-card safety-section" aria-labelledby="safetyWhatTitle"><h3 id="safetyWhatTitle">${sEsc(sText('whatTitle'))}</h3><label for="safetyScenarioSelect">${sEsc(sText('scenarioLabel'))}</label><select id="safetyScenarioSelect">${scenarioOptions}</select><div id="safetyGuide" class="safety-guide"></div></section>
 <section class="assist-card safety-section" aria-labelledby="safetyAITitle"><h3 id="safetyAITitle">${sEsc(sText('aiTitle'))}</h3><p>${sEsc(sText('aiIntro'))}</p><form id="safetyAIForm"><label for="safetySituation">${sEsc(sText('situation'))}</label><textarea id="safetySituation" rows="3" maxlength="1500" aria-describedby="safetySituationHint" autocomplete="off"></textarea><p class="field-hint" id="safetySituationHint">${sEsc(sText('situationHint'))}</p><label for="safetyImmediate">${sEsc(sText('danger'))}</label><select id="safetyImmediate"><option value="unknown">${sEsc(sText('unknownDanger'))}</option><option value="no">${sEsc(sText('dangerNo'))}</option><option value="yes">${sEsc(sText('dangerYes'))}</option></select><p class="safety-direct-notice" id="safetyDirectNotice" role="alert" hidden>${sEsc(sText('dangerNow'))} <a href="tel:112">${sEsc(sText('call112'))}</a></p><label for="safetyLocation">${sEsc(sText('location'))}</label><input id="safetyLocation" type="text" maxlength="100" autocomplete="off" placeholder="${sEsc(sText('locationPlaceholder'))}"><label class="module-consent safety-consent"><input id="safetyShareLocation" type="checkbox">${sEsc(sText('shareLocation'))}</label><label for="safetyPhoto">${sEsc(sText('photo'))}</label><input id="safetyPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="safetyPhotoHint safetyPhotoStatus"><p id="safetyPhotoHint" class="field-hint">${sEsc(sText('photoHint'))}</p><div class="safety-photo-preview" id="safetyPhotoPreview" hidden><img id="safetyPhotoImage" alt=""><button type="button" id="safetyPhotoRemove" class="assist-button secondary">${sEsc(sText('removePhoto'))}</button></div><p class="assist-status" id="safetyPhotoStatus" role="status" aria-live="polite"></p><div class="safety-ai-actions"><button class="assist-button primary wide" id="safetyAskAI" type="submit">${sEsc(sText('submitAI'))}</button></div><p class="assist-status" id="safetyAIStatus" role="status" aria-live="polite"></p><div class="safety-ai-result" id="safetyAIResult" aria-live="polite"></div></form></section>
 <section class="assist-card safety-section" aria-labelledby="safetyPackTitle"><h3 id="safetyPackTitle">${sEsc(sText('bagTitle'))}</h3><p>${sEsc(sText('bagIntro'))}</p><p class="safety-pack-progress" id="safetyPackProgress" role="status"></p><div class="safety-pack-list" id="safetyPackList"></div><h4>${sEsc(sText('bagSuggestTitle'))}</h4><p class="safety-pack-suggestion" id="safetyPackSuggestion"></p><button class="assist-button secondary wide" id="safetyPackAsk" type="button">${sEsc(sText('askBag'))}</button><p class="assist-status" id="safetyPackStatus" role="status" aria-live="polite"></p><div class="safety-ai-result" id="safetyPackResult" aria-live="polite"></div></section>
 <section class="assist-card safety-section" aria-labelledby="safetyProfileTitle"><h3 id="safetyProfileTitle">${sEsc(sText('profileTitle'))}</h3><p>${sEsc(sText('profileIntro'))}</p><form id="safetyProfileForm"><label for="safetyHousehold">${sEsc(sText('household'))}</label><select id="safetyHousehold">${Array.from({length:12},(_,index)=>`<option value="${index+1}">${index+1}</option>`).join('')}</select><div class="safety-profile-options">${[['children','children'],['seniors','seniors'],['mobility','mobility'],['pets','pets'],['medicines','medicines'],['equipment','equipment']].map(([key,label])=>`<label><input type="checkbox" name="safety-${key}"><span>${sEsc(sText(label))}</span></label>`).join('')}</div><div class="safety-profile-actions"><button class="assist-button primary" type="submit">${sEsc(sText('saveProfile'))}</button><button class="assist-button secondary" id="safetyClearProfile" type="button">${sEsc(sText('clearProfile'))}</button></div><p id="safetyProfileStatus" class="assist-status" role="status" aria-live="polite">${profileSaved?sEsc(sText('profileSaved')):''}</p></form></section>
 <section class="assist-card safety-numbers" aria-labelledby="safetyNumbersTitle"><h3 id="safetyNumbersTitle">${sEsc(sText('callsTitle'))}</h3><p>${sEsc(sText('numbersNote'))}</p><ul><li><a href="tel:112"><strong>112</strong><span>${sEsc(sText('call112'))}</span></a></li><li><a href="tel:997"><strong>997</strong><span>${sEsc(sText('police'))}</span></a></li><li><a href="tel:998"><strong>998</strong><span>${sEsc(sText('fire'))}</span></a></li><li><a href="tel:999"><strong>999</strong><span>${sEsc(sText('medical'))}</span></a></li><li><a href="tel:992"><strong>992</strong><span>${sEsc(sText('gas'))}</span></a></li></ul>${sourceMarkup(['emergency112','gas'])}</section>
 <p class="safety-offline-note">${sEsc(sText('offline'))}</p><p class="safety-medical-note">${sEsc(sText('notMedical'))}</p><p class="safety-reviewed">${sEsc(sText('reviewed'))}</p>`;
 document.querySelector('#safetyScenarioSelect').value=selectedScenario;
 renderScenarioGuide(selectedScenario);
 updateProfileInputs();
 renderPack();
 bindSafetyInteractions();
}
function setSafetyMode(enabled){
 const active=Boolean(enabled);
 safetyPanel.classList.toggle('safety-emergency',active);
 safetyPanel.classList.toggle('safety-large',active);
 safetyPanel.classList.toggle('safety-high-contrast',active);
 document.querySelector('#safetyMode').setAttribute('aria-pressed',String(active));
 document.querySelector('#safetyMode').textContent=active?sText('exitMode'):sText('mode');
 document.querySelector('#safetyAccessTools').hidden=!active;
 document.querySelector('#safetyLarge').setAttribute('aria-pressed',String(active));
 document.querySelector('#safetyContrast').setAttribute('aria-pressed',String(active));
}
function setSafetyLarge(enabled){safetyPanel.classList.toggle('safety-large',enabled);document.querySelector('#safetyLarge').setAttribute('aria-pressed',String(enabled))}
function setSafetyContrast(enabled){safetyPanel.classList.toggle('safety-high-contrast',enabled);document.querySelector('#safetyContrast').setAttribute('aria-pressed',String(enabled))}
function appendList(parent,title,items){
 if(!items.length)return;
 const heading=document.createElement('h4'),list=document.createElement('ol');heading.textContent=title;items.forEach(item=>{const li=document.createElement('li');li.textContent=item;list.append(li)});parent.append(heading,list);
}
function displayAIResult(container,result){
 container.replaceChildren();
 const warning=document.createElement('p');warning.className='safety-ai-warning';warning.textContent=sText('aiWarning');container.append(warning);
 if(result.call_emergency===true){const urgent=document.createElement('p');urgent.className='safety-ai-urgent';urgent.setAttribute('role','alert');urgent.textContent=sText('aiEmergency');container.append(urgent);const link=document.createElement('a');link.href='tel:112';link.className='safety-call-button';link.textContent=sText('call112');container.append(link)}
 appendList(container,sText('aiActions'),Array.isArray(result.actions)?result.actions:[]);
 appendList(container,sText('aiChecklist'),Array.isArray(result.checklist)?result.checklist:[]);
 appendList(container,sText('aiAvoid'),Array.isArray(result.avoid)?result.avoid:[]);
}
function selectedProfile(){
 return {household:profileState.household,children:profileState.children,seniors:profileState.seniors,mobility:profileState.mobility,pets:profileState.pets,medicines:profileState.medicines,equipment:profileState.equipment};
}
function potwierdzWyslanie(payload,status,resultBox){
 const opis=payload.description.slice(0,280)+(payload.description.length>280?'…':'');
 const linie=['Wysyłasz do modelu AI:','','Opis: '+opis,'Zagrożenie: '+sText('scenarioLabel')+': '+payload.threat];
 if(payload.location)linie.push('Lokalizacja: '+payload.location);
 linie.push('Model: '+sText('aiTitle'),'','Cel: dodatkowe wskazówki. Odpowiedź jest niezweryfikowana i nie zastępuje poleceń służb.','');
 const zgoda=window.confirm(linie.join('\n'));
 if(!zgoda){status.textContent='Anulowano. Nic nie wysłano do modelu AI.';resultBox.replaceChildren()}
 return zgoda;
}
async function requestSafetyAI(task){
 const status=document.querySelector(task==='backpack'?'#safetyPackStatus':'#safetyAIStatus');
 const resultBox=document.querySelector(task==='backpack'?'#safetyPackResult':'#safetyAIResult');
 const immediate=document.querySelector('#safetyImmediate')?.value;
 if(task==='situation'&&immediate==='yes'){
  status.textContent=sText('aiDirectStatus');
  resultBox.replaceChildren();
  return;
 }
 const description=task==='backpack'?safetyCopy[safetyLang()].bagIntro:document.querySelector('#safetySituation').value.trim();
 if(task==='situation'&&!description){status.textContent=sText('aiNoDescription');document.querySelector('#safetySituation').focus();return}
 const locationText=document.querySelector('#safetyShareLocation').checked?document.querySelector('#safetyLocation').value.trim():'';
 const checked=packItems().filter(item=>packState[item.id]===true).map(item=>item.id);
 const missing=packItems().filter(item=>packState[item.id]!==true).map(item=>item.id);
 const payload={task,threat:selectedScenario,description,immediateDanger:false,location:locationText,shareLocation:Boolean(locationText),profile:selectedProfile(),checked,missing,model:window.getLmStudioModel?.()||'',lang:safetyLang()};
 if(!(await potwierdzWyslanie(payload,status,resultBox))){status.textContent='';return}
 const button=document.querySelector(task==='backpack'?'#safetyPackAsk':'#safetyAskAI');
 button.disabled=true;status.textContent=sText('aiWait');resultBox.replaceChildren();
 try{
  const response=await fetch('/api/safety/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.result)throw new Error(data.error||'unavailable');
  displayAIResult(resultBox,data.result);status.textContent='';
 }catch(error){
  status.textContent=sText('aiUnavailable');
  const fallback=document.createElement('p');fallback.className='safety-ai-fallback';
  if(task==='backpack')fallback.textContent=missing.length?`${sText('bagSuggestTitle')}: ${missing.map(id=>sLocal(safetyData.backpack.find(item=>item.id===id)?.text)).filter(Boolean).join('; ')}.`:sText('none');
  else fallback.textContent=sLocal(safetyData.scenarios.find(item=>item.id===selectedScenario)?.summary);
  resultBox.replaceChildren(fallback);
 }
 finally{button.disabled=false}
}
function handlePhoto(){
 const input=document.querySelector('#safetyPhoto'),file=input.files?.[0],status=document.querySelector('#safetyPhotoStatus'),preview=document.querySelector('#safetyPhotoPreview'),image=document.querySelector('#safetyPhotoImage');
 if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null}
 if(!file){preview.hidden=true;image.removeAttribute('src');status.textContent='';return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){input.value='';preview.hidden=true;image.removeAttribute('src');status.textContent=safetyLang()==='en'?'Choose a JPEG, PNG or WebP image no larger than 8 MiB.':'Wybierz obraz JPEG, PNG lub WebP o wielkości do 8 MiB.';return}
 photoUrl=URL.createObjectURL(file);image.src=photoUrl;image.alt=safetyLang()==='en'?'Local preview of the selected image':'Lokalny podgląd wybranego zdjęcia';preview.hidden=false;status.textContent=safetyLang()==='en'?'Image preview only. The image will not be uploaded or analysed.':'Tylko podgląd zdjęcia. Obraz nie zostanie wysłany ani przeanalizowany.';
}
function bindSafetyInteractions(){
 document.querySelector('#safetyScenarioSelect').addEventListener('change',event=>renderScenarioGuide(event.target.value));
 document.querySelector('#safetyAIForm').addEventListener('submit',event=>{event.preventDefault();requestSafetyAI('situation')});
 document.querySelector('#safetyImmediate').addEventListener('change',event=>{document.querySelector('#safetyDirectNotice').hidden=event.target.value!=='yes';if(event.target.value==='yes'){document.querySelector('#safetyAIStatus').textContent=sText('aiDirectStatus');document.querySelector('#safetyDirectNotice').scrollIntoView({block:'nearest'})}else document.querySelector('#safetyAIStatus').textContent=''});
 document.querySelector('#safetyPhoto').addEventListener('change',handlePhoto);
 document.querySelector('#safetyPhotoRemove').addEventListener('click',()=>{document.querySelector('#safetyPhoto').value='';handlePhoto()});
 document.querySelector('#safetyProfileForm').addEventListener('submit',event=>{
  event.preventDefault();profileState.household=Math.max(1,Math.min(12,Number(document.querySelector('#safetyHousehold').value)||1));
  ['children','seniors','mobility','pets','medicines','equipment'].forEach(key=>profileState[key]=document.querySelector(`[name="safety-${key}"]`).checked);
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profileState));profileSaved=true;document.querySelector('#safetyProfileStatus').textContent=sText('profileSaved')}catch(error){document.querySelector('#safetyProfileStatus').textContent=sText('profileError')}
  renderPack();
 });
 document.querySelector('#safetyClearProfile').addEventListener('click',()=>{
  profileState={household:1,children:false,seniors:false,mobility:false,pets:false,medicines:false,equipment:false};profileSaved=false;
  try{localStorage.removeItem(PROFILE_KEY)}catch(error){}
  updateProfileInputs();renderPack();document.querySelector('#safetyProfileStatus').textContent=sText('profileCleared');
 });
 document.querySelector('#safetyPackAsk').addEventListener('click',()=>requestSafetyAI('backpack'));
 document.querySelector('#safetyMode').addEventListener('click',()=>setSafetyMode(!safetyPanel.classList.contains('safety-emergency')));
 document.querySelector('#safetyExitMode').addEventListener('click',()=>setSafetyMode(false));
 document.querySelector('#safetyLarge').addEventListener('click',event=>setSafetyLarge(event.currentTarget.getAttribute('aria-pressed')!=='true'));
 document.querySelector('#safetyContrast').addEventListener('click',event=>setSafetyContrast(event.currentTarget.getAttribute('aria-pressed')!=='true'));
}
function initSafety(){
 const lang=safetyLang();
 document.querySelector('#safetyHomeTitle').textContent=safetyCopy[lang].home;
 document.querySelector('#safetyHomeSummary').textContent=safetyCopy[lang].homeSummary;
 document.querySelector('#openSafety').addEventListener('click',openSafety);
 document.querySelector('#safetyModuleBack').addEventListener('click',closeSafety);
 fetch('/safety-guides.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error('guides');return response.json()}).then(data=>{if(!Array.isArray(data.scenarios)||!data.scenarios.length)throw new Error('guides');safetyData=data;renderSafetyPanel()}).catch(()=>{safetyContent.innerHTML=`<section class="safety-emergency-card"><h3>${sEsc(sText('emergencyText'))}</h3><a class="safety-call-button" href="tel:112">${sEsc(sText('call112'))}</a></section><p role="alert">${sEsc(sText('error'))}</p>`});
 if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/safety-sw.js').catch(()=>{}),{once:true});
}
function openSafety(){
 safetyPanel.classList.add('on');document.querySelector('#openSafety').setAttribute('aria-expanded','true');syncAccessibility();
 requestAnimationFrame(()=>document.querySelector('#safetyModuleBack').focus({preventScroll:true}));
}
function closeSafety(){
 if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null}
 const input=document.querySelector('#safetyPhoto'),preview=document.querySelector('#safetyPhotoPreview'),image=document.querySelector('#safetyPhotoImage'),status=document.querySelector('#safetyPhotoStatus');
 if(input)input.value='';if(preview)preview.hidden=true;image?.removeAttribute('src');if(status)status.textContent='';
 setSafetyMode(false);safetyPanel.classList.remove('on');document.querySelector('#openSafety').setAttribute('aria-expanded','false');syncAccessibility();
}
initSafety();
