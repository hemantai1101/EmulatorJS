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
    popup_patches = {
        "data/src/emulator.js": ('title.innerText = this.localization(popupTitle);', 'title.innerText = popupTitle ? this.localization(popupTitle) : "";'),
        "data/emulator.min.js": ('s.innerText=this.localization(t);const o=this.createElement("div");o.classList.add("ejs_popup_body")', 's.innerText=t?this.localization(t):"";const o=this.createElement("div");o.classList.add("ejs_popup_body")'),
    }
    for filename, (old, new) in popup_patches.items():
        path = extracted / filename
        source = path.read_text()
        if source.count(old) != 1:
            raise SystemExit(f"Expected popup title code was not found in {filename}")
        path.write_text(source.replace(old, new))
    # PS1 touch controls and visibility.
    touch_patches = {
        "data/src/emulator.js": [
            ('this.addEventListener(button, "touchstart touchend touchcancel", (e) => {', 'window.PS1Touch.bindMouseButton(this, button, value, downValue);\n                this.addEventListener(button, "touchstart touchend touchcancel", (e) => {'),
            ('this.addEventListener(dpadMain, "touchend touchcancel", cancelCb);', 'this.addEventListener(dpadMain, "touchend touchcancel", cancelCb);\n            window.PS1Touch.bindMouseDpad(dpadMain, updateCb, cancelCb);'),
            ('this.toggleVirtualGamepad = (show) => {', 'this.toggleVirtualGamepad = (show) => { clearTimeout(this.virtualGamepadResizeTimeout); this.virtualGamepad.style.opacity = "";'),
            ('setTimeout(() => {\n                    this.virtualGamepad.style.display = "none";', 'this.virtualGamepadResizeTimeout = setTimeout(() => {\n                    this.virtualGamepad.style.display = "none";'),
            ('            const args = [];', '            const args = [];\n            if (this.getCore() === "pcsx_rearmed") args.push("--device=1:517");'),
            ('"zone": elem,', '"zone": elem, "size": zone.size || 100,'),
            ('zoneObj.on("end", () => {', 'zoneObj.on("end", () => { if (zone.ps1Touch) { window.PS1Touch.handle(this.gameManager, zone); return; }'),
            ('zoneObj.on("move", (e, info) => {', 'zoneObj.on("move", (e, info) => { if (zone.ps1Touch) { window.PS1Touch.handle(this.gameManager, zone, info); return; }'),
        ],
        "data/emulator.min.js": [
            ('this.addEventListener(n,"touchstart touchend touchcancel",', 'window.PS1Touch.bindMouseButton(this,n,s,o);this.addEventListener(n,"touchstart touchend touchcancel",'),
            ('this.addEventListener(n,"touchstart touchmove",(', 'const ps1Move=('),
            ('i(l,r,c,d)})),this.addEventListener(n,"touchend touchcancel",(', 'i(l,r,c,d)});const ps1End=('),
            ('i(0,0,0,0)})),e.appendChild(n)};', 'i(0,0,0,0)});this.addEventListener(n,"touchstart touchmove",ps1Move);this.addEventListener(n,"touchend touchcancel",ps1End);window.PS1Touch.bindMouseDpad(n,ps1Move,ps1End);e.appendChild(n)};'),
            ('this.toggleVirtualGamepad=t=>{this.virtualGamepad.style.display=', 'this.toggleVirtualGamepad=t=>{clearTimeout(this.virtualGamepadResizeTimeout);this.virtualGamepad.style.opacity="";this.virtualGamepad.style.display='),
            ('this.virtualGamepad.style.display="",setTimeout((()=>{this.virtualGamepad.style.display="none"', 'this.virtualGamepad.style.display="",this.virtualGamepadResizeTimeout=setTimeout((()=>{this.virtualGamepad.style.display="none"'),
            ('startGame(){try{const t=[];', 'startGame(){try{const t=[];this.getCore()==="pcsx_rearmed"&&t.push("--device=1:517");'),
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
    # The game menu opens only through its button.
    menu_patches = {
        'data/src/emulator.js': [
            ((
                '        this.createBottomMenuBarListeners = () => {\n'
                '            const clickListener = (e) => {\n'
                '                if (e.pointerType === "touch") return;\n'
                '                if (!this.started || ignoreEvents || document.pointerLockElement === this.canvas) return;\n'
                '                if (this.isPopupOpen()) return;\n'
                '                show();\n'
                '            }\n'
                '            const mouseListener = (e) => {\n'
                '                if (!this.started || ignoreEvents || document.pointerLockElement === this.canvas) return;\n'
                '                if (this.isPopupOpen()) return;\n'
                '                const deltaX = e.movementX;\n'
                '                const deltaY = e.movementY;\n'
                '                const threshold = this.elements.menu.offsetHeight + 30;\n'
                '                const mouseY = e.clientY;\n'
                '\n'
                '                if (mouseY >= window.innerHeight - threshold) {\n'
                '                    show();\n'
                '                    return;\n'
                '                }\n'
                '                let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);\n'
                '                if (angle < 0) angle += 360;\n'
                '                if (angle < 85 || angle > 95) return;\n'
                '                show();\n'
                '            }\n'
                '            if (this.menu.mousemoveListener) this.removeEventListener(this.menu.mousemoveListener);\n'
                '            \n'
                '            if ((this.preGetSetting("menubarBehavior") || "downward") === "downward") {\n'
                '                this.menu.mousemoveListener = this.addEventListener(this.elements.parent, "mousemove", mouseListener);\n'
                '            } else {\n'
                '                this.menu.mousemoveListener = this.addEventListener(this.elements.parent, "mousemove", clickListener);\n'
                '            }\n'
                '\n'
                '            this.addEventListener(this.elements.parent, "click", clickListener);\n'
                '        }\n'
            ), '        this.createBottomMenuBarListeners = () => {};\n'),
            ('            let timeout;\n            let ready = true;\n            this.addEventListener(menuButton, "touchstart touchend mousedown mouseup click", (e) => {\n                if (!ready) return;\n                clearTimeout(timeout);\n                timeout = setTimeout(() => {\n                    ready = true;\n                }, 2000)\n                ready = false;\n                e.preventDefault();\n                this.menu.toggle();\n            })\n', '            this.addEventListener(menuButton, "click", (e) => {\n                e.preventDefault();\n                this.menu.toggle();\n            });\n'),
        ],
        'data/emulator.min.js': [
            ('this.createBottomMenuBarListeners=()=>{const t=t=>{"touch"!==t.pointerType&&this.started&&!e&&document.pointerLockElement!==this.canvas&&(this.isPopupOpen()||n())},i=t=>{if(!this.started||e||document.pointerLockElement===this.canvas)return;if(this.isPopupOpen())return;const i=t.movementX,s=t.movementY,o=this.elements.menu.offsetHeight+30;if(t.clientY>=window.innerHeight-o)return void n();let a=Math.atan2(s,i)*(180/Math.PI);a<0&&(a+=360),a<85||a>95||n()};this.menu.mousemoveListener&&this.removeEventListener(this.menu.mousemoveListener),"downward"===(this.preGetSetting("menubarBehavior")||"downward")?this.menu.mousemoveListener=this.addEventListener(this.elements.parent,"mousemove",i):this.menu.mousemoveListener=this.addEventListener(this.elements.parent,"mousemove",t),this.addEventListener(this.elements.parent,"click",t)}', 'this.createBottomMenuBarListeners=()=>{}'),
            ('let i=!0;this.addEventListener(t,"touchstart touchend mousedown mouseup click",(t=>{i&&(clearTimeout(e),e=setTimeout((()=>{i=!0}),2e3),i=!1,t.preventDefault(),this.menu.toggle())}))', 'this.addEventListener(t,"click",(t=>{t.preventDefault(),this.menu.toggle()}))'),
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
    core_default_patches = {
        "data/src/emulator.js": (
            '        return "";\n    }\n    loadSettings() {',
            '        return Object.entries(this.config.defaultOptions || {}).map(([key, value]) => key + " = " + JSON.stringify(String(value))).join("\\n");\n    }\n    loadSettings() {',
        ),
        "data/emulator.min.js": (
            'return""}loadSettings(){',
            'return Object.entries(this.config.defaultOptions||{}).map(([key,value])=>key+" = "+JSON.stringify(String(value))).join("\\n")}loadSettings(){',
        ),
    }
    for filename, (old, new) in core_default_patches.items():
        path = extracted / filename
        source = path.read_text()
        if source.count(old) != 1:
            raise SystemExit(f"Expected core defaults code was not found in {filename}")
        path.write_text(source.replace(old, new))
    save_mount_patches = {
        "data/src/GameManager.js": ('            this.FS.unmount("/data/saves");\n', ''),
        "data/emulator.min.js": ('this.FS.unmount("/data/saves"),', ''),
    }
    for filename, (old, new) in save_mount_patches.items():
        path = extracted / filename
        source = path.read_text()
        if source.count(old) != 1:
            raise SystemExit(f"Expected save mount code was not found in {filename}")
        path.write_text(source.replace(old, new))
    public = ROOT / "public"
    public.mkdir(exist_ok=True)
    shutil.copytree(extracted / "data", public / "data", dirs_exist_ok=True)
    shutil.copy2(extracted / "LICENSE", public / "LICENSE")
    shutil.copy2(ROOT / "index.html", public / "index.html")
    shutil.copy2(ROOT / "manifest.webmanifest", public / "manifest.webmanifest")
    shutil.copy2(ROOT / "recent-game.js", public / "recent-game.js")
    shutil.copy2(ROOT / "recovery.js", public / "recovery.js")
    shutil.copy2(ROOT / "touch-controls.js", public / "touch-controls.js")
    shutil.copy2(ROOT / "menu.js", public / "menu.js")
    shutil.copy2(ROOT / "saves.js", public / "saves.js")
    shutil.copy2(ROOT / "state-cards.js", public / "state-cards.js")
    shutil.copytree(ROOT / "fusion", public / "fusion", dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("*.test.cjs", "*.py", "__pycache__"))
    shutil.copy2(ROOT / "robots.txt", public / "robots.txt")
    shutil.copy2(ROOT / "sitemap.xml", public / "sitemap.xml")
    shutil.copy2(ROOT / "google535566f4769c65a4.html", public / "google535566f4769c65a4.html")
print(f"Prepared EmulatorJS {VERSION} in {public}")
