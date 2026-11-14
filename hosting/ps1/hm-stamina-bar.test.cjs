const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

// Minimal DOM: each selector returns its own lazily made element, nested the same way.
function el() {
  const kids = {}, handlers = {};
  const e = {
    setAttribute(k, v) { e[k] = v; },
    style: {}, dataset: {}, hidden: false, parentNode: null, textContent: '', title: '',
    classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, has(c) { return this.set.has(c); } },
    querySelector: q => (kids[q] ||= el()),
    appendChild(c) { c.parentNode = e; },
    addEventListener(t, f) { handlers[t] = f; },
    fire(t, ev = {}) { handlers[t]?.({ preventDefault() {}, stopPropagation() {}, ...ev }); },
    remove() { e.removed = true; e.parentNode = null; }
  };
  return e;
}
const body = el();
const host = el();
const shadow = el();
host.attachShadow = () => shadow;
const $ = q => shadow.querySelector(q);

const H = new Uint8Array(0x300000);
const B = 0x10000;
const sig = [0x00, 0x00, 0x1a, 0x3c, 0x80, 0x0c, 0x5a, 0x27, 0x08, 0x00, 0x40, 0x03];
const put16 = (o, v) => { H[B + o] = v & 0xff; H[B + o + 1] = v >> 8; };
const girl = n => 0x76224 + n * 0x1D4;

