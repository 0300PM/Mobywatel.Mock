const letterPanel=document.querySelector('#letterPanel');
const familyPanel=document.querySelector('#familyPanel');
let letterRequest=null;

function openModule(panel,focusTarget){
 panel.classList.add('on');
 syncAccessibility();
 requestAnimationFrame(()=>focusTarget.focus({preventScroll:true}));
}
function closeModule(panel){
 panel.classList.remove('on');
 syncAccessibility();
}
function openLetter(){
 $('#letterResults').replaceChildren();
 openModule(letterPanel,$('#letterBack'));
}
function closeLetter(){
 letterRequest?.abort();
 letterRequest=null;
 closeModule(letterPanel);
}
function openFamily(){
 renderFamily();
 openModule(familyPanel,$('#familyBack'));
}
function closeFamily(){closeModule(familyPanel)}
$('#openLetterModule').addEventListener('click',openLetter);
$('#openFamilyModule').addEventListener('click',openFamily);
$('#seniorLetterModule').addEventListener('click',openLetter);
$('#seniorFamilyModule').addEventListener('click',openFamily);
$('#letterBack').addEventListener('click',closeLetter);
$('#familyBack').addEventListener('click',closeFamily);

function setLetterStatus(text){$('#letterStatus').textContent=text}
async function postJson(url,payload,signal){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Nie udało się wykonać tej czynności.');
 return data;
}
function fileBase64(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Nie udało się odczytać wybranego pliku.'));
  reader.onload=()=>{
   const bytes=new Uint8Array(reader.result),parts=[];
   for(let offset=0;offset<bytes.length;offset+=0x8000)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+0x8000)));
   resolve(btoa(parts.join('')));
  };
  reader.readAsArrayBuffer(file);
 });
}
async function extractLetter(){
 const file=$('#letterFile').files?.[0];
 if(!file){setLetterStatus('Najpierw wybierz plik PDF albo TXT.');$('#letterFile').focus();return}
 if(file.size>4*1024*1024){setLetterStatus('Plik przekracza limit 4 MiB.');return}
 const button=$('#extractLetter');button.disabled=true;setLetterStatus('Odczytuję plik. Tekst nie jest jeszcze wysyłany do modelu AI.');
 try{
  const data=await fileBase64(file);
  const result=await postJson('/api/letter/extract',{filename:file.name,data});
  $('#letterText').value=result.text;
  $('#letterResults').replaceChildren();
  $('#letterConsent').checked=false;
  setLetterStatus(`Odczytano ${result.text.length.toLocaleString('pl-PL')} znaków. Sprawdź tekst, usuń dane osobowe i zaznacz zgodę dopiero przed analizą.`);
  $('#letterText').focus();
 }catch(error){setLetterStatus(error.message||'Nie udało się odczytać pliku.')}
 finally{button.disabled=false}
}
$('#extractLetter').addEventListener('click',extractLetter);
$('#letterFile').addEventListener('change',()=>setLetterStatus($('#letterFile').files?.[0]?.name?`Wybrano plik: ${$('#letterFile').files[0].name}. Wybierz „Odczytaj wybrany plik”, aby zobaczyć tekst.`:''));

