// Dobieranie treningów z bazy i generowanie nowych na podstawie kryteriów.
// Kryteria: { style, format, duration, level (1-3), focus, equipment: [] }

export const STYLES = { any: 'Dowolny', crossfit: 'CrossFit', hyrox: 'Hyrox', hybrid: 'Hybryda' };
export const FORMATS = {
  any: 'Dowolny', amrap: 'AMRAP', emom: 'EMOM', for_time: 'For Time', chipper: 'Chipper',
  intervals: 'Interwały', strength: 'Siła + metcon',
};
export const LEVELS = { 1: 'Początkujący', 2: 'Średni', 3: 'Zaawansowany' };
export const FOCUS = {
  full: 'Całe ciało', engine: 'Kondycja', strength: 'Siła', gymnastics: 'Gimnastyka', legs: 'Nogi', upper: 'Góra ciała',
};
const FOCUS_PATTERNS = {
  full: ['squat', 'hinge', 'push', 'pull', 'full', 'mono', 'olympic', 'lunge', 'core', 'jump', 'carry'],
  engine: ['mono', 'full', 'jump'],
  strength: ['hinge', 'squat', 'olympic', 'push'],
  gymnastics: ['pull', 'push', 'core'],
  legs: ['squat', 'lunge', 'hinge', 'jump', 'sled'],
  upper: ['push', 'pull', 'core'],
};

let M = {}; // id -> ruch

export function setMovements(list) {
  M = Object.fromEntries(list.map((m) => [m.id, m]));
}
export const movement = (id) => M[id];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LEVEL_MULT = { 1: 0.7, 2: 1, 3: 1.3 };

function nice(n, unit) {
  if (unit === 'm') return n >= 200 ? Math.round(n / 50) * 50 : Math.max(10, Math.round(n / 5) * 5);
  if (n >= 30) return Math.round(n / 5) * 5;
  if (n >= 12) return Math.round(n / 2) * 2;
  return Math.max(3, Math.round(n));
}

const available = (m, eq) => m.eq.length === 0 || m.eq.some((e) => eq.includes(e));

// Pozycja treningu: ruch + ilość (powtórzenia/kalorie/metry) + obciążenie dla poziomu.
function item(m, level, factor = 1) {
  const qty = nice(m.base * LEVEL_MULT[level] * factor, m.unit);
  const it = { mv: m.id };
  if (m.unit === 'cal') it.cal = `${qty}/${nice(qty * 0.8, 'cal')}`;
  else if (m.unit === 'm') it.m = qty;
  else it.reps = qty;
  if (m.load) it.load = m.load[level];
  return it;
}

// Wybiera `count` ruchów z różnych wzorców, preferując fokus.
function pick(pool, count, focus, { maxMono = 1, require = [] } = {}) {
  const want = FOCUS_PATTERNS[focus] || FOCUS_PATTERNS.full;
  const scored = shuffle(pool).map((m) => ({ m, s: (want.includes(m.pattern) ? 2 : 0) + Math.random() * 1.5 }))
    .sort((a, b) => b.s - a.s).map((x) => x.m);
  const out = [];
  const used = new Set();
  let mono = 0;
  for (const pat of require) {
    const m = scored.find((x) => x.pattern === pat && !out.includes(x));
    if (m) { out.push(m); used.add(m.pattern); if (m.pattern === 'mono') mono++; }
  }
  for (const m of scored) {
    if (out.length >= count) break;
    if (out.includes(m) || used.has(m.pattern)) continue;
    if (m.pattern === 'mono' && mono >= maxMono) continue;
    out.push(m); used.add(m.pattern);
    if (m.pattern === 'mono') mono++;
  }
  // Za mało różnych wzorców przy małej ilości sprzętu – dobierz cokolwiek.
  for (const m of scored) { if (out.length >= count) break; if (!out.includes(m)) out.push(m); }
  // Cardio na początek rundy.
  return out.sort((a, b) => (b.pattern === 'mono') - (a.pattern === 'mono'));
}

function pool(c, { hyroxOnly = false } = {}) {
  return Object.values(M).filter((m) => available(m, c.equipment) && m.level <= c.level && (!hyroxOnly || m.hyrox));
}

