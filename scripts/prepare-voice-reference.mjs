#!/usr/bin/env node
/**
 * Prepare a private, owner-approved voice sample for JANUS local-first cloning.
 * Offline-only: ffmpeg and ffprobe are invoked on local paths; no HTTP/API calls.
 * The original is never overwritten. Reference audio stays OUTSIDE Git.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

function fail(message) {
  process.stderr.write(`JANUS VOICE SAMPLE ERROR: ${message}\n`);
  process.exit(1);
}
function localPath(value, label) {
  if (typeof value !== 'string' || !value.trim() || /^(https?:|data:|file:)/i.test(value)) fail(`${label} must be a local filesystem path`);
  return resolve(value);
}
function parseArgs(argv) {
  const args = Object.create(null);
  for (const token of argv) {
    if (!token.startsWith('--') || !token.includes('=')) fail('Expected --input=... --output=... --start=seconds --end=seconds');
    const pivot = token.indexOf('=');
    const key = token.slice(2, pivot);
    if (!['input', 'output', 'start', 'end'].includes(key) || key in args) fail(`Invalid or repeated parameter: ${key}`);
    args[key] = token.slice(pivot + 1);
  }
  if (Object.keys(args).length !== 4) fail('Required: --input, --output, --start and --end');
  const input = localPath(args.input, 'input');
  const output = localPath(args.output, 'output');
  if (input === output) fail('Output cannot overwrite the original recording');
  if (!existsSync(input)) fail('Input file does not exist');
  if (extname(output).toLowerCase() !== '.wav') fail('Output must be a .wav file');
  if (existsSync(output) || existsSync(`${output}.manifest.json`)) fail('Output or manifest already exists; choose a new path');
  const start = Number(args.start), end = Number(args.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start < 10 || end - start > 180) fail('Cut must be 10–180 seconds inside source file');
  return { input, output, start, end };
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 4 });
  if (result.error) fail(`${command} unavailable: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} failed: ${(result.stderr || '').slice(-400)}`);
  return result.stdout;
}
function checksum(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
const { input, output, start, end } = parseArgs(process.argv.slice(2));
const probe = JSON.parse(run('ffprobe', ['-v','error','-show_entries','format=duration','-of','json',input]));
const totalSeconds = Number(probe?.format?.duration);
if (!Number.isFinite(totalSeconds) || end > totalSeconds + 0.002) fail('Trim end exceeds recording duration');
mkdirSync(dirname(output), { recursive: true });
const duration = end - start;
const filter = `highpass=f=70,lowpass=f=11000,afade=t=in:st=0:d=0.12,afade=t=out:st=${Math.max(0,duration-0.3)}:d=0.3`;
run('ffmpeg', [
  '-hide_banner','-loglevel','error','-nostdin','-n',
  '-ss',String(start),'-i',input,'-t',String(duration),'-map','0:a:0',
  '-af',filter,'-ac','1','-ar','24000','-c:a','pcm_s16le',output,
]);
const outputProbe = JSON.parse(run('ffprobe', ['-v','error','-show_entries','stream=codec_name,channels,sample_rate:format=duration','-of','json',output]));
const stream = outputProbe?.streams?.[0];
if (stream?.codec_name !== 'pcm_s16le' || stream?.channels !== 1 || Number(stream?.sample_rate) !== 24000 || Math.abs(Number(outputProbe?.format?.duration)-duration)>0.03) fail('Output format validation failed');
const manifest = {
  schema_version: 1,
  purpose: 'owner-approved-local-voice-reference',
  privacy: 'private-local-file-not-for-git',
  source_filename: basename(input),
  source_sha256: checksum(input),
  output_filename: basename(output),
  output_sha256: checksum(output),
  trim_seconds: { start, end },
  output_format: { codec: 'pcm_s16le', sample_rate_hz: 24000, channels: 1 },
  transformations: ['highpass 70 Hz','lowpass 11000 Hz','edge fades only'],
  transcript_status: 'requires-exact-review-before-Qwen-voice-clone',
  note: 'No synthetic/provider-generated audio is permitted as training reference.',
};
writeFileSync(`${output}.manifest.json`, JSON.stringify(manifest,null,2)+'\n', {flag:'wx', mode:0o600});
process.stdout.write(`Prepared private reference: ${output}\nSHA256: ${manifest.output_sha256}\n`);
