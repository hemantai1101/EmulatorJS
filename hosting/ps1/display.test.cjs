const fs = require('node:fs');
const assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname + '/public/data/emulator.min.js', 'utf8');
const start = code.indexOf('createBottomMenuBarListeners=()=>{');
const end = code.indexOf(',this.createBottomMenuBarListeners()', start);
assert.ok(start > 0 && end > start);
const handlers = {};
const emulator = {
  addEventListener(element, type, handler) { handlers[type] = handler; },
};
new Function('this.' + code.slice(start, end) + ';').call(emulator);
emulator.createBottomMenuBarListeners();
assert.deepEqual(Object.keys(handlers), [], 'game clicks and mouse moves have no menu-open handler');
const page = fs.readFileSync(__dirname + '/index.html','utf8');
for (const selector of ['#game:fullscreen', '#game:-webkit-full-screen']) {
  const css = page.slice(page.indexOf(selector), page.indexOf('}', page.indexOf(selector)));
  assert.ok(css.includes('height: 100dvh !important'), selector);
}
console.log('PASS: game clicks and mouse moves cannot auto-open the menu; both native fullscreen selectors override the page height cap.');