const store = {};
const window = { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
const ctx = {
  window,
  document: { body, createElement: () => host, fullscreenElement: null },
  setInterval: () => 1, clearInterval: () => {},
  Date, getComputedStyle: () => ({ display: 'none' })
};
window.EJS_emulator = { gameManager: { Module: { HEAPU8: H } } };
const src = fs.readFileSync(__dirname + '/plugins/hm-stamina-bar.js', 'utf8');
const run = () => vm.runInNewContext(src, ctx);

// No RAM found yet: wait text shows.
run();
assert.equal(host.parentNode, body, 'box attaches to the page');
let kept = false;
host.fire('mousedown', { preventDefault() { kept = true; } });
assert(kept, 'clicking the panel leaves focus on the game');
assert.equal($('.wait').hidden, false);
assert.equal($('.st').hidden, true);
assert.equal(window.__hmStamina.read(), null);

$('.more').fire('click');
assert($('.box').classList.has('expanded'));
assert.equal($('.more').textContent, 'Close');
assert.equal($('.more')['aria-expanded'], 'true');
$('.more').fire('click');
assert(!$('.box').classList.has('expanded'));
assert.equal($('.more').textContent, 'More');
assert.equal($('.more')['aria-expanded'], 'false');

// Values from a live game: stamina 100 of 100, fatigue 18, hearts as read on 9 November 2026.
sig.forEach((v, j) => { H[B + 0x80 + j] = v; });
put16(0x71A12, 100); put16(0x71A14, 100); put16(0x71A16, 18);
put16(girl(3), 2000); put16(girl(7), 2200); put16(girl(9), 2700); put16(girl(14), 0); put16(girl(20), 2200);
run();
const s = window.__hmStamina.read();
assert.equal(s.animals.length, 0, 'no named animals');
assert.deepEqual({ ...s, hearts: { ...s.hearts }, animals: undefined, villagers: undefined, sprites: undefined },
  { stamina: 100, max: 100, fatigue: 18, hearts: { Karen: 2000, Ann: 2200, Elli: 2700, Mary: 0, Popuri: 2200 }, held: 0, heldCount: null, place: null, floor: null, season: 0, day: 0, weekday: 0, hour: 0, tomorrow: 'Sunny', water: null, basket: null, pond: null, crops: null, race: null, animals: undefined, villagers: undefined, sprites: undefined });
assert.equal($('.tool').querySelector('.name').textContent, 'Nothing');
assert.equal($('.floor').hidden, true, 'no floor outside the mine');

// Tomorrow's weather is the u16 at 0x7AD02; unknown values hide the line.
assert.equal($('.sky').querySelector('.name').textContent, '☀️');
assert.equal($('.sky').querySelector('.name').title, 'Sunny tomorrow');
put16(0x7AD02, 1);
run();
assert.equal($('.sky').querySelector('.name').textContent, '🌧️');
put16(0x7AD02, 4);
run();
assert.equal(window.__hmStamina.read().tomorrow, 'Blizzard');
assert.equal($('.sky').querySelector('.name').textContent, '🌨️');
put16(0x7AD02, 9);
run();
assert.equal(window.__hmStamina.read().tomorrow, null);
assert.equal($('.sky').hidden, true, 'odd weather value is hidden');
put16(0x7AD02, 0);

// Mine floor: the place number sits behind the pointer at 0xA0378; 55 and 67 are mines.
const put32 = (o, v) => { put16(o, v & 0xffff); put16(o + 2, v >>> 16); };
put32(0xA0378, 0x8009F78C); put16(0x9F78C, 67); put16(0x12D110, 1);
run();
assert.equal(window.__hmStamina.read().floor, 2);
assert.equal($('.floor').hidden, false);
assert.equal($('.floor').querySelector('.name').textContent, 'Floor 2');
assert.equal($('.ores').hidden, false, 'item odds show in the mine');
assert.equal($('.ores').innerHTML, '<span>Nothing</span><span class="num">40%</span><span>Coin</span><span class="num">25%</span>'
  + '<span>Junk Ore</span><span class="num">20%</span><span>Copper</span><span class="num">10%</span><span>Silver</span><span class="num">5%</span>');
const odds = (place, floor) => JSON.parse(JSON.stringify(window.__hmStamina.mineOdds(place, floor)));
assert.deepEqual(odds(67, 1), [['Nothing', 40], ['Coin', 30], ['Junk Ore', 20], ['Copper', 10]]);
assert.deepEqual(odds(55, 9), [['Orichalcum', 25], ['Adamantite', 25], ['Rare item*', 50]]);
assert.deepEqual(odds(55, 10), [['Nothing', 100]], 'a running total over 100 never reaches later slots');
for (const place of [55, 67]) for (let f = 1; f <= 10; f++) {
  assert.equal(odds(place, f).reduce((t, [, c]) => t + c, 0), 100, `odds add to 100 at ${place} floor ${f}`);
}
put16(0x9F78C, 55);
run();
assert.equal(window.__hmStamina.read().floor, 2, '55 is a mine too');
put16(0x12D110, 40);
run();
assert.equal(window.__hmStamina.read().floor, null, 'odd floor value is hidden');
put16(0x12D110, 1); put16(0x9F78C, 19);
run();
assert.equal(window.__hmStamina.read().floor, null, 'other places hide the floor');
assert.equal($('.floor').hidden, true);
assert.equal($('.ores').hidden, true);
put32(0xA0378, 0x12345678);
run();
assert.equal(window.__hmStamina.read().place, null, 'a bad pointer is ignored');
put32(0xA0378, 0); put16(0x9F78C, 0); put16(0x12D110, 0);
assert.equal($('.wa').hidden, true, 'no can, no water line');

// Water: the held can (item 21 at 0x71A84, value at +4), then a carried tool slot.
put16(0x71A84, 21); put16(0x71A88, 98);
run();
assert.equal(window.__hmStamina.read().water, 98);
assert.equal($('.wa').hidden, false);
assert.equal($('.wa').querySelector('.num').textContent, '98/100');
assert.equal($('.wa').querySelector('.fill').style.width, '98%');
assert.equal($('.tool').querySelector('.name').textContent, 'Watering Can');
put16(0x71A84, 11); put16(0x71A88, 0); put16(0x70EC2 + 6 * 3, 21); put16(0x70EC2 + 6 * 3 + 4, 0);
run();
assert.equal(window.__hmStamina.read().water, 0, 'can in a tool slot, empty');
assert($('.wa').classList.has('empty'));
assert.equal($('.tool').querySelector('.name').textContent, 'Axe');
put16(0x70EC2 + 6 * 23, 21); put16(0x70EC2 + 6 * 23 + 4, 40); put16(0x70EC2 + 6 * 3, 0);
run();
assert.equal(window.__hmStamina.read().water, 40, 'can in the last of 24 tool slots');
put16(0x70EC2 + 6 * 23, 0);
put16(0x71A84, 25); put16(0x71A88, 100);
run();
assert.equal(window.__hmStamina.read().water, 100, 'Mystrile can held, full');
assert.equal($('.tool').querySelector('.name').textContent, 'Mystrile Can');
// Held count: shown only when the item record's type byte (+2) is 2, as the game's menu does for seeds.
put32(0x6C858, 0x8004B1A4);
H[B + 0x4B1A4 + 34 * 40 + 2] = 2; H[B + 0x4B1A4 + 25 * 40 + 2] = 1;
run();
assert.equal($('.tool').querySelector('.name').textContent, 'Mystrile Can', 'a can shows no count');
put16(0x71A84, 34); put16(0x71A88, 7);
run();
assert.equal($('.tool').querySelector('.name').textContent, 'Turnip Seeds ×7');
put16(0x71A88, 0);
run();
assert.equal($('.tool').querySelector('.name').textContent, 'Turnip Seeds', 'no count when zero');
put32(0x6C858, 0x12345678); put16(0x71A88, 7);
run();
assert.equal($('.tool').querySelector('.name').textContent, 'Turnip Seeds', 'bad table pointer shows no count');
put32(0x6C858, 0); put16(0x71A84, 25); put16(0x71A88, 100);
put16(0x71A84, 22); put16(0x71A88, 37);
run();
assert.equal(window.__hmStamina.read().water, 37, 'Copper can');
put16(0x71A84, 0); put16(0x71A88, 0);
put16(0x70EC2 + 6 * 3, 0);
run();
assert.equal(window.__hmStamina.read().water, null, 'can put away');
assert.equal($('.wa').hidden, true);
assert.equal($('.wait').hidden, true);

// Tool names follow the item list: 1 Sickle ... 57 Fishing Pole; unknown numbers show as Item n.
const tn = window.__hmStamina.toolName;
assert.deepEqual([0, 1, 6, 11, 16, 21, 25, 26, 34, 57, 58].map(tn),
  ['Nothing', 'Sickle', 'Hoe', 'Axe', 'Hammer', 'Watering Can', 'Mystrile Can', 'Milker', 'Turnip Seeds', 'Fishing Pole', 'Item 58']);
assert.equal($('.st').querySelector('.fill').style.width, '100%');
assert.equal($('.st').querySelector('.num').textContent, '100/100');
assert.equal($('.fa').querySelector('.fill').style.width, '18%');
assert.equal($('.fa').querySelector('.num').textContent, '18/100');

// Hearts start closed; the toggle opens them and the choice is kept.
assert.equal($('.hearts').hidden, true);
assert.equal($('.htoggle').textContent, '▾ Hearts');
$('.box').fire('click');
assert.equal($('.hearts').hidden, true, 'tapping the stats does not open hearts');
$('.htoggle').fire('click');
assert.equal($('.hearts').hidden, false);
assert.equal(store['ps1-plugin-hm-hearts-open'], '1');
const row = n => $('.hearts').querySelector('.g-' + n);
assert.equal(row('Elli').querySelector('.num').textContent, '2,700');
assert.equal(row('Elli').querySelector('.heart').title, 'Black heart');
assert.equal(row('Mary').querySelector('.num').textContent, '0');
assert.equal(row('Elli').querySelector('.fill').style.width, '4%', 'heart bar is out of 65,535');
assert.equal(row('Elli').querySelector('.fill').style.background, '#9ca3af', 'a black heart gets a grey bar so it shows on the dark panel');
$('.hearts').fire('click', { target: { closest: q => q === 'a' ? {} : null } });
assert.equal($('.hearts').hidden, false, 'a name link does not close the hearts');
$('.hearts').fire('click');
assert.equal($('.hearts').hidden, true, 'tapping the open hearts closes them');
$('.htoggle').fire('click');
assert.equal($('.hearts').hidden, false);
assert.equal($('.htoggle').textContent, '▴ Hearts');
run();
assert.equal($('.hearts').hidden, false, 'open choice survives a restart');

// Shops: closed until tapped; open shops get a green dot from the weekday and hour.
const shopRow = i => $('.shops').querySelector('.sh-' + i);
assert.equal($('.shops').hidden, true);
put16(0x70CF6, 1); put16(0x70CF8, 10); put16(0x70CF4, 1);
run();
assert.equal($('.stoggle').textContent, '▾ Shops · Mon 10a');
let heartsBefore = $('.hearts').hidden;
$('.stoggle').fire('click');
assert.equal($('.shops').hidden, false);
assert.equal($('.hearts').hidden, heartsBefore, 'the shops toggle does not flip hearts');
assert.equal(store['ps1-plugin-hm-shops-open'], '1');
assert($('.box').classList.has('wide'));
assert(shopRow(0).classList.has('open'), 'Supermarket open Monday 10 AM');
assert(!shopRow(4).classList.has('open'), 'Yodel Ranch closed on Monday');
assert.equal(shopRow(0).querySelector('.when').textContent, '9a–6p');
assert.equal(shopRow(0).title, '9a–6p. Closed Sun, Tue');
assert.equal(shopRow(9).title, '10a–5p. Closed Mon, summer only');
assert.equal(shopRow(4).querySelector('.when').textContent, 'Closed', 'Yodel Ranch rest day says Closed');
assert(shopRow(4).classList.has('shut'));
assert.equal(shopRow(9).querySelector('.when').textContent, 'Closed', 'Kai shut outside summer');
assert(!shopRow(0).classList.has('shut'));
put16(0x70CF4, 7);
run();
assert.equal($('.stoggle').textContent, '▴ Shops · Mon 10a · 🎉 Goddess Festival', 'Spring 8 is a festival');
assert(!shopRow(0).classList.has('open'), 'shops closed on a festival');
assert.equal(shopRow(0).querySelector('.when').textContent, '🎉 Closed');
assert.equal(shopRow(0).title, '9a–6p. Closed Sun, Tue. Goddess Festival today');
assert.equal(window.__hmStamina.isOpen('Inn', { season: 3, day: 9, weekday: 3, hour: 12 }), false, 'Winter 10 Dog Race');
assert.equal(window.__hmStamina.isOpen('Inn', { season: 3, day: 10, weekday: 3, hour: 12 }), true);
put16(0x70CF4, 1);
run();
assert.equal(shopRow(0).querySelector('.when').textContent, '9a–6p');
const open = (name, season, weekday, hour) => window.__hmStamina.isOpen(name, { season, weekday, hour });
assert.equal(open('Supermarket', 0, 2, 10), false, 'closed Tuesday');
assert.equal(open('Supermarket', 0, 3, 17), true);
assert.equal(open('Supermarket', 0, 3, 18), false, 'shut at closing hour');
assert.equal(open('Kai', 0, 3, 12), false, 'Kai only in summer');
assert.equal(open('Kai', 1, 3, 12), true);
assert.equal(open('Inn', 3, 0, 20), true);
run();
assert.equal($('.shops').hidden, false, 'shops choice survives a restart');
$('.shops').fire('click');
assert.equal($('.shops').hidden, true, 'tapping the open shops closes them');
assert.equal($('.box').classList.has('wide'), !$('.hearts').hidden, 'only open hearts keep the box wide');
put16(0x70CF6, 0); put16(0x70CF8, 0); put16(0x70CF4, 0);

// Animals: a slot shows when its name (18 bytes before the love byte) does not start with 0xFFFF.
const name = (at, text) => { [...text].forEach((c, i) => put16(at - 18 + i * 2, c.charCodeAt(0) - 65)); for (let i = text.length; i < 9; i++) put16(at - 18 + i * 2, 0xFFFF); };
assert.equal($('.atoggle').hidden, true, 'no animals, no toggle');
name(0x759FA, 'Bin'); H[B + 0x759FA] = 10;
name(0x74302 + 0xB4 * 2, 'Cluck'); H[B + 0x74302 + 0xB4 * 2] = 130;
name(0x74A0A + 0xB8 * 19, 'Moo'); H[B + 0x74A0A + 0xB8 * 19] = 255;
for (let i = 0; i < 9; i++) put16(0x75AEA - 18 + i * 2, 0xFFFF);
H[B + 0x75AEA] = 99;
H[B + 0x75A18] = 4;
run();
const animals = JSON.parse(JSON.stringify(window.__hmStamina.read().animals));
assert.deepEqual(animals, [{ kind: 'Dog', name: 'Bin', love: 10, marks: [[true, '🤲', 'Picked up today'], [false, '📯', 'Whistled today']] }, { kind: 'Chicken', name: 'Cluck', love: 130 }, { kind: 'Barn', name: 'Moo', love: 255 }],
  'empty horse slot is skipped');
assert.equal($('.atoggle').textContent, '▾ Animals (3)');
assert.equal($('.animals').hidden, true);
heartsBefore = $('.hearts').hidden;
$('.atoggle').fire('click');
assert.equal($('.hearts').hidden, heartsBefore, 'the animals toggle does not flip hearts');
assert($('.animals').innerHTML.includes('Bin <span class="mark on" title="Picked up today">🤲</span><span class="mark" title="Whistled today">📯</span></span>'), 'dog shows pick-up and whistle marks');
assert(!$('.animals').innerHTML.includes('Cluck <span class="mark'), 'a chicken without a record has no marks');
name(0x75AEA, 'Rose'); H[B + 0x75AEA] = 36; H[B + 0x75B08] = 4;
run();
assert($('.animals').innerHTML.includes('Rose <span class="mark on" title="Brushed today">🪮</span><span class="mark" title="Called today">📯</span></span>'), 'horse shows brush and call marks');
for (let i = 0; i < 9; i++) put16(0x75AEA - 18 + i * 2, 0xFFFF);
H[B + 0x75B08] = 0;
run();
assert.equal($('.animals').hidden, false);
assert.equal(store['ps1-plugin-hm-animals-open'], '1');
assert($('.animals').innerHTML.includes('<span><span class="kind">🐔</span>Cluck</span><div class="bar"><div class="fill" style="width:51%"></div></div><span class="num">130/255</span>'));
put16(0x74302 + 0xB4 * 2 - 0x16, 0x10A);
run();
assert.equal(window.__hmStamina.read().animals[1].kind, 'Chick');
assert($('.animals').innerHTML.includes('<span><span class="kind">🐣</span>Cluck</span>'), 'a chick gets its own emoji');
put16(0x74302 + 0xB4 * 2 - 0x16, 0);
assert($('.animals').innerHTML.includes('style="width:100%"></div></div><span class="num">255/255</span>'), 'full love fills the bar');
assert($('.animals').innerHTML.includes('style="width:4%"></div></div><span class="num">10/255</span>'));
$('.atoggle').fire('click');
assert.equal($('.animals').hidden, true);

// Hen marks in the Animals rows: a full box covers the first unfed hens in the coop; outside hens show grazing.
const hen = (i, nm, where, flags, graze) => {
  const at = 0x742EC + i * 0xB4;
  put16(at, 0x109); name(at + 0x16, nm); put16(at + 0x30, where); H[B + at + 0x34] = flags; put16(at + 0xAC, graze);
};
hen(0, 'Amy', 4, 0x10, 0); hen(3, 'Peep', 1, 0, 3); hen(5, 'Dot', 4, 0, 0); H[B + 0x7130E + 2] = 1;
$('.atoggle').fire('click');
run();
const marksOf = nm => window.__hmStamina.read().animals.find(a => a.name === nm).marks;
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Amy'))), [[true, '🌾', 'Fed tonight']], 'a full box covers the first hen');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Dot'))), [[false, '🌾', 'No feed in the coop']], 'no box left for the second');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Peep'))), [[false, '🌿', 'Grazed 3/5']]);
assert($('.animals').innerHTML.includes('Amy <span class="mark on" title="Fed tonight">🌾</span></span>'));
assert($('.animals').innerHTML.includes('Dot <span class="mark" title="No feed in the coop">🌾</span></span>'));
assert(!$('.animals').innerHTML.includes('In coop'), 'no words for where a hen is');
H[B + 0x742EC + 5 * 0xB4 + 0x34] = 1; put16(0x742EC + 3 * 0xB4 + 0xAC, 6); put16(0x7AD00, 1);
run();
assert.equal(marksOf('Dot')[0][0], true, 'a hen fed today stays fed');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Peep'))), [[true, '🌿', 'Grazed 5/5'], [true, '🌧️', 'Rain: loses love outside']]);
put16(0x70CF2, 3);
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Peep')[0])), [false, '🌿', 'No grass in winter']);
H[B + 0x742EC + 0x36] = 2;
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Amy'))), [[true, '🤲', 'You are holding her'], [true, '🌾', 'Fed tonight']], 'the held hen is marked first');
assert.equal(marksOf('Dot')[0][1], '🌾', 'other hens are not marked held');
assert($('.animals').innerHTML.includes('Amy <span class="mark on" title="You are holding her">🤲</span>'));
H[B + 0x742EC + 0x36] = 0;
H[B + 0x742EC + 0x34] = 0x50; H[B + 0x742EC + 0x16] = 199;
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Amy'))), [[true, '🌾', 'Fed tonight'], [false, '🥇', 'Golden eggs at 200 love']], 'a winner under 200 love shows a grey medal');
H[B + 0x742EC + 0x16] = 200;
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Amy')[1])), [true, '🥇', 'Lays golden eggs'], 'a winner at 200 love lays golden eggs');
assert($('.animals').innerHTML.includes('<span class="mark on" title="Lays golden eggs">🥇</span>'));
assert(!JSON.stringify(marksOf('Dot')).includes('🥇'), 'other hens have no medal');
H[B + 0x742EC + 0x34] = 0x10; H[B + 0x742EC + 0x16] = 0;
put16(0x742EC + 3 * 0xB4 + 0x30, 9);
run();
assert.equal(marksOf('Peep'), undefined, 'a hen away has no marks');
H[B + 0x742EC + 3 * 0xB4 + 0x36] = 2;
put16(0x742EC + 3 * 0xB4, 0x10A);
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Peep'))), [[true, '🤲', 'You are holding her']], 'a held chick is marked too');
H[B + 0x742EC + 3 * 0xB4 + 0x36] = 0;
$('.atoggle').fire('click');
for (const i of [0, 3, 5]) { put16(0x742EC + i * 0xB4, 0); put16(0x742EC + i * 0xB4 + 4, 0xFFFF); }
H[B + 0x7130E + 2] = 0; put16(0x7AD00, 0); put16(0x70CF2, 0);
run();

