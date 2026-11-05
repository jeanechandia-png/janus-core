# Infinity Interpreter Engine v0.1

**Reusable translation capability** for **Infinity Connect (flagship)**, Janus, Melanie, IBA and authorized automations.

Instead of reinventing STT/TTS, this module builds on existing **VoiceGateway** and model-router concepts. It supplies a provider-neutral contextual **text interpretation** contract and an ephemeral consecutive-session context, independent of JANUS CORE.

- `interpretText(request, translationPort)` handles language, sector, glossary, register, speaker labels and consent.
- `contextualTranslationMessages()` treats transcript and glossary as untrusted data, never as commands.
- `ConsecutiveInterpretationSession` retains only the previous four source turns in memory; `clear()` forgets them.
- The host supplies a local or external model/provider and decides when to run existing STT/TTS.
- External processing requires `allowExternalProcessing: true` per turn. Provider failure blocks rather than invents translation.
- Janus uses the thin Tool Gateway adapter: `interpreter.translate.text`, `interpreter.capabilities.get`.

## Connect consumer example

```ts
const result = await interpretText({
  consumer: 'connect',
  text: 'Buenos días, tengo una cita a las nueve.',
  sourceLanguage: 'es',
  targetLanguage: 'nl',
  context: { domain: 'appointments', register: 'formal' },
}, localTranslationPort);
```

## Release scope

Implemented: contextual text interface, glossary, bounded short-lived context, per-turn provider consent gate, structured output validation, Janus adapter, tests.

Not yet implemented: streaming microphone / audio interpretation end-to-end, speaker diarization, certified simultaneous interpretation, hosted Connect product, billing, offline model weights, or guaranteed translation accuracy. Reuse existing STT/TTS and deploy a dedicated Connect adapter/UI for the next phase. High-stakes translations need human review.