// ---------- Szablony CrossFit / hybryda ----------
function genAmrap(c, p, minutes = c.duration) {
  const n = minutes <= 12 ? 3 : 4;
  const mv = pick(p, n, c.focus);
  return { title: `AMRAP ${minutes} min`, format: 'amrap', minutes, items: mv.map((m) => item(m, c.level)) };
}

function genEmom(c, p, minutes = c.duration) {
  const n = minutes % 4 === 0 && minutes >= 16 ? 4 : 3;
  const mv = pick(p, n, c.focus);
  const fit = Math.floor(minutes / n) * n;
  return {
    title: `EMOM ${fit} min`, format: 'emom', minutes: fit,
    notes: `Co minutę kolejna stacja, ${fit / n} rund. Praca ~40 s, reszta odpoczynek.`,
    items: mv.map((m) => item(m, c.level, 0.75)),
  };
}

function genForTime(c, p, minutes = c.duration) {
  if (minutes <= 10) {
    const mv = pick(p, 2, c.focus, { maxMono: 0 });
    const scheme = c.level === 1 ? '15-12-9' : c.level === 3 ? '21-15-9' : '18-14-10';
    return { title: `${scheme} na czas (limit ${minutes} min)`, format: 'for_time', scheme, minutes, items: mv.map((m) => ({ mv: m.id, load: m.load?.[c.level] })) };
  }
  const rounds = clamp(Math.round(minutes / 4.5), 3, 6);
  const mv = pick(p, 3, c.focus);
  return { title: `${rounds} rund na czas (limit ${minutes} min)`, format: 'for_time', rounds, minutes, items: mv.map((m) => item(m, c.level)) };
}

function genChipper(c, p, minutes = c.duration) {
  const n = clamp(Math.round(minutes / 5), 5, 8);
  const mv = pick(p, n, c.focus, { maxMono: 2 });
  const factor = (minutes / n) / 2.2;
  return { title: `Chipper na czas (limit ${minutes} min)`, format: 'for_time', minutes, notes: 'Lista od góry do dołu, bez wracania.', items: mv.map((m) => item(m, c.level, factor)) };
}

function genIntervals(c, p, minutes = c.duration) {
  const work = minutes >= 30 ? 4 : 3;
  const rounds = clamp(Math.floor(minutes / (work + 1)), 3, 8);
  const mv = pick(p, 3, c.focus, { require: p.some((m) => m.pattern === 'mono') ? ['mono'] : [] });
  return {
    title: `${rounds} × (${work} min pracy / 1 min przerwy)`, format: 'intervals', rounds, minutes: rounds * (work + 1),
    notes: 'W każdym okienku AMRAP poniższej rundy. Wynik: suma rund.',
    items: mv.map((m) => item(m, c.level, 0.6)),
  };
}

function genStrength(c, p) {
  const heavy = p.filter((m) => ['squat', 'hinge', 'olympic', 'push'].includes(m.pattern) && m.load && m.unit === 'reps');
  const parts = [];
  let rest = c.duration;
  if (heavy.length) {
    const bar = heavy.filter((m) => m.eq.includes('barbell') && c.equipment.includes('barbell'));
    const base = bar.length ? bar : heavy;
    const pref = base.filter((m) => FOCUS_PATTERNS[c.focus]?.includes(m.pattern));
    const lift = rand(pref.length ? pref : base);
    const sMin = clamp(Math.round(c.duration * 0.45), 10, 25);
    const scheme = rand(c.level === 1 ? ['5×5 (technika, umiarkowanie)', '4×8'] : ['5×5', '5-5-3-3-1-1', 'EMOM 10 min × 2 powt.', '6×3']);
    parts.push({ title: `A. ${lift.name} – ${scheme}`, format: 'strength', minutes: sMin, notes: 'Narastająco do ciężkiej serii z dobrą techniką. Przerwy 2–3 min.', items: [{ mv: lift.id }] });
    rest -= sMin + 3;
    p = p.filter((m) => m !== lift);
  }
  const metcon = rest <= 12 ? genAmrap(c, p, Math.max(6, rest)) : rand([genAmrap, genForTime, genEmom])(c, p, rest);
  metcon.title = (parts.length ? 'B. ' : '') + metcon.title;
  parts.push(metcon);
  return parts;
}

