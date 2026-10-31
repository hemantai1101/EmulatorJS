'use strict';
(async function () {
    const $ = id => document.getElementById(id);
    const status = message => { $('status').textContent = message; };
    try {
        const [data, deck] = await Promise.all(['data.json', 'deck.json'].map(async path => {
            const response = await fetch(path);
            if (!response.ok) throw Error(`Could not load ${path}`);
            return response.json();
        }));
        const engine = FMFusion.create(data), key = 'ps1-fm-helper-v1';
        let state = { hand: [], field: Array(5).fill(null), terrain: 'None' }, undo = [], lines = [], shown = 20, pending = null;
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            if (saved && Array.isArray(saved.hand) && saved.hand.length <= 5 && saved.hand.every(id => engine.cards.has(id)) && Array.isArray(saved.field) && saved.field.length === 5 && saved.field.every(c => !c || (engine.monster(c.id) && engine.cards.get(c.id).stars.includes(c.star))) && FMFusion.terrain[saved.terrain]) state = saved;
        } catch (_) { status('Could not read the saved hand. You can still use this page.'); }
        const node = (tag, text, className) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; };
        const button = (text, action) => { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; };
        const starName = s => `${FMFusion.symbols[s]} ${s}`;
        function picture(id) {
            const img = document.createElement('img'); img.src = `images/${id}.jpg`; img.alt = engine.cards.get(id).name; img.width = 94; img.height = 94; img.loading = 'lazy';
            img.onerror = () => { const fallback = node('span', `#${id} · No picture`, 'art'); fallback.setAttribute('role', 'img'); fallback.setAttribute('aria-label', img.alt + ': picture missing'); img.replaceWith(fallback); };
            return img;
        }
        function tile(id, action, count = 0) {
            const c = engine.cards.get(id), el = action ? button('', action) : node('div'); el.className = 'card';
            if (action) el.setAttribute('aria-label', `Add ${c.name}`);
            el.append(picture(id), node('small', `#${String(id).padStart(3, '0')} · ${c.type}`), node('strong', c.name));
            if (engine.monster(id)) el.append(node('small', `${c.atk} / ${c.def}`));
            if (count > 1) el.append(node('span', `×${count}`, 'badge'));
            return el;
        }
        function save() {
            try { localStorage.setItem(key, JSON.stringify(state)); }
            catch (_) { status('Browser storage is full or off. Your hand works until this page closes.'); }
        }
        function change(action, message) {
            undo.push(structuredClone(state)); if (undo.length > 50) undo.shift(); action(); save(); render(); if (message) status(message);
        }
        function add(id) {
            const target = $('target').value;
            if (target === 'hand') {
                if (state.hand.length >= 5) { status('Hand is full. Remove a card first.'); return; }
                change(() => state.hand.push(id), `Added ${engine.cards.get(id).name}.`);
            } else {
                if (!engine.monster(id)) { status('Own field slots hold monsters only.'); return; }
                if (state.field[Number(target)]) { status('That slot is full. Remove its card first.'); return; }
                change(() => { state.field[Number(target)] = { id, star: engine.cards.get(id).stars[0] }; }, `Added to own slot ${Number(target) + 1}.`);
                $('field-panel').open = true;
            }
        }
        function matches(text) {
            $('matches').replaceChildren();
            if (!text.trim()) return;
            const found = engine.suggest(text);
            $('matches').append(...found.map(c => tile(c.id, () => {
                if (pending) {
                    const list = pending.tokens.slice(); list[pending.index] = c.name; pending = null;
                    $('query').value = list.join(', '); $('add').click();
                } else add(c.id);
            })));
            if (!found.length) $('matches').append(node('p', 'No match. Try a shorter name or card ID.'));
        }
        $('query').addEventListener('input', () => { pending = null; matches($('query').value); });
        $('query').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('add').click(); } });
        $('add').onclick = () => {
            const tokens = $('query').value.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
            if (!tokens.length) return;
            const resolved = tokens.map(t => engine.exact(t));
            const missing = resolved.findIndex(c => !c);
            if (missing >= 0) {
                pending = { tokens, index: missing };
                status(`Pick a picture for “${tokens[missing]}”. No cards from this list were added.`);
                matches(tokens[missing]); return;
            }
            pending = null;
            if ($('target').value !== 'hand') {
                if (tokens.length !== 1) { status('Add one card at a time to a field slot.'); return; }
                add(resolved[0].id); return;
            }
            if (state.hand.length + resolved.length > 5) { status('Too many cards. A hand holds 5. No cards were added.'); return; }
            change(() => state.hand.push(...resolved.map(c => c.id)), `Added ${resolved.length} card${resolved.length === 1 ? '' : 's'}.`);
            $('query').value = ''; matches('');
        };
        $('reset').onclick = () => change(() => {
            state = { hand: [], field: Array(5).fill(null), terrain: 'None' }; pending = null;
            $('query').value = ''; matches(''); $('target').value = 'hand'; $('foe').value = ''; $('direct').checked = false;
        }, 'New duel. Undo can bring your cards back.');
        $('undo').onclick = () => { if (!undo.length) return; state = undo.pop(); save(); render(); status('Undone.'); };
        Object.keys(FMFusion.terrain).forEach(t => $('terrain').add(new Option(t, t)));
        FMFusion.cycles.flat().forEach(s => $('foe').add(new Option(starName(s), s)));
        FMFusion.cycles.forEach(cycle => $('cycles').append(node('p', cycle.map(starName).join(' → ') + ' → ' + starName(cycle[0]))));
        $('terrain').onchange = () => change(() => { state.terrain = $('terrain').value; }, 'Field view changed. No card was played in your game.');
        for (const id of ['foe', 'direct', 'failed']) $(id).onchange = render;
        $('deck-note').textContent = `Deck snapshot: ${deck.date}. ${deck.note}`;
        const counts = new Map(); deck.ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
        counts.forEach((count, id) => $('deck').append(tile(id, () => add(id), count)));
        function render() {
            $('undo').disabled = !undo.length; $('terrain').value = state.terrain;
            $('hand-count').textContent = `${state.hand.length}/5`; $('hand').replaceChildren();
            const counts = new Map(); state.hand.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
            counts.forEach((count, id) => {
                const el = tile(id, null, count);
                el.append(node('small', `Hand ${state.hand.map((card, i) => card === id ? i + 1 : null).filter(Boolean).join(', ')}`));
                const remove = button('Remove one', () => change(() => state.hand.splice(state.hand.indexOf(id), 1), 'Removed one card.')); remove.className = 'remove'; el.append(remove); $('hand').append(el);
            });
            if (!state.hand.length) $('hand').append(node('p', 'Your hand is empty.', 'muted'));
            $('field').replaceChildren();
            state.field.forEach((entry, i) => {
                const slot = node('div', undefined, 'slot'); slot.append(node('strong', `Slot ${i + 1}`, 'slot-title'));
                if (entry) {
                    const card = tile(entry.id); const select = document.createElement('select'); select.setAttribute('aria-label', `Slot ${i + 1} star`);
                    engine.cards.get(entry.id).stars.forEach(s => select.add(new Option(starName(s), s))); select.value = entry.star;
                    select.onchange = () => change(() => { state.field[i].star = select.value; });
                    const stats = engine.stats(entry.id, state.terrain, entry.star, $('foe').value, $('direct').checked);
                    card.append(select, node('small', `Field ${stats.atk - stats.battle}/${stats.def - stats.battle}`), button('Remove', () => change(() => { state.field[i] = null; }, 'Field card removed.'))); slot.append(card);
                } else slot.append(button('Empty', () => { $('target').value = String(i); $('query').focus(); }));
                $('field').append(slot);
            });
            renderResults();
        }
        function statsText(id, star) {
            const s = engine.stats(id, state.terrain, star, $('foe').value, $('direct').checked);
            return `Printed ${s.printedAtk}/${s.printedDef} · Field ${s.atk - s.battle}/${s.def - s.battle} · ${$('direct').checked ? 'Direct' : 'Battle'} ${s.atk}/${s.def}${s.battle ? ' (+500 star)' : ''}`;
        }
        function renderResults() {
            shown = 20; lines = engine.search(state.hand, state.field, $('failed').checked); drawLines();
        }
        function drawLines() {
            $('results').replaceChildren();
            $('result-count').textContent = lines.length ? `${lines.length} lines. Clean fusions first, then highest printed ATK. Showing ${Math.min(shown, lines.length)}.` : 'No monster fusion lines yet. Add cards or change your hand.';
            lines.slice(0, shown).forEach((line, lineIndex) => {
                const c = engine.cards.get(line.result), el = node('article', undefined, 'line');
                const head = node('div', undefined, 'result-head'); head.append(picture(c.id), node('h3', `${c.name} · ${c.atk}/${c.def}`, line.failed ? 'warn' : 'good')); el.append(head);
                el.append(node('p', line.slot === null ? 'Start in hand. Select in this order:' : `Target own slot ${line.slot + 1} (${engine.cards.get(state.field[line.slot].id).name}). Select hand cards in this order:`));
                el.append(node('p', line.order.map((i, n) => `${n + 1}. ${engine.cards.get(state.hand[i]).name} [hand ${i + 1}]`).join(' → ')));
                if (line.failed) el.append(node('p', `Wastes ${line.failed} card${line.failed === 1 ? '' : 's'} in failed steps. Open the steps before using this line.`, 'warn'));
                const steps = node('ol', undefined, 'steps');
                line.steps.forEach(step => {
                    const a = engine.cards.get(step.a), b = engine.cards.get(step.b), r = engine.cards.get(step.result), li = node('li');
                    const pics = node('div', undefined, 'step-pics'); pics.append(picture(a.id), node('span', '+'), picture(b.id), node('span', '→'), picture(r.id)); li.append(pics);
                    li.append(node('p', `${a.name} + ${b.name} → ${r.name} · ${r.atk}/${r.def} · ${r.stars.map(starName).join(' / ')}`));
                    if (!step.success) li.append(node('p', `FAILED FUSION. ${a.name} is discarded; ${b.name} remains.`, 'warn'));
                    steps.append(li);
                });
                const breakdown = node('details'); breakdown.open = lineIndex === 0;
                breakdown.append(node('summary', line.failed ? `Show steps · ${line.failed} FAILED` : 'Show fusion steps'), steps); el.append(breakdown);
                const star = document.createElement('select'); star.setAttribute('aria-label', `${c.name} star`);
                c.stars.forEach(s => star.add(new Option(starName(s), s)));
                star.value = c.stars.find(s => engine.stats(c.id, state.terrain, s, $('foe').value, $('direct').checked).battle) || c.stars[0];
                const summary = node('p', statsText(c.id, star.value)); star.onchange = () => { summary.textContent = statsText(c.id, star.value); };
                el.append(star, summary);
                const slot = document.createElement('select'); slot.setAttribute('aria-label', 'Record result in own slot');
                state.field.forEach((entry, i) => { if (!entry || i === line.slot) slot.add(new Option(`Own slot ${i + 1}`, String(i))); });
                if (line.slot !== null) { slot.value = String(line.slot); slot.disabled = true; }
                const use = button('Record this play', () => {
                    if (slot.value === '') return;
                    change(() => {
                        const used = new Set(line.order); state.hand = state.hand.filter((_, i) => !used.has(i)); state.field[Number(slot.value)] = { id: line.result, star: star.value };
                    }, 'Recorded here only. Your game was not changed.');
                    $('field-panel').open = true;
                });
                use.disabled = slot.options.length === 0;
                el.append(slot, use); $('results').append(el);
            });
            $('more').hidden = shown >= lines.length;
        }
        $('more').onclick = () => { shown += 20; drawLines(); };
        render(); status('Ready. Add your current hand.');
    } catch (error) { status(`Could not start: ${error.message}. Reload to try again.`); }
})();