function appendText(parent,tag,text,className){
 const node=document.createElement(tag);
 if(className)node.className=className;
 node.textContent=text;
 parent.append(node);
 return node;
}
function renderLetterResult(result){
 const container=document.createElement('section');container.className='assist-card letter-result';container.tabIndex=-1;container.setAttribute('role','region');container.setAttribute('aria-label','Wynik wyjaśnienia pisma');
 appendText(container,'h3','Znaczenie pisma · interpretacja','');
 appendText(container,'p',result.meaning.text,'letter-meaning');
 appendText(container,'h4','Źródło w piśmie','letter-section-title');
 appendText(container,'blockquote',`„${result.meaning.source}”`,'letter-quote');
 const addSection=(heading,items)=>{
  const section=document.createElement('section');
  appendText(section,'h4',heading,'letter-section-title');
  if(!items.length){appendText(section,'p','Model nie wskazał informacji z cytowanym źródłem. Sprawdź tę część w oryginale.','');container.append(section);return}
  const list=document.createElement('ul');
  items.forEach(item=>{
   const li=document.createElement('li');
   const label=item.kind==='fact'?'Fakt z pisma':'Interpretacja';
   appendText(li,'span',label,item.kind==='fact'?'letter-kind fact':'letter-kind interpretation');
   appendText(li,'p',item.text,'');
   appendText(li,'blockquote',`„${item.source}”`,'letter-quote');
   list.append(li);
  });
  section.append(list);container.append(section);
 };
 const deadline=document.createElement('section');
 appendText(deadline,'h4','Termin','letter-section-title');
 if(result.deadline){appendText(deadline,'p',result.deadline.text,'');appendText(deadline,'blockquote',`„${result.deadline.source}”`,'letter-quote')}
 else appendText(deadline,'p','W tekście nie znaleziono jednoznacznie podanego terminu. Nie wyznaczaj go samodzielnie.','');
 container.append(deadline);
 addSection('Co trzeba zrobić?',result.actions);
 addSection('Jakie dokumenty przygotować?',result.documents);
 $('#letterResults').replaceChildren(container);
 container.focus?.({preventScroll:true});
}
async function explainLetter(){
 const text=$('#letterText').value.trim();
 if(!text){setLetterStatus('Wklej treść albo najpierw odczytaj plik.');$('#letterText').focus();return}
 if(text.length>30000){setLetterStatus('Tekst przekracza limit 30 000 znaków.');return}
 if(!$('#letterConsent').checked){setLetterStatus('Zaznacz zgodę po sprawdzeniu i ewentualnym usunięciu danych osobowych.');$('#letterConsent').focus();return}
 const button=$('#explainLetter');button.disabled=true;$('#extractLetter').disabled=true;
 letterRequest=new AbortController();
 setLetterStatus('Wysyłam tekst do skonfigurowanego modelu AI. Odpowiedź może chwilę potrwać.');
 try{
  const payload={text};
  if(['lmstudio','workers'].includes(window.AGENT_INFO?.provider)){const model=window.getLmStudioModel?.();if(model)payload.model=model}
  const data=await postJson('/api/letter/explain',payload,letterRequest.signal);
  renderLetterResult(data.result);
  setLetterStatus('Analiza gotowa. Cytaty pochodzą z tekstu, ale wyjaśnienie modelu może być błędne. Porównaj je z oryginałem.');
  $('#letterResults').scrollIntoView({block:'nearest'});
 }catch(error){if(error.name!=='AbortError')setLetterStatus(error.message||'Nie udało się wyjaśnić pisma.')}
 finally{letterRequest=null;button.disabled=false;$('#extractLetter').disabled=false}
}
$('#explainLetter').addEventListener('click',explainLetter);

