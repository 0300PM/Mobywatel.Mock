let AGENT=false;
CONVS.forEach(conversation=>{conversation.api=[];conversation.stan=null});
const originalMkConv=mkConv;
mkConv=function(box){const conversation=originalMkConv(box);conversation.api=[];conversation.stan=null;return conversation};

function botText(text){
 clearEmpty();
 const message=document.createElement('div');
 message.className='msg bot';message.dataset.t='0';message.textContent=text;
 msgs.append(message);end();touch('bot',text);
}

const localScreens={
 mapa:{label:'Otwórz mapę placówek',open:()=>openMap()},
 pomoc:{label:'Otwórz pomoc',open:()=>openHelp()},
 dostepnosc:{label:'Otwórz ułatwienia dostępu',open:()=>openAccess()}
};
function openLocalScreen(screen){
 const destination=localScreens[screen];
 if(!destination)return;
 announce(destination.label+'.');destination.open();
}
function offerLocalScreen(conversation,screen){
 const destination=localScreens[screen],row=el('<div class="chips"></div>'),button=document.createElement('button');
 button.type='button';button.textContent=destination.label;
 button.onclick=()=>{row.remove();openLocalScreen(screen)};
 row.append(button);conversation.el.append(row);end();
}

async function agentSend(text){
 const conversation=WR;
 if(conversation.requesting){
  if(!input.value)input.value=text;
  announce('Poczekaj na odpowiedź asystenta. Wiadomość zachowano do ponownego wysłania.');
  return;
 }
 conversation.requesting=true;
 if(conversation.api.length>=58)conversation.api=conversation.api.slice(-58);
 conversation.api.push({role:'user',content:text});
 inflight++;
 const typing=el('<div class="typing" role="status" aria-label="Czekam na odpowiedź asystenta"><i></i><i></i><i></i></div>');
 conversation.el.append(typing);end();
 await agentHealthReady;
 const local=['lmstudio','workers'].includes(window.AGENT_INFO?.provider);   // worker Cloudflare też ma własny limit czasu
 const seconds=local?Math.max(1,Math.min(Number(window.AGENT_INFO.timeout)||180,600))+20:80;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),seconds*1000);
 let failure='Nie udało się połączyć z asystentem AI. Żadna czynność nie została wykonana. Sprawdź konfigurację i połączenie, a potem spróbuj ponownie.';
 try{
  const payload={conv:conversation.id,messages:conversation.api,lang:window.LANG||'pl'};
  if(local){const model=window.getLmStudioModel?.();if(model)payload.model=model}
  const response=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  const data=await response.json();
  if(!response.ok){if(local&&(response.status===400||response.status===502)&&typeof data.error==='string'&&data.error.length<=300)failure=data.error+' Żadna czynność nie została wykonana.';throw new Error('agent')}
  if(!Array.isArray(data.messages)||!Array.isArray(data.events))throw new Error('agent');
  const answers=data.events.filter(event=>event.t==='text'&&typeof event.plain==='string');
  const navigation=data.events.filter(event=>event.t==='navigate'&&Object.hasOwn(localScreens,event.screen));
  if(!answers.length||navigation.length>1||answers.length+navigation.length!==data.events.length)throw new Error('response');
  conversation.api=data.messages;
  typing.remove();
  answers.forEach(answer=>botText(answer.plain));
  if(navigation.length){
   const screen=navigation[0].screen;
   try{
    if(conversation===VIS&&app.classList.contains('chatting')&&!activeLayer())openLocalScreen(screen);
    else offerLocalScreen(conversation,screen);
   }catch(error){botText('Odpowiedź dotarła, ale nie udało się otworzyć ekranu. Spróbuj otworzyć go z ekranu głównego.')}
  }
 }catch(error){
  conversation.api.pop();
  typing.remove();
  botText(failure);
  if(conversation===VIS&&!input.value)input.value=text;
  announce('Asystent jest niedostępny. Wiadomość można wysłać ponownie.');
 }finally{
  clearTimeout(timeout);typing.remove();conversation.requesting=false;settle();
 }
}

route=text=>agentSend(text);
$('#cam').setAttribute('aria-label','Odczyt zdjęcia dokumentu — niedostępny');
$('#cam').onclick=()=>{enterChat();botText('Odczyt zdjęcia dokumentu nie jest dostępny. Nie wykonano żadnej czynności. Możesz wpisać pytanie lub skorzystać z dyktowania.')};

async function initAgent(){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch('/api/health',{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw new Error('health');
  const data=await response.json();AGENT=!!data.agent;window.AGENT_INFO=data;
  document.dispatchEvent(new CustomEvent('agentinfo',{detail:data}));
 }catch(error){AGENT=false}
 finally{clearTimeout(timeout)}
 app.dataset.agent=AGENT?'configured':'unavailable';
}
const agentHealthReady=initAgent();
