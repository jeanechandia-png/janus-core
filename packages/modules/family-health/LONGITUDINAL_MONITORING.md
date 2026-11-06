# JANUS Family Health — longitudinal monitoring extension (2026-11-06)

## Added
- `src/longitudinal-monitoring.ts`: opt-in observation model for heart rate, sleep, respiratory rate, snoring, blood oxygen, ECG references and symptoms.
- Time-limited seasonal monitoring plan; disabled mode prevents collection in the pure planning layer.
- Self-reported and device-observed episodes, duration, context and relief measures.
- Clinician-facing structured summary with source, date, units and explicit non-diagnostic limitations.
- Synthetic tests: `tests/family-health-longitudinal.test.ts`.

## Not connected / not certified
- No HealthKit, Google Home, Fitbit, Nest Hub, Google Health Connect or microphone/snore sensor access is connected. A Google Home speaker does not automatically expose sleep sensing; feature availability depends on the exact model and integration.
- No native background monitoring or automated trigger based on user chat statements. This requires an authenticated, consent-scoped event handler and an available sensor source.
- No persistent encrypted health database, authenticated report export, dashboard integration, notification delivery or emergency dispatch.
- The report builder is pure: callers must enforce profile authorization and consent before loading or passing health data.
- No child medical alert thresholds, sleep-apnea diagnoses, automatic 112 calling, or changes to vendor-native alerts.
- Tests committed but not executed in this session; PR remains draft and production unchanged.

## Integration acceptance criteria
1. Confirm active JANUS dashboard branch and safely integrate the existing PR without overwriting concurrent work.
2. Connect native HealthKit bridge with per-type authorization, or an explicitly supported Android/Google sensor source. Confirm exact device models.
3. Implement authenticated and encrypted per-profile storage, retention/deletion, audit, and consent revocation.
4. Connect a user-requested seasonal tracking command to a signed monitoring plan; never start collecting merely because health is mentioned.
5. Display a profile-scoped timeline and generate an export for medical consultation, with measured vs self-reported data separated.
6. Validate alerts with appropriate clinical input and test device disconnect, stale data, permissions and notification delivery.
7. Keep emergency calling user-initiated unless a separate, verified emergency integration and explicit authorization exists.
