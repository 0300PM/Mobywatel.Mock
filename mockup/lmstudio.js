const LM_MODEL_KEY='mobywatels.lmstudio.model.v1';
const lmCard=$('#lmStudioCard'),lmSelect=$('#lmStudioModel'),lmRefresh=$('#lmStudioRefresh'),lmStatus=$('#lmStudioStatus');
let lmServerId=null,lmSelection='',lmModels=[],lmListChecked=false;

function validLmModel(value){return typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\p{C}]/u.test(value)}
function readLmSelection(){
 try{
  const saved=JSON.parse(localStorage.getItem(LM_MODEL_KEY)||'null');
  return saved?.server===lmServerId&&validLmModel(saved.model)?saved.model:'';
 }catch(error){return ''}
}
function saveLmSelection(){
 try{localStorage.setItem(LM_MODEL_KEY,JSON.stringify({server:lmServerId,model:lmSelection}));return true}
 catch(error){return false}
}
function lmOption(value,label,disabled=false){
 const option=document.createElement('option');option.value=value;option.textContent=label;option.disabled=disabled;return option;
}
function renderLmModels(){
 lmSelect.replaceChildren(lmOption('',lmModels.length?'Wybierz model':'Najpierw pokaż modele',true));
 if(lmSelection&&!lmModels.includes(lmSelection))lmSelect.append(lmOption(lmSelection,lmSelection+(lmListChecked?' (nie ma na liście)':''),true));
 lmModels.forEach(model=>lmSelect.append(lmOption(model,model)));
 lmSelect.value=lmSelection;
 lmSelect.disabled=!lmModels.length;
}
function configureLmStudio(info){
 lmCard.hidden=info?.provider!=='lmstudio';
 if(lmCard.hidden)return;
 lmServerId=typeof info.lmstudio_id==='string'&&info.lmstudio_id?info.lmstudio_id:null;
 lmSelection=lmServerId?(readLmSelection()||(validLmModel(info.model)?info.model:'')):'';
 lmModels=[];lmListChecked=false;renderLmModels();
 lmRefresh.disabled=!lmServerId;
 if(!lmServerId)lmStatus.textContent=info?.provider==='workers'?'Nieprawidłowy adres workera. Sprawdź CLOUDFLARE_WORKERS_URL w konfiguracji aplikacji.':'Nieprawidłowy adres serwera. Sprawdź LM_STUDIO_BASE_URL w konfiguracji aplikacji.';
 else if(lmSelection)lmStatus.textContent='Wybrany model: '+lmSelection+'. Sprawdź połączenie, aby zobaczyć listę modeli.';
 else lmStatus.textContent='Sprawdź połączenie, a następnie wybierz model.';
}
window.getLmStudioModel=()=>lmSelection;
document.addEventListener('agentinfo',event=>configureLmStudio(event.detail));
if(window.AGENT_INFO)configureLmStudio(window.AGENT_INFO);

lmRefresh.addEventListener('click',async()=>{
 if(!lmServerId)return;
 lmRefresh.disabled=true;lmStatus.textContent='Sprawdzam połączenie i listę modeli…';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('/api/lmstudio/models',{cache:'no-store',signal:controller.signal});
  const result=await response.json();
  if(!response.ok){lmStatus.textContent=typeof result.error==='string'?result.error:'Nie udało się pobrać listy modeli.';return}
  if(!Array.isArray(result.models))throw new Error('models');
  lmModels=[...new Set(result.models.filter(validLmModel))].slice(0,256);lmListChecked=true;
  if(!lmSelection&&lmModels.length===1){lmSelection=lmModels[0];const saved=saveLmSelection();lmStatus.textContent=saved?'Połączono. Wybrano jedyny dostępny model.':'Połączono. Model wybrano do zamknięcia strony; nie udało się zapisać wyboru.'}
  else if(!lmModels.length)lmStatus.textContent='Połączono z LM Studio, ale lista modeli jest pusta. Wczytaj model lub włącz Just-in-Time, a potem sprawdź ponownie.';
  else if(lmSelection&&!lmModels.includes(lmSelection))lmStatus.textContent='Wybrany wcześniej model nie jest na liście. Wczytaj go w LM Studio albo wybierz inny.';
  else if(lmSelection)lmStatus.textContent='Połączono z LM Studio. Wybrany model: '+lmSelection+'.';
  else lmStatus.textContent='Połączono z LM Studio. Wybierz model z listy.';
  renderLmModels();
 }catch(error){lmStatus.textContent='Nie udało się sprawdzić połączenia. Uruchom serwer LM Studio albo sprawdź workera Cloudflare i spróbuj ponownie.'}
 finally{clearTimeout(timer);lmRefresh.disabled=false}
});
lmSelect.addEventListener('change',()=>{
 if(!lmModels.includes(lmSelect.value))return;
 lmSelection=lmSelect.value;
 lmStatus.textContent=saveLmSelection()?'Wybrano model: '+lmSelection+'.':'Wybrano model do zamknięcia strony; nie udało się zapisać wyboru.';
});
window.addEventListener('storage',event=>{
 if(event.key!==LM_MODEL_KEY||!lmServerId)return;
 lmSelection=readLmSelection();renderLmModels();
 lmStatus.textContent=lmSelection?'Wybór modelu zmieniono w innej karcie: '+lmSelection+'.':'Wybierz model z listy.';
});
