#!/usr/bin/env python3
"""Instala los 26 WebP EXACTOS aprobados desde el ZIP del proyecto.

Sin red ni dependencias de terceros; sólo escribe en el checkout autorizado.
Conserva cada imagen byte a byte y no sobrescribe versiones diferentes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "assets" / "approved"
PREFIX = "janus_aprobado/assets/approved/"
def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("zip_file", type=Path, help="janus_kendra_arte_aprobado_20261106.zip")
    p.add_argument("--verify-only", action="store_true")
    a = p.parse_args()
    expected = json.loads((TARGET / "INDEX.json").read_text(encoding="utf8"))["required_assets"]
    assert len(expected)==26, "Registro de arte 26 archivos incompleto"
    entries: dict[str,bytes] = {}
    with ZipFile(a.zip_file) as z:
        names = set(z.namelist())
        for name, checksum in expected.items():
            source = PREFIX + name
            if source not in names:
                raise ValueError(f"ZIP incompleto: {source}")
            raw = z.read(source)
            if sha256(raw) != checksum:
                raise ValueError(f"SHA original incorrecto: {name}")
            destination = TARGET / name
            if destination.exists() and sha256(destination.read_bytes()) != checksum:
                raise FileExistsError(f"No reemplazar arte diferente: {destination}")
            entries[name] = raw
    if not a.verify_only:
        TARGET.mkdir(parents=True, exist_ok=True)
        # All inputs checked first; no partial import for missing/altered data.
        for name, raw in entries.items():
            out = TARGET / name
            if not out.exists():
                temp = out.with_name(out.name + ".janus-new")
                temp.write_bytes(raw)
                temp.replace(out)
    print(f"Arte original: {len(entries)}/26 verificados SHA-256. Importado: {not a.verify_only}")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
