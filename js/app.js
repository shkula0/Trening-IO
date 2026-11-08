import { STYLES, FORMATS, LEVELS, FOCUS, setMovements, movement, generate, match } from './generator.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* tryb prywatny */ } },
};

const state = {
  tab: 'pick',
  workouts: [],
  equipmentNames: {},
  criteria: store.get('criteria', {
    style: 'any', format: 'any', duration: 20, level: 2, focus: 'full',
    equipment: ['run', 'rower', 'kettlebell', 'dumbbell', 'box', 'wallball', 'pullup_bar', 'rope'],
  }),
  results: null,
  generated: null,
  saved: store.get('saved', []),
  query: '',
  open: null,
};

// ---------- Formatowanie ----------
function qty(it) {
  if (it.reps != null) return `${it.reps}`;
  if (it.cal != null) return `${it.cal} kal`;
  if (it.m != null) return `${it.m} m`;
  if (it.sec != null) return `${it.sec} s`;
  return '';
}
function itemText(it) {
  const name = it.mv ? (movement(it.mv)?.name ?? it.mv) : it.text;
  return [qty(it), name].filter(Boolean).join(' ') + (it.load ? ` (${it.load})` : '') + (it.note ? ` – ${it.note}` : '');
}
const metaLine = (w) => [STYLES[w.style], FORMATS[w.format] ?? w.format, `${w.duration_min} min`, LEVELS[w.level]].filter(Boolean).join(' · ');

export function toText(w) {
  const lines = [`${w.name}`, metaLine(w)];
  if (w.description) lines.push(w.description);
  for (const p of w.parts) {
    lines.push('', p.title + (p.scheme && !p.title.includes(p.scheme) ? ` (${p.scheme})` : ''));
    if (p.notes) lines.push(p.notes);
    p.items.forEach((it) => lines.push(`• ${itemText(it)}`));
  }
  if (w.scaling) lines.push('', `Skalowanie: ${w.scaling}`);
  return lines.join('\n');
}

// ---------- Widoki ----------
function chips(name, options, value, multi = false) {
  return `<div class="chips" data-name="${name}" ${multi ? 'data-multi' : ''}>${Object.entries(options).map(([k, label]) => {
    const on = multi ? value.includes(k) : String(value) === String(k);
    return `<button type="button" class="chip${on ? ' on' : ''}" data-value="${k}">${esc(label)}</button>`;
  }).join('')}</div>`;
}

function card(w, extra = '') {
  const items = w.parts.flatMap((p) => p.items).slice(0, 4).map((it) => esc(movement(it.mv)?.name ?? it.text)).join(', ');
  return `<button class="card" data-open="${esc(w.id)}">
    <div class="card-top"><strong>${esc(w.name)}</strong>${extra}</div>
    <div class="meta">${esc(metaLine(w))}</div>
    <div class="moves">${items}</div>
  </button>`;
}

function viewPick() {
  const c = state.criteria;
  let html = `<form id="criteria" class="panel">
    <label>Styl</label>${chips('style', STYLES, c.style)}
    <label>Format</label>${chips('format', FORMATS, c.format)}
    <label>Czas: <b id="durVal">${c.duration} min</b></label>
    <input type="range" name="duration" min="6" max="90" step="2" value="${c.duration}">
    <label>Poziom</label>${chips('level', LEVELS, c.level)}
    <label>Fokus</label>${chips('focus', FOCUS, c.focus)}
    <label>Sprzęt <span class="links"><a href="#" data-eq="all">wszystko</a> · <a href="#" data-eq="none">nic</a></span></label>
    ${chips('equipment', state.equipmentNames, c.equipment, true)}
    <button class="primary" type="submit">Pokaż treningi</button>
  </form>`;
  if (state.results) {
    html += `<section id="results"><h2>Nowy trening <small>dedukcja z kryteriów</small></h2>
      ${card(state.generated, '<span class="badge new">nowy</span>')}
      <button class="ghost" data-action="regen">↻ Wygeneruj inny</button>
      <h2>Z Twojej bazy <small>${state.results.length}</small></h2>
      ${state.results.length ? state.results.slice(0, 15).map((r) => card(r.w, r.reasons.length ? `<span class="badge">${esc(r.reasons.join(', '))}</span>` : '')).join('')
        : '<p class="empty">Nic z bazy nie pasuje do tych kryteriów. Poluzuj czas, styl albo dodaj sprzęt.</p>'}
    </section>`;
  }
  return html;
}

function viewBase() {
  const q = state.query.toLowerCase();
  const list = state.workouts.filter((w) => !q || toText(w).toLowerCase().includes(q) || (w.tags || []).some((t) => t.includes(q)));
  return `<div class="panel"><input type="search" id="search" placeholder="Szukaj: nazwa, ruch, tag…" value="${esc(state.query)}"></div>
    <p class="count">${list.length} z ${state.workouts.length} treningów</p>
    ${list.map((w) => card(w)).join('')}`;
}