// Cow and sheep marks: cows take fodder boxes before sheep; talk, brush, milk, wool, baby and sick come from the record.
const barnAnimal = (i, nm, kind, where, flags, extra = {}) => {
  const at = 0x749F4 + i * 0xB8;
  put16(at, kind); name(at + 0x16, nm); put16(at + 0x30, where);
  put16(at + 0x34, flags & 0xFFFF); put16(at + 0x36, flags >>> 16);
  for (const [o, v] of Object.entries(extra)) put16(at + Number(o), v);
};
barnAnimal(0, 'Wooly', 0x165, 5, 0x10000 | 2, { 0xB4: 7 });
barnAnimal(1, 'Bess', 0x162, 5, 0x10 | 4, { 0x16: 50 });
barnAnimal(2, 'Daisy', 0x162, 5, 0x8 | 0x100, { 0xB2: 5 });
barnAnimal(3, 'Lil', 0x160, 1, 0, { 0xAC: 2 });
H[B + 0x712F8 + 4] = 1;
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Bess'))), [[true, '🌾', 'Fed tonight'], [false, '💬', 'Talked today (+3 love tonight)'],
  [true, '🪮', 'Brushed today'], [true, '🥛', 'Milk ready']], 'the first cow gets the box');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Daisy'))), [[false, '🌾', 'No fodder in the barn'], [false, '💬', 'Talked today (+3 love tonight)'],
  [false, '🪮', 'Brushed today'], [false, '🥛', 'No milk while pregnant'], [true, '🍼', 'Baby in 16 days'], [true, '🤒', 'Sick']], 'a pregnant cow has no milk');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Wooly'))), [[false, '🌾', 'No fodder in the barn'], [true, '💬', 'Talked today (+3 love tonight)'],
  [false, '🪮', 'Brushed today'], [true, '✂️', 'Wool ready']], 'sheep come after cows for fodder, even in slot 0');
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Lil'))), [[false, '🌿', 'Grazed 2/5'], [false, '💬', 'Talked today (+3 love tonight)'],
  [false, '🪮', 'Brushed today']], 'a calf outside shows grazing and no milk');
