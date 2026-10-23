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
    archive = args.archive or ROOT / ".cache" / f"emulatorjs-{VERSION}.7z"
    if not args.archive and not archive.exists():
        archive.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://github.com/EmulatorJS/EmulatorJS/releases/download/v{VERSION}/{VERSION}.7z"
        download = Path(tmp) / "emulatorjs.7z"
        urllib.request.urlretrieve(url, download)
        with download.open("rb") as release:
            if hashlib.file_digest(release, "sha256").hexdigest() != SHA256:
                raise SystemExit("The release checksum did not match. Nothing was cached.")
        shutil.move(download, archive)
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
    # Keep the release engine intact outside the custom PS1 stick.
    touch_patches = {
        "data/src/emulator.js": [
            ('"zone": elem,', '"zone": elem, "size": zone.size || 100,'),
            ('zoneObj.on("end", () => {', 'zoneObj.on("end", () => { if (zone.ps1Touch) { window.PS1Touch.handle(this.gameManager, zone); return; }'),
            ('zoneObj.on("move", (e, info) => {', 'zoneObj.on("move", (e, info) => { if (zone.ps1Touch) { window.PS1Touch.handle(this.gameManager, zone, info); return; }'),
        ],
        "data/emulator.min.js": [
            ('nipplejs.create({zone:i,', 'nipplejs.create({zone:i,size:t.size||100,'),
            ('n.on("end",(()=>{this.gameManager.simulateInput(0,t.inputValues[0],0)', 'n.on("end",(()=>{if(t.ps1Touch){window.PS1Touch.handle(this.gameManager,t);return;}this.gameManager.simulateInput(0,t.inputValues[0],0)'),
            ('n.on("move",((e,i)=>{const n=i.angle.degree', 'n.on("move",((e,i)=>{if(t.ps1Touch){window.PS1Touch.handle(this.gameManager,t,i);return;}const n=i.angle.degree'),
        ],
    }
    for filename, replacements in touch_patches.items():
        path = extracted / filename
        source = path.read_text()
        for old, new in replacements:
            if source.count(old) != 1:
                raise SystemExit(f"Expected touch control code was not found in {filename}")
            source = source.replace(old, new)
        path.write_text(source)
    # Phones must open the menu with its button, not mouse events made from taps.
    menu_patches = {
        "data/emulator.min.js": [
            ('createBottomMenuBarListeners=()=>{const t=t=>{', 'createBottomMenuBarListeners=()=>{const t=t=>{if(matchMedia("(pointer:coarse)").matches||t.sourceCapabilities?.firesTouchEvents)return;'),
            ('},i=t=>{if(!this.started||e||document.pointerLockElement===this.canvas)return;', '},i=t=>{if(matchMedia("(pointer:coarse)").matches||t.sourceCapabilities?.firesTouchEvents)return;if(!this.started||e||document.pointerLockElement===this.canvas)return;'),
        ],
        "data/src/emulator.js": [
            ('const clickListener = (e) => {', 'const clickListener = (e) => { if (matchMedia("(pointer:coarse)").matches || e.sourceCapabilities?.firesTouchEvents) return;'),
            ('const mouseListener = (e) => {', 'const mouseListener = (e) => { if (matchMedia("(pointer:coarse)").matches || e.sourceCapabilities?.firesTouchEvents) return;'),
        ],
    }
    for filename, replacements in menu_patches.items():
        path = extracted / filename
        source = path.read_text()
        for old, new in replacements:
            if source.count(old) != 1:
                raise SystemExit(f"Expected menu code was not found in {filename}")
            source = source.replace(old, new)
        path.write_text(source)
    keyboard_patches = {
        "data/src/emulator.js": (
            'keyChange(e) {\n        if (e.repeat) return;',
            'keyChange(e) {\n        if (e.repeat) {\n            if (this.started && this.settingsMenu.style.display === "none" && !this.isPopupOpen() && this.getSettingValue("keyboardInput") !== "enabled") e.preventDefault();\n            return;\n        }',
        ),
        "data/emulator.min.js": (
            'keyChange(t){if(t.repeat)return;',
            'keyChange(t){if(t.repeat){if(this.started&&this.settingsMenu.style.display==="none"&&!this.isPopupOpen()&&this.getSettingValue("keyboardInput")!=="enabled")t.preventDefault();return;}',
        ),
    }
    for filename, (old, new) in keyboard_patches.items():
        path = extracted / filename
        source = path.read_text()
        if source.count(old) != 1:
            raise SystemExit(f"Expected keyboard code was not found in {filename}")
        path.write_text(source.replace(old, new))
    public = ROOT / "public"
    public.mkdir(exist_ok=True)
    shutil.copytree(extracted / "data", public / "data", dirs_exist_ok=True)
    shutil.copy2(extracted / "LICENSE", public / "LICENSE")
    shutil.copy2(ROOT / "index.html", public / "index.html")
    shutil.copy2(ROOT / "manifest.webmanifest", public / "manifest.webmanifest")
    shutil.copy2(ROOT / "recovery.js", public / "recovery.js")
    shutil.copy2(ROOT / "touch-controls.js", public / "touch-controls.js")
    shutil.copy2(ROOT / "robots.txt", public / "robots.txt")
    shutil.copy2(ROOT / "sitemap.xml", public / "sitemap.xml")
    shutil.copy2(ROOT / "google535566f4769c65a4.html", public / "google535566f4769c65a4.html")
print(f"Prepared EmulatorJS {VERSION} in {public}")