function viewSaved() {
  if (!state.saved.length) return '<p class="empty">Nie masz jeszcze zapisanych treningów. Otwórz trening i stuknij ☆ Zapisz.</p>';
  return state.saved.slice().reverse().map((w) => card(w)).join('');
}

function viewDetail(w) {
  const isSaved = state.saved.some((s) => s.id === w.id);
  return `<div class="detail">
    <div class="detail-bar"><button class="ghost" data-action="close">← Wróć</button>
      <span><button class="ghost" data-action="save">${isSaved ? '★ Zapisany' : '☆ Zapisz'}</button>
      <button class="ghost" data-action="share">Udostępnij</button></span></div>
    <h1>${esc(w.name)}</h1>
    <div class="meta">${esc(metaLine(w))}${w.source ? ` · <i>${esc(w.source)}</i>` : ''}</div>
    ${w.description ? `<p>${esc(w.description)}</p>` : ''}
    ${w.parts.map((p) => `<div class="part">
      <h3>${esc(p.title)}</h3>
      ${p.scheme && !p.title.includes(p.scheme) ? `<div class="meta">${esc(p.scheme)}</div>` : ''}
      ${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}
      <ul>${p.items.map((it) => `<li>${esc(itemText(it))}</li>`).join('')}</ul>
    </div>`).join('')}
    ${w.scaling ? `<p class="notes"><b>Skalowanie:</b> ${esc(w.scaling)}</p>` : ''}
    ${w.equipment?.length ? `<p class="meta">Sprzęt: ${esc(w.equipment.map((e) => state.equipmentNames[e] ?? e).join(', '))}</p>` : ''}
  </div>`;
}

function render() {
  const main = $('#main');
  main.innerHTML = state.open ? viewDetail(state.open)
    : state.tab === 'pick' ? viewPick() : state.tab === 'base' ? viewBase() : viewSaved();
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab && !state.open));
}

// ---------- Akcje ----------
function find(id) {
  return [state.generated, ...state.workouts, ...state.saved].find((w) => w && w.id === id);
}

function run() {
  state.generated = generate(state.criteria);
  state.results = match(state.workouts, state.criteria);
  render();
  $('#results')?.scrollIntoView({ behavior: 'smooth' });
}

async function share(w) {
  const text = toText(w);
  if (navigator.share) {
    try { await navigator.share({ title: w.name, text }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); toast('Skopiowano do schowka'); } catch { toast('Nie udało się skopiować'); }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2000);
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) {
    const group = chip.parentElement;
    const name = group.dataset.name;
    if ('multi' in group.dataset) {
      chip.classList.toggle('on');
      state.criteria[name] = [...group.querySelectorAll('.on')].map((b) => b.dataset.value);
    } else {
      group.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b === chip));
      state.criteria[name] = name === 'level' ? Number(chip.dataset.value) : chip.dataset.value;
    }
    store.set('criteria', state.criteria);
    return;
  }
  const eqLink = e.target.closest('[data-eq]');
  if (eqLink) {
    e.preventDefault();
    state.criteria.equipment = eqLink.dataset.eq === 'all' ? Object.keys(state.equipmentNames) : [];
    store.set('criteria', state.criteria);
    render();
    return;
  }
  const tab = e.target.closest('nav button');
  if (tab) { state.tab = tab.dataset.tab; state.open = null; render(); window.scrollTo(0, 0); return; }
  const open = e.target.closest('[data-open]');
  if (open) { state.open = find(open.dataset.open); state.scroll = window.scrollY; render(); window.scrollTo(0, 0); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'close') { state.open = null; render(); window.scrollTo(0, state.scroll || 0); }
  if (action === 'regen') { state.generated = generate(state.criteria); render(); $('#results')?.scrollIntoView(); }
  if (action === 'share') share(state.open);
  if (action === 'save') {
    const w = state.open;
    const i = state.saved.findIndex((s) => s.id === w.id);
    if (i >= 0) state.saved.splice(i, 1); else state.saved.push(w);
    store.set('saved', state.saved);
    render();
  }
});

document.addEventListener('submit', (e) => { e.preventDefault(); run(); });
document.addEventListener('input', (e) => {
  if (e.target.name === 'duration') {
    state.criteria.duration = Number(e.target.value);
    $('#durVal').textContent = `${e.target.value} min`;
    store.set('criteria', state.criteria);
  }
  if (e.target.id === 'search') {
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos);
  }
});

// ---------- Start ----------
async function init() {
  // Wersja jednoplikowa (podgląd) ma dane wbudowane w window.TRENING_DATA.
  const load = (path) => window.TRENING_DATA?.[path] ?? fetch(path).then((r) => r.json());
  const [mv, wk] = await Promise.all([load('data/movements.json'), load('data/workouts.json')]);
  setMovements(mv.movements);
  state.equipmentNames = mv.equipment;
  state.workouts = wk.workouts;
  render();
}

init().catch((err) => { $('#main').innerHTML = `<p class="empty">Nie udało się wczytać danych: ${esc(err.message)}</p>`; });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
