(function (root) {
    'use strict';
    const cycles = [['Sun', 'Moon', 'Venus', 'Mercury'], ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Pluto', 'Neptune']];
    const symbols = { Sun: '☉', Moon: '☾', Venus: '♀', Mercury: '☿', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '⛢', Pluto: '♇', Neptune: '♆' };
    const terrain = {
        None: [[], []], Forest: [['Beast', 'Beast-Warrior', 'Insect', 'Plant'], []],
        Wasteland: [['Zombie', 'Dinosaur', 'Rock'], []], Mountain: [['Dragon', 'Winged Beast', 'Thunder'], []],
        Meadow: [['Warrior', 'Beast-Warrior'], []], Sea: [['Aqua', 'Fish', 'Sea Serpent', 'Thunder'], ['Machine', 'Pyro']],
        Yami: [['Spellcaster', 'Fiend'], ['Fairy']]
    };
    const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = (a, b) => Math.min(a, b) * 1000 + Math.max(a, b);
    function distance(a, b) {
        let row = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 0; i < a.length; i++) {
            const next = [i + 1];
            for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
            row = next;
        }
        return row[b.length];
    }
    function create(data) {
        const cards = new Map(data.cards.map(c => [c.id, c]));
        const pairs = new Map(data.fusions.map(([a, b, c]) => [key(a, b), c]));
        const equips = new Set(data.equips.map(([a, b]) => `${a}:${b}`));
        const aliases = { elecsnake: 'Electric Snake', petit: 'Petit Dragon', thtd: 'Twin-headed Thunder Dragon', twinheaded: 'Twin-headed Thunder Dragon', pottrick: 'Pot the Trick' };
        const monster = id => Boolean(cards.get(id)?.stars.length);
        function resolve(text) {
            const n = normalize(text);
            if (!n) return [];
            if (/^#?\d+$/.test(text.trim())) return cards.has(Number(text.replace('#', ''))) ? [cards.get(Number(text.replace('#', '')))] : [];
            const exact = data.cards.filter(c => normalize(c.name) === normalize(aliases[n] || n));
            if (exact.length) return exact;
            return data.cards.filter(c => normalize(c.name).includes(n));
        }
        function suggest(text) {
            const matches = resolve(text);
            if (matches.length) return matches.slice(0, 18);
            const n = normalize(text);
            return data.cards.map(c => [c, distance(n, normalize(c.name))]).filter(([, d]) => d <= Math.max(2, Math.floor(n.length / 3))).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([c]) => c);
        }
        function exact(text) {
            const n = normalize(text);
            return data.cards.find(c => String(c.id) === text.trim().replace(/^#/, '') || normalize(c.name) === normalize(aliases[n] || n));
        }
        function fuse(a, b) {
            if (!cards.has(a) || !cards.has(b)) throw Error('Unknown card ID');
            const result = pairs.get(key(a, b));
            if (result) return { a, b, result, success: true };
            if (!monster(a) || !monster(b)) return { a, b, result: null, success: false, unsupported: true };
            return { a, b, result: b, success: false, discarded: a };
        }
        function search(hand, field = [], allowFailed = false) {
            if (hand.length > 5) throw Error('A hand holds at most five cards');
            const lines = [];
            function walk(result, remaining, order, steps, slot) {
                if (steps.length && steps.at(-1).success) lines.push({ result, order, steps, slot, failed: steps.filter(s => !s.success).length });
                const seen = new Set();
                for (const i of remaining) {
                    if (seen.has(hand[i]) || !monster(hand[i])) continue;
                    seen.add(hand[i]);
                    const step = fuse(result, hand[i]);
                    if (!step.success && !allowFailed) continue;
                    walk(step.result, remaining.filter(j => j !== i), [...order, i], [...steps, step], slot);
                }
            }
            if (field.filter(Boolean).length < 5) hand.forEach((id, i) => { if (monster(id)) walk(id, hand.map((_, j) => j).filter(j => j !== i), [i], [], null); });
            field.forEach((entry, slot) => { if (entry && monster(entry.id)) walk(entry.id, hand.map((_, j) => j), [], [], slot); });
            const seen = new Set();
            return lines.sort((a, b) => a.failed - b.failed || cards.get(b.result).atk - cards.get(a.result).atk || a.order.length - b.order.length).filter(line => {
                const signature = JSON.stringify([line.slot, line.order.map(i => hand[i]), line.steps.map(s => s.result)]);
                if (seen.has(signature)) return false;
                seen.add(signature); return true;
            });
        }
        function stats(id, land = 'None', star = '', opponent = '', direct = false) {
            const c = cards.get(id), rule = terrain[land];
            if (!c || !rule) throw Error('Unknown card or field');
            const boost = rule[0].includes(c.type) ? 500 : rule[1].includes(c.type) ? -500 : 0;
            const battle = !direct && cycles.some(cycle => cycle[(cycle.indexOf(star) + 1) % cycle.length] === opponent && cycle.includes(star)) ? 500 : 0;
            return { printedAtk: c.atk, printedDef: c.def, terrain: boost, battle, atk: Math.max(0, c.atk + boost) + battle, def: Math.max(0, c.def + boost) + battle };
        }
        return { cards, pairs, resolve, suggest, exact, fuse, search, stats, monster, canEquip: (equip, id) => equips.has(`${equip}:${id}`) };
    }
    const api = { create, normalize, cycles, symbols, terrain };
    if (typeof module !== 'undefined') module.exports = api;
    else root.FMFusion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
