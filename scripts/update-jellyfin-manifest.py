#!/usr/bin/env python3

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

if len(sys.argv) != 7:
    print(
        "Usage: update-jellyfin-manifest.py <manifest> <version> <tag> <asset_name> <repo> <checksum>",
        file=sys.stderr,
    )
    sys.exit(1)

manifest_path = Path(sys.argv[1])
version = sys.argv[2]
tag = sys.argv[3]
asset_name = sys.argv[4]
repo = sys.argv[5]
checksum = sys.argv[6]

if not manifest_path.exists():
    raise SystemExit(f"Manifest introuvable: {manifest_path}")

source_url = f"https://github.com/{repo}/releases/download/{tag}/{asset_name}"

timestamp = (
    datetime.now(timezone.utc)
    .replace(microsecond=0)
    .isoformat()
    .replace("+00:00", "Z")
)

data = json.loads(manifest_path.read_text(encoding="utf-8"))


def find_plugin_entry(root):
    if isinstance(root, dict) and isinstance(root.get("versions"), list):
        return root

    if isinstance(root, list):
        candidates = [
            item for item in root
            if isinstance(item, dict) and isinstance(item.get("versions"), list)
        ]
        preferred = [
            item for item in candidates
            if "cinehover" in str(item.get("name", "")).lower()
            or "cinemahover" in str(item.get("name", "")).lower()
        ]
        if preferred:
            return preferred[0]
        if candidates:
            return candidates[0]

    raise SystemExit("Impossible de trouver une entrée plugin avec un champ versions[].")


plugin = find_plugin_entry(data)
versions = plugin.setdefault("versions", [])
previous = versions[0] if versions else {}

target_abi = (
    os.environ.get("JELLYFIN_TARGET_ABI")
    or previous.get("targetAbi")
    or previous.get("targetAbiVersion")
)

if not target_abi:
    raise SystemExit(
        "targetAbi introuvable. Définis JELLYFIN_TARGET_ABI dans le workflow."
    )

new_entry = {
    "version": version,
    "changelog": f"CineHover {version}",
    "targetAbi": target_abi,
    "sourceUrl": source_url,
    "checksum": checksum,
    "timestamp": timestamp,
}

versions[:] = [
    entry for entry in versions
    if not (isinstance(entry, dict) and str(entry.get("version")) == version)
]

versions.insert(0, new_entry)

manifest_path.write_text(
    json.dumps(data, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)

print(f"Manifest mis à jour: {manifest_path}")
print(f"Version: {version}")
print(f"URL: {source_url}")
print(f"SHA256: {checksum}")
