import { authHeaders, sessionToken } from './founder-session.js';
import { currentLanguage } from './language-buttons.js';

// No new data store: this projection is memory-only and restricted to the current Founder session.
export function homeCardLines(data, language='es') {
  const nl=language==='nl', t=(es,n)=>nl?n:es;
  const unavailable=t('Sin datos verificados','Geen geverifieerde gegevens');
  if (!data?.ok) return {dia:[unavailable],prioridades:[unavailable],ingresos:[unavailable]};
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
  return {dia:[...(agenda.length?agenda:[t('Sin citas pendientes en JANUS','Geen openstaande afspraken in JANUS')]),t('Agenda propia de JANUS · no incluye Calendar externo','Eigen JANUS-agenda · zonder externe Calendar')],prioridades:priorities,ingresos:revenue};
}
export function mountFounderHomeData() {
  let data=null, token='', generation=0, pending=false, checkedAt=0;
  const cards=['dia','prioridades','ingresos'];
  function paint() {
    const lang=currentLanguage('founder');
    const valid=token && token===sessionToken() && Date.now()-checkedAt<90000;
    const lines=homeCardLines(valid?data:null,lang);
    for(const key of cards){
      const node=document.querySelector('[data-home-card="'+key+'"] .jh-card-body');
      if(!node)continue;
      const values=lines[key], signature=JSON.stringify(values);
      if(node.dataset.homeSignature===signature)continue;
      node.dataset.homeSignature=signature;
      const elements=values.map((line,i)=>{const p=document.createElement('p');p.className=i===0?'jh-empty':'jh-note';p.textContent=line;return p;});
      node.replaceChildren(...elements);
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
  const timer=setInterval(()=>void refresh(),30000);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  void refresh();
}
