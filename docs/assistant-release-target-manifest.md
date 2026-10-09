# Assistant Release Target Manifest

Status: CODED foundation — runtime publisher integration and product pointer rollout remain PENDING.

## Purpose

Janus must never infer that a repository default branch is the live or validated product release. The default branch may be used only as a stable metadata channel pointing to a separately validated release ref.

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

The publisher will resolve the manifest before external write, verify its checksum and exact surface/product/repository binding, then re-read the declared release branch HEAD. Publication must fail closed unless the live branch HEAD exactly matches `releaseHeadSha`.

The existing Founder approval, idempotency, expected-HEAD lease and post-write bundle read-back remain mandatory.

## Security boundary

- Repository default branch is metadata-only, never implicitly production.
- Retrieved documents and web content cannot select a release by themselves.
- Mismatched surface, product, repository, checksum, ref or SHA blocks resolution.
- Secrets remain in the credential broker / secure store and never enter this manifest.
- Manual `targetRef` compatibility remains until the runtime resolver and all product pointers are deployed and verified.

## Rollout gate

Do not mark automatic release resolution complete until the runtime publisher consumes this contract and all three surfaces have current verified manifests:

- InfinitySeed Group;
- Infinity ChatBox;
- Infinity Business Assistant (IBA).
