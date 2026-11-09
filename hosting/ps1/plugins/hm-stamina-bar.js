// Harvest Moon: Back to Nature (US, SLUS-01115) stamina, fatigue, held tool, mine floor, can water and hearts. Reads RAM only; never writes it.
(function () {
    'use strict';
    if (window.__hmStamina) window.__hmStamina.stop();

    // RAM offsets from 0x80000000, from public cheat lists, checked against a live game on 9 November 2026.
    const STAMINA = 0x71A12, STAMINA_MAX = 0x71A14, FATIGUE = 0x71A16;
    // The game caps fatigue at 100 (code at 0x800D62EC) and changes behaviour at 50, 70 and 80 (0x800CD4E4).
    const FATIGUE_MAX = 100, FATIGUE_TIRED = 50, FATIGUE_HIGH = 80;
    // Affection is u16 at 0x80076224 + villager * 0x1D4; the girls' villager numbers come from the table at 0x80055988.
    const GIRLS = [['Karen', 3], ['Ann', 7], ['Elli', 9], ['Mary', 14], ['Popuri', 20]];
    const affection = n => 0x76224 + n * 0x1D4;
    // Heart level steps from the game's code at 0x80022F1C. Colour names follow fan guides.
    const HEARTS = [
        [5000, 'Black', '#1b1b1b'], [20000, 'Purple', '#a855f7'], [30000, 'Blue', '#3b82f6'], [40000, 'Green', '#22c55e'],
        [50000, 'Yellow', '#facc15'], [60000, 'Orange', '#fb923c'], [Infinity, 'Red', '#ef4444']
    ];
    const heartOf = v => HEARTS.find(h => v < h[0]);
    // Items are 6-byte slots: u16 id, then u16 value at +4. The held item is at 0x80071A84; the 24 tool slots start at 0x80070EC2.
    // The basic watering can is item 21; its value is the water left, 100 when full (from the user's saves).
    const HELD = 0x71A84, TOOL_SLOTS = 0x70EC2, TOOL_SLOT_COUNT = 24, CAN = 21, CAN_MAX = 100;
    // Tool item numbers 1-57, from a public GameShark item list; they match the tools seen in the user's saves.
    const TOOLS = [, 'Sickle', 'Copper Sickle', 'Silver Sickle', 'Golden Sickle', 'Mystrile Sickle',
        'Hoe', 'Copper Hoe', 'Silver Hoe', 'Golden Hoe', 'Mystrile Hoe',
        'Axe', 'Copper Axe', 'Silver Axe', 'Golden Axe', 'Mystrile Axe',
        'Hammer', 'Copper Hammer', 'Silver Hammer', 'Golden Hammer', 'Mystrile Hammer',
        'Watering Can', 'Copper Can', 'Silver Can', 'Golden Can', 'Mystrile Can',
        'Milker', 'Clippers', 'Brush', 'Bell', 'Animal Medicine', 'Cow Miracle Potion', 'Sheep Miracle Potion', 'Blue Feather',
        'Turnip Seeds', 'Potato Seeds', 'Cucumber Seeds', 'Strawberry Seeds', 'Cabbage Seeds', 'Tomato Seeds', 'Corn Seeds',
        'Onion Seeds', 'Pumpkin Seeds', 'Pineapple Seeds', 'Eggplant Seeds', 'Carrot Seeds', 'Sweet Potato Seeds',
        'Spinach Seeds', 'Green Pepper Seeds', 'Moondrop Seeds', 'Pink Cat Seeds', 'Magic Red Seeds', 'Toy Flower Seeds',
        'Orange Cup Seeds', 'Grass Seeds', 'Ocarina', 'Fishing Rod', 'Fishing Pole'];
    const toolName = id => id === 0 ? 'Nothing' : TOOLS[id] || 'Item ' + id;
    // Place number at 0x8006C3FA: 120 in the mine, 77 in town, 90 in the library (from the user's saves).
    // The mine keeps its current floor, 0-based, at 0x8012D110; it went 0 to 1 when the user took the stairs.
    const PLACE = 0x6C3FA, MINE = 120, MINE_FLOOR = 0x12D110;
    const OPEN_KEY = 'ps1-plugin-hm-hearts-open';
    // BIOS exception handler at 0x80, used to find where PS1 RAM sits in the emulator heap.
    const SIG = [0x00, 0x00, 0x1a, 0x3c, 0x80, 0x0c, 0x5a, 0x27, 0x08, 0x00, 0x40, 0x03];

    const heap = () => window.EJS_emulator?.gameManager?.Module?.HEAPU8 || null;
    const hasSig = (H, i) => SIG.every((v, j) => H[i + j] === v);
    function findRam(H) {
        for (let i = 0; i < H.length - 16; i += 4) if (hasSig(H, i)) return i - 0x80;
        return null;
    }
    function read(H, B) {
        const u16 = o => H[B + o] | (H[B + o + 1] << 8);
        const s = { stamina: u16(STAMINA), max: u16(STAMINA_MAX), fatigue: u16(FATIGUE) };
        const ok = s.max >= 1 && s.max <= 999 && s.stamina <= 999 && s.fatigue <= 999;
        if (!ok) return null;
        s.hearts = Object.fromEntries(GIRLS.map(([name, n]) => [name, u16(affection(n))]));
        s.held = u16(HELD);
        s.floor = u16(PLACE) === MINE && u16(MINE_FLOOR) <= 9 ? u16(MINE_FLOOR) + 1 : null;
        s.water = null;
        for (const slot of [HELD, ...Array.from({ length: TOOL_SLOT_COUNT }, (_, k) => TOOL_SLOTS + k * 6)]) {
            if (u16(slot) === CAN && u16(slot + 4) <= CAN_MAX) { s.water = u16(slot + 4); break; }
        }
        return s;
    }

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
        [hidden] { display: none !important; }
        .box { width: 150px; padding: 6px 8px; background: rgba(12,15,20,.78); color: #eef2f7; border-radius: 8px;
               font: 600 11px/1.2 system-ui, sans-serif; display: grid; gap: 5px; pointer-events: auto; cursor: pointer;
               user-select: none; -webkit-user-select: none; }
        .row { display: grid; grid-template-columns: 44px 1fr 40px; align-items: center; gap: 6px; }
        .bar { height: 8px; background: #2a313b; border-radius: 4px; overflow: hidden; }
        .fill { height: 100%; width: 0; border-radius: 4px; transition: width .2s; }
        .st .fill { background: #4ade80; } .st.low .fill { background: #f59e0b; } .st.empty .fill { background: #ef4444; }
        .fa .fill { background: #a78bfa; } .fa.tired .fill { background: #f59e0b; } .fa.high .fill { background: #ef4444; }
        .wa .fill { background: #38bdf8; } .wa.empty .fill { background: #ef4444; }
        .tool { display: grid; grid-template-columns: 44px 1fr; gap: 6px; }
        .tool .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .wait { font-weight: 400; color: #aab3bf; }
        .toggle { font-weight: 400; color: #aab3bf; font-size: 10px; }
        .hearts { display: grid; gap: 3px; border-top: 1px solid #2f3742; padding-top: 5px; }
        .girl { display: grid; grid-template-columns: 44px 14px 1fr; align-items: center; gap: 6px; }
        .heart { font-size: 13px; line-height: 1; text-shadow: 0 0 1px #fff, 0 0 1px #fff; }
    </style>
    <div class="box" role="button" tabindex="0" title="Show or hide hearts">
        <div class="wait">Waiting for Harvest Moon</div>
        <div class="row st" hidden><span>Stamina</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="row fa" hidden><span>Fatigue</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="tool" hidden><span>Holding</span><span class="name"></span></div>
        <div class="tool floor" hidden><span>Mine</span><span class="name"></span></div>
        <div class="row wa" hidden><span>Water</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="toggle" hidden></div>
        <div class="hearts" hidden>${GIRLS.map(([name]) =>
            `<div class="girl g-${name}"><span>${name}</span><span class="heart">♥</span><span class="num"></span></div>`).join('')}</div>
    </div>`;
    const $ = q => shadow.querySelector(q);
    const box = $('.box'), wait = $('.wait'), st = $('.st'), fa = $('.fa'), tool = $('.tool'), floor = $('.floor'), wa = $('.wa'), toggle = $('.toggle'), hearts = $('.hearts');

    let open = false;
    try { open = window.localStorage.getItem(OPEN_KEY) === '1'; } catch {}
    let last = null;
    function flip() {
        open = !open;
        try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
        show(last);
    }
    box.addEventListener('click', flip);
    box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });

    function place() {
        const parent = document.fullscreenElement || document.webkitFullscreenElement || document.body;
        if (host.parentNode !== parent) parent.appendChild(host);
    }
    function bar(row, value, max) {
        row.querySelector('.fill').style.width = Math.min(100, Math.round(value / max * 100)) + '%';
    }
    function show(s) {
        last = s;
        wait.hidden = !!s; st.hidden = fa.hidden = tool.hidden = toggle.hidden = !s;
        floor.hidden = !s || s.floor === null;
        hearts.hidden = !s || !open;
        wa.hidden = !s || s.water === null;
        if (!s) return;
        bar(st, s.stamina, s.max);
        st.querySelector('.num').textContent = s.stamina + '/' + s.max;
        st.classList.toggle('low', s.stamina > 0 && s.stamina <= s.max * 0.3);
        st.classList.toggle('empty', s.stamina === 0);
        bar(fa, s.fatigue, FATIGUE_MAX);
        fa.querySelector('.num').textContent = s.fatigue + '/' + FATIGUE_MAX;
        fa.classList.toggle('tired', s.fatigue >= FATIGUE_TIRED && s.fatigue < FATIGUE_HIGH);
        fa.classList.toggle('high', s.fatigue >= FATIGUE_HIGH);
        tool.querySelector('.name').textContent = toolName(s.held);
        if (s.floor !== null) floor.querySelector('.name').textContent = 'Floor ' + s.floor;
        if (s.water !== null) {
            bar(wa, s.water, CAN_MAX);
            wa.querySelector('.num').textContent = s.water + '/' + CAN_MAX;
            wa.classList.toggle('empty', s.water === 0);
        }
        toggle.textContent = open ? '▴ Hide hearts' : '▾ Hearts';
        if (!open) return;
        for (const [name] of GIRLS) {
            const v = s.hearts[name], h = heartOf(v), row = hearts.querySelector('.g-' + name);
            const heart = row.querySelector('.heart');
            heart.style.color = h[2];
            heart.title = h[1] + ' heart';
            row.querySelector('.num').textContent = v.toLocaleString('en-US');
        }
    }

    let B = null, lastScan = 0;
    function tick() {
        place();
        const H = heap();
        if (!H) return show(null);
        if (B === null || B < 0 || !hasSig(H, B + 0x80)) {
            // A full heap scan is slow; try at most once every 2 seconds.
            if (Date.now() - lastScan < 2000) return show(null);
            lastScan = Date.now();
            B = findRam(H);
        }
        show(B === null ? null : read(H, B));
    }
    tick();
    const timer = setInterval(tick, 250);
    window.__hmStamina = {
        stop() { clearInterval(timer); host.remove(); delete window.__hmStamina; },
        read: () => { const H = heap(); return H && B !== null ? read(H, B) : null; },
        heart: v => heartOf(v)[1],
        toolName
    };
})();
