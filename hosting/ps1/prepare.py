#!/usr/bin/env python3
"""Prepare only the public player files for a Cloud Run build."""
from pathlib import Path
import argparse
import hashlib
import shutil
import subprocess
import tempfile
import urllib.request

VERSION = "4.2.3"
SHA256 = "07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b"
ROOT = Path(__file__).resolve().parent

parser = argparse.ArgumentParser()
parser.add_argument("--archive", type=Path, help="Use an already downloaded official release")
args = parser.parse_args()
extractor = shutil.which("7zz") or shutil.which("7z")
if not extractor:
    raise SystemExit("Install 7-Zip first: brew install sevenzip")

with tempfile.TemporaryDirectory() as tmp:
    archive = args.archive or Path(tmp) / "emulatorjs.7z"
    if not args.archive:
        url = f"https://github.com/EmulatorJS/EmulatorJS/releases/download/v{VERSION}/{VERSION}.7z"
        urllib.request.urlretrieve(url, archive)
    with archive.open("rb") as release:
        if hashlib.file_digest(release, "sha256").hexdigest() != SHA256:
            raise SystemExit("The release checksum did not match. Nothing was built.")
    extracted = Path(tmp) / "release"
    subprocess.run([extractor, "x", str(archive.resolve()), f"-o{extracted}", "data/*", "LICENSE", "-y"], check=True, stdout=subprocess.DEVNULL)
    for core in (extracted / "data/cores").glob("*.data"):
        if not core.name.startswith("pcsx_rearmed-"):
            core.unlink()
    timestamp = 'new Date().toLocaleString("sv-SE", { hour12: false }).replace(/[ :]/g, "-")'
    patches = {
        "data/src/emulator.js": ('a.download = this.getBaseFileName() + ".state";', f'a.download = this.getBaseFileName() + "-" + {timestamp} + ".state";'),
        "data/emulator.min.js": ('i.download=this.getBaseFileName()+".state"', f'i.download=this.getBaseFileName()+"-"+{timestamp}+".state"'),
    }
    for filename, (old, new) in patches.items():
        path = extracted / filename
        source = path.read_text()
        if source.count(old) != 1:
            raise SystemExit(f"Expected save download code was not found in {filename}")
        path.write_text(source.replace(old, new))
    public = ROOT / "public"
    public.mkdir(exist_ok=True)
    shutil.copytree(extracted / "data", public / "data", dirs_exist_ok=True)
    shutil.copy2(extracted / "LICENSE", public / "LICENSE")
    shutil.copy2(ROOT / "index.html", public / "index.html")
    shutil.copy2(ROOT / "manifest.webmanifest", public / "manifest.webmanifest")
print(f"Prepared EmulatorJS {VERSION} in {public}")
