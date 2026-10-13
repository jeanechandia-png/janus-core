# Assistant Release Target Manifest

Status: CODED + TESTED + INTEGRATED in the runtime publisher (unit tests; no live GitHub E2E yet). Product pointer rollout on the three repositories remains PENDING.

## Purpose

Janus must never infer that a repository default branch is the live or validated product release. Release metadata lives on the dedicated stable ref `infinity/assistant-control-metadata`, which is separate from both the repository default branch and the product release branch.

For repository delivery targets, the manifest path is:

`.infinity/assistant-control/<productKey>.release.json`

Examples:

- `.infinity/assistant-control/infinity-chatbox.release.json`
- `.infinity/assistant-control/iba.release.json`
- `.infinity/assistant-control/infinity-group.release.json`

## Contract

A release-target manifest is checksum-protected and binds:

- exact Janus assistant surface id;
- exact product id;
- exact repository `owner/repo`;
- validated release branch/ref;
- exact validated branch HEAD SHA;
- update timestamp;
- one or more evidence references.

The manifest cannot contain credentials or secrets.

## Intended productive resolution

The publisher reads the manifest from `infinity/assistant-control-metadata` before external write, verifies its checksum and exact surface/product/repository binding, then re-reads the declared release branch HEAD. Publication must fail closed unless the live branch HEAD exactly matches `releaseHeadSha`.

The existing Founder approval, idempotency, expected-HEAD lease and post-write bundle read-back remain mandatory.

## Release HEAD custody (2026-10-13)

The publisher writes the bundle onto the release branch itself, so its own verified commit moves the branch HEAD away from `releaseHeadSha`. A strict equality check made the manifest permanently stale after the first successful publish.

`verifyReleaseHeadCustody` therefore accepts the observed HEAD only when:

1. it equals `releaseHeadSha` (`manifest_head`); or
2. it is reachable from `releaseHeadSha` exclusively through Janus' own local SQLite deliveries on the same repository and ref, each with status `published_verified` or `applied`, each `expectedHeadSha -> publishedCommitSha` (`janus_delivery_lineage`).

Any foreign commit (human, CI or another tool) breaks the chain and fails closed: the manifest must be refreshed and re-validated. Forks (two verified deliveries from the same parent) and cycles are rejected rather than guessed. The custody mode and delivery chain are recorded in the governance decision metadata.

## Security boundary

- Repository default branches are not used for release resolution.
- `infinity/assistant-control-metadata` is a dedicated control-plane ref and is never implicitly production.
- Retrieved documents and web content cannot select a release by themselves.
- Mismatched surface, product, repository, checksum, ref or SHA blocks resolution.
- Secrets remain in the credential broker / secure store and never enter this manifest.
- Manual `targetRef` compatibility remains until all product pointers are deployed and verified.

## Rollout gate

Do not mark automatic release resolution complete until all three surfaces have current verified manifests on the dedicated metadata ref:

- InfinitySeed Group;
- Infinity ChatBox;
- Infinity Business Assistant (IBA).

## Production deployment anchor (2026-10-13, Founder rule)

**Chronology is not publication.** The newest commit on a release branch may be a candidate awaiting the Founder's authorization; only the hosting provider's *published* deploy says what visitors see.

A manifest may optionally declare:

```json
"deployment": { "provider": "netlify", "siteId": "<netlify site id>" }
```

The field is covered by the checksum when present and omitted from it when absent, so pre-existing manifests (e.g. ChatBox `de219f8e`) remain valid byte-for-byte.

When bound, the publisher:

1. reads the site's `published_deploy` through the read-only `netlify` adapter (`site.published_deploy`, token `NETLIFY_AUTH_TOKEN`);
2. requires `state=ready`, matching site and branch, and a structured `commit_ref` — **titles and chronology are never parsed as evidence** (`commit_unverifiable` otherwise);
3. allows the write only if the branch HEAD **is** the published commit, or the only commits above it are Janus' own verified deliveries;
4. otherwise fails closed with `unpublished_commits_above_production`, so Janus never stacks its bundle on unapproved work.

Known limitation (observed 2026-10-13): ChatBox deploys are created with the Netlify CLI and carry `commit_ref: null`. Until deploys record their commit (Git-linked builds, or a deploy step that sets it), a bound manifest will correctly report `commit_unverifiable` instead of guessing.

## Error-learning note — 2026-10-13

ERROR: the PR #27 stale-HEAD guard compared the live HEAD to `releaseHeadSha` by strict equality. CAUSE: the guard ignored that the publisher's own write advances the same branch. IMPACT: automatic resolution would work once per manifest update and then block every later publish with a misleading "stale" error. LESSON: a fail-closed guard must model the system's own legitimate writes. PREVENTIVE RULE: any HEAD-pinning control must define custody for self-authored commits explicitly and test the second publish, not only the first. CHANGE: custody chain + regression tests in `tests/assistant-release-target.test.ts`.

ERROR: `tests/runtime-smoke.mjs` inherited `GITHUB_TOKEN` from the shell, so any environment with a token made the smoke fail (`publisher` reported `github-revalidated-idempotent`). PREVENTIVE RULE: smoke tests must set every credential variable explicitly. CHANGE: the smoke now sets `GITHUB_TOKEN=''`.

## Error-learning note — 2026-10-09

A first ChatBox pointer attempt targeted the repository default branch. Its pull-request CI exposed that the default branch was historically stale: the workflow referenced a missing security script and discovered zero product tests. The pointer itself was not the cause, but the incident proved that a default branch is not a trustworthy control-plane anchor.

**Rule preventive:** release-target metadata must use the dedicated stable metadata ref and must never derive authority from a repository default branch.
