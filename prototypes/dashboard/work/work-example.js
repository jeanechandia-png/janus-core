'use strict';
/* ===== JANUS Work · datos de EJEMPLO para la vista previa =====
 * Todo es ficticio y tiene la MISMA forma que devuelve GET /api/dashboard/work (ReusableWorkDashboard).
 * Los nombres salen de __WORK_NAME_A__/B/C: el build los sustituye por nombres genéricos, o por los
 * de prototypes/dashboard/local/work-names.json (fuera de Git) en una vista previa privada.
 */
function workExample(nowIso) {
  const now = Date.parse(nowIso), iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
  const caps = { text: true, voice: false, downloadFiles: false, shareOutside: false, approvePayments: false, changePermissions: false, productionDeploy: false, editProjectInstructions: false, uploadAttachments: true };
  const reserved = ['purchases', 'payments', 'contracts', 'permissions', 'critical_deploys', 'project_instructions', 'file_download', 'external_sharing'];
  const day = (offset) => { const d = new Date(now + offset * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ag = (id, who, kind, visibility, offset, time, endTime, text, projectId) => Object.assign({ id, principalId: who, kind, visibility, date: day(offset), text, done: false, createdAt: nowIso, updatedAt: nowIso }, time ? { time } : {}, endTime ? { endTime } : {}, projectId ? { projectId } : {});
  const task = (id, who, title, goal, status, priority, next, minAgo, handoff, agent) => ({
    assignment: Object.assign({ id, title, goal, assigneePrincipalId: who, scopeIds: ['scope-demo'], status, priority, createdBy: 'founder', createdAt: iso(3000), updatedAt: iso(minAgo), nextActions: next }, agent ? { preferredProvider: agent } : {}),
    ...(handoff ? { latestHandoff: handoff } : {}),
  });
  const hand = (id, assignmentId, who, summary, done, pending, blockers, minAgo, evidence) => ({
    id, assignmentId, fromPrincipalId: who, createdAt: iso(minAgo), executiveSummary: summary, conclusions: [], completed: done, pending, blockers, nextActions: pending, decisions: [], evidenceRefs: evidence || [], checksum: 'ejemplo',
  });
  const res = (id, name, source, mimeType, minAgo, addedBy) => ({ id, name, source, mimeType, createdAt: iso(minAgo), addedBy: addedBy || 'founder', viewable: source === 'upload' && /^(image\/(png|jpeg|webp|gif)|application\/pdf|text\/(plain|markdown|csv))$/.test(mimeType) });
  const emptySessions = { open: null, recent: [], todayActiveSeconds: 0, selfReported: true };

  /* ── A · desarrollo (ES) ── */
  const aH = hand('h-a1', 'a-1', 'colab-a', 'Endpoints de autenticación listos y probados en local.', ['Login por desafío y firma', 'Pruebas de permisos por proyecto'], ['Paginación del listado', 'Documentar errores'], [], 1500, ['commit 4f2c1a9 (ejemplo)']);
  const A = {
    templateId: 'janus-work-v1', skinSource: 'iba-command-center', principalId: 'colab-a', locale: 'es',
    labels: { title: 'Centro de trabajo', projects: 'Proyectos', assignments: 'Mis tareas', blockers: 'Bloqueos' },
    profile: { displayName: '__WORK_NAME_A__', roleTitle: 'Desarrollo de API', functions: ['Backend y API', 'Pruebas automáticas', 'Documentación técnica'],
      instructions: 'Trabaja siempre sobre el repositorio autorizado; nada crítico queda solo en tu equipo.\nAntes de dar algo por terminado: pruebas en verde y evidencia en la entrega.\nSi algo implica gasto, contrato o despliegue, se detiene y se consulta al CEO.\nRegistra el punto exacto donde lo dejas al cerrar la sesión.' },
    capabilities: caps, reservedToCeo: reserved,
    assignments: [
      task('a-1', 'colab-a', 'API de proyectos: listado y permisos', 'Exponer el listado de proyectos con permisos por colaborador', 'active', 'high', ['Añadir paginación al listado', 'Documentar códigos de error'], 95, aH, 'anthropic'),
      task('a-2', 'colab-a', 'Pruebas E2E de acceso', 'Verificar que nadie ve proyectos ajenos', 'queued', 'normal', ['Preparar tres usuarios de prueba'], 400),
      task('a-3', 'colab-a', 'Integración de adjuntos', 'Subida de archivos por proyecto', 'blocked', 'normal', ['Esperar autorización del CEO para activar la puerta de carga'], 700),
    ],
    projects: [
      { id: 'p-api', name: 'Proyecto API', status: 'active', description: 'Servicio que conecta la web con el núcleo de datos.', instructions: 'TypeScript estricto. Cada endpoint con prueba de permisos. Ningún secreto en el repositorio.', canWrite: true, ownedByMe: false, localOnly: true,
        nextActions: ['Añadir paginación al listado', 'Documentar códigos de error', 'Revisar con JANUS el plan de pruebas E2E'],
        resumeFrom: { subject: 'Listado de proyectos', content: 'Falta la paginación (cursor) en GET /projects; el filtro por permisos ya pasa las pruebas.', at: iso(95) },
        decisions: [{ subject: 'Autenticación', content: 'Desafío y firma con llave del dispositivo; sin contraseñas compartidas.', at: iso(2900) }, { subject: 'Errores', content: 'Respuesta uniforme para acceso denegado y recurso inexistente.', at: iso(1600) }],
        unresolvedErrors: [{ subject: 'Prueba intermitente', content: 'La prueba de caducidad falla 1 de cada 20 ejecuciones; pendiente de aislar.', at: iso(300) }],
        checkpointAt: iso(95), threads: [{ id: 't-a1', title: 'Paginación', status: 'active', updatedAt: iso(95) }],
        resources: [res('r1', 'Especificación de la API.pdf', 'google_drive', 'application/pdf', 4000), res('r2', 'Plan de pruebas.md', 'upload', 'text/markdown', 1700), res('r3', 'Diagrama de permisos.png', 'upload', 'image/png', 900)] },
      { id: 'p-web', name: 'Web corporativa', status: 'active', description: 'Mantenimiento de la web institucional.', canWrite: false, ownedByMe: false, localOnly: false, nextActions: [], decisions: [], unresolvedErrors: [], threads: [], resources: [res('r4', 'Guía de estilo.pdf', 'google_drive', 'application/pdf', 9000)] },
    ],
    deliveries: [aH, hand('h-a0', 'a-1', 'colab-a', 'Esquema de datos acordado y migración inicial.', ['Tablas de proyectos y miembros'], ['Endpoints de lectura'], [], 4300, [])],
    sessions: { open: { sessionId: 'ws-demo', principalId: 'colab-a', state: 'running', startedAt: iso(128), activeSeconds: 6780, pausedSeconds: 900, pauses: 1, projectId: 'p-api', progress: [{ at: iso(60), note: 'Filtro por permisos en verde' }], blockers: [], deliveries: [], lastEventAt: iso(60) },
      recent: [{ sessionId: 'ws-old', principalId: 'colab-a', state: 'ended', startedAt: iso(1560), endedAt: iso(1290), activeSeconds: 14400, pausedSeconds: 1800, pauses: 2, projectId: 'p-api', progress: [], blockers: [], deliveries: [], lastEventAt: iso(1290) }],
      todayActiveSeconds: 6780, selfReported: true },
    messaging: { recipients: [{ id: 'ceo', label: 'CEO' }], sent: [], inbox: [{ id: 'in-1', fromPrincipalId: 'founder', recipientId: 'colab-a', toPrincipalId: 'colab-a', subject: 'Prioridad de esta semana', body: 'Primero la paginación del listado. Te dejo el esquema adjunto; avísame por aquí cuando esté.', status: 'delivered', decision: 'internal_recipient', createdAt: iso(35), attachments: [{ resourceId: 'r-esquema', name: 'esquema-listado.pdf' }] }] }, agenda: [ag('g1', 'colab-a', 'availability', 'work', 0, '09:00', '14:00', ''), ag('g2', 'colab-a', 'reminder', 'work', 0, '12:30', '', 'Enviar al CEO el avance de la paginación', 'p-api'), ag('g3', 'colab-a', 'reminder', 'private', 1, '17:00', '', 'Recoger el coche del taller'), ag('g4', 'colab-a', 'availability', 'work', 2, '09:00', '13:00', '')],
    usage: { used: 7, limit: 60, remaining: 53 }, generatedAt: nowIso,
  };

  /* ── B · comercial (NL) ── */
  const bH = hand('h-b1', 'b-1', 'colab-b', 'Tien kappers in de regio gebeld; drie willen een demo.', ['Belronde afgerond', 'Notities per zaak vastgelegd'], ['Demo’s inplannen'], [], 220, []);
  const B = {
    templateId: 'janus-work-v1', skinSource: 'iba-command-center', principalId: 'colab-b', locale: 'nl',
    labels: { title: 'Werkdashboard', projects: 'Projecten', assignments: 'Mijn taken', blockers: 'Blokkades' },
    profile: { displayName: '__WORK_NAME_B__', roleTitle: 'Commercieel · Nederland', functions: ['Acquisitie', 'Demo’s geven', 'Klantopvolging'],
      instructions: 'Beloof geen prijzen of kortingen die niet in de prijslijst staan.\nContracten en betalingen lopen altijd via de CEO.\nLeg na elk gesprek vast: wat is afgesproken en wat is de volgende stap.' },
    capabilities: caps, reservedToCeo: reserved,
    assignments: [
      task('b-1', 'colab-b', 'Demo’s inplannen bij drie zaken', 'Drie demo’s deze week', 'active', 'high', ['Twee tijdsloten voorstellen per zaak'], 220, bH, 'gemini'),
      task('b-2', 'colab-b', 'Opvolging offerte', 'Reactie op verstuurde offerte krijgen', 'queued', 'normal', ['Donderdag nabellen'], 1300),
    ],
    projects: [
      { id: 'p-nl', name: 'Acquisitie Nederland', status: 'active', description: 'Lokale ondernemers benaderen voor de chatbot-pilot.', instructions: 'Schrijf en spreek in het Nederlands. Gebruik alleen goedgekeurd materiaal.', canWrite: true, ownedByMe: false, localOnly: false,
        nextActions: ['Twee tijdsloten voorstellen per zaak', 'Demo-script doornemen met JANUS'],
        resumeFrom: { subject: 'Belronde', content: 'Drie zaken willen een demo; data nog niet bevestigd.', at: iso(220) },
        decisions: [{ subject: 'Doelgroep', content: 'Eerst kappers en barbershops in de regio.', at: iso(5000) }], unresolvedErrors: [], checkpointAt: iso(220),
        threads: [{ id: 't-b1', title: 'Belronde', status: 'active', updatedAt: iso(220) }],
        resources: [res('r5', 'Prijslijst 2026.pdf', 'google_drive', 'application/pdf', 6000), res('r6', 'Demo-script.docx', 'upload', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2500)] },
    ],
    deliveries: [bH], sessions: emptySessions, messaging: { recipients: [{ id: 'ceo', label: 'CEO' }], sent: [] }, agenda: [ag('g5', 'colab-b', 'availability', 'work', 0, '10:00', '16:00', ''), ag('g6', 'colab-b', 'reminder', 'work', 2, '11:00', '', 'Offerte nabellen', 'p-nl')],
    usage: { used: 7, limit: 60, remaining: 53 }, generatedAt: nowIso,
  };

  /* ── C · contenido visual (ES) ── */
  const C = {
    templateId: 'janus-work-v1', skinSource: 'iba-command-center', principalId: 'colab-c', locale: 'es',
    labels: { title: 'Centro de trabajo', projects: 'Proyectos', assignments: 'Mis tareas', blockers: 'Bloqueos' },
    profile: { displayName: '__WORK_NAME_C__', roleTitle: 'Fotografía y contenido', functions: ['Sesiones de fotografía', 'Edición', 'Entrega de material'] },
    capabilities: caps, reservedToCeo: reserved,
    assignments: [task('c-1', 'colab-c', 'Selección de fotos para la web', 'Entregar 20 fotos editadas', 'active', 'normal', ['Editar la segunda tanda', 'Subir la selección al proyecto'], 600)],
    projects: [
      { id: 'p-foto', name: 'Contenido visual', status: 'active', description: 'Fotografía y vídeo para web y redes.', canWrite: true, ownedByMe: false, localOnly: false,
        nextActions: ['Editar la segunda tanda'], decisions: [], unresolvedErrors: [], threads: [],
        resources: [res('r7', 'Referencia de estilo.jpg', 'upload', 'image/jpeg', 3000)] },
    ],
    deliveries: [], sessions: emptySessions, messaging: { recipients: [{ id: 'ceo', label: 'CEO' }], sent: [] }, agenda: [],
    usage: { used: 7, limit: 60, remaining: 53 }, generatedAt: nowIso,
  };
  return { 'colab-a': A, 'colab-b': B, 'colab-c': C };
}