// ---------- Szablony Hyrox ----------
const HYROX_ORDER = [
  { id: 'ski', full: 1000, unit: 'm', sub: ['row', 'bike', 'burpee'] },
  { id: 'sled_push', full: 50, unit: 'm', sub: ['db_lunge', 'lunge'] },
  { id: 'sled_pull', full: 50, unit: 'm', sub: ['db_row', 'ring_row', 'pullup'] },
  { id: 'bbj', full: 80, unit: 'm', sub: ['burpee'] },
  { id: 'row', full: 1000, unit: 'm', sub: ['ski', 'bike', 'burpee'] },
  { id: 'farmers', full: 200, unit: 'm', sub: ['kb_swing', 'deadlift'] },
  { id: 'sandbag_lunge', full: 100, unit: 'm', sub: ['db_lunge', 'lunge'] },
  { id: 'wall_ball', full: 100, unit: 'reps', sub: ['thruster', 'air_squat'] },
];

// used: ruchy już wykorzystane w tym treningu – zamienniki się nie powtarzają.
function station(st, frac, c, used = new Set()) {
  const ok = (m) => m && available(m, c.equipment) && m.level <= c.level && !used.has(m.id);
  const pick1 = [st.id, ...st.sub, 'burpee', 'air_squat', 'lunge', 'situp', 'pushup'].map((id) => M[id]).find(ok);
  if (!pick1) return null;
  used.add(pick1.id);
  const it = { mv: pick1.id };
  if (pick1.id === st.id) {
    const q = nice(st.full * frac, st.unit === 'm' ? 'm' : 'reps');
    if (st.unit === 'm') it.m = q; else it.reps = q;
  } else {
    Object.assign(it, item(pick1, c.level, 1.2));
    it.note = `zamiast: ${M[st.id].name}`;
  }
  if (pick1.load) it.load = pick1.load[c.level];
  if (pick1.id === 'wall_ball') it.load = c.level === 1 ? '4/3 kg' : '6/4 kg';
  return it;
}

function runItem(c, meters) {
  if (c.equipment.includes('run')) return { mv: 'run', m: meters };
  const alt = ['rower', 'skierg', 'bike'].find((e) => c.equipment.includes(e));
  const mv = { rower: 'row', skierg: 'ski', bike: 'bike' }[alt];
  if (!mv) return { mv: 'burpee', reps: Math.round(meters / 40), note: 'zamiast biegu' };
  return mv === 'bike' ? { mv, cal: `${Math.round(meters / 30)}`, note: 'zamiast biegu' } : { mv, m: meters, note: 'zamiast biegu' };
}

function genHyrox(c) {
  const f = c.format === 'any' ? rand(['for_time', 'intervals', 'emom']) : c.format;
  const run = c.level === 1 ? 400 : c.level === 3 ? 1000 : 600;
  if (f === 'emom' || f === 'amrap') {
    const p = pool(c, { hyroxOnly: true }).filter((m) => m.id !== 'run');
    const part = f === 'emom' ? genEmom(c, p.length >= 3 ? p : pool(c)) : genAmrap(c, p.length >= 3 ? p : pool(c));
    if (c.equipment.includes('run')) part.notes = `${part.notes ? part.notes + ' ' : ''}Co 2 rundy dodaj ${run / 2} m biegu.`;
    return { format: f, parts: [part] };
  }
  if (f === 'intervals' || f === 'chipper' || f === 'strength') {
    const rounds = clamp(Math.round(c.duration / 6), 3, 8);
    const runIt = runItem(c, run);
    const used = new Set([runIt.mv]);
    const sts = shuffle(HYROX_ORDER).map((s) => station(s, 0.25, c, used)).filter(Boolean).slice(0, 2);
    return {
      format: 'intervals',
      parts: [{ title: `${rounds} rund, 1 min przerwy między rundami`, format: 'intervals', rounds, minutes: c.duration, notes: 'Bieg pod zmęczeniem – trzymaj tempo zawodów.', items: [runIt, ...sts] }],
    };
  }
  // Symulacja (for time): bieg + stacje w kolejności zawodów, dystanse skalowane do czasu.
  const frac = clamp(c.duration / 90, 0.2, 1) * LEVEL_MULT[c.level];
  const runM = nice(1000 * clamp(c.duration / 80, 0.25, 1), 'm');
  const n = clamp(Math.round(c.duration / 6), 4, 8);
  const order = n >= 8 ? HYROX_ORDER : HYROX_ORDER.filter((_, i) => i % Math.ceil(8 / n) === 0 || i === 7).slice(0, n);
  const used = new Set();
  const items = order.map((s) => station(s, frac, c, used)).filter(Boolean);
  return {
    format: 'for_time',
    parts: [{ title: `${items.length} rund na czas (limit ${c.duration} min)`, format: 'for_time', minutes: c.duration, notes: `Każda runda: ${runItem(c, runM).mv === 'run' ? `${runM} m biegu` : 'odcinek cardio zamiast biegu'}, potem stacja.`, items }],
  };
}

