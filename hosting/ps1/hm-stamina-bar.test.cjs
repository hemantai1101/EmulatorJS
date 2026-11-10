const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

// Minimal DOM: each selector returns its own lazily made element, nested the same way.
function el() {
  const kids = {}, handlers = {};
  const e = {
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
  Date
};
window.EJS_emulator = { gameManager: { Module: { HEAPU8: H } } };
const src = fs.readFileSync(__dirname + '/plugins/hm-stamina-bar.js', 'utf8');
const run = () => vm.runInNewContext(src, ctx);

// No RAM found yet: wait text shows.
run();
assert.equal(host.parentNode, body, 'box attaches to the page');
assert.equal($('.wait').hidden, false);
assert.equal($('.st').hidden, true);
assert.equal(window.__hmStamina.read(), null);

// Values from a live game: stamina 100 of 100, fatigue 18, hearts as read on 9 November 2026.
sig.forEach((v, j) => { H[B + 0x80 + j] = v; });
put16(0x71A12, 100); put16(0x71A14, 100); put16(0x71A16, 18);
put16(girl(3), 2000); put16(girl(7), 2200); put16(girl(9), 2700); put16(girl(14), 0); put16(girl(20), 2200);
run();
const s = window.__hmStamina.read();
assert.equal(s.animals.length, 0, 'no named animals');
assert.deepEqual({ ...s, hearts: { ...s.hearts }, animals: undefined },
  { stamina: 100, max: 100, fatigue: 18, hearts: { Karen: 2000, Ann: 2200, Elli: 2700, Mary: 0, Popuri: 2200 }, held: 0, place: null, floor: null, season: 0, weekday: 0, hour: 0, tomorrow: 'Sunny', water: null, animals: undefined });
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

// Hearts start closed; a tap opens them and the choice is kept.
assert.equal($('.hearts').hidden, true);
assert.equal($('.htoggle').textContent, '▾ Hearts');
$('.box').fire('click');
assert.equal($('.hearts').hidden, false);
assert.equal(store['ps1-plugin-hm-hearts-open'], '1');
const row = n => $('.hearts').querySelector('.g-' + n);
assert.equal(row('Elli').querySelector('.num').textContent, '2,700');
assert.equal(row('Elli').querySelector('.heart').title, 'Black heart');
assert.equal(row('Mary').querySelector('.num').textContent, '0');
run();
assert.equal($('.hearts').hidden, false, 'open choice survives a restart');
$('.box').fire('keydown', { key: 'Enter' });
assert.equal($('.hearts').hidden, true, 'Enter closes the hearts');
$('.box').fire('click');

// Shops: closed until tapped; open shops get a green dot from the weekday and hour.
const shopRow = i => $('.shops').querySelector('.sh-' + i);
assert.equal($('.shops').hidden, true);
put16(0x70CF6, 1); put16(0x70CF8, 10);
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
assert.equal(shopRow(0).title, 'Closed Sun, Tue');
assert.equal(shopRow(9).title, 'Closed Mon, summer only');
const open = (name, season, weekday, hour) => window.__hmStamina.isOpen(name, { season, weekday, hour });
assert.equal(open('Supermarket', 0, 2, 10), false, 'closed Tuesday');
assert.equal(open('Supermarket', 0, 3, 17), true);
assert.equal(open('Supermarket', 0, 3, 18), false, 'shut at closing hour');
assert.equal(open('Kai', 0, 3, 12), false, 'Kai only in summer');
assert.equal(open('Kai', 1, 3, 12), true);
assert.equal(open('Inn', 3, 0, 20), true);
run();
assert.equal($('.shops').hidden, false, 'shops choice survives a restart');
$('.stoggle').fire('click');
assert.equal($('.shops').hidden, true);
assert(!$('.box').classList.has('wide'));
put16(0x70CF6, 0); put16(0x70CF8, 0);

// Animals: a slot shows when its name (18 bytes before the love byte) does not start with 0xFFFF.
const name = (at, text) => { [...text].forEach((c, i) => put16(at - 18 + i * 2, c.charCodeAt(0) - 65)); for (let i = text.length; i < 9; i++) put16(at - 18 + i * 2, 0xFFFF); };
assert.equal($('.atoggle').hidden, true, 'no animals, no toggle');
name(0x759FA, 'Bin'); H[B + 0x759FA] = 10;
name(0x74302 + 0xB4 * 2, 'Cluck'); H[B + 0x74302 + 0xB4 * 2] = 130;
name(0x74A0A + 0xB8 * 19, 'Moo'); H[B + 0x74A0A + 0xB8 * 19] = 255;
for (let i = 0; i < 9; i++) put16(0x75AEA - 18 + i * 2, 0xFFFF);
H[B + 0x75AEA] = 99;
run();
const animals = JSON.parse(JSON.stringify(window.__hmStamina.read().animals));
assert.deepEqual(animals, [{ kind: 'Dog', name: 'Bin', love: 10 }, { kind: 'Chicken', name: 'Cluck', love: 130 }, { kind: 'Barn', name: 'Moo', love: 255 }],
  'empty horse slot is skipped');
assert.equal($('.atoggle').textContent, '▾ Animals (3)');
assert.equal($('.animals').hidden, true);
heartsBefore = $('.hearts').hidden;
$('.atoggle').fire('click');
assert.equal($('.hearts').hidden, heartsBefore, 'the animals toggle does not flip hearts');
assert.equal($('.animals').hidden, false);
assert.equal(store['ps1-plugin-hm-animals-open'], '1');
assert($('.animals').innerHTML.includes('<span>Cluck <span class="kind">Chicken</span></span><div class="bar"><div class="fill" style="width:51%"></div></div><span class="num">130/255</span>'));
assert($('.animals').innerHTML.includes('style="width:100%"></div></div><span class="num">255/255</span>'), 'full love fills the bar');
assert($('.animals').innerHTML.includes('style="width:4%"></div></div><span class="num">10/255</span>'));
$('.atoggle').fire('click');
assert.equal($('.animals').hidden, true);

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
assert.deepEqual(H, before, 'the plugin never writes RAM');
console.log('PASS: Harvest Moon plugin reads stamina, fatigue, held tool, mine floor and item odds, shop hours, animal love, can water, tomorrow weather and hearts, opens hearts on tap, and handles missing or odd RAM.');