assert.deepEqual([...window.__hmStamina.read().animals.filter(a => ['Bess', 'Wooly', 'Lil'].includes(a.name)).map(a => a.kind)], ['Sheep', 'Cow', 'Calf']);
const milkOf = () => JSON.parse(JSON.stringify(marksOf('Bess'))).find(m => m[1] === '🥛');
put16(0x749F4 + 0xB8 + 0x34, 0x10 | 8); run();
assert.deepEqual(milkOf(), [false, '🥛', 'Milked today']);
put16(0x749F4 + 0xB8 + 0x34, 8); run();
assert.deepEqual(milkOf(), [false, '🥛', 'No milk today (not fed last night)']);
put16(0x749F4 + 0xB8 + 0x34, 0x10); put16(0x749F4 + 0xB8 + 0x16, 1); run();
assert.deepEqual(milkOf(), [false, '🥛', 'No milk: love too low']);
put16(0x749F4 + 0xB8 + 0x34, 0x10 | 4); put16(0x749F4 + 0xB8 + 0x16, 50);
put16(0x749F4 + 0xB4, 3);
run();
assert.deepEqual(JSON.parse(JSON.stringify(marksOf('Wooly').at(-1))), [false, '✂️', 'Wool 3/7']);
$('.atoggle').fire('click');
run();
assert($('.animals').innerHTML.includes('<span class="kind">🐑</span>Wooly'), 'sheep get their own emoji');
$('.atoggle').fire('click');
for (const i of [0, 1, 2, 3]) { put16(0x749F4 + i * 0xB8, 0); put16(0x749F4 + i * 0xB8 + 4, 0xFFFF); }
H[B + 0x712F8 + 4] = 0;
run();

// Villagers: friendship is the u16 2 bytes before each villager's affection, out of 255; the girls are not listed.
const friend = n => girl(n) - 2;
const sprite = (k, text, v) => { const at = 0x7A638 + k * 0xF8; for (let i = 0; i < 9; i++) put16(at + 4 + i * 2, i < text.length ? text.charCodeAt(i) - 65 : 0xFFFF); put16(at + 0x16, v); };
sprite(0, 'Chef', 50); sprite(6, 'Aqua', 70); sprite(3, 'Hoggy', 999);
put16(friend(1), 69); put16(friend(6), 83); put16(friend(8), 169); put16(friend(35), 255); put16(friend(24), 300);
run();
const vs = JSON.parse(JSON.stringify(window.__hmStamina.read().villagers));
assert.equal(vs.length, 27, 'an odd value over 255 is skipped');
assert.deepEqual(vs.slice(0, 6), [{ name: 'Jeff', value: 69 }, { name: 'Sasha', value: 0 }, { name: 'Saibara', value: 0 }, { name: 'Gray', value: 0 }, { name: 'Doug', value: 83 }, { name: 'Doctor', value: 169 }]);
assert.deepEqual(vs.at(-1), { name: 'Won', value: 255 });
assert(!vs.some(v => ['Karen', 'Ann', 'Elli', 'Mary', 'Popuri', 'Gotz'].includes(v.name)));
assert.equal($('.vtoggle').hidden, false);
assert.equal($('.vtoggle').textContent, '▾ Villagers (27)');
assert.equal($('.villagers').hidden, true);
heartsBefore = $('.hearts').hidden;
$('.vtoggle').fire('click');
assert.equal($('.hearts').hidden, heartsBefore, 'the villagers toggle does not flip hearts');
assert.equal($('.villagers').hidden, false);
assert.equal(store['ps1-plugin-hm-villagers-open'], '1');
assert.equal($('.vtoggle').textContent, '▴ Villagers (27)');
assert($('.box').classList.has('wide'));
assert($('.villagers').innerHTML.startsWith('<div class="villager"><a href="https://harvestmoon.fandom.com/wiki/Jeff_(BTN)" target="_blank" rel="noopener">Jeff</a><div class="bar"><div class="fill" style="width:27%"></div></div><span class="num">69/255</span></div>'));
assert($('.villagers').innerHTML.includes('<a href="https://harvestmoon.fandom.com/wiki/Won_(BTN)" target="_blank" rel="noopener">Won</a><div class="bar"><div class="fill" style="width:100%"></div></div><span class="num">255/255</span>'));
run();
assert.equal($('.villagers').hidden, false, 'villagers choice survives a restart');
$('.vtoggle').fire('click');
assert.equal($('.villagers').hidden, true);
assert.equal($('.box').classList.has('wide'), !$('.hearts').hidden, 'only open hearts keep the box wide');
assert($('.villagers').innerHTML.includes('<a href="https://harvestmoon.fandom.com/wiki/Doctor_(BTN)" target="_blank" rel="noopener">Doctor</a><div class="bar"><div class="fill" style="width:66%"></div></div><span class="num">169/255</span>'), 'the Doctor is listed');
assert(!$('.villagers').innerHTML.includes('Chef'), 'sprites are not in the villagers list');
put16(friend(24), 0);

