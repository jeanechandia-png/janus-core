import { createHash, randomBytes } from 'node:crypto';
import type { AuthorityPrincipal } from '../../core/src/authority.js';

export class VoiceAuthorityError extends Error {
  constructor(message: string, readonly status = 403) { super(message); }
}

/** Ephemeral, server-owned binding. A speaker hint never grants authority. */
export class VoiceAuthority {
  private readonly bindings = new Map<string, { hash: string; token: string }>();
  private readonly tickets = new Map<string, { sessionId: string; token: string; expires: number }>();

  constructor(
    private readonly authenticate: (token: string) => AuthorityPrincipal | undefined,
    private readonly now = () => Date.now(),
  ) {}

  bind(sessionId: string, token: string): void {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(sessionId)) throw new VoiceAuthorityError('Invalid voice session identifier', 400);
    const principal = this.authenticate(token);
    if (principal?.role !== 'founder_director') throw new VoiceAuthorityError('Authenticated Founder voice session required', 401);
    const hash = this.hash(token);
    const previous = this.bindings.get(sessionId);
    if (previous && previous.hash !== hash && this.authenticate(previous.token)) {
      throw new VoiceAuthorityError('Voice session belongs to another authenticated session');
    }
    this.prune();
    if (!previous && this.bindings.size >= 100) throw new VoiceAuthorityError('Voice session limit reached', 429);
    this.bindings.set(sessionId, { hash, token });
  }

  principal(sessionId: string): AuthorityPrincipal {
    const binding = this.bindings.get(sessionId);
    const principal = binding && this.authenticate(binding.token);
    if (!principal || principal.role !== 'founder_director') {
      this.bindings.delete(sessionId);
      throw new VoiceAuthorityError('Voice authority session expired; sign in again', 401);
    }
    return principal;
  }

  ticket(sessionId: string, token: string): string {
    this.bind(sessionId, token);
    if (this.tickets.size >= 100) throw new VoiceAuthorityError('Voice ticket limit reached', 429);
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(this.hash(ticket), { sessionId, token, expires: this.now() + 30_000 });
    return ticket;
  }

  consume(ticket: string, sessionId: string): () => void {
    const key = this.hash(ticket);
    const record = this.tickets.get(key);
    this.tickets.delete(key); // one attempt, including a wrong-session attempt
    if (!record || record.expires <= this.now() || record.sessionId !== sessionId) {
      throw new VoiceAuthorityError('Voice ticket is invalid, expired or already used', 401);
    }
    this.bind(sessionId, record.token);
    const boundHash = this.hash(record.token);
    return () => {
      if (this.bindings.get(sessionId)?.hash !== boundHash) throw new VoiceAuthorityError('Voice session was replaced', 401);
      this.principal(sessionId);
    };
  }

  private prune(): void {
    for (const [id, binding] of this.bindings) if (!this.authenticate(binding.token)) this.bindings.delete(id);
    for (const [id, record] of this.tickets) if (record.expires <= this.now() || !this.authenticate(record.token)) this.tickets.delete(id);
  }

  private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
}