// ---------- Główne funkcje ----------
const NAMES_A = ['Stalowe', 'Szybkie', 'Ciężkie', 'Równe', 'Gęste', 'Ostre', 'Długie', 'Gorące'];
const NAMES_B = ['tempo', 'płuca', 'nogi', 'schody', 'okienka', 'kółko', 'pół godziny', 'koło'];

export function generate(c) {
  c = { ...c, level: Number(c.level), duration: Number(c.duration) };
  const style = c.style === 'any' ? rand(['crossfit', 'hyrox', 'hybrid']) : c.style;
  let format = c.format;
  let parts;
  if (style === 'hyrox') {
    ({ format, parts } = genHyrox(c));
  } else {
    const p = pool(c);
    if (format === 'any') {
      const opts = ['amrap', 'emom', 'for_time', 'intervals'];
      if (c.duration >= 25) opts.push('chipper');
      if (c.duration >= 30 || style === 'hybrid') opts.push('strength');
      format = rand(opts);
    }
    if (format === 'strength') parts = genStrength(c, p);
    else parts = [{ amrap: genAmrap, emom: genEmom, for_time: genForTime, chipper: genChipper, intervals: genIntervals }[format](c, p)];
  }
  const eq = new Set();
  parts.forEach((pt) => pt.items.forEach((it) => (M[it.mv]?.eq || []).filter((e) => c.equipment.includes(e)).slice(0, 1).forEach((e) => eq.add(e))));
  return {
    id: `gen-${Date.now()}`,
    name: `${rand(NAMES_A)} ${rand(NAMES_B)}`,
    source: 'wygenerowany',
    style, format, duration_min: c.duration, level: c.level,
    focus: [c.focus], equipment: [...eq],
    description: '',
    parts,
    scaling: c.level === 1 ? 'Skaluj dowolnie: mniej powtórzeń, lżej, krótsze dystanse. Liczy się technika.' : '',
    tags: [],
  };
}

// Dopasowanie treningów z bazy: zwraca listę [{ w, score, reasons }] posortowaną malejąco.
export function match(workouts, c) {
  const level = Number(c.level);
  const dur = Number(c.duration);
  return workouts.map((w) => {
    // Pozycja sprzętu może mieć zamienniki: "rower|skierg|bike" = wystarczy jeden z nich.
    if (!w.equipment.every((e) => e.split('|').some((x) => c.equipment.includes(x)))) return null;
    if (c.style !== 'any' && w.style !== c.style) return null;
    let score = 0;
    const reasons = [];
    const diff = Math.abs(w.duration_min - dur) / dur;
    if (diff > 0.6) return null;
    score += 3 * (1 - diff);
    if (c.format !== 'any') { if (w.format === c.format) { score += 3; reasons.push('format'); } else score -= 2; }
    const ld = Math.abs(w.level - level);
    score += ld === 0 ? 2 : ld === 1 ? 0 : -3;
    if (ld === 1) reasons.push(w.level > level ? 'do zeskalowania' : 'łatwiejszy');
    if (w.focus.includes(c.focus)) { score += 2; reasons.push('fokus'); }
    return { w, score, reasons };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}
