#!/usr/bin/env python3
"""InfinitySeed Group: bóveda portable de criaturas JANUS, 100 % local/offline.

export: crea ZIP autónomo de 4 GLB aprobados, imágenes, licencias, manifiestos.
verify: verifica integridad, contenido y que no necesita red.
import: copia los activos a otro checkout sin sobreescritura silenciosa.

No llama a proveedores de IA, no realiza compras y no genera modelos.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import zipfile

PROJECT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT / "assets" / "approved"
IDS = ("lumi", "bombo", "musgo", "nimbo")
TOP = "janus-kendra-portable/v1/"
MAX_FILE = 18 * 1024 * 1024
MAX_TOTAL = 130 * 1024 * 1024

def sha(data):
    return hashlib.sha256(data).hexdigest()

def safe_name(name):
    part = PurePosixPath(name)
    return (name.startswith(TOP) and not name.endswith("/")
            and not part.is_absolute() and ".." not in part.parts
            and "\\" not in name and not any(p == "" for p in part.parts))

def files_for_export(source):
    index = json.loads((source / "INDEX.json").read_text(encoding="utf8"))
    register = json.loads((source / "models/REGISTRY.json").read_text(encoding="utf8"))
    if set(register.get("characters", {})) != set(IDS):
        raise ValueError("BLOQUEO: se requieren cuatro GLB aprobados; no exportar borradores.")
    required = [Path("INDEX.json"), Path("models/REGISTRY.json")]
    for name in sorted(index["required_assets"]):
        if name.endswith(".webp"):
            required.append(Path(name))
    for cid in IDS:
        entry = register["characters"][cid]
        if entry.get("status") != "approved":
            raise ValueError("BLOQUEO: criatura no aprobada: " + cid)
        required += [Path("models") / (cid + ".glb"),
                     Path("models/licenses") / (cid + ".license.txt")]
    if (source / "README.md").is_file():
        required.append(Path("README.md"))
    unique = dict.fromkeys(required)
    result = {}
    for item in unique:
        filename = source / item
        if not filename.is_file() or filename.is_symlink():
            raise ValueError("BLOQUEO: falta un archivo local original: " + str(item))
        data = filename.read_bytes()
        if not data or len(data) > MAX_FILE:
            raise ValueError("BLOQUEO: archivo vacío o excesivo: " + str(item))
        expected = index["required_assets"].get(item.name)
        if expected and sha(data) != expected:
            raise ValueError("BLOQUEO: imagen original distinta al SHA registrado: " + str(item))
        result[item.as_posix()] = data
    return result

def export_bundle(source, output, require_approval=True):
    # Before export, run exactly the same verification as the A/B offline builder,
    # including signed visual review, model rig and vendor-free commercial license.
    if require_approval:
        validator = PROJECT / "tools/verified-creature-glb.cjs"
        completed = subprocess.run(["node", str(validator), "--require-all"],
                                   cwd=PROJECT, text=True, capture_output=True,
                                   check=False)
        if completed.returncode:
            raise ValueError("BLOQUEO: gate oficial no superado. " +
                             (completed.stderr or completed.stdout).strip()[:1100])
    assets = files_for_export(source)
    manifest = {"schema": 1, "project": "JANUS-KENDRA",
                "modelCount": 4, "models": list(IDS), "offlinePlayback": True,
                "runtimeProviderRequired": False, "subscriptionForPlayback": False,
                "fileHashes": {p: {"sha256": sha(data), "bytes": len(data)}
                               for p, data in assets.items()}}
    manifest_bytes = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, prefix=".janus-", suffix=".zip",
                                     delete=False) as temp:
        staging = Path(temp.name)
    try:
        with zipfile.ZipFile(staging, "w", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=6) as archive:
            for relative, data in sorted(assets.items()):
                archive.writestr(TOP + relative, data)
            archive.writestr(TOP + "VAULT-MANIFEST.json", manifest_bytes)
        verify_bundle(staging)
        os.replace(staging, output)
    finally:
        if staging.exists():
            staging.unlink()
    return manifest

def verify_bundle(filename):
    with zipfile.ZipFile(filename) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or not all(safe_name(p) for p in names):
            raise ValueError("ZIP con rutas peligrosas o repetidas")
        expected_manifest = TOP + "VAULT-MANIFEST.json"
        if expected_manifest not in names:
            raise ValueError("No hay manifiesto portable")
        manifest = json.loads(archive.read(expected_manifest))
        if manifest.get("schema") != 1 or manifest.get("offlinePlayback") is not True or (
            manifest.get("runtimeProviderRequired") is not False or
            manifest.get("subscriptionForPlayback") is not False):
            raise ValueError("Bóveda sin garantías locales")
        if manifest.get("models") != list(IDS) or manifest.get("modelCount") != 4:
            raise ValueError("Faltan criaturas aprobadas")
        entries = manifest.get("fileHashes")
        if not isinstance(entries, dict) or set(names) != {
            TOP + p for p in entries} | {expected_manifest}:
            raise ValueError("El contenido no corresponde al manifiesto")
        total = 0
        for relative, meta in entries.items():
            if not isinstance(meta, dict) or not isinstance(meta.get("bytes"), int):
                raise ValueError("Registro inválido")
            info = archive.getinfo(TOP + relative)
            if info.is_dir() or info.file_size > MAX_FILE:
                raise ValueError("ZIP no contiene activos regulares acotados")
            data = archive.read(TOP + relative)
            total += len(data)
            if total > MAX_TOTAL or len(data) != meta["bytes"] or sha(data) != meta["sha256"]:
                raise ValueError("SHA-256 o límite no coincide: " + relative)
        # Avoid implicit network or subscription verification in portable bundles.
        for id_ in IDS:
            if "models/" + id_ + ".glb" not in entries:
                raise ValueError("Falta GLB: " + id_)
            if "models/licenses/" + id_ + ".license.txt" not in entries:
                raise ValueError("Falta licencia local: " + id_)
        return manifest

def import_bundle(filename, target):
    manifest = verify_bundle(filename)
    target = Path(target).resolve()
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(filename) as archive:
        # Full preflight: not one byte written if a preexisting file differs.
        for relative, meta in manifest["fileHashes"].items():
            dest = target / relative
            if dest.is_symlink() or not dest.resolve().is_relative_to(target):
                raise ValueError("Ruta no autorizada: " + relative)
            if dest.exists() and sha(dest.read_bytes()) != meta["sha256"]:
                raise ValueError("Se conserva versión existente, diferente: " + relative)
        for relative, meta in manifest["fileHashes"].items():
            dest = target / relative
            if dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=dest.parent, prefix=".asset-", delete=False) as temp:
                temp.write(archive.read(TOP + relative))
                staging = Path(temp.name)
            try:
                if sha(staging.read_bytes()) != meta["sha256"]:
                    raise ValueError("SHA cambió durante importación: " + relative)
                os.replace(staging, dest)
            finally:
                if staging.exists():
                    staging.unlink()
    return len(manifest["fileHashes"])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest="action",required=True)
    exp=sub.add_parser("export")
    exp.add_argument("--source",type=Path,default=SOURCE)
    exp.add_argument("--out",type=Path,required=True)
    v=sub.add_parser("verify")
    v.add_argument("--zip",type=Path,required=True)
    imp=sub.add_parser("import")
    imp.add_argument("--zip",type=Path,required=True)
    imp.add_argument("--dest",type=Path,default=SOURCE)
    args=p.parse_args()
    try:
        if args.action=="export":
            manifest=export_bundle(args.source,args.out)
            print("EXPORTADO sin dependencia:",args.out,"modelos:",manifest["modelCount"])
        elif args.action=="verify":
            m=verify_bundle(args.zip)
            print("VERIFICADO:",m["modelCount"],"GLB; archivos:",len(m["fileHashes"]))
        elif args.action=="import":
            print("IMPORTADOS sin sobrescribir:",import_bundle(args.zip,args.dest),"archivos")
    except (OSError,ValueError,KeyError,zipfile.BadZipFile) as exc:
        print("BLOQUEADO: "+str(exc),file=sys.stderr)
        return 1
    return 0

if __name__=="__main__":
    raise SystemExit(main())
