const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

// Minimal DOM: each selector returns its own lazily made element, nested the same way.
function el() {
  const kids = {}, handlers = {};
  const e = {
    style: {}, hidden: false, parentNode: null, textContent: '', title: '',
    classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, has(c) { return this.set.has(c); } },
    querySelector: q => (kids[q] ||= el()),
    appendChild(c) { c.parentNode = e; },
    addEventListener(t, f) { handlers[t] = f; },
    fire(t, ev = {}) { handlers[t]?.({ preventDefault() {}, ...ev }); },
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
assert.deepEqual({ ...s, hearts: { ...s.hearts } },
  { stamina: 100, max: 100, fatigue: 18, hearts: { Karen: 2000, Ann: 2200, Elli: 2700, Mary: 0, Popuri: 2200 }, water: null });
assert.equal($('.wa').hidden, true, 'no can, no water line');

// Water: the held can (item 21 at 0x71A84, value at +4), then a carried tool slot.
put16(0x71A84, 21); put16(0x71A88, 98);
run();
assert.equal(window.__hmStamina.read().water, 98);
assert.equal($('.wa').hidden, false);
assert.equal($('.wa').querySelector('.num').textContent, '98/100');
assert.equal($('.wa').querySelector('.fill').style.width, '98%');
put16(0x71A84, 11); put16(0x71A88, 0); put16(0x70EC2 + 6 * 3, 21); put16(0x70EC2 + 6 * 3 + 4, 0);
run();
assert.equal(window.__hmStamina.read().water, 0, 'can in a tool slot, empty');
assert($('.wa').classList.has('empty'));
put16(0x70EC2 + 6 * 3, 0);
run();
assert.equal(window.__hmStamina.read().water, null, 'can put away');
assert.equal($('.wa').hidden, true);
assert.equal($('.wait').hidden, true);
assert.equal($('.st').querySelector('.fill').style.width, '100%');
assert.equal($('.st').querySelector('.num').textContent, '100/100');
assert.equal($('.fa').querySelector('.fill').style.width, '18%');
assert.equal($('.fa').querySelector('.num').textContent, '18/100');

// Hearts start closed; a tap opens them and the choice is kept.
assert.equal($('.hearts').hidden, true);
assert.equal($('.toggle').textContent, '▾ Hearts');
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
console.log('PASS: Harvest Moon plugin reads stamina, fatigue, can water and hearts, opens hearts on tap, and handles missing or odd RAM.');
