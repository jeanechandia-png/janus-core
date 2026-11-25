import { authHeaders, sessionToken } from './founder-session.js';
import { currentLanguage } from './language-buttons.js';

// No new data store: this projection is memory-only and restricted to the current Founder session.
export function homeCardLines(data, language='es') {
  const nl=language==='nl', t=(es,n)=>nl?n:es;
  const unavailable=t('Sin datos verificados','Geen geverifieerde gegevens');
  if (!data?.ok) return {dia:[unavailable],prioridades:[unavailable],ingresos:[unavailable],clientes:[unavailable]};
  const items=Array.isArray(data.agenda?.items)?data.agenda.items:[];
  const agenda=items.map(item=>[item.time,item.text].filter(Boolean).join(' · '));
  const feeds=data.feeds, approvals=data.approvals;
  const priorities=[];
  if(Number.isSafeInteger(approvals?.pending)) priorities.push(t('Aprobaciones: ','Goedkeuringen: ')+approvals.pending);
  if(Number.isSafeInteger(feeds?.newRequests)) priorities.push(t('Solicitudes nuevas: ','Nieuwe aanvragen: ')+feeds.newRequests+' ('+feeds.connected+'/'+feeds.total+')');
  else priorities.push(t('Solicitudes externas sin verificar','Externe aanvragen niet geverifieerd'));
  const rev=data.revenue;
  const revenue=rev?.verified===true && rev.currency==='EUR' && Number.isSafeInteger(rev.minor)
    ? [new Intl.NumberFormat(nl?'nl-NL':'es-NL',{style:'currency',currency:'EUR'}).format(rev.minor/100),
       t('Ventas registradas con justificante · ','Geboekte omzet met bewijs · ')+rev.from+' – '+rev.to]
    : [unavailable,t('Contabilidad EUR: sin asientos verificados suficientes','EUR-boekhouding: onvoldoende geverifieerde boekingen')];
  return {dia:[...(agenda.length?agenda:[t('Sin citas pendientes en JANUS','Geen openstaande afspraken in JANUS')]),t('Agenda propia de JANUS · no incluye Calendar externo','Eigen JANUS-agenda · zonder externe Calendar')],prioridades:priorities,ingresos:revenue,clientes:[Number.isSafeInteger(feeds?.newRequests)?t('Solicitudes nuevas: ','Nieuwe aanvragen: ')+feeds.newRequests+' ('+feeds.connected+'/'+feeds.total+')':unavailable,t('Solicitudes no equivalen a clientes confirmados','Aanvragen zijn geen bevestigde klanten')]};
}
export function mountFounderHomeData() {
  let data=null, token='', generation=0, pending=false, checkedAt=0;
  const cards=['dia','prioridades','ingresos','clientes'];
  const signatures=new WeakMap();
  function paint() {
    const lang=currentLanguage('founder');
    const valid=token && token===sessionToken() && Date.now()-checkedAt<90000;
    const lines=homeCardLines(valid?data:null,lang);
    for(const key of cards){
      const nodes=document.querySelectorAll('[data-home-card="'+key+'"] .jh-card-body,[data-founder-live="'+key+'"]');
      for(const node of nodes){
        const values=lines[key], signature=JSON.stringify(values);
        if(signatures.get(node)===signature)continue;
        signatures.set(node,signature);
        const elements=values.map((line,i)=>{const p=document.createElement('p');p.className=i===0?'jh-empty':'jh-note';p.textContent=line;return p;});
        node.replaceChildren(...elements);
      }
    }
  }
  async function refresh(){
    const current=sessionToken()||'';
    if(current!==token){generation++;token=current;data=null;pending=false;checkedAt=0;paint();}
    if(!token||pending||document.hidden){paint();return;}
    const id=++generation;pending=true;
    try{
      const response=await fetch('/api/founder/home-summary',{headers:authHeaders(),cache:'no-store',signal:AbortSignal.timeout(10000)});
      const body=response.ok?await response.json():null;
      if(id===generation&&token===sessionToken()){data=body?.ok===true?body:null;checkedAt=Date.now();}
    }catch{if(id===generation){data=null;checkedAt=0;}}
    finally{if(id===generation){pending=false;paint();}}
  }
  const root=document.getElementById('app');
  if(root)new MutationObserver(paint).observe(root,{childList:true,subtree:true});
  document.addEventListener('janus:language-changed',paint);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  let timer=setInterval(()=>void refresh(),30000);
  addEventListener('pagehide',()=>{clearInterval(timer);generation++;pending=false;checkedAt=0;data=null;paint();});
  addEventListener('pageshow',event=>{if(event.persisted){clearInterval(timer);timer=setInterval(()=>void refresh(),30000);void refresh();}});
  addEventListener('online',()=>void refresh());
  let readiness=null, readinessToken='', readinessBusy=false;
  function paintReadiness(){
    const target=document.querySelector('[data-integration-readiness]');
    if(!target)return;
    const nl=currentLanguage('founder')==='nl';
    const labels={verified:nl?'Geverifieerd':'Verificado',needs_auth:nl?'Autorisatie nodig':'Autorización necesaria',denied:nl?'Toegang geweigerd':'Acceso denegado',unavailable:nl?'Niet beschikbaar':'No disponible',invalid_response:nl?'Ongeldig antwoord':'Respuesta no válida',not_connected:nl?'Niet verbonden':'No conectado'};
    const names={'gmail':'Gmail','calendar':'Google Calendar','infinity-business-assistant':'IBA','infinity-chatbox':'Infinity ChatBox','infinityseed-group':'InfinitySeed Group'};
    const valid=readinessToken&&readinessToken===sessionToken();
    const lines=valid&&readinessBusy?[nl?'Controleren…':'Comprobando…']:valid&&readiness?.ok?[new Date(readiness.checkedAt).toLocaleString(nl?'nl-NL':'es-NL'),...readiness.results.map(item=>(names[item.service]||item.service)+': '+(labels[item.state]||labels.unavailable))]:[nl?'Nog niet geverifieerd':'Sin comprobar'];
    if(signatures.get(target)===JSON.stringify(lines))return;
    signatures.set(target,JSON.stringify(lines));
    target.replaceChildren(...lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  }
  document.addEventListener('click',async event=>{
    if(!event.target.closest?.('[data-check-integrations]')||readinessBusy)return;
    readinessToken=sessionToken()||'';readiness=null;
    if(!readinessToken){paintReadiness();return;}
    readinessBusy=true;paintReadiness();
    try{const response=await fetch('/api/founder/integration-readiness',{method:'POST',headers:authHeaders(),cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(response.ok&&readinessToken===sessionToken())readiness=await response.json();
    }catch{/* leave unverified */}
    finally{readinessBusy=false;paintReadiness();}
  });
  if(root)new MutationObserver(paintReadiness).observe(root,{childList:true,subtree:true});
  document.addEventListener('janus:language-changed',paintReadiness);
  addEventListener('pagehide',()=>{readiness=null;readinessToken='';paintReadiness();});
  void refresh();
}