// Sprites: 7 records of 0xF8 from 0x7A638, name at +4, friendship at +0x16; slots without a name end or over 255 are skipped.
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().sprites)), [{ name: 'Chef', value: 50, skills: { harvest: 0, water: 0, animals: 0 } }, { name: 'Aqua', value: 70, skills: { harvest: 0, water: 0, animals: 0 } }]);
assert.equal($('.ptoggle').hidden, false);
assert.equal($('.ptoggle').textContent, '▾ Sprites (2)');
assert.equal($('.sprites').hidden, true);
heartsBefore = $('.hearts').hidden;
const villagersBefore = $('.villagers').hidden;
$('.ptoggle').fire('click');
assert.equal($('.hearts').hidden, heartsBefore, 'the sprites toggle does not flip hearts');
assert.equal($('.villagers').hidden, villagersBefore, 'the sprites toggle does not open villagers');
assert.equal($('.sprites').hidden, false);
assert.equal(store['ps1-plugin-hm-sprites-open'], '1');
assert.equal($('.ptoggle').textContent, '▴ Sprites (2)');
assert($('.box').classList.has('wide'));
assert.equal($('.sprites').innerHTML, '<div class="sprow head"><span></span><span></span><span title="Harvest skill">🌾</span><span title="Water skill">💧</span><span title="Animals skill">🐄</span></div><div class="sprow"><span><a href="https://harvestmoon.fandom.com/wiki/Harvest_Sprites_(BTN)" target="_blank" rel="noopener">Chef</a></span><div class="bar spbar" title="Friendship 50/255"><div class="fill" style="width:20%;background:#ef4444"></div><span>50</span></div><span class="sk sk-harvest zero" title="Harvest skill 0/255, +1 per harvest work day. Picks 0-2 ripe crops each hour from 6:00 to 20:00, about 15 a day">0<span class="m"><i style="width:0%"></i></span></span><span class="sk sk-water zero" title="Water skill 0/255, +1 per water work day. Waters 0-4 dry crops each hour from 6:00 to 20:00, about 30 a day">0<span class="m"><i style="width:0%"></i></span></span><span class="sk sk-animals zero" title="Animal skill 0/255, +1 per animal work day. Each hour from 6:00 to 20:00, cares for more animals per step at 50 and 100">0<span class="m"><i style="width:0%"></i></span></span></div><div class="sprow"><span><a href="https://harvestmoon.fandom.com/wiki/Harvest_Sprites_(BTN)" target="_blank" rel="noopener">Aqua</a></span><div class="bar spbar" title="Friendship 70/255"><div class="fill" style="width:27%;background:#38bdf8"></div><span>70</span></div><span class="sk sk-harvest zero" title="Harvest skill 0/255, +1 per harvest work day. Picks 0-2 ripe crops each hour from 6:00 to 20:00, about 15 a day">0<span class="m"><i style="width:0%"></i></span></span><span class="sk sk-water zero" title="Water skill 0/255, +1 per water work day. Waters 0-4 dry crops each hour from 6:00 to 20:00, about 30 a day">0<span class="m"><i style="width:0%"></i></span></span><span class="sk sk-animals zero" title="Animal skill 0/255, +1 per animal work day. Each hour from 6:00 to 20:00, cares for more animals per step at 50 and 100">0<span class="m"><i style="width:0%"></i></span></span></div>', 'one header row, then each sprite with its colour, friendship in the bar tooltip and three skills');
run();
assert.equal($('.sprites').hidden, false, 'sprites choice survives a restart');
$('.ptoggle').fire('click');
assert.equal($('.sprites').hidden, true);
assert.equal($('.box').classList.has('wide'), !$('.hearts').hidden, 'only open hearts keep the box wide');

// Sprite jobs: +0xB8 bit 1 harvest, 2 water, 4 animals; +0xB4 is work days left + 1.
put16(0x7A638 + 0xB8, 0x41); put16(0x7A638 + 0xB4, 4);
put16(0x7A638 + 6 * 0xF8 + 0xB8, 0x42); put16(0x7A638 + 6 * 0xF8 + 0xB4, 1);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().sprites)), [
  { name: 'Chef', value: 50, job: { kind: 'Harvest', icon: '🌾', days: 3 }, skills: { harvest: 0, water: 0, animals: 0 } },
  { name: 'Aqua', value: 70, job: { kind: 'Water', icon: '💧', days: 0 }, skills: { harvest: 0, water: 0, animals: 0 } }]);
assert.equal($('.ptoggle').textContent, '▾ Sprites (2) 🌾💧', 'jobs show on the closed toggle');
assert.equal($('.ptoggle').title, 'Chef: Harvest · 3 more days\nAqua: Water · last day today');
$('.ptoggle').fire('click');
assert.match($('.sprites').innerHTML, /<div class="sprow"><span><a [^>]+>Chef<\/a> <span class="mark on" title="Harvest · 3 more days">🌾<span class="jobdays">3d<\/span><\/span><\/span><div class="bar spbar" title="Friendship 50\/255">.*?<span class="sk sk-harvest on zero"/);
assert.match($('.sprites').innerHTML, /💧<span class="jobdays">today<\/span>/, 'last work day shows today');
assert.match($('.sprites').innerHTML, /<span class="sk sk-water on zero"/, 'the skill for the current job is marked');
$('.ptoggle').fire('click');
put16(0x7A638 + 0xB4, 0);
put16(0x7A638 + 6 * 0xF8 + 0xB8, 0x44); put16(0x7A638 + 6 * 0xF8 + 0xB4, 2);
run();
assert.equal(window.__hmStamina.read().sprites[0].job, undefined, 'no days left means no job');
assert.equal($('.ptoggle').title, 'Aqua: Animals · 1 more day');
put16(0x7A638 + 0xB8, 0); put16(0x7A638 + 6 * 0xF8 + 0xB8, 0); put16(0x7A638 + 6 * 0xF8 + 0xB4, 0);
run();
assert.equal($('.ptoggle').textContent, '▾ Sprites (2)');

// Skills: +0xAE harvest, +0xB0 water, +0xB2 animals, 0-255; hourly runs from 6:00 to 20:00 make 15 a day.
put16(0x7A638 + 0xAE, 120); put16(0x7A638 + 0xB0, 23); put16(0x7A638 + 0xB2, 5); put16(0x7A638 + 6 * 0xF8 + 0xB0, 300);
run();
assert.deepEqual(JSON.parse(JSON.stringify(Array.from(window.__hmStamina.read().sprites, v => v.skills))),
  [{ harvest: 120, water: 23, animals: 5 }, { harvest: 0, animals: 0 }], 'a skill over 255 is not shown');
