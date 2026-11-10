// Harvest Moon: Back to Nature (US, SLUS-01115) stamina, fatigue, held tool, mine floor and item odds, shop hours, animal love, can water, tomorrow's weather and hearts. Reads RAM only; never writes it.
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
    // Watering cans are items 21-25 (basic to Mystrile); the value is the water left, 100 when full
    // (seen for the basic and Mystrile cans in the user's saves).
    const HELD = 0x71A84, TOOL_SLOTS = 0x70EC2, TOOL_SLOT_COUNT = 24, CANS = [21, 22, 23, 24, 25], CAN_MAX = 100;
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
    // The place number is a u16 behind the pointer at 0x800A0378. The hoe digs mine tiles only at places 55 and 67
    // (code at 0x800C64DC). The mine keeps its current floor, 0-based, at 0x8012D110.
    const PLACE_PTR = 0xA0378, MINES = [55, 67], MINE_FLOOR = 0x12D110;
    // Item odds for a dug tile that is not stairs, from 0x80113A20: one rand(100) roll walks 8 slots of percents.
    // Tables copied from 0x80127FE8 (place 67) and 0x80128088 (place 55), one row per floor; items from 0x80128128 and 0x80128138.
    // Item names from a public CodeBreaker item list; 99 is not on it. Starred items are given once.
    const MINE_ITEMS = {
        67: [0, 102, 312, 124, 123, 122, 96, 103],
        55: [0, 312, 102, 96, 97, 98, 103, 99]
    };
    const MINE_ODDS = {
        67: [[40, 30, 20, 10, 0, 0, 0, 0], [40, 25, 20, 10, 5, 0, 0, 0], [40, 20, 20, 15, 5, 0, 0, 0], [30, 20, 20, 15, 10, 5, 0, 0],
            [30, 15, 15, 15, 10, 5, 5, 5], [20, 10, 15, 20, 10, 15, 5, 5], [15, 10, 15, 20, 15, 10, 10, 5], [10, 5, 10, 25, 20, 15, 10, 5],
            [5, 5, 15, 25, 20, 15, 10, 5], [0, 0, 10, 30, 25, 20, 10, 5]],
        55: [[40, 30, 20, 10, 0, 0, 0, 0], [40, 20, 20, 10, 5, 5, 0, 0], [35, 20, 20, 15, 5, 5, 0, 0], [25, 20, 20, 15, 10, 10, 0, 0],
            [25, 15, 20, 15, 10, 10, 5, 0], [20, 10, 20, 15, 15, 15, 5, 0], [15, 10, 20, 20, 15, 15, 5, 0], [10, 5, 15, 25, 20, 20, 5, 0],
            [0, 0, 0, 0, 25, 25, 0, 50], [100, 0, 10, 30, 25, 20, 10, 5]]
    };
    const ITEM_NAMES = { 0: 'Nothing', 96: 'Mystrile', 97: 'Orichalcum', 98: 'Adamantite', 99: 'Rare item*', 102: 'Coin',
        103: 'Power Berry*', 122: 'Gold', 123: 'Silver', 124: 'Copper', 312: 'Junk Ore' };
    // The roll stops at the first slot whose running total passes it, so totals above 100 never reach later slots.
    function mineOdds(place, floor) {
        let sum = 0;
        return MINE_ODDS[place][floor - 1].map((pct, i) => {
            const chance = Math.min(100, sum + pct) - Math.min(100, sum);
            sum += pct;
            return [ITEM_NAMES[MINE_ITEMS[place][i]], chance];
        }).filter(([, chance]) => chance > 0);
    }
    // Weather is u16: today at 0x8007AD00, tomorrow at 0x8007AD02 (tomorrow became today in the user's saves).
    // 0 sunny and 1 rain were seen in saves; 2-4 come from a public cheat list.
    const WEATHER_TOMORROW = 0x7AD02, WEATHER = ['Sunny', 'Rain', 'Snow', 'Typhoon', 'Blizzard'];
    const WEATHER_ICON = { Sunny: '☀️', Rain: '🌧️', Snow: '❄️', Typhoon: '🌀', Blizzard: '🌨️' };
    const OPEN_KEY = 'ps1-plugin-hm-hearts-open', SHOPS_KEY = 'ps1-plugin-hm-shops-open';
    // Season (0 spring) at 0x80070CF2, weekday at 0x80070CF6 (0 is Sunday: the day-name code at 0x8001AAB8 indexes "Sun" first), hour at 0x80070CF8.
    const SEASON = 0x70CF2, WEEKDAY = 0x70CF6, HOUR = 0x70CF8, DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Shop hours from fan guides, not the game's code: [name, opens, closes, closed weekdays, only in season].
    // Festivals and storms can also close shops; the plugin does not know about those.
    const SHOPS = [
        ['Supermarket', 9, 18, [0, 2]], ['Blacksmith', 10, 16, [4]], ['Carpenter', 11, 17, [0]],
        ['Poultry Farm', 12, 16, [0]], ['Yodel Ranch', 9, 15, [1]], ['Clinic', 9, 16, [3]],
        ['Inn', 8, 21, []], ['Won', 13, 16, []], ['Winery', 9, 12, [6]], ['Kai', 10, 17, [1], 1]
    ];
    // Animal love is a byte; the name field is 9 u16 letters 18 bytes before it, padded with 0xFFFF (an empty slot starts with 0xFFFF).
    // Addresses from a public CodeBreaker list: chickens from 0x80074302 every 0xB4, barn animals from 0x80074A0A every 0xB8,
    // dog 0x800759FA, horse 0x80075AEA. Love tops out at 255.
    const ANIMALS = [['Dog', [0x759FA]], ['Horse', [0x75AEA]],
        ['Chicken', Array.from({ length: 10 }, (_, i) => 0x74302 + i * 0xB4)],
        ['Barn', Array.from({ length: 20 }, (_, i) => 0x74A0A + i * 0xB8)]];
    const ANIMALS_KEY = 'ps1-plugin-hm-animals-open', LOVE_MAX = 255;
    const letter = c => c < 26 ? String.fromCharCode(c + 65) : c >= 32 && c < 58 ? String.fromCharCode(c + 65) : '?';
    const clock = h => (h % 12 || 12) + (h < 12 ? 'a' : 'p');
    const isOpen = ([, from, to, closed, season], s) =>
        s.hour >= from && s.hour < to && !closed.includes(s.weekday) && (season === undefined || season === s.season);
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
        const u32 = o => (u16(o) | (u16(o + 2) << 16)) >>> 0;
        const s = { stamina: u16(STAMINA), max: u16(STAMINA_MAX), fatigue: u16(FATIGUE) };
        const ok = s.max >= 1 && s.max <= 999 && s.stamina <= 999 && s.fatigue <= 999;
        if (!ok) return null;
        s.hearts = Object.fromEntries(GIRLS.map(([name, n]) => [name, u16(affection(n))]));
        s.held = u16(HELD);
        const ptr = u32(PLACE_PTR) - 0x80000000;
        s.place = ptr >= 0 && ptr < 0x200000 ? u16(ptr) : null;
        s.floor = MINES.includes(s.place) && u16(MINE_FLOOR) <= 9 ? u16(MINE_FLOOR) + 1 : null;
        s.animals = [];
        for (const [kind, spots] of ANIMALS) for (const at of spots) {
            let name = '';
            if (u16(at - 2) !== 0xFFFF) continue;
            for (let i = 0; i < 8 && u16(at - 18 + i * 2) !== 0xFFFF; i++) name += letter(u16(at - 18 + i * 2));
            if (name) s.animals.push({ kind, name, love: H[B + at] });
        }
        s.season = u16(SEASON); s.weekday = u16(WEEKDAY); s.hour = u16(HOUR);
        s.tomorrow = WEATHER[u16(WEATHER_TOMORROW)] || null;
        s.water = null;
        for (const slot of [HELD, ...Array.from({ length: TOOL_SLOT_COUNT }, (_, k) => TOOL_SLOTS + k * 6)]) {
            if (CANS.includes(u16(slot)) && u16(slot + 4) <= CAN_MAX) { s.water = u16(slot + 4); break; }
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
        .icon { font-size: 14px; line-height: 1; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .wait { font-weight: 400; color: #aab3bf; }
        .toggle { font-weight: 400; color: #aab3bf; font-size: 10px; }
        .ores { display: grid; grid-template-columns: 1fr auto; gap: 1px 6px; padding-left: 50px; font-weight: 400; font-size: 10px; color: #cfd6df; }
        .box.wide { width: 190px; }
        .shops { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .shop { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 5px; }
        .shop .dot { width: 7px; height: 7px; border-radius: 50%; background: #4b5563; }
        .shop.open .dot { background: #4ade80; }
        .shop:not(.open) { color: #8b95a3; }
        .shop .when { font-weight: 400; font-variant-numeric: tabular-nums; }
        .animals { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .animal { display: grid; grid-template-columns: 1fr 50px 46px; align-items: center; gap: 6px; }
        .animal .fill { background: #f472b6; }
        .animal .kind { color: #8b95a3; font-weight: 400; }
        .hearts { display: grid; gap: 3px; border-top: 1px solid #2f3742; padding-top: 5px; }
        .girl { display: grid; grid-template-columns: 44px 14px 1fr; align-items: center; gap: 6px; }
        .heart { font-size: 13px; line-height: 1; text-shadow: 0 0 1px #fff, 0 0 1px #fff; }
    </style>
    <div class="box" role="button" tabindex="0" title="Tap for hearts">
        <div class="wait">Waiting for Harvest Moon</div>
        <div class="row st" hidden><span>Stamina</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="row fa" hidden><span>Fatigue</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="tool" hidden><span>Holding</span><span class="name"></span></div>
        <div class="tool sky" hidden><span>Tmrw</span><span class="name icon"></span></div>
        <div class="tool floor" hidden><span>Mine</span><span class="name"></span></div>
        <div class="ores" hidden></div>
        <div class="row wa" hidden><span>Water</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="toggle stoggle" hidden></div>
        <div class="shops" hidden>${SHOPS.map(([name], i) =>
            `<div class="shop sh-${i}"><span class="dot"></span><span>${name}</span><span class="when"></span></div>`).join('')}</div>
        <div class="toggle atoggle" hidden></div>
        <div class="animals" hidden></div>
        <div class="toggle htoggle" hidden></div>
        <div class="hearts" hidden>${GIRLS.map(([name]) =>
            `<div class="girl g-${name}"><span>${name}</span><span class="heart">♥</span><span class="num"></span></div>`).join('')}</div>
    </div>`;
    const $ = q => shadow.querySelector(q);
    const box = $('.box'), wait = $('.wait'), st = $('.st'), fa = $('.fa'), tool = $('.tool'), floor = $('.floor'), ores = $('.ores'), sky = $('.sky'), wa = $('.wa'), toggle = $('.htoggle'), stoggle = $('.stoggle'), shops = $('.shops'), atoggle = $('.atoggle'), animals = $('.animals'), hearts = $('.hearts');

    let open = false;
    try { open = window.localStorage.getItem(OPEN_KEY) === '1'; } catch {}
    let last = null;
    function flip() {
        open = !open;
        try { window.localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
        show(last);
    }
    let shopsOpen = false;
    try { shopsOpen = window.localStorage.getItem(SHOPS_KEY) === '1'; } catch {}
    function flipShops(e) {
        e.stopPropagation();
        shopsOpen = !shopsOpen;
        try { window.localStorage.setItem(SHOPS_KEY, shopsOpen ? '1' : '0'); } catch {}
        show(last);
    }
    let animalsOpen = false;
    try { animalsOpen = window.localStorage.getItem(ANIMALS_KEY) === '1'; } catch {}
    function flipAnimals(e) {
        e.stopPropagation();
        animalsOpen = !animalsOpen;
        try { window.localStorage.setItem(ANIMALS_KEY, animalsOpen ? '1' : '0'); } catch {}
        show(last);
    }
    box.addEventListener('click', flip);
    atoggle.addEventListener('click', flipAnimals);
    animals.addEventListener('click', e => e.stopPropagation());
    stoggle.addEventListener('click', flipShops);
    shops.addEventListener('click', e => e.stopPropagation());
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
        wait.hidden = !!s; st.hidden = fa.hidden = tool.hidden = toggle.hidden = stoggle.hidden = !s;
        shops.hidden = !s || !shopsOpen;
        atoggle.hidden = !s || !s.animals.length;
        animals.hidden = atoggle.hidden || !animalsOpen;
        box.classList.toggle('wide', !!s && (shopsOpen || animalsOpen && s.animals.length > 0));
        floor.hidden = ores.hidden = !s || s.floor === null;
        sky.hidden = !s || s.tomorrow === null;
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
        if (s.tomorrow !== null) {
            const icon = sky.querySelector('.name');
            icon.textContent = WEATHER_ICON[s.tomorrow];
            icon.title = s.tomorrow + ' tomorrow';
        }
        if (s.floor !== null) {
            floor.querySelector('.name').textContent = 'Floor ' + s.floor;
            const key = s.place + ':' + s.floor;
            if (ores.dataset.key !== key) {
                ores.dataset.key = key;
                ores.innerHTML = mineOdds(s.place, s.floor).map(([name, chance]) => `<span>${name}</span><span class="num">${chance}%</span>`).join('');
            }
        }
        if (s.water !== null) {
            bar(wa, s.water, CAN_MAX);
            wa.querySelector('.num').textContent = s.water + '/' + CAN_MAX;
            wa.classList.toggle('empty', s.water === 0);
        }
        stoggle.textContent = (shopsOpen ? '▴ Hide shops' : '▾ Shops') + ' · ' + DAYS[s.weekday] + ' ' + clock(s.hour);
        if (shopsOpen) SHOPS.forEach((shop, i) => {
            const [, from, to, closed, season] = shop, row = shops.querySelector('.sh-' + i);
            row.classList.toggle('open', isOpen(shop, s));
            row.querySelector('.when').textContent = clock(from) + '–' + clock(to);
            row.title = (closed.length ? 'Closed ' + closed.map(d => DAYS[d]).join(', ') : 'Open every day') + (season === undefined ? '' : ', summer only');
        });
        atoggle.textContent = (animalsOpen ? '▴ Hide animals' : '▾ Animals') + ' (' + s.animals.length + ')';
        if (animalsOpen) {
            const html = s.animals.map(a => `<div class="animal" title="${a.kind}"><span>${a.name} <span class="kind">${a.kind}</span></span>`
                + `<div class="bar"><div class="fill" style="width:${Math.round(a.love / LOVE_MAX * 100)}%"></div></div>`
                + `<span class="num">${a.love}/${LOVE_MAX}</span></div>`).join('');
            if (animals.innerHTML !== html) animals.innerHTML = html;
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
        toolName,
        mineOdds,
        isOpen: (name, s) => isOpen(SHOPS.find(x => x[0] === name), s)
    };
})();
