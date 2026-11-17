import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/prepare-voice-reference.mjs', import.meta.url));
const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], {stdio:'ignore'}).status === 0 && spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;

test('prepare voice sample rejects missing/nonlocal input without network activity', () => {
  const result = spawnSync(process.execPath,[script,'--input=https://example.com/a.mp3','--output=/tmp/no.wav','--start=0','--end=15'],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/local filesystem/);
});

test('prepare voice sample produces auditable, mono 24 kHz PCM without overwriting original', {skip: !ffmpegAvailable}, () => {
  const dir = mkdtempSync(join(tmpdir(),'janus-voice-test-'));
  const input=join(dir,'owner-source.wav'), output=join(dir,'reference.wav');
  const source=spawnSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','sine=frequency=240:duration=12','-ar','48000',input],{encoding:'utf8'});
  assert.equal(source.status,0,source.stderr);
  const args=[script,`--input=${input}`,`--output=${output}`,'--start=0.5','--end=11.5'];
  const run=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.ok(existsSync(input));
  assert.ok(existsSync(output));
  const m=JSON.parse(readFileSync(`${output}.manifest.json`,'utf8'));
  assert.equal(m.output_format.codec,'pcm_s16le');
  assert.equal(m.output_format.sample_rate_hz,24000);
  assert.equal(m.trim_seconds.start,0.5);
  assert.equal(m.transcript_status,'requires-exact-review-before-Qwen-voice-clone');
  const again=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.notEqual(again.status,0);
  assert.match(again.stderr,/already exists/);
});
