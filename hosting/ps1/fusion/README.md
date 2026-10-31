# Forbidden Memories fusion helper

From the repository root, run `make play`. Open http://localhost:8765/fusion/ in a new tab. If that port is busy, run `make play PORT=8767` and open http://localhost:8767/fusion/ instead. Keep the live game in its own tab and at its existing address.

Add a hand by name, FM card ID, or a comma/newline list. Exact names and explicit aliases such as `elec snake` work in lists. Partial names and typos show pictures to choose from. They are never silently resolved. Five cards maximum; each copy is a separate usable material. The saved deck is a tap-to-add palette, not the current hand. It comes from the 30 October deck verification in `FORBIDDEN_MEMORIES_CARDS.json`; later rewards are not assumed to be in that deck. No campaign claims, historical coaching stats, active duel, or proposed move are imported.

Own monster slots are numbered left to right. A field monster is the start of a line targeting that slot, followed by ordered hand cards. The search never uses two field cards. With all five field slots full, only lines targeting an existing monster are offered. “Record this play” updates this helper only, consumes the selected hand copies, and places the result in the chosen slot. Undo restores it. New duel clears the tracked board/hand/terrain and can be undone. Removing a destroyed card and adding drawn cards are manual. This is not a turn or legal-battle tracker.

## Data and accuracy

Reused source: [sg4e/YGOFM-gamedata](https://github.com/sg4e/YGOFM-gamedata), MIT, pinned commit `bd91b5b0568059ec38555a3994c30a5068dc3dda`. Its `cardinfo.json`, `fusions.json`, and `equipinfo.json` supply 722 cards, 25,146 unique unordered pairs (50,242 directed entries when symmetric pairs are expanded), and exact equip compatibility. See `DATA-LICENSE.txt` and `provenance.json` for credit and SHA-256 hashes. The stripped local JSON is checked by `make check`; normal builds/searches do not fetch data.

Independent check: [Marcelo Silvarolla’s YFM.db release 1](https://github.com/MarceloSilvarolla/YFM-Database-and-Fusion-Guide/releases/tag/1). All 25,146 pairs match; all 722 ATK/DEF and Guardian Star records match. This is agreement between community datasets, not an exhaustive test against a running game. Their underlying source history may overlap. The text guide was inspected for context but is not copied or shipped; its public-redistribution restriction is kept. The independent database is also not shipped.

To repeat the network source audit, run:

```sh
python3 hosting/ps1/fusion/audit-data.py
```

The exact pair table already captures secondary groups, ATK thresholds, conflicts, and precedence. No type-based rule is inferred at runtime. The DFS search tries each available ordered monster chain, up to five hand cards plus one field monster. Duplicate copies are distinct resources; equivalent orders of identical copies are deduplicated. It returns true-fusion endpoints, sorting lines without failures first, then printed ATK, then hand-card count. The optional wasted-card search permits failed monster steps: the first monster is discarded and the next remains. Every such step is explicitly labeled, and its final endpoint must still be a true fusion. Spell/equip/ritual interactions are excluded from search, even though some exact pairs exist in the raw table. This avoids pretending a spell effect or equip is an ordinary monster fusion. The equip table is available to tests; no equip-play UI is provided.

Observed regression cases cover Griggle + Water Omotics; Dancing Elf + Key Mace; Dancing Elf → Mask of Darkness → Morphing Jar; Petit Dragon → Rock → Electric Snake; weak Dragon → weak Thunder → another Dragon/Thunder; Nemuriko → Mechanical Spider → D. Human; and the reported Masked Clown → Mechanical Spider → Petit Dragon line. They also cover Laser Cannon Armor rejection on Twin-headed, Sea weakening Cyber Soldier, and the Shield/Meadow/Forest/Uranus/Moon examples.

Terrain follows the FM field descriptions and [FM guide’s field table](https://www.supercheats.com/playstation/walkthroughs/yugiohforbiddenmemories-walkthrough04.txt): Forest boosts Beast/Beast-Warrior/Insect/Plant; Wasteland boosts Zombie/Dinosaur/Rock; Mountain boosts Dragon/Winged Beast/Thunder; Meadow boosts Warrior/Beast-Warrior; Sea boosts Aqua/Fish/Sea Serpent/Thunder and weakens Machine/Pyro; Yami boosts Spellcaster/Fiend and weakens Fairy. Each change is 500 ATK/DEF. The star cycles follow the pinned source’s `GuardianStar.java`. Only the stronger side receives +500 in a battle; the helper does not subtract 500 from the weaker side. These are shown separately from printed and field stats. Direct attack disables the star bonus. Fusion lookup never uses terrain or battle-adjusted ATK. Field selection describes the current board; it does not claim a free field-spell play. No TCG effects are imported. Equipped/other modified field stats, opponent stats, attack legality, and whole-turn plans are outside v1.

## Pictures

Art is downloaded once from YGOPRODeck’s cropped-image endpoint by FM password, following its [cache/re-host guidance](https://ygoprodeck.com/api-guide/). The small JPEGs are served from `images/` on the same origin, with no image hotlinks, analytics, external scripts, or relaxed player isolation headers. They are card art only: modern text, effects, and stats are not used. Art may differ from the PS1 picture. Konami and the relevant rights holders retain artwork rights; the data’s MIT license does not grant rights to card art.

Cards lacking an FM password use explicit art-only IDs in `art-ids.json`: exact normalized-name matches from the YGOPRODeck card catalogue, plus Meteor B. Dragon’s modern art name, Meteor Black Dragon. This does not add a redeemable FM password. The 706 cached images cover all 722 cards except 16, listed in `image-status.json`; absent images get an accessible ID/name label. Do not substitute a guessed card image.

To retry missing pictures, run `python3 hosting/ps1/fusion/cache-images.py`. It keeps cached files, limits concurrency, downloads only missing files, and uses macOS `sips` when available to make 160px JPEGs. A failure leaves the textual card usable. The image cache is checked in, so first use does not need the image host.

## Storage, tests, and limits

Only localStorage key `ps1-fm-helper-v1` is used. No IndexedDB, game bytes, BIOS, emulator state, memory cards, or save history is read or written. There is no emulator script on this page. Session undo holds the last 50 edits; saved hand/field/terrain return after reload, while foe star and direct-attack choice reset. No service worker is added: an open loaded helper works without network, but a cold offline reload still needs the local server. This helper is local only and has not been deployed.

`make check` includes the exact-table integrity check, every ordered pair including failures, observed chains, duplicates, field restrictions, terrain, stars, direct attacks, and input resolution. Browser UI validation is recorded in `PROJECT.md`. A desktop phone-size viewport is not a physical phone test.
