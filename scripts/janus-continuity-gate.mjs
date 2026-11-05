#!/usr/bin/env node
/**
 * JANUS continuity gate: protects the same local-first Core as Claude and
 * other agents add changes in parallel. VIGENTE must not silently drop
 * features already merged into main.
 *
 * npm run continuity:gate
 * npm run continuity:gate -- --require-main-ancestor
 *
 * Structural / ancestry guard, not hardware or integration verification.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const CORE_FEATURES = Object.freeze([
  { id: 'core.sqlite-and-continuity', paths: [
    ['packages/core/src/sqlite-store.ts', 'class'],
    ['docs/STATE.md', '## AHORA'],
  ] },
  { id: 'core.specialists', paths: [
    ['packages/core/src/expertise-policy.ts', 'agentic_workflow'],
    ['packages/orchestrator/src/model-planner.ts', 'JanusPlan'],
  ] },
  { id: 'core.automation', paths: [
    ['packages/automation/src/trigger-dispatcher.ts', 'dispatch'],
  ] },
  { id: 'core.evolution', paths: [
    ['packages/modules/janus-evolution-guard/src/index.ts', 'premortem'],
  ] },
  { id: 'claude.authenticated-voice', paths: [
    ['packages/security/src/voice-authority.ts', 'VoiceAuthority'],
    ['packages/voice/src/session.ts', 'VoiceSessionController'],
    ['apps/runtime/server.ts', 'voiceAuthority.bind'],
  ] },
  { id: 'claude.business-knowledge', paths: [
    ['packages/adapters/src/business-knowledge-tool-adapter.ts', 'BusinessKnowledgeToolAdapter'],
    ['apps/runtime/server.ts', 'toolGateway.register(knowledgeAdapter)'],
  ] },
  { id: 'core.voice-independence', paths: [
    ['packages/voice/src/voice-independence.ts', 'evaluateProviderRetirement'],
    ['sidecars/qwen3_tts_server.py', 'voice_clone'],
  ] },
  { id: 'core.voice-studio', paths: [
    ['packages/adapters/src/voice-studio-tool-adapter.ts', 'VoiceStudioToolAdapter'],
    ['apps/runtime/server.ts', 'toolGateway.register(voiceStudio)'],
    ['tests/voice-studio.test.ts', 'consentimiento'],
  ] },
  { id: 'main.infinity-connect-interpreter', paths: [
    ['packages/modules/infinity-interpreter/src/index.ts', 'interpretText'],
    ['packages/adapters/src/infinity-interpreter-tool-adapter.ts', 'InfinityInterpreterToolAdapter'],
    ['apps/runtime/server.ts', 'toolGateway.register(new InfinityInterpreterToolAdapter'],
    ['tests/infinity-interpreter.test.ts', 'interpretText'],
    ['docs/lego-modules.md', 'infinity-interpreter'],
  ] },
]);

// PENDING, NOT MERGED: these surfaces need separate review in their source PRs.
export const PENDING_SURFACES = Object.freeze([
  {id:'kendra-3d-and-nexo', pr:63},
  {id:'claude-voice-identity-and-local-clone', pr:60},
  {id:'claude-companion-3d', pr:53},
  {id:'provider-finops', pr:61},
]);

export function auditFeatures(root = ROOT, features = CORE_FEATURES) {
  const results = features.map(({id, paths}) => ({
    id,
    errors: paths.flatMap(([name, marker]) => {
      const absolute = resolve(root,name);
      if (!existsSync(absolute)) return ['missing: '+name];
      const source = readFileSync(absolute,'utf8');
      return source.includes(marker) ? [] : ['missing marker '+JSON.stringify(marker)+' in '+name];
    })
  }));
  return {ok:results.every(x=>x.errors.length===0),results};
}
export function gitValue(args, cwd = ROOT) {
  try { return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }
  catch { return null; }
}
export function gitAncestry(cwd = ROOT) {
  const head = gitValue(['rev-parse','HEAD'],cwd);
  const main = gitValue(['rev-parse','refs/remotes/origin/main'],cwd);
  if(!head || !main) return {ok:false,reason:'HEAD/origin/main unavailable: fetch origin main before release.',head,main};
  const mergeBase = gitValue(['merge-base','HEAD','refs/remotes/origin/main'],cwd);
  return {ok:main===mergeBase,head,main,mergeBase,
    reason: main===mergeBase ? 'Latest fetched main is in branch ancestry.' :
      'Branch is stale or diverged from origin/main: reconcile, do not overwrite.'};
}
export function continuityReport({root=ROOT,features=CORE_FEATURES,requireMainAncestor=false}={}){
  const checks=auditFeatures(root,features);
  const ancestry=gitAncestry(root);
  return {
    project:'JANUS CORE',at:new Date().toISOString(),featureCoverage:checks,
    currentMain:ancestry,pendingMerge:PENDING_SURFACES,
    coreContinuitySafe:checks.ok && (!requireMainAncestor || ancestry.ok),
    productReleaseVerified:false,
    releaseBlockers:['Draft companion/dashboard PRs remain separate','Physical voice/biometrics/GPU validation pending'],
    note:'A green CORE gate does not mean draft PRs are merged, hardware works or acoustic cloning is verified.'
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const strict=process.argv.includes('--require-main-ancestor');
  const result=continuityReport({requireMainAncestor:strict});
  console.log(JSON.stringify(result,null,2));
  if(!result.coreContinuitySafe) process.exitCode=1;
}
