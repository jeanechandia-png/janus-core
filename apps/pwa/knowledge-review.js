import { authHeaders } from './founder-session.js';
let openingReview = false;

export function mountFounderFaceId() {
  if (!globalThis.JanusFounderNative?.enroll || document.querySelector('[data-face-enroll]')) return;
  const host = document.querySelector('.approvals-actions');
  if (!host) return;
  const enroll = document.createElement('button'); enroll.type = 'button'; enroll.className = 'secondary';
  enroll.dataset.faceEnroll = ''; enroll.textContent = 'Vincular Face ID';
  enroll.addEventListener('click', async () => {
    enroll.disabled = true;
    const status = document.querySelector('#approvalsStatus');
    try {
      const token = authHeaders().authorization?.replace(/^Bearer /, '');
      if (!token) throw new Error('Primero entra como Founder en este dispositivo.');
      await globalThis.JanusFounderNative.enroll({ authoritySessionToken: token });
      if (status) status.textContent = 'Face ID vinculado. Ya puedes confirmar cambios desde este dispositivo.';
    } catch (error) { if (status) status.textContent = error.message || String(error); }
    finally { enroll.disabled = false; }
  });
  host.append(enroll);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFounderFaceId, { once: true });
else mountFounderFaceId();

/** One exact proposal, reviewed from the server; never resubmit the original dictation on approval. */
export async function reviewKnowledgeProposal(proposalId) {
  if (!/^kp_[A-Za-z0-9_-]{1,100}$/.test(proposalId || '')) return;
  if (openingReview || document.querySelector('[data-knowledge-review]')) return;
  openingReview = true;
  let data;
  try {
    const response = await fetch(`/api/knowledge/proposals/${encodeURIComponent(proposalId)}`, { headers: authHeaders(), cache: 'no-store' });
    data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo leer la propuesta.');
  } finally { openingReview = false; }
  const dialog = document.createElement('dialog');
  dialog.dataset.knowledgeReview = '';
  dialog.style.cssText = 'max-width:min(540px,94vw);max-height:85dvh;overflow:auto;border:1px solid #9099ae;border-radius:20px;background:#111621;color:#f0f3fa;padding:24px;font:16px/1.5 system-ui;box-shadow:0 24px 80px #0009';
  const title = document.createElement('h2'); title.textContent = 'Revisa el cambio';
  const copy = document.createElement('p'); copy.style.whiteSpace = 'pre-wrap';
  copy.textContent = [...data.readback.lines, ...data.readback.warnings].join('\n');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  status.textContent = 'Aún no se ha aplicado. Tu aprobación afecta solo a esta propuesta.';
  const approve = document.createElement('button'); approve.textContent = 'Confirmar con Face ID'; approve.type = 'button';
  const close = document.createElement('button'); close.textContent = 'Ahora no'; close.type = 'button';
  for (const button of [approve, close]) button.style.cssText = 'font:inherit;padding:12px 16px;border:1px solid #8995ac;border-radius:12px;margin:6px;background:#202c41;color:#fff;cursor:pointer';
  const previousFocus = document.activeElement;
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus?.(); });
  approve.addEventListener('click', async () => {
    approve.disabled = true;
    try {
      const native = globalThis.JanusFounderNative;
      if (!native || typeof native.actionProof !== 'function') {
        throw new Error('Falta activar el puente de Face ID en este iPhone. El cambio sigue pendiente y no se ha aplicado.');
      }
      status.textContent = 'Confirma tu identidad en el dispositivo…';
      const proofId = await native.actionProof({ action: data.biometricAction,
        authoritySessionToken: authHeaders().authorization?.replace(/^Bearer /, ''),
        reason: 'Confirma el cambio que acabas de revisar en JANUS' });
      if (typeof proofId !== 'string' || !/^bio_proof_[A-Za-z0-9_-]+$/.test(proofId)) throw new Error('Face ID no devolvió una prueba válida.');
      const applied = await fetch(`/api/knowledge/proposals/${encodeURIComponent(proposalId)}`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(), 'x-janus-biometric-proof': proofId },
        body: JSON.stringify({ confirmProposalId: proposalId, expectedRevision: data.baseRevision }),
      });
      const result = await applied.json();
      if (!applied.ok) throw new Error(result.error || 'No se pudo aplicar.');
      status.textContent = result.reply;
      approve.hidden = true; close.textContent = 'Cerrar';
      dispatchEvent(new CustomEvent('janus:knowledge-applied', { detail: { proposalId, revision: result.revision } }));
    } catch (error) { status.textContent = error.message || String(error); }
    finally { approve.disabled = false; }
  });
  dialog.append(title, copy, status, approve, close); document.body.append(dialog); dialog.showModal();
}

export function proposalFromEvent(event) {
  const payload = event?.payload;
  if (payload?.tool !== 'knowledge') return null;
  return payload.proposalId || payload.result?.output?.proposalId || null;
}

addEventListener('janus:knowledge-proposal', (event) => {
  reviewKnowledgeProposal(event.detail?.proposalId).catch((error) => {
    dispatchEvent(new CustomEvent('janus:review-error', { detail: { message: error.message || String(error) } }));
  });
});
