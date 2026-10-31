const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const context = vm.createContext({ module: { exports: {} } });
vm.runInContext(fs.readFileSync(`${__dirname}/engine.js`, 'utf8'), context);
const { create, cycles } = context.module.exports;
const data = require('./data.json');
const provenance = require('./provenance.json');
const engine = create(data);
const id = name => { const c = engine.exact(name); assert(c, name); return c.id; };
const pair = (a, b, result) => {
    for (const [x, y] of [[a, b], [b, a]]) assert.equal(engine.fuse(id(x), id(y)).result, id(result), `${x} + ${y}`);
};
const chain = (names, expected) => {
    let r = id(names[0]);
    for (let i = 1; i < names.length; i++) { const step = engine.fuse(r, id(names[i])); assert(step.success); r = step.result; assert.equal(r, id(expected[i - 1])); }
    const lines = engine.search(names.map(id));
    assert(lines.some(l => l.result === r && l.order.length === names.length));
};
assert.equal(data.cards.length, 722);
assert.equal(data.fusions.length, 25146);
assert.equal(engine.pairs.size, 25146);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(`${__dirname}/data.json`)).digest('hex'), provenance.data_sha256);
const oracle = new Map(data.fusions.map(([a, b, r]) => [`${Math.min(a, b)}:${Math.max(a, b)}`, r]));
for (let a = 1; a <= 722; a++) for (let b = 1; b <= 722; b++) {
    const expected = oracle.get(`${Math.min(a, b)}:${Math.max(a, b)}`), actual = engine.fuse(a, b);
    assert.equal(actual.success, expected !== undefined);
    if (expected !== undefined) assert.equal(actual.result, expected);
    else if (engine.monster(a) && engine.monster(b)) { assert.equal(actual.result, b); assert.equal(actual.discarded, a); }
    else assert(actual.unsupported);
}
pair('Griggle', 'Water Omotics', 'Queen of Autumn Leaves');
pair('Dancing Elf', 'Key Mace', 'Mystical Elf');
chain(['Dancing Elf', 'Mask of Darkness', 'Morphing Jar'], ['Dark Elf', 'Mystical Sand']);
chain(['Petit Dragon', 'Ancient Jar', 'Electric Snake'], ['Stone D.', 'Twin-headed Thunder Dragon']);
chain(['Petit Dragon', 'Electric Snake', 'Petit Dragon'], ['Thunder Dragon', 'Twin-headed Thunder Dragon']);
chain(['Petit Dragon', 'Electric Snake', 'Electric Snake'], ['Thunder Dragon', 'Twin-headed Thunder Dragon']);
chain(['Nemuriko', 'Mechanical Spider', 'D. Human'], ['Disk Magician', 'Cyber Soldier']);
chain(['Masked Clown', 'Mechanical Spider', 'Petit Dragon'], ['Cyber Soldier', 'Metal Dragon']);
assert.equal(engine.cards.get(id('Mystical Sand')).def, 1700);
assert.deepEqual(engine.cards.get(id('Mystical Sand')).stars, ['Mercury', 'Saturn']);
assert.equal(engine.cards.get(id('Cyber Soldier')).type, 'Machine');
assert.equal(engine.stats(id('Cyber Soldier'), 'Sea').terrain, -500);
assert.equal(engine.canEquip(id('Laser Cannon Armor'), id('Twin-headed Thunder Dragon')), false);
assert.equal(engine.stats(id('Millennium Shield'), 'Meadow').def, 3500);
assert.equal(engine.stats(id('Millennium Shield'), 'Forest').def, 3000);
assert.equal(engine.stats(id('Millennium Shield'), 'Forest', 'Uranus', 'Pluto').def, 3500);
assert.equal(engine.stats(id('Millennium Shield'), 'Forest', 'Uranus', 'Moon').def, 3000);
assert.equal(engine.stats(id('Twin-headed Thunder Dragon'), 'Mountain', 'Moon', 'Uranus').atk, 3300);
for (const cycle of cycles) for (let i = 0; i < cycle.length; i++) {
    assert.equal(engine.stats(1, 'None', cycle[i], cycle[(i + 1) % cycle.length]).battle, 500);
    assert.equal(engine.stats(1, 'None', cycle[i], cycle[(i + 1) % cycle.length], true).battle, 0);
}
const hand = ['Mechanical Spider', 'Masked Clown', 'Dharma Cannon', 'Petit Dragon', 'Cyber Commander'].map(id);
const before = JSON.stringify(hand);
for (const failed of [false, true]) {
    for (const line of engine.search(hand, [{ id: id('Nemuriko') }], failed)) {
        assert.equal(new Set(line.order).size, line.order.length);
        assert.equal(line.steps.length, line.order.length - (line.slot === null ? 1 : 0));
        let r = line.slot === null ? hand[line.order[0]] : id('Nemuriko');
        for (const i of line.order.slice(line.slot === null ? 1 : 0)) r = engine.fuse(r, hand[i]).result;
        assert.equal(line.result, r);
        assert(line.steps.at(-1).success);
        if (!failed) assert.equal(line.failed, 0);
    }
}
assert.equal(JSON.stringify(hand), before);
assert(engine.search([id('Electric Snake')], [{ id: id('Stone D.') }]).some(l => l.result === id('Twin-headed Thunder Dragon') && l.slot === 0));
assert.equal(engine.search([], [{ id: id('Petit Dragon') }, { id: id('Electric Snake') }]).length, 0);
const full = Array.from({ length: 5 }, () => ({ id: id('Stone D.') }));
assert(engine.search(hand, full).every(l => l.slot !== null));
assert.throws(() => engine.search([...hand, 1]), /five/);
assert.equal(engine.exact('elec snake').id, id('Electric Snake'));
assert.equal(engine.exact('#421').id, id('Cyber Commander'));
assert.equal(engine.exact('dragon'), undefined);
assert.equal(engine.exact('petit dragn'), undefined);
assert(engine.suggest('petit dragn').some(c => c.id === id('Petit Dragon')));
assert(engine.resolve('dragon').length > 1);
const wasted = engine.search(['Blue-eyes White Dragon', 'Petit Dragon', 'Electric Snake'].map(id), [], true);
assert(wasted.some(l => l.failed === 1 && l.steps[0].success === false && l.steps[0].discarded === id('Blue-eyes White Dragon') && l.result === id('Thunder Dragon')));
console.log('Fusion checks passed: all 521,284 ordered pairs, observed chains, duplicates, field slots, terrain, stars, and search.');
