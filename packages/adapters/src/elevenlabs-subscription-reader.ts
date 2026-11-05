/** Safe, read-only ElevenLabs usage adapter. Never fetches generated audio or text history. */
export interface ElevenLabsSubscriptionReaderOptions {
  apiKeyProvider: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}
export class ElevenLabsSubscriptionReader {
  private readonly apiKeyProvider: () => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  constructor(options: ElevenLabsSubscriptionReaderOptions) {
    this.apiKeyProvider = options.apiKeyProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }
  async read(): Promise<unknown | null> {
    const key = (await this.apiKeyProvider())?.trim();
    if (!key) return null; // Missing credentials are unknown, never zero.
    const response = await this.fetchImpl('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: { 'xi-api-key': key, accept: 'application/json' },
      redirect: 'error', // Never forward the secret to another domain.
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error('ElevenLabs subscription HTTP ' + response.status);
    const text = await response.text();
    if (text.length > 60_000) throw new Error('ElevenLabs subscription response too large');
    try { return JSON.parse(text) as unknown; }
    catch { throw new Error('ElevenLabs subscription returned invalid JSON'); }
  }
}
