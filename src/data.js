export const focus = { Push: 'Chest, shoulders & triceps', Pull: 'Back & biceps', Legs: 'Lower body & abs' };
const routine = rows => rows.map(([id, name, sets, reps]) => ({ id, name, sets, reps }));
export const routines = {
  Push: routine([
    ['Chest press', 'Machine Chest Press', 3, '8–12'], ['Incline chest press', 'Incline Chest Press', 3, '8–12'],
    ['Shoulder press', 'Machine Shoulder Press', 3, '8–12'], ['Lateral raises', 'Lateral Raise Machine', 3, '12–15'],
    ['Pec deck', 'Pec Deck', 2, '12–15'], ['Triceps pushdowns', 'Cable Triceps Pushdown', 3, '10–15'],
  ]),
  Pull: routine([
    ['Lat pulldown', 'Lat Pulldown', 3, '8–12'], ['Seated row', 'Seated Row Machine', 3, '8–12'],
    ['High row', 'High Row Machine', 3, '10–12'], ['Reverse pec deck', 'Reverse Pec Deck', 3, '12–15'],
    ['Machine biceps curl', 'Machine Biceps Curl', 3, '10–12'], ['Cable hammer curl', 'Cable Hammer Curl', 2, '12–15'],
  ]),
  Legs: routine([
    ['Leg press', 'Leg Press', 3, '8–12'], ['Seated leg curl', 'Seated Leg Curl', 3, '10–15'],
    ['Leg extension', 'Leg Extension', 3, '10–15'], ['Hip thrust', 'Hip Thrust Machine', 3, '10–12'],
    ['Calf raises', 'Calf Raise Machine', 3, '12–15'], ['Abdominal crunches', 'Abdominal Crunch Machine', 3, '12–15'],
  ]),
};
export const resistanceTypes = { weight: 'Weight (lb)', level: 'Machine level', bodyweight: 'Bodyweight', reps: 'Reps only' };
export const difficulties = { easy: ['⌃⌃', 'Easy'], moderate: ['−', 'Moderate'], hard: ['△', 'Hard'] };
export function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
}
export const fromKey = key => new Date(key + 'T12:00:00');
export const formatDate = (key, options = { month: 'short', day: 'numeric' }) => fromKey(key).toLocaleDateString(undefined, options);
export const storageKey = 'strength-log:v1:' + (import.meta.env?.BASE_URL || '/strength-log/');
export const setKey = (id, index) => id + ':' + index;
export const blank = () => ({ version: 2, days: {}, templates: structuredClone(routines), preferences: {}, showDifficulty: true, notes: [], noteDraft: { category: 'Idea', text: '', context: '' } });
export const isLogged = s => Boolean(s && /^[1-9]\d*$/.test(s.reps));
export const countSets = day => Object.values(day?.sets || {}).filter(isLogged).length;
export const doneSets = day => Object.values(day?.sets || {}).filter(s => s.done && isLogged(s)).length;
export const totalSets = day => (day?.exercises || []).reduce((sum, e) => sum + e.sets, 0);
export const trainingSets = day => Object.values(day.sets).filter(s => isLogged(s) && (day.completed || s.done));
export const volume = day => trainingSets(day).reduce((sum, s) => sum + (s.resistance === 'weight' ? Number(s.weight || 0) * Number(s.reps) : 0), 0);
export function performance(s) {
  if (!isLogged(s)) return '—';
  const r = s.resistance || 'weight';
  const prefix = r === 'level' ? (s.weight ? 'Level ' + s.weight + ' × ' : '') : r === 'weight' ? (s.weight ? s.weight + ' lb × ' : '') : r === 'bodyweight' ? 'Bodyweight × ' : '';
  return prefix + s.reps + (r === 'reps' || !prefix ? ' reps' : '') + (s.difficulty ? ' · ' + difficulties[s.difficulty][1] : '');
}
export function previousWorkout(data, date, id) {
  return Object.entries(data.days).filter(([d, day]) => d < date && day.completed &&
    Object.entries(day.sets).some(([key, s]) => key.startsWith(id + ':') && isLogged(s)))
    .sort(([a], [b]) => b.localeCompare(a))[0];
}
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const number = (v, integer = false) => typeof v === 'string' && (v === '' || ((integer ? /^[1-9]\d*$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/).test(v) && Number.isFinite(Number(v))));
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && dateKey(fromKey(d)) === d;
const validExercise = e => object(e) && typeof e.id === 'string' && e.id.length > 0 && e.id.length < 200 && typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length < 200 && Number.isInteger(e.sets) && e.sets > 0 && e.sets <= 50 && typeof e.reps === 'string' && e.reps.length < 80;
const validExercises = es => Array.isArray(es) && es.length > 0 && es.length <= 100 && es.every(validExercise) && new Set(es.map(e => e.id)).size === es.length;
export function validateBackup(data) {
  if (!object(data) || ![1, 2].includes(data.version) || !object(data.days)) return false;
  if (data.version === 1 && (!['log', 'complete', 'manual'].includes(data.mode) || !Number.isInteger(data.seconds) || data.seconds < 5 || data.seconds > 600)) return false;
  if (data.version === 2 && (!object(data.templates) || !Object.keys(routines).every(t => validExercises(data.templates[t])) ||
    !object(data.preferences) || !Object.values(data.preferences).every(v => Object.hasOwn(resistanceTypes, v)) || typeof data.showDifficulty !== 'boolean' ||
    !Array.isArray(data.notes) || !data.notes.every(n => object(n) && typeof n.id === 'string' && ['Bug', 'Improvement', 'Idea'].includes(n.category) && typeof n.text === 'string' && typeof n.context === 'string' && typeof n.createdAt === 'string' && Number.isFinite(Date.parse(n.createdAt))) ||
    (data.noteDraft !== undefined && (!object(data.noteDraft) || !['Bug', 'Improvement', 'Idea'].includes(data.noteDraft.category) || typeof data.noteDraft.text !== 'string' || typeof data.noteDraft.context !== 'string')))) return false;
  return Object.entries(data.days).every(([date, day]) => {
    if (!validDate(date) || !object(day) || ![...Object.keys(routines), 'Rest'].includes(day.type) || typeof day.completed !== 'boolean' || !object(day.sets)) return false;
    if (data.version === 1 && day.type === 'Rest') return false;
    if (data.version === 2 && (day.type === 'Rest' ? !Array.isArray(day.exercises) || day.exercises.length !== 0 || Object.keys(day.sets).length !== 0 : !validExercises(day.exercises))) return false;
    const es = data.version === 1 ? routines[day.type].map(e => ({ ...e, sets: 3 })) : day.exercises;
    const keys = new Set(es.flatMap(e => Array.from({ length: e.sets }, (_, i) => setKey(e.id, i))));
    return Object.entries(day.sets).every(([key, s]) => keys.has(key) && object(s) && typeof s.done === 'boolean' && number(s.weight) && number(s.reps, true) && (!s.done || isLogged(s)) &&
      (data.version === 1 || (Object.hasOwn(resistanceTypes, s.resistance) && (!s.difficulty || Object.hasOwn(difficulties, s.difficulty)) && (s.resistance !== 'level' || number(s.weight, true)))));
  });
}
export function migrate(data) {
  if (!validateBackup(data)) throw new Error('Invalid backup');
  if (data.version === 2) return { ...data, noteDraft: data.noteDraft || blank().noteDraft };
  const next = blank();
  for (const [date, day] of Object.entries(data.days)) {
    next.days[date] = { ...day, exercises: routines[day.type].map(e => ({ ...e, sets: 3 })), sets: Object.fromEntries(Object.entries(day.sets).map(([key, s]) => [key, { ...s, resistance: 'weight' }])) };
  }
  return next;
}
export function loadData() {
  const saved = localStorage.getItem(storageKey);
  return saved ? migrate(JSON.parse(saved)) : blank();
}
export function weekDates(date) {
  const d = fromKey(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(x.getDate() + i); return dateKey(x); });
}

