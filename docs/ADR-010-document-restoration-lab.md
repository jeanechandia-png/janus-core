# ADR-010 — Document Restoration Lab (Infinity Lab)

Date: 2026-10-20 · Status: accepted as candidate (owner instruction) · Owner: Founder

## Decision

Janus gets a document restoration capability that runs only inside Infinity Lab, InfinitySeed's controlled test environment: `packages/core/src/document-restoration.ts`. It is a reusable LEGO module; products may reuse it later with the same invariants.

## What it does

Physical restoration of any document: deskew, dewarp, denoise, contrast, stain removal, tear repair, reference colorization, upscaling, OCR transcription, layout reformatting and working-copy translation. For documents the operator owns that are not official instruments (internal business documents, marketing, letters, notes, archival photos), it also allows content edits on a clearly marked copy.

## Invariants

1. Runs only with `environment: 'infinity-lab'`; anything else is refused.
2. The original is immutable, referenced by SHA-256 and never overwritten.
3. Every output has a provenance manifest (original hash, output hash, operations, operator, purpose, time) chained in a tamper-evident audit log (`verifyRestorationChain`).
4. Every output carries a visible mark: «COPIA RESTAURADA — Infinity Lab · no es el original» or «COPIA MODIFICADA — …». The mark cannot be disabled.
5. Identity, government-issued, financial-instrument, legal-certificate, academic-credential and medical-record documents are restored, never altered.
6. Signatures and seals are never altered on any document.
7. Content changes require ownership of the document and a stated purpose.

## Why

Restoring and digitising damaged material is valuable and reusable (archives, customer documents, marketing). Altering official documents would produce counterfeits; the module makes that path impossible by design, so the capability can be offered safely later.

## Next

Image-processing adapters (local OpenCV/Tesseract-class tools behind the existing adapter pattern) plug into the allowed operations; the policy and provenance layer above stays unchanged.
