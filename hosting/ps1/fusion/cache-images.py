#!/usr/bin/env python3
"""Cache card art once; never use TCG text or stats."""
import concurrent.futures
import json
from pathlib import Path
import shutil
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
DEST = ROOT / 'images'
DEST.mkdir(exist_ok=True)
cards = json.loads((ROOT / 'data.json').read_text())['cards']
art_ids = json.loads((ROOT / 'art-ids.json').read_text())


def cache(card):
    target = DEST / f"{card['id']}.jpg"
    if target.exists():
        return None
    password = str(art_ids.get(str(card['id'])) or card['password'] or '')
    if not password or not password.isdigit() or int(password) == 0:
        return card['id']
    time.sleep(0.35)
    url = f'https://images.ygoprodeck.com/images/cards_cropped/{int(password)}.jpg'
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            body = response.read()
        if not body.startswith(b'\xff\xd8'):
            return card['id']
        target.write_bytes(body)
        if shutil.which('sips'):
            subprocess.run(['sips', '-Z', '160', '-s', 'formatOptions', '65', str(target)], check=True, stdout=subprocess.DEVNULL)
        return None
    except (urllib.error.URLError, TimeoutError):
        return card['id']


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    missing = [result for result in pool.map(cache, cards) if result is not None]
(ROOT / 'image-status.json').write_text(json.dumps({'cached': len(list(DEST.glob('*.jpg'))), 'missing': missing}) + '\n')
print(f'Cached {len(list(DEST.glob("*.jpg")))} pictures; {len(missing)} missing.')
