#!/usr/bin/env python3
"""JANUS 3D Forge: optional OFFLINE-first TRELLIS.2 image-to-GLB worker.

Independent of Hyper3D. GPU inference requires TRELLIS.2 installed separately
with its own dependency licenses reviewed; never installs packages or downloads
model weights unless --allow-model-download is passed explicitly.

Examples:
  python3 sidecars/janus_3d_forge_trellis2.py --check
  python3 sidecars/janus_3d_forge_trellis2.py --input /private/original.png --output /private/musgo.glb

Outputs are static meshes, NOT guaranteed rigged/animation-ready. Use the
existing JanusCreatureSlot contract, local Blender rigging and human approval.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

MODEL_ID = "microsoft/TRELLIS.2-4B"
SUPPORTED_IMAGES = {".png", ".jpeg", ".jpg", ".webp"}


def preflight() -> dict:
    """No side effects, internet requests or heavy ML imports."""
    info = {
        "engine": "janus-3d-forge-trellis2",
        "execution": "local_only",
        "model": MODEL_ID,
        "system": platform.system(),
        "linux_supported_by_upstream": platform.system() == "Linux",
        "nvidia_gpu": False,
        "gpu_memory_mb": None,
        "gpu_meets_upstream_24gb": False,
        "upstream_repository": "https://github.com/microsoft/TRELLIS.2",
        "paid_generation": False,
        "weights_downloaded_by_this_check": False,
    }
    executable = shutil.which("nvidia-smi")
    if executable:
        try:
            run = subprocess.run(
                [executable, "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, check=True, text=True, timeout=6,
            )
            memories = [int(v.strip()) for v in run.stdout.splitlines() if v.strip().isdigit()]
            if memories:
                info["nvidia_gpu"] = True
                info["gpu_memory_mb"] = max(memories)
                info["gpu_meets_upstream_24gb"] = max(memories) >= 24576
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    return info


def generate(input_path: Path, output_path: Path, allow_download: bool, texture_size: int) -> None:
    """Invoke the documented TRELLIS.2 pipeline, not a remote vendor API."""
    if not input_path.is_file() or input_path.suffix.lower() not in SUPPORTED_IMAGES:
        raise ValueError("Use an existing original local JPG, PNG or WebP reference")
    if output_path.suffix.lower() != ".glb":
        raise ValueError("The output must end in .glb")
    if input_path.resolve() == output_path.resolve():
        raise ValueError("Output cannot overwrite the original reference")
    status = preflight()
    if not status["linux_supported_by_upstream"] or not status["gpu_meets_upstream_24gb"]:
        raise RuntimeError("TRELLIS.2 upstream requires Linux and NVIDIA GPU with >=24 GB VRAM")
    if not allow_download:
        # A local inference run must not silently download 4B-parameter weights.
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    try:
        from PIL import Image
        from trellis2.pipelines import Trellis2ImageTo3DPipeline
        import o_voxel
    except ImportError as error:
        raise RuntimeError(
            "TRELLIS.2 local environment unavailable. Install it according to "
            "the official upstream README, then retry. No installation was attempted."
        ) from error

    pipeline = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    with Image.open(input_path) as image:
        reference = image.convert("RGB")
        mesh = pipeline.run(reference)[0]
    # Official TRELLIS.2 sample uses this simplification before GLB extraction.
    mesh.simplify(16777216)
    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices,
        faces=mesh.faces,
        attr_volume=mesh.attrs,
        coords=mesh.coords,
        attr_layout=mesh.layout,
        voxel_size=mesh.voxel_size,
        aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
        decimation_target=80000,
        texture_size=texture_size,
        remesh=True,
        remesh_band=1,
        remesh_project=0,
        verbose=False,
    )
    # Existing JANUS GLTF loader has no Basis/KTX2 dependency. Avoid required
    # WebP extension; use standard embedded textures if exporter supports it.
    output_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if output_path.exists():
        raise FileExistsError("Refusing to replace existing 3D asset: " + str(output_path))
    glb.export(str(output_path), extension_webp=False)
    os.chmod(output_path, 0o600)


def main() -> int:
    parser = argparse.ArgumentParser(description="JANUS own local 3D generation worker (not Hyper3D)")
    parser.add_argument("--check", action="store_true", help="Inspect hardware only; no downloads")
    parser.add_argument("--input", type=Path, help="Local original character image")
    parser.add_argument("--output", type=Path, help="Local output GLB, outside public repository")
    parser.add_argument("--allow-model-download", action="store_true", help="Explicit opt-in for Hugging Face weights download")
    parser.add_argument("--texture-size", type=int, default=1024, choices=[512, 1024, 2048])
    args = parser.parse_args()
    if args.check:
        print(json.dumps(preflight(), indent=2))
        return 0
    if not args.input or not args.output:
        parser.error("--input and --output are both required unless --check is used")
    generate(args.input, args.output, args.allow_model_download, args.texture_size)
    print(json.dumps({
        "status": "generated_static_glb_review_required",
        "asset": str(args.output),
        "next": "npm run forge:prepare -- --slot <id> --origin janus-trellis2-local --input <glb>",
        "warning": "Static mesh; rigging, morph targets, animations and visual approval still pending",
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print("JANUS 3D Forge: " + str(error), file=sys.stderr)
        sys.exit(1)
