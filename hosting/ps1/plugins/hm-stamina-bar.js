// Harvest Moon: Back to Nature (US, SLUS-01115) stamina, fatigue, held tool, mine floor and item odds, basket, horse race tips, fish pond, ripe crops, shop hours, animal love, villager and sprite friendship, sprite jobs, can water, tomorrow's weather and hearts. Reads RAM only; never writes it.
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
    // Other villagers' friendship is the u16 just before (0x80076222 + villager * 0x1D4); the game's add function at 0x8011FEE0 caps it at 255.
    // Names from a public cheat list (vcgamers.com); each address fits this layout and the list's girl entries match the game's table.
    // Villager 8 is the Doctor: a gift to him raised it from 160 to 169 while the talk target 0x80071A22 was 8.
    const friendship = n => affection(n) - 2, FRIEND_MAX = 255;
    const VILLAGERS = [[1, 'Jeff'], [2, 'Sasha'], [4, 'Saibara'], [5, 'Gray'], [6, 'Doug'], [8, 'Doctor'], [10, 'Carter'], [11, 'Cliff'],
        [12, 'Basil'], [13, 'Anna'], [15, 'Barley'], [16, 'May'], [17, 'Thomas'], [18, 'Lillia'], [19, 'Rick'], [21, 'Duke'],
        [22, 'Manna'], [23, 'Ellen'], [24, 'Gotz'], [25, 'Kai'], [28, 'Harris'], [29, 'Kano'], [30, 'Gourmet'], [31, 'Louis'],
        [32, 'Greg'], [34, 'Stu'], [35, 'Won']];
    const VILLAGERS_KEY = 'ps1-plugin-hm-villagers-open', WIKI = name => 'https://harvestmoon.fandom.com/wiki/' + name + '_(BTN)';
    const SPRITES_WIKI = 'https://harvestmoon.fandom.com/wiki/Harvest_Sprites_(BTN)';
    // Harvest Sprites: 7 records of 0xF8 bytes from 0x8007A638 (cleared and looped over by code at 0x8010C6A0 and 0x8010C95C).
    // Each holds its name at +4 (u16 letters, 0xFFFF ends) and friendship at +0x16, kept within 0-255 by code at 0x8010CC78.
    const SPRITES = Array.from({ length: 7 }, (_, k) => 0x7A638 + k * 0xF8);
    // Hired job: +0xB8 bit 1 harvest, 2 water, 4 animals (set at 0x8010E81C-0x8010E8EC); +0xB4 is 2, 4 or 8 when hired for 1, 3 or 7 days
    // (0x8010E988). Each new day takes 1 off and the sprite works while it is above 0 (0x8010CCB0), so +0xB4 - 1 work days are left.
    const JOBS = [[1, 'Harvest', '🌾'], [2, 'Water', '💧'], [4, 'Animals', '🐄']], JOB_DAYS_MAX = 8;
    // Each sprite's outfit colour, from fan guides.
    const SPRITES_KEY = 'ps1-plugin-hm-sprites-open';
    const SPRITE_COLOURS = { Chef: '#ef4444', Nappy: '#fb923c', Hoggy: '#facc15', Timid: '#22c55e', Aqua: '#38bdf8', Staid: '#6366f1', Bold: '#a855f7' };
    // Heart level steps from the game's code at 0x80022F1C. Colour names follow fan guides.
    const HEARTS = [
        [5000, 'Black', '#1b1b1b', '#9ca3af'], [20000, 'Purple', '#a855f7'], [30000, 'Blue', '#3b82f6'], [40000, 'Green', '#22c55e'],
        [50000, 'Yellow', '#facc15'], [60000, 'Orange', '#fb923c'], [Infinity, 'Red', '#ef4444']
    ];
    const heartOf = v => HEARTS.find(h => v < h[0]);
    // The affection adder at 0x8011FF0C stops at 0xFFFF.
    const HEART_MAX = 0xFFFF;
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
    // Item records are 40 bytes behind the pointer at 0x8006C858; the menu (0x800FB510) shows a slot's +4 count when byte +2 is 2 (seeds).
    const ITEM_TABLE_PTR = 0x6C858, ITEM_SIZE = 40, STACKS = 2, STACK_MAX = 99;
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
    // Horse race: 3 races of 6 horses, 0xE bytes each from 0x8007AD4E (race * 0x54): u16 id, speed, whip, style, push, odds.
    // Code at 0x8002206C rolls them at a new game and on race day. The current race is u16 at 0x8007AD4C (3: you ride, in row 2).
    const RACE = 0x7AD4C, HORSES = 0x7AD4E, DAY = 0x70CF4;
    // Names by id, from the race code's table at 0x800BB534 and the text at 0x800556A8 (one letter of id 29 is unknown).
    const HORSE_NAMES = ['HoneyB', 'BeeBop', 'Nova', 'ShyBoy', 'Sadie', 'Apache', 'HotPot', 'Pesto', 'Bubba', 'Regent', 'Junior',
        'Mango', 'Donut', 'Roper', 'MayDay', 'Wonder', 'Blacky', 'Matty', 'Adios', 'Maniac', 'Flower', 'Rocket', 'Kaya', 'Tangle',
        'Chewy', 'Galaxy', 'RockOn', 'Elvis', 'ChaCha', '?UMom', 'Maple', 'Diva', 'Digger', 'Lava', 'Sultan', 'Fuji', 'Catnip',
        'Dandy', 'Mojo', 'Koko'];
    // While the race code is loaded, 0x800B7E20 holds 7 then 0x800B7EB8. Betting runs in town code, so race day (Spring 18) also counts.
    const RACE_CODE = 0xB7E20, RACE_DAY = [0, 17], SIM_RUNS = 1000;
    // Chance per row (push, normal, hold back) and column (stamina >170, >100, else; whip >80 or not) that a horse does NOT whip, out of 127.
    const NO_WHIP = [[0, 80, 60, 90, 115, 100], [30, 100, 90, 110, 120, 110], [125, 127, 125, 127, 127, 120]];
    // Replays the race code (0x800B8898 each frame, decisions every 6th frame) many times and counts wins per lane.
    function raceOdds(horses, runs = SIM_RUNS) {
        let seed = 1;
        const rand = n => { seed = (Math.imul(seed, 0x41C64E6D) + 0x3039) >>> 0; return ((seed >>> 16) * n) >>> 16; };
        const chance = x => rand(100) < Math.trunc(x * 100 / 127);
        // Every frame starts each horse at its base pace (0x800B9C48); a whip only lifts the pace of its own frame.
        const n = horses.length, base = horses.map(h => 128 + Math.trunc(512 * h.speed / 25500));
        const step = base.map(b => Math.trunc(b * 4096 / 30)), wins = horses.map(() => 0);
        const stamina = new Int32Array(n), pos = new Int32Array(n), whip = new Uint8Array(n), pace = new Int32Array(n);
        for (let run = 0; run < runs; run++) {
            stamina.fill(255); pos.fill(-0x20000); whip.fill(0);
            let leader = 0, winner = -1;
            for (let frame = 1; winner < 0 && frame < 5000; frame++) {
                for (let i = 0; i < n; i++) pace[i] = base[i];
                if (frame % 6 === 0) {
                    for (let i = 0; i < n; i++) if (stamina[i] < 255) stamina[i] += 5;
                    const late = pos[leader] >= 0x400000;
                    for (let i = 0; i < n; i++) {
                        if (whip[i]) { whip[i] = 0; continue; }
                        const h = horses[i];
                        let mood = (late ? chance(h.style + 1) : chance(127 - h.style)) ? 1 : 2, boxed = false;
                        for (let j = 0; j < n; j++) if (j !== i && pos[j] - pos[i] >= 0 && pos[j] - pos[i] <= 0x59FFF) boxed = true;
                        if (boxed && chance(h.push + 1)) mood--;
                        const col = (stamina[i] > 170 ? 0 : stamina[i] > 100 ? 2 : 4) + (h.whipPower > 80 ? 0 : 1);
                        whip[i] = NO_WHIP[mood][col] < rand(127) ? 1 : 0;
                    }
                    for (let i = 0; i < n; i++) {
                        if (whip[i] && stamina[i] >= 40) { stamina[i] -= 40; pace[i] += Math.trunc(pace[i] * (horses[i].whipPower + 150) / 255); }
                        pace[i] = Math.max(base[i], pace[i] - Math.trunc((pace[i] - base[i]) * 255 / ((stamina[i] + 1) * 18)));
                    }
                }
                for (let i = 0; i < n; i++) {
                    pos[i] += pace[i] === base[i] ? step[i] : Math.trunc(pace[i] * 4096 / 30);
                    if (winner < 0 && pos[i] > 0x7FFFFF) winner = i;
                }
                for (let i = 0; i < n; i++) if (pos[i] > pos[leader]) leader = i;
            }
            if (winner >= 0) wins[winner]++;
        }
        return wins.map(w => Math.round(w / runs * 1000) / 10);
    }
    // Basket: u16 count at 0x800712C0, then 25 u16 counts by kind, then u32 sale value at 0x800712F4.
    // The add code at 0x800F3E44 stops at 30. Kinds come from 0x800F3C9C: items 0x41-0x4F are kinds 0-14 (crops, in seed order),
    // the rest group sizes and gold versions; their names follow item prices at 0x8006C858 + id * 40 + 0x12 matched to fan guides.
    // Kinds 22-24 are items 0x5D-0x5F (item - 71 at 0x800F3D2C), named Blue, Red and Green Grass on a public CodeBreaker item list.
    // Some items (such as mine finds) add to the count and value but to no kind; they show as Other.
    const BASKET = 0x712C0, BASKET_MAX = 30, BASKET_KINDS = ['Turnip', 'Potato', 'Cucumber', 'Strawberry', 'Cabbage', 'Tomato', 'Corn',
        'Onion', 'Pumpkin', 'Pineapple', 'Eggplant', 'Carrot', 'Sweet potato', 'Spinach', 'Green pepper', 'Egg', 'Mayonnaise', 'Wool',
        'Milk', 'Cheese', 'Yarn', 'Fish', 'Blue grass', 'Red grass', 'Green grass'];
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
    const ANIMALS_KEY = 'ps1-plugin-hm-animals-open', LOVE_MAX = 255, DOG_FLAGS = 0x75A18, HORSE_FLAGS = 0x75B08;
    const ANIMAL_ICON = { Dog: '🐶', Horse: '🐴', Chicken: '🐔', Chick: '🐣', Barn: '🐄' };
    // Coop feed (game code 0x800E21E4): at the new day each unfed hen in the coop (place 4) empties the first full box of 10 at 0x8007130E.
    // A hen outside (place 1) is fed after 5 outside ticks (+0xAC, code 0x800E20F0); rain (today 0x8007AD00 = 1) costs love instead, winter does nothing.
    const COOP_BOXES = 0x7130E, HENS = Array.from({ length: 10 }, (_, i) => 0x742EC + i * 0xB4), HEN = 0x109, CHICK = 0x10A, IN_COOP = 4, OUTSIDE = 1;
    const GRAZE_DONE = 5, WEATHER_TODAY = 0x7AD00, RAIN = 1, WINTER = 3;
    // Bit 0x20000 of a chicken's +0x34 flags marks the one the player holds (the put-down code at 0x800CF07C looks for it).
    const HELD_BIT = 0x20000;
    // Bit 0x40 marks a contest winner; her egg is golden (item 0xE8) when love is 200 or more (0x800E2344).
    const GOLD_BIT = 0x40, GOLD_LOVE = 200;
    // Fish pond: 99 slots of 4 bytes from 0x80075854 (u16 item, u16 days grown), counted by 0x8010C668.
    // Items 0xA3 small, 0xA2 medium, 0xA1 large (0x8010C5A0 sets the size by days: under 10, under 20, then large).
    // Bit 0 of 0x800759E0 is set when Fish Food goes in (0x8010C4B0); only then do the fish grow that night (0x8010C3F8).
    // Each fed night adds 1 day; at 30 a fish drops back to 20 and may add small fish.
    const POND_KEY = 'ps1-plugin-hm-pond-open', POND_MEDIUM = 10, POND_LARGE = 20, POND_BREED = 30;
    const POND = 0x75854, POND_SLOTS = 99, POND_FED = 0x759E0, FISH = { 0xA3: 'small', 0xA2: 'medium', 0xA1: 'large' };
    // Crops: 8-byte tiles (u16 item, u16 soil, u8 stage) on the field (1125 from 0x80071DFC) and in the Hothouse (49 from 0x80074124,
    // used when 0x80070D0C is set). A crop is an item with flag 0x40, except 0x31-0x36 and 0x178-0x179 (0x80110790 and 0x801108F8).
    // It is ripe when its stage equals u16 +2 of the growth row (16 bytes from the pointer at 0x8006C864) named by item byte +3.
    // The sprites' harvest job needs at least one ripe crop (0x80110658).
    const FIELD = 0x71DFC, FIELD_TILES = 1125, HOTHOUSE = 0x74124, HOTHOUSE_TILES = 49, HOTHOUSE_ON = 0x70D0C, GROWTH_PTR = 0x6C864, CROP_FLAG = 0x40;
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
        s.villagers = VILLAGERS.map(([n, name]) => ({ name, value: u16(friendship(n)) })).filter(v => v.value <= FRIEND_MAX);
        s.sprites = [];
        for (const at of SPRITES) {
            let name = '', i = 0;
            for (; i < 9 && u16(at + 4 + i * 2) !== 0xFFFF; i++) name += letter(u16(at + 4 + i * 2));
            if (!name || i >= 9 || u16(at + 0x16) > FRIEND_MAX) continue;
            const sprite = { name, value: u16(at + 0x16) }, job = JOBS.find(([bit]) => u16(at + 0xB8) & bit), days = u16(at + 0xB4);
            if (job && days >= 1 && days <= JOB_DAYS_MAX) sprite.job = { kind: job[1], icon: job[2], days: days - 1 };
            s.sprites.push(sprite);
        }
        s.held = u16(HELD);
        const items = u32(ITEM_TABLE_PTR) - 0x80000000, heldCount = u16(HELD + 4);
        s.heldCount = items >= 0 && items + (s.held + 1) * ITEM_SIZE <= 0x200000 && H[B + items + s.held * ITEM_SIZE + 2] === STACKS
            && heldCount >= 1 && heldCount <= STACK_MAX ? heldCount : null;
        const ptr = u32(PLACE_PTR) - 0x80000000;
        s.place = ptr >= 0 && ptr < 0x200000 ? u16(ptr) : null;
        s.floor = MINES.includes(s.place) && u16(MINE_FLOOR) <= 9 ? u16(MINE_FLOOR) + 1 : null;
        s.animals = [];
        for (const [kind, spots] of ANIMALS) for (const at of spots) {
            let name = '';
            if (u16(at - 2) !== 0xFFFF) continue;
            for (let i = 0; i < 8 && u16(at - 18 + i * 2) !== 0xFFFF; i++) name += letter(u16(at - 18 + i * 2));
            // Chicken records start 0x16 bytes before love with their kind: 0x10A is a chick.
            if (name) s.animals.push({ kind: kind === 'Chicken' && u16(at - 0x16) === CHICK ? 'Chick' : kind, name, love: H[B + at], at });
        }
        // Dog flags (record +0x34): 0x4 picked up today, 0x2 came to the whistle today; each gives +2 love at the new day (0x80108D84).
        const dog = s.animals.find(a => a.kind === 'Dog');
        if (dog) dog.marks = [[(H[B + DOG_FLAGS] & 4) !== 0, '🤲', 'Picked up today'], [(H[B + DOG_FLAGS] & 2) !== 0, '📯', 'Whistled today']];
        // Horse flags work the same way (0x8010B264): 0x4 brushed today, 0x2 came when called today.
        const horse = s.animals.find(a => a.kind === 'Horse');
        if (horse) horse.marks = [[(H[B + HORSE_FLAGS] & 4) !== 0, '🪮', 'Brushed today'], [(H[B + HORSE_FLAGS] & 2) !== 0, '📯', 'Called today']];
        s.season = u16(SEASON); s.weekday = u16(WEEKDAY); s.hour = u16(HOUR);
        // Hens take full coop boxes in slot order at the new day, so a full box counts as fed for the first unfed hens inside.
        let boxes = 0;
        for (let i = 0; i < 10; i++) if (H[B + COOP_BOXES + i]) boxes++;
        const rain = u16(WEATHER_TODAY) === RAIN, winter = s.season === WINTER;
        for (const at of HENS) {
            const hen = s.animals.find(a => a.at === at + 0x16);
            if (u16(at) !== HEN || !hen) continue;
            const fed = (H[B + at + 0x34] & 1) === 1, where = u16(at + 0x30), graze = Math.min(u16(at + 0xAC), GRAZE_DONE);
            if (where === IN_COOP) {
                const covered = fed || boxes-- > 0;
                hen.marks = [[covered, '🌾', covered ? 'Fed tonight' : 'No feed in the coop']];
            } else if (where === OUTSIDE) {
                hen.marks = [[!winter && (fed || graze >= GRAZE_DONE), '🌿', winter ? 'No grass in winter' : 'Grazed ' + graze + '/' + GRAZE_DONE]];
                if (rain) hen.marks.push([true, '🌧️', 'Rain: loses love outside']);
            }
        }
        for (const at of HENS) {
            const bird = s.animals.find(a => a.at === at + 0x16);
            if (bird && (u32(at + 0x34) & HELD_BIT)) bird.marks = [[true, '🤲', 'You are holding her'], ...(bird.marks || [])];
            if (bird && u16(at) === HEN && (u32(at + 0x34) & GOLD_BIT)) (bird.marks ||= []).push([bird.love >= GOLD_LOVE, '🥇',
                bird.love >= GOLD_LOVE ? 'Lays golden eggs' : 'Golden eggs at ' + GOLD_LOVE + ' love']);
        }
        for (const a of s.animals) delete a.at;
        s.tomorrow = WEATHER[u16(WEATHER_TOMORROW)] || null;
        s.basket = null;
        const kinds = BASKET_KINDS.map((_, i) => u16(BASKET + 2 + i * 2));
        const sorted = kinds.reduce((a, b) => a + b);
        if (u16(BASKET) > 0 && u16(BASKET) <= BASKET_MAX && sorted <= u16(BASKET)) {
            const items = {};
            kinds.forEach((n, i) => { if (n) items[BASKET_KINDS[i]] = (items[BASKET_KINDS[i]] || 0) + n; });
            if (sorted < u16(BASKET)) items.Other = (items.Other || 0) + u16(BASKET) - sorted;
            s.basket = { count: u16(BASKET), value: u32(BASKET + 0x34), items };
        }
        s.race = null;
        const raceCode = u32(RACE_CODE) === 7 && u32(RACE_CODE + 4) === 0x800B7EB8;
        if ((raceCode || s.season === RACE_DAY[0] && u16(DAY) === RACE_DAY[1]) && u16(RACE) <= 3) {
            const at = HORSES + Math.min(u16(RACE), 2) * 0x54;
            const horses = Array.from({ length: 6 }, (_, i) => {
                const o = at + i * 0xE, id = u16(o);
                return { id, name: id === 0xFFFF ? 'You' : HORSE_NAMES[id], speed: u16(o + 2), whipPower: u16(o + 4), style: u16(o + 6), push: u16(o + 8), odds: u16(o + 10) };
            });
            if (horses.every(h => h.id === 0xFFFF || h.name && h.speed <= 255 && h.whipPower <= 255 && h.style <= 127 && h.push <= 127))
                s.race = { number: Math.min(u16(RACE), 2) + 1, ride: u16(RACE) === 3, horses };
        }
        s.pond = { small: 0, medium: 0, large: 0, count: 0, fed: (u16(POND_FED) & 1) === 1, days: [] };
        for (let i = 0; i < POND_SLOTS && s.pond; i++) {
            const id = u16(POND + i * 4);
            if (id && !FISH[id]) s.pond = null;
            else if (id) { s.pond[FISH[id]]++; s.pond.count++; s.pond.days.push(u16(POND + i * 4 + 2)); }
        }
        if (s.pond && !s.pond.count && !s.pond.fed) s.pond = null;
        s.crops = null;
        const growth = u32(GROWTH_PTR) - 0x80000000, inRam = o => o >= 0 && o < 0x200000;
        if (inRam(items) && inRam(growth)) {
            const c = { field: 0, fieldRipe: 0, hothouse: 0, hothouseRipe: 0 };
            const scan = (at, n, key) => {
                for (let i = 0; i < n; i++) {
                    const t = at + i * 8, id = u16(t), rec = items + id * ITEM_SIZE;
                    if (!inRam(rec + ITEM_SIZE) || !(H[B + rec] & CROP_FLAG) || id >= 0x31 && id <= 0x36 || id === 0x178 || id === 0x179) continue;
                    const row = growth + ((H[B + rec + 3] << 24) >> 24) * 16;
                    if (!inRam(row + 16)) continue;
                    c[key]++;
                    if (H[B + t + 4] === u16(row + 2)) c[key + 'Ripe']++;
                }
            };
            scan(FIELD, FIELD_TILES, 'field');
            if (u16(HOTHOUSE_ON)) scan(HOTHOUSE, HOTHOUSE_TILES, 'hothouse');
            if (c.field + c.hothouse) s.crops = c;
        }
        s.water = null;
        for (const slot of [HELD, ...Array.from({ length: TOOL_SLOT_COUNT }, (_, k) => TOOL_SLOTS + k * 6)]) {
            if (CANS.includes(u16(slot)) && u16(slot + 4) <= CAN_MAX) { s.water = u16(slot + 4); break; }
        }
        return s;
    }

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));z-index:99999;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
        [hidden] { display: none !important; }
        .box { width: 150px; padding: 6px 8px; background: rgba(12,15,20,.78); color: #eef2f7; border-radius: 8px;
               font: 600 11px/1.2 system-ui, sans-serif; display: grid; gap: 5px; pointer-events: auto; cursor: pointer;
               user-select: none; -webkit-user-select: none; }
        .details { display: grid; gap: 5px; }
        .more { display: none; }
        @media (pointer: coarse), (max-width: 900px) {
            .box { cursor: default; }
            .box:not(.expanded) { width: 150px; padding: 4px 8px; gap: 3px; }
            .box:not(.expanded) .details { display: none; }
            .box.expanded { max-height: calc(100dvh - 32px - env(safe-area-inset-top)); overflow-y: auto; touch-action: pan-y; }
            .more { display: block; justify-self: end; min-height: 0; padding: 1px 3px; position: sticky; top: 0; z-index: 1; border: 0;
                    background: #10151b; color: #aab3bf; font: 400 10px/16px system-ui, sans-serif; text-decoration: underline; cursor: pointer; }
        }
        .row { display: grid; grid-template-columns: 44px 1fr 48px; align-items: center; gap: 6px; }
        .bar { height: 8px; background: #2a313b; border-radius: 4px; overflow: hidden; }
        .fill { height: 100%; width: 0; border-radius: 4px; transition: width .2s; }
        .st .fill { background: #4ade80; } .st.low .fill { background: #f59e0b; } .st.empty .fill { background: #ef4444; }
        .fa .fill { background: #a78bfa; } .fa.tired .fill { background: #f59e0b; } .fa.high .fill { background: #ef4444; }
        button.bk { width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .bk .label, .pond .label { font-size: 10px; }
        button.pond { width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .fishes { display: grid; grid-template-columns: 1fr auto auto; gap: 1px 8px; padding-left: 12px; white-space: nowrap; font-weight: 400; font-size: 10px; color: #cfd6df; }
        .bk .fill { background: #d6a35c; } .bk.full .fill { background: #ef4444; }
        .wa .fill { background: #38bdf8; } .wa.empty .fill { background: #ef4444; }
        .tool { display: grid; grid-template-columns: 44px 1fr; gap: 6px; }
        .tool .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .icon { font-size: 14px; line-height: 1; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .wait { font-weight: 400; color: #aab3bf; }
        .toggle { font-weight: 400; color: #aab3bf; font-size: 10px; }
        .ores { display: grid; grid-template-columns: 1fr auto; gap: 1px 6px; padding-left: 50px; font-weight: 400; font-size: 10px; color: #cfd6df; }
        .box.wide { width: 230px; }
        .shops { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .shop { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 5px; }
        .shop .dot { width: 7px; height: 7px; border-radius: 50%; background: #4b5563; }
        .shop.open .dot { background: #4ade80; }
        .shop:not(.open) { color: #8b95a3; }
        .shop .when { font-weight: 400; font-variant-numeric: tabular-nums; }
        .animals { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .animal { display: grid; grid-template-columns: 1fr 50px 46px; align-items: center; gap: 6px; }
        .animal .fill { background: #f472b6; }
        .mark { opacity: .5; filter: grayscale(1); } .mark.on { opacity: 1; filter: none; }
        .animal .kind { display: inline-block; width: 15px; font-weight: 400; }
        .animal > span:first-child { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .villagers { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .villager { display: grid; grid-template-columns: 1fr 50px 46px; align-items: center; gap: 6px; }
        .villager .fill { background: #fbbf24; }
        .race { display: grid; gap: 2px; border-top: 1px solid #2f3742; padding-top: 5px; font-size: 10px; }
        .race .title { font-size: 11px; }
        .horse { display: grid; grid-template-columns: 10px 1fr 34px 38px; align-items: center; gap: 5px; color: #8b95a3; }
        .horse.best { color: #4ade80; }
        .horse .odds { font-weight: 400; }
        .hearts { display: grid; gap: 3px; border-top: 1px solid #2f3742; padding-top: 5px; }
        .girl { display: grid; grid-template-columns: 44px 14px 1fr 46px; align-items: center; gap: 6px; }
        .girl a, .villager a { justify-self: start; color: inherit; text-decoration: none; } .girl a:hover, .villager a:hover { text-decoration: underline; }
        .heart { font-size: 13px; line-height: 1; text-shadow: 0 0 1px #fff, 0 0 1px #fff; }
    </style>
    <div class="box">
        <div class="wait">Waiting for Harvest Moon</div>
        <div class="row st" hidden><span>Stamina</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="row fa" hidden><span>Fatigue</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <button class="more" type="button" aria-expanded="false">More</button>
        <div class="details">
        <div class="tool" hidden><span>Holding</span><span class="name"></span></div>
        <div class="row wa" hidden><span>Water</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>
        <div class="tool sky" hidden><span>Tmrw</span><span class="name icon"></span></div>
        <div class="tool floor" hidden><span>Mine</span><span class="name"></span></div>
        <div class="ores" hidden></div>
        <button class="row bk" type="button" aria-expanded="false" title="Show or hide basket contents" hidden><span class="label">Basket ▸</span><div class="bar"><div class="fill"></div></div><span class="num"></span></button>
        <div class="ores bkitems" hidden></div>
        <button class="tool pond" type="button" aria-expanded="false" title="Show or hide fish nights" hidden><span class="label">Pond ▸</span><span class="name"></span></button>
        <div class="fishes" title="Fed nights per fish. M or L: nights until medium or large. 🐟: nights until it may have babies." hidden></div>
        <div class="tool crops" hidden><span>Ripe</span><span class="name"></span></div>
        <div class="race" hidden></div>
        <div class="toggle stoggle" hidden></div>
        <div class="shops" hidden>${SHOPS.map(([name], i) =>
            `<div class="shop sh-${i}"><span class="dot"></span><span>${name}</span><span class="when"></span></div>`).join('')}</div>
        <div class="toggle atoggle" hidden></div>
        <div class="animals" hidden></div>
        <div class="toggle vtoggle" hidden></div>
        <div class="villagers" hidden></div>
        <div class="toggle ptoggle" hidden></div>
        <div class="villagers sprites" hidden></div>
        <div class="toggle htoggle" hidden></div>
        <div class="hearts" hidden>${GIRLS.map(([name]) =>
            `<div class="girl g-${name}"><a href="${WIKI(name)}" target="_blank" rel="noopener">${name}</a><span class="heart">♥</span><div class="bar"><div class="fill"></div></div><span class="num"></span></div>`).join('')}</div>
        </div>
    </div>`;
    const $ = q => shadow.querySelector(q);
    const box = $('.box'), wait = $('.wait'), st = $('.st'), fa = $('.fa'), tool = $('.tool'), floor = $('.floor'), ores = $('.ores'), sky = $('.sky'), wa = $('.wa'), toggle = $('.htoggle'), stoggle = $('.stoggle'), shops = $('.shops'), atoggle = $('.atoggle'), animals = $('.animals'), vtoggle = $('.vtoggle'), villagers = $('.villagers'), ptoggle = $('.ptoggle'), sprites = $('.sprites'), hearts = $('.hearts'), race = $('.race'), bk = $('.bk'), bkitems = $('.bkitems'), pond = $('.pond'), fishes = $('.fishes'), crops = $('.crops');
    const more = $('.more');
    let expanded = false;
    more.addEventListener('click', e => {
        e.stopPropagation();
        expanded = !expanded;
        box.classList.toggle('expanded', expanded);
        more.textContent = expanded ? 'Close' : 'More';
        more.setAttribute('aria-expanded', String(expanded));
    });
    race.addEventListener('click', e => e.stopPropagation());
    const raceCache = new Map();
    function raceHtml(r) {
        const key = JSON.stringify(r);
        if (!raceCache.has(key)) {
            const odds = r.ride ? null : raceOdds(r.horses);
            const best = odds && odds.indexOf(Math.max(...odds));
            raceCache.set(key, `<div class="title">🏇 Race ${r.number} · ${r.ride ? 'you ride, no tip' : 'likely ' + r.horses[best].name}</div>`
                + r.horses.map((h, i) => `<div class="horse${i === best ? ' best' : ''}"><span>${i + 1}</span><span>${h.name}</span>`
                + `<span class="num odds">×${h.odds}</span><span class="num">${odds ? odds[i] + '%' : ''}</span></div>`).join(''));
        }
        return raceCache.get(key);
    }

    let open = false;
    try { open = window.localStorage.getItem(OPEN_KEY) === '1'; } catch {}
    let last = null;
    let basketOpen = false;
    bk.addEventListener('click', e => {
        e.stopPropagation();
        basketOpen = !basketOpen;
        show(last);
    });
    let pondOpen = false;
    try { pondOpen = window.localStorage.getItem(POND_KEY) === '1'; } catch {}
    function flipPond() {
        pondOpen = !pondOpen;
        try { window.localStorage.setItem(POND_KEY, pondOpen ? '1' : '0'); } catch {}
        show(last);
    }
    pond.addEventListener('click', e => { e.stopPropagation(); flipPond(); });
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
    let villagersOpen = false;
    try { villagersOpen = window.localStorage.getItem(VILLAGERS_KEY) === '1'; } catch {}
    function flipVillagers(e) {
        e.stopPropagation();
        villagersOpen = !villagersOpen;
        try { window.localStorage.setItem(VILLAGERS_KEY, villagersOpen ? '1' : '0'); } catch {}
        show(last);
    }
    let spritesOpen = false;
    try { spritesOpen = window.localStorage.getItem(SPRITES_KEY) === '1'; } catch {}
    function flipSprites(e) {
        e.stopPropagation();
        spritesOpen = !spritesOpen;
        try { window.localStorage.setItem(SPRITES_KEY, spritesOpen ? '1' : '0'); } catch {}
        show(last);
    }
    vtoggle.addEventListener('click', flipVillagers);
    ptoggle.addEventListener('click', flipSprites);
    atoggle.addEventListener('click', flipAnimals);
    toggle.addEventListener('click', e => { e.stopPropagation(); flip(); });
    stoggle.addEventListener('click', flipShops);
    // Tapping an open list closes it; links inside still open.
    const closeOnTap = (list, close) => list.addEventListener('click', e => {
        e.stopPropagation();
        if (!e.target?.closest?.('a')) close(e);
    });
    closeOnTap(sprites, flipSprites);
    closeOnTap(villagers, flipVillagers);
    closeOnTap(animals, flipAnimals);
    closeOnTap(shops, flipShops);
    closeOnTap(hearts, () => flip());
    closeOnTap(bkitems, () => { basketOpen = false; show(last); });
    closeOnTap(fishes, flipPond);

    function place() {
        const parent = document.fullscreenElement || document.webkitFullscreenElement || document.body;
        if (host.parentNode !== parent) parent.appendChild(host);
    }
    function bar(row, value, max) {
        row.querySelector('.fill').style.width = Math.min(100, Math.round(value / max * 100)) + '%';
    }
    // One row per fed-night count, most first: size, nights, how many, nights to the next step.
    function fishHtml(days) {
        const counts = new Map();
        for (const d of [...days].sort((a, b) => b - a)) counts.set(d, (counts.get(d) || 0) + 1);
        return [...counts].map(([d, n]) => {
            const size = d < POND_MEDIUM ? 'S' : d < POND_LARGE ? 'M' : 'L';
            const next = d < POND_MEDIUM ? `M in ${POND_MEDIUM - d}` : d < POND_LARGE ? `L in ${POND_LARGE - d}` : `🐟 in ${Math.max(0, POND_BREED - d)}`;
            return `<span>${size} ${d} night${d === 1 ? '' : 's'}</span><span class="num">×${n}</span><span class="num">${next}</span>`;
        }).join('');
    }
    function show(s) {
        last = s;
        wait.hidden = !!s; st.hidden = fa.hidden = tool.hidden = toggle.hidden = stoggle.hidden = !s;
        shops.hidden = !s || !shopsOpen;
        atoggle.hidden = !s || !s.animals.length;
        animals.hidden = atoggle.hidden || !animalsOpen;
        vtoggle.hidden = !s || !s.villagers.length;
        villagers.hidden = vtoggle.hidden || !villagersOpen;
        ptoggle.hidden = !s || !s.sprites.length;
        sprites.hidden = ptoggle.hidden || !spritesOpen;
        box.classList.toggle('wide', !!s && (!!s.race || shopsOpen || animalsOpen && s.animals.length > 0 || !villagers.hidden || !sprites.hidden || open));
        floor.hidden = ores.hidden = !s || s.floor === null;
        sky.hidden = !s || s.tomorrow === null;
        hearts.hidden = !s || !open;
        wa.hidden = !s || s.water === null;
        bk.hidden = !s || !s.basket;
        bkitems.hidden = bk.hidden || !basketOpen;
        bk.setAttribute('aria-expanded', String(!bkitems.hidden));
        bk.querySelector('.label').textContent = basketOpen ? 'Basket ▾' : 'Basket ▸';
        if (s?.basket) {
            bar(bk, s.basket.count, BASKET_MAX);
            bk.querySelector('.num').textContent = s.basket.count + '/' + BASKET_MAX;
            bk.classList.toggle('full', s.basket.count >= BASKET_MAX);
            const html = Object.entries(s.basket.items).map(([name, n]) => `<span>${name}</span><span class="num">${n}</span>`).join('')
                + `<span>Worth</span><span class="num">${s.basket.value.toLocaleString('en-US')}G</span>`;
            if (bkitems.innerHTML !== html) bkitems.innerHTML = html;
        }
        pond.hidden = !s || !s.pond;
        if (s?.pond) {
            const p = s.pond, name = pond.querySelector('.name');
            const html = `S${p.small} M${p.medium} L${p.large} <span class="num">${p.count}/${POND_SLOTS}</span>`
                + ` <span class="mark${p.fed ? ' on' : ''}">🍤</span>`;
            if (name.innerHTML !== html) name.innerHTML = html;
            pond.title = `Small ${p.small}, medium ${p.medium}, large ${p.large}. ` + (p.fed ? 'Fed today: fish grow tonight' : 'Not fed today');
            const html2 = fishHtml(p.days);
            if (fishes.innerHTML !== html2) fishes.innerHTML = html2;
        }
        fishes.hidden = pond.hidden || !pondOpen || !s.pond.count;
        pond.setAttribute('aria-expanded', String(!fishes.hidden));
        pond.querySelector('.label').textContent = pondOpen ? 'Pond ▾' : 'Pond ▸';
        crops.hidden = !s || !s.crops;
        if (s?.crops) {
            const c = s.crops, ripe = c.fieldRipe + c.hothouseRipe, name = crops.querySelector('.name');
            const html = `<span class="num">${ripe}/${c.field + c.hothouse}</span> <span class="mark${ripe ? ' on' : ''}">🧚</span>`;
            if (name.innerHTML !== html) name.innerHTML = html;
            crops.title = `Field ${c.fieldRipe} of ${c.field} ripe` + (c.hothouse ? `, Hothouse ${c.hothouseRipe} of ${c.hothouse}` : '') + '. '
                + (ripe ? 'Sprites can take a harvest job' : 'Sprites take a harvest job only when a crop is ripe');
        }
        race.hidden = !s || !s.race;
        if (s?.race) {
            const html = raceHtml(s.race);
            if (race.innerHTML !== html) race.innerHTML = html;
        }
        if (!s) return;
        bar(st, s.stamina, s.max);
        st.querySelector('.num').textContent = s.stamina + '/' + s.max;
        st.classList.toggle('low', s.stamina > 0 && s.stamina <= s.max * 0.3);
        st.classList.toggle('empty', s.stamina === 0);
        bar(fa, s.fatigue, FATIGUE_MAX);
        fa.querySelector('.num').textContent = s.fatigue + '/' + FATIGUE_MAX;
        fa.classList.toggle('tired', s.fatigue >= FATIGUE_TIRED && s.fatigue < FATIGUE_HIGH);
        fa.classList.toggle('high', s.fatigue >= FATIGUE_HIGH);
        tool.querySelector('.name').textContent = toolName(s.held) + (s.heldCount === null ? '' : ' ×' + s.heldCount);
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
        stoggle.textContent = (shopsOpen ? '▴ Shops' : '▾ Shops') + ' · ' + DAYS[s.weekday] + ' ' + clock(s.hour);
        if (shopsOpen) SHOPS.forEach((shop, i) => {
            const [, from, to, closed, season] = shop, row = shops.querySelector('.sh-' + i);
            row.classList.toggle('open', isOpen(shop, s));
            row.querySelector('.when').textContent = clock(from) + '–' + clock(to);
            row.title = (closed.length ? 'Closed ' + closed.map(d => DAYS[d]).join(', ') : 'Open every day') + (season === undefined ? '' : ', summer only');
        });
        atoggle.textContent = (animalsOpen ? '▴ Animals' : '▾ Animals') + ' (' + s.animals.length + ')';
        if (animalsOpen) {
            const mark = ([on, icon, tip]) => `<span class="mark${on ? ' on' : ''}" title="${tip}">${icon}</span>`;
            const html = s.animals.map(a => `<div class="animal" title="${a.kind}"><span><span class="kind">${ANIMAL_ICON[a.kind] || '🐾'}</span>${a.name}`
                + (a.marks ? ' ' + a.marks.map(mark).join('') : '') + `</span>`
                + `<div class="bar"><div class="fill" style="width:${Math.round(a.love / LOVE_MAX * 100)}%"></div></div>`
                + `<span class="num">${a.love}/${LOVE_MAX}</span></div>`).join('');
            if (animals.innerHTML !== html) animals.innerHTML = html;
        }
        vtoggle.textContent = (villagersOpen ? '▴ Villagers' : '▾ Villagers') + ' (' + s.villagers.length + ')';
        const jobTip = j => j.kind + (j.days ? ` · ${j.days} more day${j.days > 1 ? 's' : ''}` : ' · last day today');
        const friends = (list, colour, link) => list.map(v => `<div class="villager">`
            + (v.job ? '<span>' : '') + `<a href="${link(v.name)}" target="_blank" rel="noopener">${v.name}</a>`
            + (v.job ? ` <span class="mark on" title="${jobTip(v.job)}">${v.job.icon}</span></span>` : '')
            + `<div class="bar"><div class="fill" style="width:${Math.round(v.value / FRIEND_MAX * 100)}%${colour?.[v.name] ? ';background:' + colour[v.name] : ''}"></div></div>`
            + `<span class="num">${v.value.toLocaleString('en-US')}/${FRIEND_MAX}</span></div>`).join('');
        if (villagersOpen) {
            const html = friends(s.villagers, null, WIKI);
            if (villagers.innerHTML !== html) villagers.innerHTML = html;
        }
        const jobs = s.sprites.filter(v => v.job);
        ptoggle.textContent = (spritesOpen ? '▴ Sprites' : '▾ Sprites') + ' (' + s.sprites.length + ')' + (jobs.length ? ' ' + jobs.map(v => v.job.icon).join('') : '');
        ptoggle.title = jobs.length ? jobs.map(v => v.name + ': ' + jobTip(v.job)).join('\n') : '';
        if (spritesOpen) {
            const html = friends(s.sprites, SPRITE_COLOURS, () => SPRITES_WIKI);
            if (sprites.innerHTML !== html) sprites.innerHTML = html;
        }
        toggle.textContent = open ? '▴ Hearts' : '▾ Hearts';
        if (!open) return;
        for (const [name] of GIRLS) {
            const v = s.hearts[name], h = heartOf(v), row = hearts.querySelector('.g-' + name);
            const heart = row.querySelector('.heart');
            heart.style.color = h[2];
            heart.title = h[1] + ' heart';
            bar(row, v, HEART_MAX);
            row.querySelector('.fill').style.background = h[3] || h[2];
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
        raceOdds,
        isOpen: (name, s) => isOpen(SHOPS.find(x => x[0] === name), s)
    };
})();
