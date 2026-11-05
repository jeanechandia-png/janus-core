'use strict';
/* FINOPS: lectura/verificación; nunca contabilizar "sin datos" como cero.
 * Entrada: GET /api/finops (misma sesión JANUS autorizada) o
 * window.JANUS_FINOPS_SNAPSHOT desde el runtime autenticado.
 * {generatedAt,providers:[{id,name,source,verifiedAt,budgetEur,spentEur,
 *   monthly:[{month,eur}],daily:[{date,eur}],renewalDate,
 *   creditsUsed,creditsLimit,balanceEur,health,plan,fallback}]}
 * Todas las cantidades se guardan en EUR; si no hay EUR verificados, mostrar N/D.
 */
const FinOps = (() => {
  const catalog = [
    ['elevenlabs','ElevenLabs'],['openai','OpenAI API'],['chatgpt','ChatGPT'],
    ['claude','Claude'],['gemini','Gemini'],['workspace','Google Workspace'],
    ['hostinger','Hostinger'],['vercel','Vercel'],['netlify','Netlify'],
    ['supabase','Supabase'],['whatsapp','WhatsApp / Meta'],['github','GitHub']
  ];
  let snapshot = null, loaded = false, pending = false, connection = 'No conectado';
  const amount = (v) => Number.isFinite(v) && v >= 0 ? new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(v) : 'Sin verificar';
  const val = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  const validDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
  const fresh = (p) => validDate(p.verifiedAt) && Date.now() - Date.parse(p.verifiedAt) >= 0 && Date.now() - Date.parse(p.verifiedAt) <= 86400000;
  function records() {
    const input = snapshot && Array.isArray(snapshot.providers) ? snapshot.providers : [];
    const found = new Map(input.filter(x => x && typeof x.id === 'string').map(x => [x.id.toLowerCase(),x]));
    return catalog.concat(input.filter(x => x && typeof x.id === 'string' && !catalog.some(k => k[0] === x.id.toLowerCase())).map(x => [x.id.toLowerCase(),x.name || x.id]))
      .map(([id,name]) => Object.assign({id,name,source:null,verifiedAt:null,budgetEur:null,spentEur:null,monthly:[],daily:[],health:'unknown'},found.get(id) || {},{id,name:found.get(id)?.name || name}));
  }
  function status(p) {
    if (!fresh(p)) return 'unknown';
    if (p.health === 'down' || p.paymentFailed === true || p.creditsUsed != null && p.creditsLimit != null && p.creditsLimit > 0 && p.creditsUsed >= p.creditsLimit) return 'critical';
    const percentage = val(p.budgetEur) != null && p.budgetEur > 0 && val(p.spentEur) != null ? p.spentEur / p.budgetEur * 100 :
      val(p.creditsUsed) != null && val(p.creditsLimit) != null && p.creditsLimit > 0 ? p.creditsUsed / p.creditsLimit * 100 : null;
    if (percentage == null) return 'unknown';
    if (percentage >= 85) return 'critical';
    if (percentage >= 70 || p.health === 'degraded') return 'warning';
    return 'healthy';
  }
  const badge = s => s === 'critical' ? ['Crítico','fi-red'] : s === 'warning' ? ['Atención','fi-amber'] : s === 'healthy' ? ['Correcto','fi-green'] : ['Sin verificar','fi-grey'];
  function counters() {
    return records().reduce((a,p) => { a[status(p)]++;return a; },{critical:0,warning:0,healthy:0,unknown:0});
  }
  function compact() {
    const c = counters(), checked = c.healthy+c.critical+c.warning;
    const label = c.critical ? c.critical+' críticas' : c.warning ? c.warning+' alertas' : checked ? 'Sin alertas' : 'Sin datos';
    const kind = c.critical ? 'fi-red' : c.warning ? 'fi-amber' : checked ? 'fi-green' : 'fi-grey';
    return {label,kind};
  }
  function chip() { const c=compact();return '<span class="chip fi-chip go '+c.kind+'"' + goAttr('plataformas','Consumo y suscripciones') + '>◉ <b>Costes</b> · '+esc(c.label)+'</span>'; }
  function chipB(chipFactory) { const c=compact(); return chipFactory(c.kind === 'fi-red' ? 'bad' : c.kind === 'fi-amber' ? 'warn' : '', 'plataformas','Control de costes','◉ <b>Costes</b> · '+esc(c.label)); }
  function mobileChip() { const c=compact();return '<div class="fi-mobile go '+c.kind+'"' + goAttr('plataformas','Control de plataformas') + '>◉ Costes y plataformas <b>'+esc(c.label)+'</b> ›</div>'; }
  function safeSeries(p,field,key) {
    return (Array.isArray(p[field]) ? p[field] : []).filter(r=>r&&typeof r[key]==='string'&&val(r.eur)!=null).sort((a,b)=>a[key].localeCompare(b[key])).slice(- (field==='monthly'?12:31));
  }
  function graph(series,key,title) {
    if (!series.length) return '<section class="fi-graph"><h3>'+esc(title)+'</h3><div class="fi-blank">Sin histórico de consumo verificado. No se representan importes ficticios.</div></section>';
    const max = Math.max(0.01,...series.map(x=>x.eur));
    return '<section class="fi-graph"><h3>'+esc(title)+'</h3><div class="fi-bars" role="img" aria-label="'+esc(title)+'">'+series.map(x=>{
      const height = Math.max(2,Math.round(x.eur/max*100));
      return '<div class="fi-barcol" title="'+esc(x[key])+': '+esc(amount(x.eur))+'"><span class="fi-barvalue">'+esc(amount(x.eur))+'</span><div class="fi-bar" style="height:'+height+'%"></div><small>'+esc(x[key].slice(key==='month'?5:8))+'</small></div>';
    }).join('')+'</div><p class="fi-disclaimer">Gráfica de registros aportados por la fuente; no demuestra que el período esté completo.</p></section>';
  }
  function tableCard(p) {
    const state = status(p), b=badge(state);
    return '<div class="fi-provider go"'+goAttr('plataformas/'+encodeURIComponent(p.id),'Detalle de '+p.name)+'><span class="fi-dot '+b[1]+'"></span><strong>'+esc(p.name)+'</strong><span class="fi-money">'+amount(val(p.spentEur))+'</span><small class="'+b[1]+'">'+b[0]+'</small><span class="fi-chevron">›</span></div>';
  }
  function detail(sub,M) {
    const all=records(), c=counters();
    const selected = sub ? all.find(p=>p.id===decodeURIComponent(sub)) : null;
    const measured = all.filter(p=>val(p.spentEur)!=null&&fresh(p));
    const total = measured.length ? measured.reduce((x,p)=>x+p.spentEur,0) : null;
    const header = '<div class="fi-header"><div><h2>'+ (selected ? esc(selected.name) : 'Control de plataformas') +'</h2><p>Facturación, cuotas y disponibilidad · importes en euros</p></div><div class="fi-updated">'+esc(snapshot?.generatedAt && validDate(snapshot.generatedAt) ? 'Datos: '+new Date(snapshot.generatedAt).toLocaleString('es-ES') : connection)+'</div></div>';
    const note = '<div class="fi-note">Fuentes no conectadas o desactualizadas = SIN VERIFICAR, nunca 0 € ni estado verde. Los planes personales y las API se supervisan por separado; no se presupone ninguna suscripción activa.</div>';
    if(selected){
      const s=status(selected),b=badge(s);
      const facts = [
        ['Estado','<span class="'+b[1]+'">'+b[0]+'</span>'],
        ['Consumo del período',amount(val(selected.spentEur))],
        ['Presupuesto',amount(val(selected.budgetEur))],
        ['Créditos utilizados',val(selected.creditsUsed) == null ? 'Sin verificar' : Number(selected.creditsUsed).toLocaleString('es-ES')],
        ['Límite de créditos',val(selected.creditsLimit)==null?'Sin verificar':Number(selected.creditsLimit).toLocaleString('es-ES')],
        ['Plan',esc(selected.plan||'Sin verificar')],
        ['Próxima renovación',esc(selected.renewalDate||'Sin verificar')],
        ['Plan B',esc(selected.fallback||'Sin verificar')],
        ['Fuente',esc(selected.source||'No conectada')],
        ['Comprobado',esc(selected.verifiedAt||'Sin verificar')]
      ];
      return frame('plataformas',sub,M,header+'<div class="fi-return go"'+goAttr('plataformas','Volver a plataformas')+'>← Todas las plataformas</div><div class="fi-facts">'+facts.map(f=>'<div><small>'+f[0]+'</small><b>'+f[1]+'</b></div>').join('')+'</div><div class="fi-graphs">'+graph(safeSeries(selected,'daily','date'),'date','Consumo diario')+graph(safeSeries(selected,'monthly','month'),'month','Evolución mensual')+'</div>'+note);
    }
    const dailyMap=new Map(),monthlyMap=new Map();
    all.forEach(p=>{safeSeries(p,'daily','date').forEach(x=>dailyMap.set(x.date,(dailyMap.get(x.date)||0)+x.eur));safeSeries(p,'monthly','month').forEach(x=>monthlyMap.set(x.month,(monthlyMap.get(x.month)||0)+x.eur));});
    const daily=Array.from(dailyMap,([date,eur])=>({date,eur})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-31);
    const monthly=Array.from(monthlyMap,([month,eur])=>({month,eur})).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
    return frame('plataformas',sub,M,header+'<div class="fi-summary"><div class="fi-stat"><small>Consumo registrado (parcial)</small><strong>'+amount(total)+'</strong></div><div class="fi-stat fi-red"><small>Críticas</small><strong>'+c.critical+'</strong></div><div class="fi-stat fi-amber"><small>Atención</small><strong>'+c.warning+'</strong></div><div class="fi-stat fi-grey"><small>Sin verificar</small><strong>'+c.unknown+'</strong></div></div><div class="fi-graphs">'+graph(daily,'date','Consumo diario registrado')+graph(monthly,'month','Consumo mensual registrado')+'</div><h3 class="fi-subhead">Plataformas · tocar para ver detalle</h3><div class="fi-providers">'+all.map(tableCard).join('')+'</div>'+note);
  }
  async function load() {
    if (pending||loaded) return;
    pending=true;
    try {
      if (window.JANUS_FINOPS_SNAPSHOT && Array.isArray(window.JANUS_FINOPS_SNAPSHOT.providers)) {
        snapshot=window.JANUS_FINOPS_SNAPSHOT;
        connection='Fuente interna';
      } else if (location.protocol==='http:'||location.protocol==='https:') {
        const response=await fetch('/api/finops',{credentials:'same-origin',headers:{Accept:'application/json'}});
        if(response.ok){
          const raw=await response.json();
          if(raw && Array.isArray(raw.providers)){ snapshot=raw; connection='API JANUS'; }
        }
      }
    }catch(_error){connection='Sin conexión con la fuente';}
    finally {pending=false;loaded=true;}
  }
  return {load,chip,chipB,mobileChip,detail,status,records,counters};
})();