$('.ptoggle').fire('click');
assert.match($('.sprites').innerHTML, /<span class="sk sk-harvest" title="Harvest skill 120\/255, \+1 per harvest work day\. Picks 0-2 \+ 2 ripe crops each hour from 6:00 to 20:00, about 45 a day">120<span class="m"><i style="width:47%"><\/i><\/span><\/span>/);
assert.match($('.sprites').innerHTML, /<span class="sk sk-water" title="Water skill 23\/255, \+1 per water work day\. Waters 0-4 \+ 2 dry crops each hour from 6:00 to 20:00, about 60 a day">23<span class="m"><i style="width:9%"><\/i><\/span><\/span>/);
assert.match($('.sprites').innerHTML, /<span class="sk sk-animals" [^>]+>5<span class="m"><i style="width:2%"><\/i><\/span><\/span>/);
assert.match($('.sprites').innerHTML, /Friendship 70\/255">.*?<span>70<\/span><\/div><span class="sk sk-harvest zero" [^>]+>0<span class="m">.*?<\/span><\/span><span><\/span><span class="sk sk-animals zero"/, 'the bad skill leaves an empty cell');
$('.ptoggle').fire('click');
put16(0x7A638 + 0xAE, 0); put16(0x7A638 + 0xB0, 0); put16(0x7A638 + 0xB2, 0); put16(0x7A638 + 6 * 0xF8 + 0xB0, 0);
run();

// Heart colours follow the game's steps: 5000, 20000, 30000, 40000, 50000, 60000.
const heart = window.__hmStamina.heart;
assert.deepEqual([0, 4999, 5000, 19999, 20000, 29999, 30000, 39999, 40000, 49999, 50000, 59999, 60000, 65535].map(heart),
  ['Black', 'Black', 'Purple', 'Purple', 'Blue', 'Blue', 'Green', 'Green', 'Yellow', 'Yellow', 'Orange', 'Orange', 'Red', 'Red']);
put16(girl(20), 65535);
run();
assert.equal(row('Popuri').querySelector('.heart').title, 'Red heart');
assert.equal(row('Popuri').querySelector('.num').textContent, '65,535');

// Fatigue colours follow the game's 50 and 80 steps.
put16(0x71A16, 50);
run();
assert($('.fa').classList.has('tired'));
assert(!$('.fa').classList.has('high'));

// Low stamina and high fatigue change the bar colour classes.
put16(0x71A12, 20); put16(0x71A16, 80);
run();
assert($('.st').classList.has('low'));
assert($('.fa').classList.has('high'));
assert(!$('.fa').classList.has('tired'));
assert.equal($('.st').querySelector('.fill').style.width, '20%');

// Basket: the user's saves of 10 November 2026 (3 turnips and 5 potatoes worth 580G, then 18 turnips worth 1,080G).
assert.equal($('.bk').hidden, true, 'empty basket is hidden');
put16(0x712C0, 8); put16(0x712C2, 3); put16(0x712C4, 5); put16(0x712F4, 580);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().basket)), { count: 8, value: 580, items: { Turnip: 3, Potato: 5 } });
assert.equal($('.bk').hidden, false);
assert.equal($('.bk').querySelector('.num').textContent, '8/30');
assert.equal($('.bkitems').hidden, true, 'basket contents start hidden');
$('.bk').fire('click');
assert.equal($('.bkitems').hidden, false, 'tap shows contents');
assert.equal($('.bk')['aria-expanded'], 'true');
$('.bk').fire('click');
assert.equal($('.bkitems').hidden, true, 'tap hides contents');
assert.equal($('.bk')['aria-expanded'], 'false');
assert.equal($('.bkitems').innerHTML, '<span>Turnip</span><span class="num">3</span><span>Potato</span><span class="num">5</span><span>Worth</span><span class="num">580G</span>');
put16(0x712C0, 18); put16(0x712C2, 18); put16(0x712C4, 0); put16(0x712F4, 1080);
run();
assert.equal($('.bkitems').innerHTML, '<span>Turnip</span><span class="num">18</span><span>Worth</span><span class="num">1,080G</span>');
assert(!$('.bk').classList.has('full'));
put16(0x712C0, 30); put16(0x712C2, 25); put16(0x712C2 + 18 * 2, 5);
run();
assert($('.bk').classList.has('full'), 'full basket turns red');
assert($('.bkitems').innerHTML.includes('<span>Milk</span><span class="num">5</span>'));
put16(0x712C0, 31);
run();
assert.equal(window.__hmStamina.read().basket, null, 'counts that do not add up are hidden');
// The user's mine save of 10 November 2026: 2 items worth 30G with no kind counts.
for (let i = 0; i < 27; i++) put16(0x712C0 + i * 2, 0);
put16(0x712C0, 2); put16(0x712F4, 30);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().basket)), { count: 2, value: 30, items: { Other: 2 } });
assert.equal($('.bkitems').innerHTML, '<span>Other</span><span class="num">2</span><span>Worth</span><span class="num">30G</span>');
put16(0x712C0, 3); put16(0x712C2, 1);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().basket.items)), { Turnip: 1, Other: 2 });
put16(0x712C0, 4); put16(0x712C2, 0); put16(0x712C2 + 22 * 2, 1); put16(0x712C2 + 24 * 2, 1);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().basket.items)), { 'Blue grass': 1, 'Green grass': 1, Other: 2 }, 'the last three kinds are the grasses');
put16(0x712C2 + 22 * 2, 0); put16(0x712C2 + 24 * 2, 0);
put16(0x712C0, 1); put16(0x712C2, 2);
run();
assert.equal(window.__hmStamina.read().basket, null, 'more sorted items than the count is hidden');
for (let i = 0; i < 27; i++) put16(0x712C0 + i * 2, 0);

// Horse race: the user's Spring 18 save (race 1 bet screen, odds 19 25 2 8 18 1 on screen).
const RACE_ROWS = [[[35, 58, 74, 0, 127, 19], [1, 44, 140, 64, 0, 25], [18, 171, 132, 64, 127, 2], [23, 121, 10, 96, 64, 8], [33, 59, 121, 127, 96, 18], [14, 190, 107, 32, 0, 1]],
  [[34, 46, 175, 64, 64, 21], [27, 18, 130, 96, 127, 30], [39, 170, 170, 127, 127, 1], [36, 116, 203, 32, 32, 8], [29, 78, 88, 32, 96, 13], [7, 182, 168, 64, 96, 1]],
  [[17, 51, 148, 0, 127, 18], [24, 77, 167, 0, 32, 12], [8, 108, 32, 0, 64, 7], [11, 115, 220, 96, 96, 7], [4, 76, 11, 0, 127, 12], [5, 181, 22, 64, 64, 3]]];
RACE_ROWS.forEach((row, k) => row.forEach((h, i) => h.forEach((v, j) => put16(0x7AD4E + k * 0x54 + i * 0xE + j * 2, v))));
run();
assert.equal(window.__hmStamina.read().race, null, 'no race tips on other days');
assert.equal($('.race').hidden, true);
put16(0x70CF2, 0); put16(0x70CF4, 17); put16(0x7AD4C, 0);
run();
let race = window.__hmStamina.read().race;
assert.deepEqual([...race.horses.map(h => h.name)], ['Fuji', 'BeeBop', 'Adios', 'Tangle', 'Lava', 'MayDay']);
assert.deepEqual([...race.horses.map(h => h.odds)], [19, 25, 2, 8, 18, 1]);
assert.equal($('.race').hidden, false);
assert($('.race').innerHTML.includes('Race 1 · likely Adios'), 'race 1 tip');
assert($('.race').innerHTML.includes('<div class="horse best"><span>3</span><span>Adios</span>'));
const winOdds = window.__hmStamina.raceOdds(race.horses);
assert(Math.abs(winOdds.reduce((a, b) => a + b) - 100) < 1, 'win chances add up to 100');
assert.deepEqual([...window.__hmStamina.raceOdds(race.horses)], [...winOdds], 'same numbers every time');
put16(0x7AD4C, 2);
run();
assert($('.race').innerHTML.includes('Race 3 · likely Mango'), 'race 3 tip');
put16(0x7AD4C, 3); put16(0x7AD4E + 2 * 0x54 + 2 * 0xE, 0xFFFF);
run();
assert($('.race').innerHTML.includes('you ride, no tip'));
assert($('.race').innerHTML.includes('<span>You</span>'));
// The race code being loaded also counts, on any day.
put16(0x70CF4, 3); put16(0x7AD4C, 1);
run();
assert.equal(window.__hmStamina.read().race, null);
const put32r = (o, v) => { put16(o, v & 0xffff); put16(o + 2, v >>> 16); };
put32r(0xB7E20, 7); put32r(0xB7E24, 0x800B7EB8);
run();
assert.equal(window.__hmStamina.read().race.number, 2);
put32r(0xB7E20, 6); put16(0x70CF4, 0); put16(0x7AD4C, 0);
run();
assert.equal($('.race').hidden, true);

