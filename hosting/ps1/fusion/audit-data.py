#!/usr/bin/env python3
"""Recheck the pinned source files and an independent database. No writes."""
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'provenance.json').read_text())
data = json.loads((ROOT / 'data.json').read_text())
assert hashlib.sha256((ROOT / 'data.json').read_bytes()).hexdigest() == manifest['data_sha256']
source = {}
for name, checksum in manifest['files'].items():
    url = f"https://raw.githubusercontent.com/sg4e/YGOFM-gamedata/{manifest['commit']}/sqlite/json/{name}"
    body = urllib.request.urlopen(url, timeout=60).read()
    assert hashlib.sha256(body).hexdigest() == checksum, name
    source[name] = json.loads(body)
expected_cards = [{'id': c['cardId'], 'name': c['cardName'], 'type': c['type'], 'atk': c['attack'], 'def': c['defense'],
                   'stars': [s for s in (c['guardianStar1'], c['guardianStar2']) if s], 'password': c['password']}
                  for c in source['cardinfo.json']]
assert expected_cards == data['cards']
assert [[c['material1'], c['material2'], c['result']] for c in source['fusions.json']] == data['fusions']
assert [[c['equipId'], c['cardId']] for c in source['equipinfo.json']] == data['equips']
body = urllib.request.urlopen('https://github.com/MarceloSilvarolla/YFM-Database-and-Fusion-Guide/releases/download/1/YFM.db', timeout=60).read()
assert hashlib.sha256(body).hexdigest() == manifest['cross_check']['sha256']
with tempfile.TemporaryDirectory() as tmp:
    db = Path(tmp) / 'reference.db'
    db.write_bytes(body)
    connection = sqlite3.connect(db)
    pairs = {(min(a, b), max(a, b)): int(r) for a, b, r in connection.execute('SELECT * FROM Fusions')}
    assert pairs == {(min(a, b), max(a, b)): r for a, b, r in data['fusions']}
    for card in data['cards']:
        actual = connection.execute('SELECT Attack, Defense, GuardianStar1, GuardianStar2 FROM Cards WHERE CardID=?', (card['id'],)).fetchone()
        assert actual[:2] == (card['atk'], card['def'])
        assert [s for s in actual[2:] if s] == card['stars']
    connection.close()
print('Pinned files match. Independent database matches all 25,146 pairs and all 722 ATK/DEF/star records.')
