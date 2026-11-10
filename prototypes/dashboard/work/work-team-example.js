'use strict';
/* Datos de EJEMPLO para la vista de equipo (misma forma que GET /api/work/team). Todo ficticio. */
function teamExample(nowIso) {
  const now = Date.parse(nowIso), iso = (min) => new Date(now - min * 60000).toISOString();
  const day = (offset) => { const d = new Date(now + offset * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const hand = (id, a, who, summary, done, pending, blockers, min, ev) => ({ id, assignmentId: a, fromPrincipalId: who, createdAt: iso(min), executiveSummary: summary, completed: done, pending, blockers, evidenceRefs: ev || [] });
  const h1 = hand('h1', 'a-1', 'colab-a', 'Endpoints de autenticación listos y probados.', ['Login', 'Permisos'], ['Paginación'], [], 95, ['commit 4f2c1a9 (ejemplo)']);
  const h2 = hand('h2', 'b-1', 'colab-b', 'Diez negocios llamados; tres quieren demostración.', ['Ronda de llamadas'], ['Agendar demos'], [], 220);
  const task = (id, who, title, status, priority, min, agent, last) => ({ assignment: Object.assign({ id, title, assigneePrincipalId: who, status, priority, updatedAt: iso(min) }, agent ? { preferredProvider: agent } : {}), latestHandoff: last || null });
  return {
    ok: true, generatedAt: nowIso,
    members: [
      { principalId: 'colab-a', displayName: '__WORK_NAME_A__', roleTitle: 'Desarrollo de API', locale: 'es', status: 'active', openSession: { state: 'running' }, todayActiveSeconds: 6780, usage: { used: 7, limit: 60 } },
      { principalId: 'colab-b', displayName: '__WORK_NAME_B__', roleTitle: 'Comercial · Países Bajos', locale: 'nl', status: 'active', openSession: { state: 'paused' }, todayActiveSeconds: 3200, usage: { used: 3, limit: 60 } },
      { principalId: 'colab-c', displayName: '__WORK_NAME_C__', roleTitle: 'Fotografía y contenido', locale: 'es', status: 'active', openSession: null, todayActiveSeconds: 0, usage: { used: 0, limit: 60 } },
    ],
    assignments: [
      task('a-1', 'colab-a', 'API de proyectos: listado y permisos', 'active', 'high', 95, 'anthropic', h1),
      task('a-3', 'colab-a', 'Integración de adjuntos', 'blocked', 'normal', 700),
      task('b-1', 'colab-b', 'Agendar tres demostraciones', 'active', 'high', 220, 'gemini', h2),
      task('c-1', 'colab-c', 'Selección de fotos para la web', 'active', 'normal', 600),
    ],
    deliveries: [h1, h2],
    agenda: [
      { id: 'g1', principalId: 'colab-a', kind: 'availability', date: day(0), time: '09:00', endTime: '14:00', text: '' },
      { id: 'g5', principalId: 'colab-b', kind: 'availability', date: day(0), time: '10:00', endTime: '16:00', text: '' },
      { id: 'g2', principalId: 'colab-a', kind: 'reminder', date: day(0), time: '12:30', text: 'Enviar al CEO el avance de la paginación', projectId: 'p-api' },
      { id: 'g4', principalId: 'colab-a', kind: 'availability', date: day(2), time: '09:00', endTime: '13:00', text: '' },
    ],
    invites: [
      { id: 'invite_ejemplo-julio', principalId: 'julio', displayName: 'Julio', locale: 'es', status: 'pending', expired: false, createdBy: 'founder', createdAt: iso(20), expiresAt: iso(-71 * 60) },
      { id: 'invite_ejemplo-robin', principalId: 'robin', displayName: 'Robin', locale: 'nl', status: 'pending', expired: false, createdBy: 'founder', createdAt: iso(18), expiresAt: iso(-71 * 60) },
    ],
    fileAccess: [
      { id: 'f1', principalId: 'colab-a', resourceId: 'r2', projectId: 'p-api', name: 'Plan de pruebas.md', action: 'view', at: iso(40) },
      { id: 'f2', principalId: 'colab-b', resourceId: 'r6', projectId: 'p-nl', name: 'Guion de demostración.docx', action: 'view', at: iso(180) },
    ],
    messages: [
      { id: 'm1', fromPrincipalId: 'colab-a', recipientId: 'ceo', projectId: 'p-api', subject: 'Necesito acceso de lectura al repositorio de pruebas', body: 'Para terminar las pruebas E2E necesito ver el repositorio de pruebas. ¿Me lo autoriza?', status: 'delivered', decision: 'internal_recipient', createdAt: iso(50) },
      { id: 'm2', fromPrincipalId: 'colab-b', recipientId: 'external', subject: 'Enviar oferta a mi correo personal', body: 'Quería reenviarme la oferta.', status: 'rejected', decision: 'recipient_outside_company', createdAt: iso(300) },
    ],
    recipients: [{ id: 'ceo', label: 'CEO' }],
    projects: [
      { id: 'p-api', name: 'Proyecto API', status: 'active', createdBy: 'founder', localOnly: true },
      { id: 'p-nl', name: 'Captación Países Bajos', status: 'active', createdBy: 'founder', localOnly: false },
      { id: 'p-foto', name: 'Contenido visual', status: 'active', createdBy: 'colab-c', localOnly: false },
    ],
    providers: { configured: ['anthropic', 'openai', 'gemini'], dailyLimit: 60 },
  };
}