// Fish pond: 99 slots of 4 bytes from 0x75854 (u16 item 0xA3 small, 0xA2 medium, 0xA1 large); bit 0 of 0x759E0 is fed today.
assert.equal($('.pond').hidden, true, 'empty unfed pond is hidden');
put16(0x75854, 0xA3); put16(0x75856, 3); put16(0x75858, 0xA3); put16(0x7585A, 3); put16(0x75860, 0xA2); put16(0x75862, 12);
put16(0x75854 + 98 * 4, 0xA1); put16(0x75856 + 98 * 4, 25);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().pond)), { small: 2, medium: 1, large: 1, count: 4, fed: false, days: [3, 3, 12, 25], next: 25 });
assert.equal($('.pond').hidden, false);
assert.equal($('.fishes').hidden, true, 'fish nights start hidden');
assert.equal($('.pond').querySelector('.label').textContent, 'Pond ▸');
$('.pond').fire('click');
assert.equal($('.fishes').hidden, false, 'tap shows fish nights');
assert.equal($('.pond')['aria-expanded'], 'true');
assert.equal($('.pond').querySelector('.label').textContent, 'Pond ▾');
assert.equal($('.fishes').innerHTML,
  '<span class="next">L 25</span><div class="meter l"><div class="fill" style="width:83.3%"></div></div><span class="num"><span class="pick" title="You take this one next">🎣</span>×1</span><span class="num">🐟 in 5</span>'
  + '<span>M 12</span><div class="meter m"><div class="fill" style="width:40%"></div></div><span class="num">×1</span><span class="num">L in 8</span>'
  + '<span>S 3</span><div class="meter s"><div class="fill" style="width:10%"></div></div><span class="num">×2</span><span class="num">M in 7</span>', 'grouped by nights, most first, with a 30-night meter');
assert.equal(store['ps1-plugin-hm-pond-open'], '1', 'open pond list is remembered');
put16(0x75854 + 98 * 4, 0); put16(0x75864, 0xA2); put16(0x75866, 14);
run();
assert.equal(window.__hmStamina.read().pond.next, 12, 'the first medium slot is taken, not the one with most nights');
assert.match($('.fishes').innerHTML, /<span class="next">M 12<\/span>/);
assert.doesNotMatch($('.fishes').innerHTML, /class="next">M 14/);
put16(0x75864, 0); put16(0x75854 + 98 * 4, 0xA1);
run();
$('.fishes').fire('click');
assert.equal($('.fishes').hidden, true, 'tapping the list closes it');
assert.equal(store['ps1-plugin-hm-pond-open'], '0');
assert.equal($('.pond').querySelector('.name').innerHTML, 'S2 M1 L1 <span class="num">4/99</span> <span class="mark">🍤</span>');
assert.match($('.pond').title, /Not fed today/);
put16(0x759E0, 1);
run();
assert.equal(window.__hmStamina.read().pond.fed, true);
assert.match($('.pond').querySelector('.name').innerHTML, /mark on/);
assert.match($('.pond').title, /Fed today/);
put16(0x7585C, 0x41);
run();
assert.equal(window.__hmStamina.read().pond, null, 'a slot that is not a fish hides the line');
assert.equal($('.pond').hidden, true);
for (let i = 0; i < 99; i++) put16(0x75854 + i * 4, 0);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().pond)), { small: 0, medium: 0, large: 0, count: 0, fed: true, days: [] }, 'fed but empty still shows');
put16(0x759E0, 0);
run();
assert.equal(window.__hmStamina.read().pond, null);

// Auto fish: Square casts and holds the line, letting go on a bite reels in, R2 puts the catch in the rucksack.
{
  const presses = [], timers = [];
  let T = 1e6;
  window.EJS_emulator.gameManager.simulateInput = (p, i, v) => presses.push(i + ':' + v);
  ctx.Date = { now: () => T };
  ctx.setInterval = f => { timers.push(f); return timers.length; };
  put16(0x71A84, 6); put16(0x71A12, 100); put16(0x71A14, 100); put16(0x71A16, 0); put16(0x71A6C, 0x4); put16(0x71A6E, 0x400); put16(0x71A3C, 0); put16(0x71AF0, 0);
  run();
  assert.equal($('.autofish').hidden, true, 'no button without a rod');
  put16(0x71A84, 56);
  timers[0]();
  assert.equal($('.autofish').hidden, false, 'button shows with the Fishing Rod');
  assert.equal($('.autofish').textContent, '🎣 Auto fish');
  $('.autofish').fire('click');
  const step = ms => { T += ms; timers.at(-1)(); };
  step(700);
  assert.deepEqual(presses, ['1:1'], 'casts with Square held');
  put16(0x71A6C, 0x10); step(30);
  assert.equal(window.__hmStamina.fish().phase, 'wait');
  step(30);
  assert.deepEqual(presses, ['1:1'], 'keeps holding while waiting');
  put16(0x71A3C, 1); step(30);
  assert.deepEqual(presses.at(-1), '1:0', 'lets go on a bite');
  put16(0x71A6C, 0x8004); put16(0x71AF0, 0xA3); step(30);
  assert.equal(window.__hmStamina.fish().phase, 'landed');
  step(1000);
  assert.equal(presses.at(-1), '1:0', 'waits for the catch to show');
  step(600);
  assert.equal(presses.at(-1), '13:1', 'R2 puts the catch away');
  step(200);
  assert.equal(presses.at(-1), '13:0');
  put16(0x71A6C, 0); put16(0x71AF0, 0); put16(0x71A3C, 0); step(30);
  assert.equal(window.__hmStamina.fish().caught, 0, 'waits for the hands to stay empty');
  step(800);
  timers[0]();
  assert.equal(window.__hmStamina.fish().caught, 1);
  assert.equal($('.autofish').textContent, '🎣 Stop · 1 caught');
  assert($('.autofish').classList.has('on'));
  // Junk goes back in the water with X instead of the rucksack.
  step(700); put16(0x71A6C, 0x10); step(30); put16(0x71A3C, 1); step(30);
  put16(0x71A6C, 0x4); put16(0x71A3C, 0); put16(0x71A8A, 233); step(30); step(1600);
  assert.equal(presses.at(-1), '0:1', 'X throws junk back');
  assert(!presses.slice(-3).includes('13:1'));
  step(200);
  assert.equal(presses.at(-1), '0:0');
  put16(0x71A8A, 0); step(30); step(800);
  timers[0]();
  assert.equal(window.__hmStamina.fish().tossed, 1);
  assert.equal(window.__hmStamina.fish().caught, 1);
  assert.equal($('.autofish').textContent, '🎣 Stop · 1 caught · 1 junk');
  put16(0x71A12, 10); step(700);
  assert.equal(window.__hmStamina.fish().on, false, 'stops at low stamina');
  assert.equal($('.autofish').textContent, '🎣 Auto fish · Stamina low');

  put16(0x71A12, 100); $('.autofish').fire('click'); step(700);
  step(4100);
  assert.equal($('.autofish').textContent, '🎣 Auto fish · No water here', 'stops when no line goes out');
  assert.deepEqual(presses.slice(-3), ['1:0', '13:0', '0:0'], 'buttons are let go');

  $('.autofish').fire('click'); step(700); put16(0x71A6C, 0x10); step(30); put16(0x71A3C, 1); step(30);
  put16(0x71A6C, 0x4); put16(0x71AF0, 0xA3); step(30); step(1600);
  for (let i = 0; i < 3; i++) step(1300);
  assert.equal($('.autofish').textContent, '🎣 Auto fish · Rucksack full', 'stops when the catch cannot be put away');

  put16(0x71A3C, 0); $('.autofish').fire('click'); step(700);
  assert.equal($('.autofish').textContent, '🎣 Auto fish · Hands are full', 'never starts with something in hand');
  put16(0x71A6C, 0); put16(0x71AF0, 0);

  // A late catch, then the fish moving to the item slot, still count as held: Square there would eat it.
  $('.autofish').fire('click'); step(700); put16(0x71A6C, 0x10); step(30); put16(0x71A3C, 1); step(30);
  put16(0x71A6C, 0x4); put16(0x71A3C, 0); step(30);
  const before = presses.length;
  step(2000); put16(0x71AF0, 0xA3); step(30);
  assert.equal(presses.at(-1), '13:1', 'R2 for a catch that shows late');
  put16(0x71AF0, 0); put16(0x71A8A, 0xA3);
  for (let i = 0; i < 5; i++) step(1300);
  assert(!presses.slice(before).includes('1:1'), 'never presses Square while a fish is held');
  assert.equal(window.__hmStamina.fish().caught, 0);
  assert.equal($('.autofish').textContent, '🎣 Auto fish · Rucksack full');
  put16(0x71A8A, 0); put16(0x71A6C, 0);

  $('.autofish').fire('click'); step(700); put16(0x71A6C, 0x10); step(30);
  put16(0x71A84, 6); step(30);
  assert.equal($('.autofish').textContent, '🎣 Auto fish · No rod in hand');
  assert.deepEqual(presses.slice(-2), ['13:0', '0:0'], 'all buttons let go on stop');
  assert(presses.includes('1:0'));
  put16(0x71A6C, 0); put16(0x71A84, 0);

  $('.autofish').fire('click');
  assert.equal(window.__hmStamina.fish().on, true);
  $('.autofish').fire('click');
  assert.equal(window.__hmStamina.fish().on, false, 'a second tap stops');
  ctx.Date = Date;
  ctx.setInterval = () => 1;
  delete window.EJS_emulator.gameManager.simulateInput;
  run();
}

