const fs = require('node:fs');
const assert = require('node:assert/strict');
for (const file of ['data/src/emulator.js', 'data/emulator.min.js']) {
  const code = fs.readFileSync(__dirname + '/public/' + file, 'utf8');
  const start = code.indexOf(file.includes('/src/') ? 'createPopup(popupTitle, buttons, hidden)' : 'createPopup(t,e,i)');
  const end = code.indexOf('selectFile()', start);
  assert(start > 0 && end > start);
  const createPopup = new Function('return {' + code.slice(start, end).trim() + '}')().createPopup;
  function element() {
    return {
      children: [], style: {}, classList: { add() {} },
      appendChild(child) { this.children.push(child); child.parentElement = this; },
      set innerText(value) { this.text = String(value); }, get innerText() { return this.text; }
    };
  }
  const emulator = {
    createElement: element, elements: { parent: element() }, closePopup() {},
    localization(text) { return text ? 'Translated: ' + text : undefined; }
  };
  const dropBody = createPopup.call(emulator, '', {}, true);
  assert.equal(dropBody.parentElement.children[0].innerText, '', file + ': blank title must not show undefined');
  const titledBody = createPopup.call(emulator, 'Control Settings', {}, true);
  assert.equal(titledBody.parentElement.children[0].innerText, 'Translated: Control Settings');
}
console.log('PASS: drop popup has no undefined title; other titles still translate in both shipped engines.');
