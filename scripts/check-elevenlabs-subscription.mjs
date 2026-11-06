#!/usr/bin/env node
/**
 * Read-only ElevenLabs subscription/credit status.
 * Inject ELEVENLABS_API_KEY from OS secure storage; never commit it.
 * Reports only operational fields; no credentials or invoice details.
 */
const key = process.env.ELEVENLABS_API_KEY?.trim();
if (!key) {
  console.error('ElevenLabs status unavailable: secure API credential not configured');
  process.exitCode = 2;
} else {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': key, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('subscription API returned HTTP ' + response.status);
    const data = await response.json();
    const safeNumber = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
    process.stdout.write(JSON.stringify({
      tier: typeof data.tier === 'string' ? data.tier : null,
      status: typeof data.status === 'string' ? data.status : null,
      characters_used: safeNumber(data.character_count),
      characters_limit: safeNumber(data.character_limit),
      voice_slots_used: safeNumber(data.voice_slots_used),
      voice_slots_limit: safeNumber(data.voice_limit),
      has_open_invoices: typeof data.has_open_invoices === 'boolean' ? data.has_open_invoices : null,
      next_reset_unix: safeNumber(data.next_character_count_reset_unix),
    }, null, 2) + '\n');
  } catch (error) {
    console.error('ElevenLabs status check failed: ' + (error instanceof Error ? error.message : 'unknown error'));
    process.exitCode = 1;
  }
}
