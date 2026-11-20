export const routines = {
  Push: [
    ['Chest press', 3, '8–12'], ['Incline chest press', 3, '8–12'],
    ['Shoulder press', 3, '8–12'], ['Lateral raises', 3, '12–15'],
    ['Pec deck', 3, '10–15'], ['Triceps pushdowns', 3, '10–15'],
  ],
  Pull: [
    ['Lat pulldown', 3, '8–12'], ['Seated row', 3, '8–12'],
    ['High row', 3, '10–12'], ['Reverse pec deck', 3, '12–15'],
    ['Machine biceps curl', 3, '10–15'], ['Cable hammer curl', 3, '10–15'],
  ],
  Legs: [
    ['Leg press', 3, '8–12'], ['Seated leg curl', 3, '10–15'],
    ['Leg extension', 3, '10–15'], ['Hip thrust', 3, '8–12'],
    ['Calf raises', 3, '12–15'], ['Abdominal crunches', 3, '12–20'],
  ],
};

export const focus = {
  Push: 'Chest, shoulders & triceps',
  Pull: 'Back & biceps',
  Legs: 'Lower body & abs',
};

export function dateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, '0')).join('-');
}

export const fromKey = key => new Date(key + 'T12:00:00');
export const formatDate = (key, options) => fromKey(key).toLocaleDateString(undefined, options);
export const modes = { log: 'On log', complete: 'On set complete', manual: 'Manual only' };
export const blank = { version: 1, days: {}, mode: 'log', seconds: 90 };
export const storageKey = 'strength-log:v1:' + import.meta.env.BASE_URL;
export const isLogged = set => Boolean(set?.reps);
export const countSets = session => Object.values(session.sets).filter(isLogged).length;
export const setKey = (exercise, index) => exercise + ':' + index;

export function validateBackup(data) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const validNumber = (value, pattern) => typeof value === 'string' &&
    (value === '' || (pattern.test(value) && Number.isFinite(Number(value))));
  if (!object(data) || data.version !== 1 || !object(data.days) ||
      !Object.hasOwn(modes, data.mode) || !Number.isInteger(data.seconds) ||
      data.seconds < 5 || data.seconds > 600) return false;
  return Object.entries(data.days).every(([date, day]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateKey(fromKey(date)) !== date ||
        !object(day) || !Object.hasOwn(routines, day.type) ||
        typeof day.completed !== 'boolean' || !object(day.sets)) return false;
    const keys = new Set(routines[day.type].flatMap(([name, count]) =>
      Array.from({ length: count }, (_, index) => setKey(name, index))));
    return Object.entries(day.sets).every(([key, set]) =>
      keys.has(key) && object(set) && typeof set.done === 'boolean' &&
      validNumber(set.weight, /^\d*(?:\.\d+)?$/) &&
      validNumber(set.reps, /^[1-9]\d*$/) && (!set.done || isLogged(set)));
  });
}

export function loadData() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return blank;
  const parsed = JSON.parse(saved);
  if (!validateBackup(parsed)) throw new Error('Invalid saved data');
  return parsed;
}
