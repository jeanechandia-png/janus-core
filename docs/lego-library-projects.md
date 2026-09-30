# Reusable LEGO Library + Project Context Continuity

Janus must evolve existing work instead of rebuilding the same product pieces repeatedly.

## Principle 1 — Build by composition

A previously approved button, logo, icon, typography, design token, workflow or software module is a reusable Janus Library item. Projects select and compose these pieces instead of recreating them from memory.

The library is provider-independent. SQLite keeps the catalog, versions, dependency graph and checksums. Binary or large content is referenced by `contentRef` / `previewRef`; the storage adapter can later resolve that reference from local storage, Google Drive, iCloud or another replaceable backend.

Current reusable kinds:

- symbol
- photo
- logo
- icon
- button
- font
- design_token
- theme
- component
- module
- template
- workflow
- prompt
- other

Every item has:

- stable item id;
- monotonically increasing revision;
- lifecycle status;
- SHA-256 content checksum;
- tags and compatibility metadata;
- dependency references to other reusable items;
- optional structured engineering/design spec;
- optional content and preview references.

A new revision supersedes the previous revision instead of silently replacing its engineering history. The previous revision becomes historical while its content checksum remains verifiable.

## Principle 2 — The chat is a window; the project is the memory

A Janus project is durable state independent of any single conversation thread.

A project contains:

- project metadata and an optional coordination scope binding;
- multiple conversation threads;
- local/import/Google Drive/iCloud/upload resource references;
- project-scoped chronology;
- automatic context checkpoints.

Opening a new thread creates a bootstrap checkpoint from the existing chronological project state. No manual "remember the previous chat" prompt is required.

The checkpoint carries:

- active instructions;
- recent decisions;
- unresolved errors;
- current resume point;
- next actions;
- evidence references;
- SHA-256 checksum.

The runtime planner receives the project-scoped continuity, project resources and latest checkpoint when a command is linked to `projectId + threadId`.

## Runtime flow

```text
Project
  -> Thread A
      -> commands / files / decisions / instructions
      -> project-scoped chronology
      -> checkpoint after run
  -> Thread B
      -> automatic bootstrap checkpoint from Project
      -> continues from the same project state
```

Changing the thread does not erase the project context.

Project access is identity-aware. Founder access remains global; other principals can access a project only when they created it or when its linked coordination scope grants the required `read_context` / `write_work` permission. Authentication alone never reveals every project.

## Reusable composition flow

```text
Need a translator medallion?
  -> query Janus Library
  -> select approved current revision
  -> resolve required dependencies
  -> verify checksums
  -> insert/reuse in target project
  -> create a new revision only when engineering/design changes
```

## Runtime APIs

Reusable library:

- `GET /api/library`
- `GET /api/library/:itemId`
- `POST /api/library/items`

Projects:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId/context`
- `POST /api/projects/:projectId/threads`
- `POST /api/projects/:projectId/resources`
- `POST /api/command` with `projectId + threadId`

## Current boundaries

Implemented now:

- durable reusable catalog with revisions, dependencies and checksums;
- durable project/thread/resource/checkpoint records;
- project-scoped continuity;
- automatic thread bootstrap checkpoint;
- automatic checkpoint after a linked project run;
- project-aware model-planning context;
- local/Google Drive/iCloud/upload/import resource reference model.

Still to connect productively:

1. Local content-addressed asset storage for the actual binary files.
2. Importers that promote approved existing assets from Infinity products into the central catalog.
3. Automatic similarity/deduplication before creating a new asset or module.
4. Google Drive sync/write adapter and conflict revalidation.
5. Apple/iCloud bridge where platform APIs permit it.
6. PWA project browser, library browser, file uploads and drag/drop composition.
7. Builder/Design agents that must search the reusable library before creating a new component.
8. Usage graph: which project/product uses which reusable revision, enabling safe updates and impact analysis.

## Non-negotiable build rule

Before creating a new product piece, Janus should search the reusable catalog for a suitable approved piece. Rebuild is the fallback only when reuse/adaptation cannot satisfy the requirement. Reuse never bypasses compatibility, security, quality or project-access checks.
