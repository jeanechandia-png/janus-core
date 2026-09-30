# Multi-operator coordination

Janus coordinates multiple authenticated human operators without making any operator, model provider or individual session a single point of failure.

## Invariants

1. **Founder private scope stays private by default.** Assignment alone never grants access.
2. **Access is explicit.** A collaborator needs an active authenticated principal plus a scope grant with the required permission.
3. **Janus Core can coordinate local state globally without impersonating the Founder.** Core-wide visibility is not human authority for privileged external writes.
4. **Operators are least-privilege principals.** An `operator` can authenticate, ask Janus for help and work inside delegated scopes, but the Administrative Authority Control Plane still denies privileged actions that require Founder/Administrator authority.
5. **Handoffs are durable and evidence-linked.** A linked run ending in completed, blocked, failed or cancelled state produces an immutable handoff with a SHA-256 checksum.
6. **Provider independence.** Handoffs and assignments live in Janus SQLite; Claude, ChatGPT or any other model may disappear without losing the work state.

## Durable objects

- **Operator Profile** — operational identity/status; separate from secrets and private keys.
- **Coordination Scope** — a named access boundary: `private`, `shared`, `project` or `system`.
- **Grant** — explicit permission set for one principal and one scope.
- **Assignment** — goal, assignee, priority, scopes and next actions.
- **Handoff** — executive summary, conclusions, completed work, pending work, blockers, next actions, decisions and evidence references.

The handoff schema is intentionally model-independent. A future model can summarize or enrich it, but Janus Core owns the durable record and checksum.

## Permissions

Current coordination permissions:

- `read_context`
- `write_work`
- `coordinate`
- `handoff`

Revoked operator credentials invalidate active sessions. Runtime revocation also revokes active coordination grants for that principal so re-enrolling the same principal does not silently restore old access.

## Runtime flow

```text
Founder
  -> enroll operator public key
  -> create scope
  -> grant permissions
  -> create assignment

Operator
  -> P-256 challenge authentication
  -> GET /api/coordination
  -> POST /api/command { assignmentId, ... }
  -> work through normal Janus planner/tool/runtime path

Janus Core
  -> verifies scope permission before linked run
  -> records operator + assignment in run/conversation metadata
  -> executes under normal Blueprint / Authority / Delivery Gate rules
  -> on terminal state creates Coordination Handoff
  -> appends coordination_handoff Decision Receipt
  -> next authorized operator resumes from the durable brief
```

## Runtime endpoints

Founder-only mutations:

- `POST /api/auth/operator/delegate`
- `POST /api/auth/operator/revoke`
- `POST /api/coordination/scopes`
- `POST /api/coordination/grants`
- `POST /api/coordination/grants/:grantId/revoke`
- `POST /api/coordination/assignments`

Authenticated collaboration:

- `GET /api/coordination` — filtered brief for the authenticated principal.
- `POST /api/coordination/assignments/:assignmentId/handoffs` — explicit/manual handoff when needed.
- `POST /api/command` with `assignmentId` — linked run; access is revalidated before starting.

## What is not implied

- Operator authentication does not grant access to Founder-private services or accounts.
- A shared assignment does not grant access outside its scopes.
- Janus-wide local coordination visibility does not grant a model or tool unrestricted credentials.
- This layer does not yet synchronize each operator's external calendar/availability automatically. That requires per-identity adapters and credential isolation; it is a separate productive integration.

## Next integration

1. Per-operator agenda/availability view: assignments + calendar adapters + manual availability.
2. Next-operator selection and shift scheduling based on availability and permissions.
3. PWA mobile coordination console showing current operator, current assignment, latest handoff, blockers and next actions.
4. Multi-model routing remains independent: an operator can continue with another available model or offline-capable path without changing coordination state.
