# ADR-010 — Document Restoration Lab (Infinity Lab)

Date: 2026-10-20 (rev. 2, same day) · Status: accepted as candidate (owner instruction) · Owner: Founder

## Decision

Janus gets a document restoration capability that runs only inside Infinity Lab, InfinitySeed's controlled test environment: `packages/core/src/document-restoration.ts`. **Revision 2 (Founder instruction):** this capability is exclusive to Janus. It is not a LEGO module for other products and is never sold or licensed. Its purpose is free experimentation inside Infinity Lab, always under the Founder's authorization.

## What it does

Physical restoration of any document: deskew, dewarp, denoise, contrast, stain removal, tear repair, reference colorization, upscaling, OCR transcription, layout reformatting and working-copy translation. With the Founder's authorization, it also allows content edits on a clearly marked copy of any document that is not an official instrument (internal business documents, marketing, letters, notes, archival photos). Ownership is no longer required; the Founder's per-job authorization replaces it.

## Invariants

0. Exclusive to Janus (`product: 'janus'`); `COMMERCIAL_USE_ALLOWED = false`. Any other product is refused.
1. Runs only with `environment: 'infinity-lab'`; anything else is refused. Every job needs the Founder's authorization bound to that exact job id; it is recorded in the manifest (`authorizedBy`).
2. The original is immutable, referenced by SHA-256 and never overwritten.
3. Every output has a provenance manifest (original hash, output hash, operations, operator, purpose, time) chained in a tamper-evident audit log (`verifyRestorationChain`).
4. Every output carries a visible mark: «COPIA RESTAURADA — Infinity Lab · no es el original» or «COPIA MODIFICADA — …». The mark cannot be disabled.
5. Identity, government-issued, financial-instrument, legal-certificate, academic-credential and medical-record documents are restored, never altered.
6. Signatures and seals are never altered on any document.
7. Every job states its purpose.

## Fixed line (not configurable)

Invariants 5 and 6 do not depend on environment, authorization or purpose. An altered identity, government, financial, legal, academic or medical document, or a changed signature or seal, works as a counterfeit the moment it leaves the lab, and no internal control can guarantee it never leaves. Restoring those documents (cleaning, repairing, transcribing, making a marked working copy) remains fully available.

## Why

Restoring and digitising damaged material is valuable for the Founder's experiments. Altering official documents would produce counterfeits; the module makes that path impossible by design.

## Next

Image-processing adapters (local OpenCV/Tesseract-class tools behind the existing adapter pattern) plug into the allowed operations; the policy and provenance layer above stays unchanged.
