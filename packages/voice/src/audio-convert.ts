import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Converts a phone recording (m4a/mp3/caf/wav…) into the mono 16-bit PCM WAV that voice-clone references require.
// An iPhone «Notas de voz» take is .m4a, so this is the step that makes recording from the phone usable.
// Runs the local `ffmpeg` binary only: no network, no upload.

export type CommandRunner = (command: string, args: string[]) => Promise<void>;

export const defaultRunner: CommandRunner = (command, args) => new Promise((resolve, reject) => {
  execFile(command, args, { timeout: 120_000, windowsHide: true }, (error) => (error ? reject(error) : resolve()));
});

export const REFERENCE_SAMPLE_RATE = 24_000;

export async function convertToReferenceWav(inputPath: string, outputPath: string, run: CommandRunner = defaultRunner): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  try {
    await run('ffmpeg', ['-nostdin', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', String(REFERENCE_SAMPLE_RATE), '-c:a', 'pcm_s16le', outputPath]);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error('ffmpeg is not installed on the Janus host; install it to convert phone recordings (or provide a mono 16-bit WAV).');
    throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
}
