#!/usr/bin/env python3
"""JANUS / Kendra: generación LOCAL de mallas 3D (borradores, nunca finales).

Usa un checkout YA INSTALADO de TripoSR (MIT). No descarga modelos, no usa
servicios de pago, no sube fotografías ni toca las dashboards.
Un solo retrato por criatura → geometría preliminar, NO rig ni hiperrealismo
aprobado: requiere retoque/rigging/revisión antes de promoverse al registro.

Ejemplo:
 python tools/run-local-creature-reconstruction.py \
    --triposr /opt/TripoSR --ids lumi bombo musgo nimbo
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "approved"
DRAFTS = ART / "models" / "drafts"
IDS = ("lumi", "bombo", "musgo", "nimbo")

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--triposr", type=Path, required=True, help="checkout local de TripoSR, instalado previamente")
    ap.add_argument("--ids", nargs="+", choices=IDS, default=list(IDS))
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--texture-resolution", type=int, choices=(1024, 2048), default=2048)
    args = ap.parse_args()
    run = args.triposr.expanduser().resolve() / "run.py"
    if not run.is_file():
        print("BLOQUEO: no está instalado TripoSR. No se generan modelos falsos.", file=sys.stderr)
        return 2
    official = json.loads((ART / "INDEX.json").read_text(encoding="utf8"))["required_assets"]
    for creature in args.ids:
        img = ART / (creature + ".webp")
        if not img.is_file():
            print("BLOQUEO: falta la imagen original aprobada: " + str(img), file=sys.stderr)
            return 3
        if sha(img) != official[img.name]:
            print("BLOQUEO: la imagen original ha cambiado: " + creature, file=sys.stderr)
            return 4
    for creature in args.ids:
        target = DRAFTS / creature
        target.mkdir(parents=True, exist_ok=True)
        if args.skip_existing and any(target.glob("*.glb")):
            print("CONSERVADO:", creature)
            continue
        command = [
            sys.executable, str(run), str(ART / (creature + ".webp")),
            "--output-dir", str(target),
            "--bake-texture", "--texture-resolution", str(args.texture_resolution),
        ]
        print("RECONSTRUCCIÓN LOCAL:", creature, flush=True)
        # TripoSR genera un OBJ/PLY preliminar; ni huesos ni clips se inventan.
        subprocess.run(command, check=True, cwd=str(run.parent))
        outputs = list(target.rglob("*.obj")) + list(target.rglob("*.ply")) + list(target.rglob("*.glb"))
        if not outputs:
            print("ERROR: el backend no generó una malla para " + creature, file=sys.stderr)
            return 5
        if outputs[0].suffix != ".glb":
            try:
                import trimesh
            except ImportError:
                print("Malla generada en " + str(outputs[0]) + ". Instale trimesh para exportar GLB.", file=sys.stderr)
                continue
            scene = trimesh.load(str(outputs[0]), force="scene", process=False)
            draft = target / (creature + ".draft.glb")
            scene.export(str(draft))
            print("BORRADOR 3D:", draft, "SHA256:", sha(draft), flush=True)
        else:
            print("BORRADOR 3D:", outputs[0], "SHA256:", sha(outputs[0]), flush=True)
    print("ESTADO: NO APROBADO. Requiere materiales PBR, rig facial, 13 huesos, 8 morphs, 6 clips, sockets y revisión física iPhone.")
    print("Ningún archivo borrador se guarda en el registro de modelos finales.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