// Crops: 8-byte field tiles from 0x71DFC (u16 item, u16 soil, u8 stage); ripe when the stage equals u16 +2 of the item's growth row.
assert.equal($('.crops').hidden, true, 'no crops hides the line');
put32(0x6C858, 0x80040000); put32(0x6C864, 0x80041000);
H[B + 0x40000 + 0x29 * 40] = 0x40; H[B + 0x40000 + 0x29 * 40 + 3] = 7; put16(0x41000 + 7 * 16 + 2, 3);
H[B + 0x40000 + 0x31 * 40] = 0x40;
put16(0x71DFC, 0x29); H[B + 0x71DFC + 4] = 1; put16(0x71E04, 0x29); H[B + 0x71E04 + 4] = 1; put16(0x71E0C, 0x31);
run();
assert.equal($('.crops').hidden, true, 'ripe line stays inside the closed Sprites list');
$('.ptoggle').fire('click');
assert.equal($('.crops').hidden, false, 'ripe line shows in the open Sprites list');
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().crops)), { field: 2, fieldRipe: 0, hothouse: 0, hothouseRipe: 0 });
assert.equal($('.crops').querySelector('.name').innerHTML, '<span class="num">0/2</span> <span class="mark">🧚</span>');
assert.match($('.crops').title, /only when a crop is ripe/);
H[B + 0x71E04 + 4] = 3; put16(0x74124, 0x29); H[B + 0x74124 + 4] = 3;
run();
assert.equal(window.__hmStamina.read().crops.hothouse, 0, 'Hothouse is skipped until it is built');
put16(0x70D0C, 1);
run();
assert.deepEqual(JSON.parse(JSON.stringify(window.__hmStamina.read().crops)), { field: 2, fieldRipe: 1, hothouse: 1, hothouseRipe: 1 });
assert.equal($('.crops').querySelector('.name').innerHTML, '<span class="num">2/3</span> <span class="mark on">🧚</span>');
assert.match($('.crops').title, /Field 1 of 2 ripe, Hothouse 1 of 1\. Sprites can take a harvest job/);
put16(0x71DFC, 0); put16(0x71E04, 0); put16(0x71E0C, 0); put16(0x74124, 0); put16(0x70D0C, 0);
run();
assert.equal($('.crops').hidden, true);
$('.ptoggle').fire('click');

// Harvest hire patch: a nop at 0x8010E818, written only over the matching hire code.
const HIRE = [0x10400002, 0x24020004, 0xA6020028, 0x960200B8, 0x00000000, 0x34420041];
const word = o => (H[B + o] | H[B + o + 1] << 8 | H[B + o + 2] << 16 | H[B + o + 3] << 24) >>> 0;
const putHire = () => HIRE.forEach((v, i) => put32(0x10E810 + i * 4, v));
run();
assert.equal(window.__hmStamina.hireCode(), null, 'no hire code loaded');
assert.equal($('.anyharvest').hidden, true, 'button hides with the Sprites list closed');
$('.ptoggle').fire('click');
assert.equal($('.anyharvest').hidden, false);
assert.equal($('.anyharvest').textContent, '🌾 Hire with no ripe crop: Off');
$('.anyharvest').fire('click');
assert.equal(store['ps1-plugin-hm-any-harvest'], '1');
assert.equal(word(0x10E818), 0, 'nothing written while the hire code is not there');
putHire();
run();
assert.equal(window.__hmStamina.hireCode(), 'on');
assert.equal(word(0x10E818), 0, 'step-4 store is a nop');
assert.equal($('.anyharvest').textContent, '🌾 Hire with no ripe crop: On');
assert.match($('.anyharvest').title, /Hire code is loaded/);
$('.anyharvest').fire('click');
assert.equal(word(0x10E818), 0xA6020028, 'turning it off puts the store back');
assert.equal(window.__hmStamina.hireCode(), 'off');
$('.anyharvest').fire('click');
put32(0x10E824, 0x12345678);
put32(0x10E818, 0xA6020028);
run();
assert.equal(word(0x10E818), 0xA6020028, 'other code is left alone');
assert.equal(window.__hmStamina.hireCode(), null);
putHire();
run();
assert.equal(word(0x10E818), 0);
window.__hmStamina.stop();
assert.equal(word(0x10E818), 0xA6020028, 'stop puts the store back');
store['ps1-plugin-hm-any-harvest'] = '0';
HIRE.forEach((v, i) => put32(0x10E810 + i * 4, 0));
run();
$('.ptoggle').fire('click');

// Values out of range (another game) are not shown.
put16(0x71A14, 0);
run();
assert.equal(window.__hmStamina.read(), null);
assert.equal($('.wait').hidden, false);
assert.equal($('.hearts').hidden, true);

// Stop removes the box, and nothing wrote RAM.
const before = H.slice();
window.__hmStamina.stop();
assert.equal(window.__hmStamina, undefined);
assert(host.removed);
assert.deepEqual(H, before, 'the plugin writes no RAM with the harvest hire patch off');
console.log('PASS: Harvest Moon plugin reads stamina, fatigue, held tool, mine floor and item odds, basket, fish pond and fish nights, horse race tips, shop hours, animal love, coop feed, held chicken, golden egg hen, villager and sprite friendship, sprite jobs and skills, can water, ripe crops, the harvest hire patch, tomorrow weather, hearts and auto fishing with junk thrown back, opens hearts on tap, and handles missing or odd RAM.');
