const fs = require('node:fs');
const assert = require('node:assert/strict');
for (const file of ['data/emulator.min.js', 'data/src/emulator.js']) {
  const code = fs.readFileSync(__dirname + '/public/' + file,'utf8');
  const start = code.indexOf('keyChange(');
  const end = code.indexOf('gamepadEvent(',start);
  const handler = new Function('return ({' + code.slice(start,end).trim() + '}).keyChange')();
  const calls = [];
  let popup = false, keyboard = false;
  const emulator = {
    started:true, settingsMenu:{style:{display:'none'}},
    controlPopup:{parentElement:{parentElement:{getAttribute:()=>'hidden'}}},
    isPopupOpen:()=>popup, getSettingValue:()=>keyboard?'enabled':'disabled',
    controls:[{4:{value:38},5:{value:40}},{},{},{}],
    gameManager:{simulateInput:(...args)=>calls.push(args)}
  };
  function key(keyCode, repeat, type='keydown') {
    let prevented = false;
    handler.call(emulator,{keyCode,repeat,type,preventDefault(){prevented=true;}});
    return prevented;
  }
  for (const keyCode of [38,40]) {
    assert.equal(key(keyCode,false),true);
    const count = calls.length;
    for(let i=0;i<30;i++) assert.equal(key(keyCode,true),true,'held key must block page scroll');
    assert.equal(calls.length,count,'repeat must not send extra game input');
    assert.equal(key(keyCode,false,'keyup'),true);
    assert.equal(calls.at(-1)[2],0,'key release reaches the game');
  }
  emulator.started=false; assert.equal(key(38,true),false);
  emulator.started=true; popup=true; assert.equal(key(38,true),false);
  popup=false; emulator.settingsMenu.style.display='block'; assert.equal(key(38,true),false);
  emulator.settingsMenu.style.display='none'; keyboard=true; assert.equal(key(38,true),false);
  console.log(file + ': PASS — held arrows block scroll, release works, menus keep normal keys.');
}
