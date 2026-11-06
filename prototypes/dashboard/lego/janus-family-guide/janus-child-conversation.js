'use strict';
/*
 * JANUS LEGO: bridge from the child evidence policy to the real companion
 * conversation. Safe offline; no network, biometrics, telemetry or raw log.
 * This is not monitoring, diagnosis, emergency assistance or a notification.
 */
const JanusChildConversation = (() => {
  const SEVERITY = Object.freeze({
    urgent: 'urgente',
    bullying: 'importante',
    distress: 'atencion',
    diagnosis: 'atencion',
    body: 'atencion'
  });
  const TOPICS = Object.freeze({
    urgent: 'seguridad',
    bullying: 'acoso',
    distress: 'bienestar',
    diagnosis: 'consulta de salud',
    body: 'respeto al cuerpo'
  });
  const MAX_LOCAL_NOTES = 25;

  function fallbackResult() {
    // Missing child-safety code must never silently fall back to a generic LLM.
    return {
      say: ['No puedo revisar ese mensaje de forma segura ahora. Busca a Jean, a tu profesora o a otro adulto de confianza para hablarlo.'],
      safety: {
        parentAlert: {
          severity: 'atencion',
          summary: 'El control infantil local no estaba disponible. Revisar su funcionamiento en este dispositivo.'
        }
      },
      review: 'safety-module-unavailable'
    };
  }

  /**
   * The only information eligible for the local parent note is the
   * severity/topic code. Never write the child's message or an excerpt.
   * Caller is responsible for saving the note locally and showing it honestly.
   */
  function respond(text, fallback) {
    const policy = typeof window !== 'undefined' && window.JanusChildSafety;
    if (!policy || typeof policy.assess !== 'function') return fallbackResult();
    const original = String(text || '').slice(0, 200);
    let previous = { severity: 'ninguna' };
    try {
      if (typeof Companion !== 'undefined' && typeof Companion.checkMessage === 'function')
        previous = Companion.checkMessage(original) || previous;
    } catch (_) { return fallbackResult(); }

    let assessed;
    try { assessed = policy.assess(original, previous); }
    catch (_) { return fallbackResult(); }

    if (assessed) {
      const severity = SEVERITY[assessed.topic] || 'atencion';
      const topic = TOPICS[assessed.topic] || 'bienestar';
      // Parent notes are visible only in this device's demo parent panel.
      // They are NOT sent to Jean or any third-party service.
      const parentAlert = assessed.notifyAdult ? {
        severity,
        summary: 'Revisión local pendiente: tema de ' + topic + '. Hablarlo personalmente con un adulto de confianza.'
      } : null;
      return {
        say: [assessed.reply],
        safety: { parentAlert, severity, topics: [assessed.topic] },
        review: 'child-evidence-policy',
        reference: assessed.reference,
        requiresProfessional: !!assessed.requiresProfessional
      };
    }
    // Legacy companion filter is retained for topics not covered by the new
    // evidence policy; no regression in existing conversations or rewards.
    if (typeof fallback !== 'function') return fallbackResult();
    const result = fallback();
    return result && Array.isArray(result.say) ? result : fallbackResult();
  }

  function appendLocalAlert(current, alert, at) {
    const previous = Array.isArray(current) ? current : [];
    if (!alert || !['urgente', 'importante', 'atencion'].includes(alert.severity) ||
        typeof alert.summary !== 'string') return previous;
    // Strict allowlist so no caller can write the child's message into notes.
    const safeSummary = /^Revisión local pendiente: tema de (seguridad|acoso|bienestar|consulta de salud|respeto al cuerpo)\./.test(alert.summary)
      ? alert.summary
      : 'Revisión local pendiente: conversación sensible. Hablar personalmente con un adulto de confianza.';
    return [...previous, {
      at: String(at || '').slice(0, 32),
      severity: alert.severity,
      summary: safeSummary
    }].slice(-MAX_LOCAL_NOTES);
  }

  return Object.freeze({ respond, appendLocalAlert, MAX_LOCAL_NOTES });
})();
window.JanusChildConversation = JanusChildConversation;
