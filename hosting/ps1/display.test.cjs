const fs = require('node:fs');
const assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname + '/public/data/emulator.min.js', 'utf8');
const start = code.indexOf('createBottomMenuBarListeners=()=>{');
const end = code.indexOf(',this.createBottomMenuBarListeners()', start);
assert.ok(start > 0 && end > start);
function check(coarse, touchGenerated) {
  let opened = 0;
  const handlers = {};
  const emulator = {
    started: true, canvas: {}, menu: {},
    elements: {parent:{},menu:{offsetHeight:40}},
    isPopupOpen: () => false, preGetSetting: () => 'downward',
    addEventListener(element, type, handler) {handlers[type] = handler;},
    removeEventListener() {}
  };
  new Function('matchMedia','window','document','e','n','this.' + code.slice(start,end) + ';').call(
    emulator, () => ({matches:coarse}), {innerHeight:800}, {}, false, () => opened++
  );
  emulator.createBottomMenuBarListeners();
  const event = {pointerType:undefined, clientY:799, movementX:0, movementY:10,
    sourceCapabilities:touchGenerated ? {firesTouchEvents:true} : undefined};
  handlers.mousemove(event);
  handlers.click(event);
  assert.equal(opened, coarse || touchGenerated ? 0 : 2);
}
check(true,false);
check(true,true);
check(false,true);
check(false,false);
const page = fs.readFileSync(__dirname + '/index.html','utf8');
for (const selector of ['#game:fullscreen', '#game:-webkit-full-screen']) {
  const css = page.slice(page.indexOf(selector), page.indexOf('}', page.indexOf(selector)));
  assert.ok(css.includes('height: 100dvh !important'), selector);
}
console.log('PASS: touch and touch-made mouse events cannot auto-open the menu; desktop mouse works; both native fullscreen selectors override the page height cap.');