const FAMILY_KEY='mobywatel.family-center.demo.v1';
const roleLabels={admin:'Administrator pokazu',member:'Członek',viewer:'Czytelnik'};
function familyId(){return globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
function initialFamily(){return {members:[{id:'me',name:'Ja',role:'admin'}],tasks:[],active:'me'}}
function loadFamily(){
 try{
  const stored=JSON.parse(localStorage.getItem(FAMILY_KEY)||'null');
  if(!stored||!Array.isArray(stored.members)||!Array.isArray(stored.tasks))return initialFamily();
  const members=stored.members.filter(member=>member&&typeof member.id==='string'&&member.id.length<=100&&typeof member.name==='string'&&member.name.length<=40&&Object.hasOwn(roleLabels,member.role)).slice(0,50);
  if(!members.some(member=>member.id==='me'))members.unshift({id:'me',name:'Ja',role:'admin'});
  const ids=new Set(members.map(member=>member.id));
  const tasks=stored.tasks.filter(task=>task&&typeof task.id==='string'&&task.id.length<=100&&typeof task.title==='string'&&task.title.length<=120&&typeof task.owner==='string'&&ids.has(task.owner)&&typeof task.shared==='boolean'&&typeof task.date==='string'&&(task.date===''||/^\d{4}-\d{2}-\d{2}$/.test(task.date))).slice(0,500);
  return {members,tasks,active:ids.has(stored.active)?stored.active:'me'};
 }catch(error){return initialFamily()}
}
let familyState=loadFamily();
function saveFamily(){
 try{localStorage.setItem(FAMILY_KEY,JSON.stringify(familyState));$('#familyStatus').textContent='Zapisano na tym urządzeniu. Nie udostępniono innym urządzeniom.';return true}
 catch(error){$('#familyStatus').textContent='Nie udało się zapisać zmian. Mogą zniknąć po zamknięciu strony.';return false}
}
function currentMember(){return familyState.members.find(member=>member.id===familyState.active)||familyState.members[0]}
function renderFamily(){
 const view=$('#familyView'),previous=familyState.active;
 view.replaceChildren();
 familyState.members.forEach(member=>{
  const option=document.createElement('option');option.value=member.id;option.textContent=`${member.name}, ${roleLabels[member.role]}`;view.append(option);
 });
 view.value=familyState.members.some(member=>member.id===previous)?previous:'me';
 familyState.active=view.value;
 const actor=currentMember(),isAdmin=actor.role==='admin',canAdd=actor.role!=='viewer';
 $('#familyMemberForm').hidden=!isAdmin;
 $('#familyTaskForm').hidden=!canAdd;
 const members=$('#familyMembers');members.replaceChildren();
 const list=document.createElement('ul');
 familyState.members.forEach(member=>{
  const item=document.createElement('li');
  appendText(item,'span',member.name,'family-member-name');
  if(member.id==='me')appendText(item,'span',roleLabels[member.role],'family-role');
  else if(isAdmin){
   const select=document.createElement('select');select.setAttribute('aria-label',`Rola: ${member.name}`);
   Object.entries(roleLabels).forEach(([role,label])=>{const option=document.createElement('option');option.value=role;option.textContent=label;select.append(option)});
   select.value=member.role;select.addEventListener('change',()=>{member.role=select.value;saveFamily();renderFamily();announce(`Zmieniono przykładową rolę osoby ${member.name}.`)});item.append(select);
  }else appendText(item,'span',roleLabels[member.role],'family-role');
  list.append(item);
 });
 members.append(list);
 const tasks=$('#familyTasks');tasks.replaceChildren();
 const visible=familyState.tasks.filter(task=>task.shared||task.owner===actor.id).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
 if(!visible.length){appendText(tasks,'p','Brak zadań widocznych dla tego widoku.','family-empty');return}
 visible.forEach(task=>{
  const card=document.createElement('article');card.className='family-task';
  appendText(card,'h4',task.title,'');
  const owner=familyState.members.find(member=>member.id===task.owner);
  appendText(card,'p',task.shared?`Wspólne zadanie · dodane przez ${owner?.name||'osobę z listy'}`:`Prywatne zadanie · tylko ${owner?.name||'właściciel'}`,'family-task-scope');
  if(task.date)appendText(card,'p',`Termin: ${task.date.split('-').reverse().join('.')}`,'family-task-date');
  if(actor.role!=='viewer'&&(actor.role==='admin'||task.owner===actor.id)){
   const remove=document.createElement('button');remove.type='button';remove.className='assist-button subtle';remove.textContent='Usuń zadanie';remove.setAttribute('aria-label',`Usuń zadanie: ${task.title}`);
   remove.addEventListener('click',()=>{familyState.tasks=familyState.tasks.filter(item=>item.id!==task.id);saveFamily();renderFamily();announce('Usunięto przykładowe zadanie.')});card.append(remove);
  }
  tasks.append(card);
 });
}
$('#familyView').addEventListener('change',event=>{familyState.active=event.target.value;saveFamily();renderFamily();announce(`Widok: ${currentMember().name}, rola ${roleLabels[currentMember().role]}.`)});
$('#familyMemberForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(currentMember().role!=='admin')return;
 const name=$('#familyMemberName').value.trim();
 if(!name){$('#familyMemberName').focus();return}
 if(familyState.members.length>=50){$('#familyStatus').textContent='Osiągnięto limit 50 przykładowych osób.';return}
 const member={id:familyId(),name,role:$('#familyMemberRole').value};
 familyState.members.push(member);$('#familyMemberName').value='';saveFamily();renderFamily();$('#familyView').value=member.id;familyState.active=member.id;saveFamily();renderFamily();$('#familyMemberName').focus();announce(`Dodano osobę ${name} w lokalnym pokazie.`);
});
$('#familyTaskForm').addEventListener('submit',event=>{
 event.preventDefault();
 const actor=currentMember(),title=$('#familyTaskTitle').value.trim(),date=$('#familyTaskDate').value;
 if(actor.role==='viewer'||!title)return;
 if(familyState.tasks.length>=500){$('#familyStatus').textContent='Osiągnięto limit 500 przykładowych zadań.';return}
 familyState.tasks.push({id:familyId(),owner:actor.id,title,date,shared:$('#familyTaskShared').checked});
 $('#familyTaskTitle').value='';$('#familyTaskDate').value='';$('#familyTaskShared').checked=false;saveFamily();renderFamily();$('#familyTaskTitle').focus();announce('Dodano zadanie do przykładowego centrum rodzinnego. Powiadomienie nie zostało wysłane.');
});
window.addEventListener('storage',event=>{if(event.key===FAMILY_KEY){familyState=loadFamily();if(familyPanel.classList.contains('on'))renderFamily()}});
