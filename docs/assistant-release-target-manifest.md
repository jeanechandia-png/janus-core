# Assistant Release Target Manifest

Status: CODED foundation — runtime publisher integration and product pointer rollout remain PENDING.

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

## Error-learning note — 2026-10-09

A first ChatBox pointer attempt targeted the repository default branch. Its pull-request CI exposed that the default branch was historically stale: the workflow referenced a missing security script and discovered zero product tests. The pointer itself was not the cause, but the incident proved that a default branch is not a trustworthy control-plane anchor.

**Rule preventive:** release-target metadata must use the dedicated stable metadata ref and must never derive authority from a repository default branch.
