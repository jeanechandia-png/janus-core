# JANUS — Family Health integration status

This is a domain module inside the canonical JANUS repository, not a second product.

## Implemented in this PR
- Separate Founder/child profile identifiers.
- Metric-scoped access grants, revocation handling, and fail-closed cross-profile reads.
- Validated metric units, timestamps and measurement provenance.
- Explicit `no_connection` and `no_measurement` UI states.
- No fabricated measurements, clinical interpretation, or adult threshold alerts for children.
- Unit tests with synthetic fixtures.

## Not yet implemented
- Apple HealthKit entitlement, native iOS/watchOS companion and per-type read authorization. Safari PWA cannot directly access HealthKit.
- Samsung Health / Health Connect adapter for compatible Android devices.
- Private encrypted persistence, authenticated API endpoints, and audit trail; pure module access checks are NOT a server security boundary.
- JANUS dashboard widgets and separate actual device installations.
- Validated medical alert rules, notifications, and end-to-end device tests.
- Blood pressure requires a compatible measurement source; Apple Watch alone must not be treated as a cuff measuring mmHg.

## Acceptance gates
1. Confirm canonical active JANUS dashboard branch and integrate without overwriting parallel work.
2. Choose native iOS companion/bridge, request HealthKit permissions individually on the device.
3. Authenticate both profiles and verify authorization at the backend, not only in UI.
4. Store samples privately with consent, provenance, deletion/revocation and retention controls.
5. Test with real devices and permissions, including denial/revocation and offline behavior.
6. Enable alerts only after clinical review of appropriate age-specific rules; never rely on JANUS as emergency monitoring.

No device has been connected; no live health readings or alerts have been tested.
