import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ElevenLabsTtsAdapter } from "../packages/adapters/src/elevenlabs-tts-adapter.js";

test("lists voices using a runtime secret without storing it", async () => {
  const calls: string[] = [];
  const adapter = new ElevenLabsTtsAdapter({
    apiKey: () => "runtime-secret",
    fetchImpl: async (input, init) => {
      calls.push(String(input));
      assert.equal((init?.headers as Record<string,string>)["xi-api-key"], "runtime-secret");
      return new Response(JSON.stringify({ voices: [{voice_id:"voice-1",name:"Example"}] }), { status:200 });
    },
  });
  assert.deepEqual(await adapter.listVoices(), [{ voice_id:"voice-1", name:"Example", category:undefined }]);
  assert.equal(calls[0], "https://api.elevenlabs.io/v1/voices");
});
test("synthesizes correctly typed PCM chunks", async () => {
  const adapter = new ElevenLabsTtsAdapter({
    apiKey: () => "runtime-secret",
    fetchImpl: async (input, init) => {
      assert.match(String(input), /output_format=pcm_16000/);
      assert.equal(JSON.parse(String(init?.body)).model_id, "eleven_multilingual_v2");
      return new Response(new Uint8Array(2560), { status:200 });
    },
  });
  const chunks = [];
  for await (const chunk of adapter.synthesize("Hola", "voice-1")) chunks.push(chunk);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].bytes.length, 1280);
  assert.equal(chunks[0].mimeType, "audio/pcm;rate=16000;channels=1;format=s16le");
});
test("rejects invalid IDs, missing secrets and incomplete PCM", async () => {
  const adapter = new ElevenLabsTtsAdapter({ apiKey: () => "" });
  await assert.rejects(async () => { for await (const _ of adapter.synthesize("hola", "bad/id")) {} }, /Invalid/);
  await assert.rejects(() => adapter.listVoices(), /credential/);
  const broken = new ElevenLabsTtsAdapter({ apiKey: () => "key", fetchImpl: async () => new Response(new Uint8Array(3)) });
  await assert.rejects(async () => { for await (const _ of broken.synthesize("hola", "voice-1")) {} }, /incomplete/);
});
