import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, migrate, validateBackup, volume, previousWorkout, routines, performance, weekDates, doneSets, loadData, storageKey } from '../src/data.js';
const legacy = () => ({ version: 1, days: { '2026-11-18': { type: 'Push', completed: true, sets: {
  'Chest press:0': { weight: '90', reps: '12', done: true },
  'Pec deck:2': { weight: '75', reps: '10', done: false },
} } }, mode: 'log', seconds: 90 });
test('v1 migration preserves every set, legacy third sets and stable exercise identity', () => {
  const old = legacy(), snapshot = JSON.stringify(old), next = migrate(old);
  assert.equal(JSON.stringify(old), snapshot);
  assert.equal(next.version, 2);
  assert.equal(next.days['2026-11-18'].sets['Pec deck:2'].weight, '75');
  assert.equal(next.days['2026-11-18'].exercises.find(e => e.id === 'Pec deck').sets, 3);
  assert.equal(next.templates.Push.find(e => e.id === 'Pec deck').sets, 2);
  assert.equal(next.days['2026-11-18'].sets['Chest press:0'].resistance, 'weight');
  assert.equal(validateBackup(next), true);
  assert.equal(volume(next.days['2026-11-18']), 1830);
  assert.equal('seconds' in next, false);
});
test('v2 backups round-trip schedule, resistance, ratings, routines, notes and draft', () => {
  const data = blank();
  data.templates.Push[0].name = 'Custom chest machine';
  data.preferences['Chest press'] = 'level';
  data.showDifficulty = false;
  data.days['2026-11-21'] = { type: 'Push', completed: false, exercises: structuredClone(data.templates.Push), sets: {
    'Chest press:0': { weight: '7', reps: '12', done: true, resistance: 'level', difficulty: 'moderate' }
  } };
  data.days['2026-11-22'] = { type: 'Rest', completed: false, exercises: [], sets: {} };
  data.notes.push({ id: 'test', category: 'Bug', text: 'Synthetic test feedback', context: 'exercise', createdAt: '2026-11-21T15:00:00Z' });
  data.noteDraft.text = 'Draft';
  assert.equal(validateBackup(data), true);
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(data))), data);
  assert.equal(doneSets(data.days['2026-11-21']), 1);
  assert.equal(volume(data.days['2026-11-21']), 0);
});
test('numbered levels, bodyweight and reps-only never become weight volume', () => {
  const day = { completed: true, sets: {
    a: { weight: '100', reps: '10', resistance: 'weight', done: false },
    b: { weight: '7', reps: '12', resistance: 'level', done: true },
    c: { weight: '175', reps: '12', resistance: 'bodyweight', done: true },
    d: { weight: '20', reps: '12', resistance: 'reps', done: true },
  } };
  assert.equal(volume(day), 1000);
  day.completed = false;
  assert.equal(volume(day), 0);
  day.sets.a.done = true;
  assert.equal(volume(day), 1000);
});
test('comparison uses latest completed workout containing exercise across routine types', () => {
  const data = migrate(legacy());
  data.days['2026-11-19'] = { ...structuredClone(data.days['2026-11-18']), type: 'Pull', completed: true };
  data.days['2026-11-20'] = { ...structuredClone(data.days['2026-11-18']), completed: false };
  data.days['2026-11-21'] = { ...structuredClone(data.days['2026-11-18']), completed: true };
  assert.equal(previousWorkout(data, '2026-11-21', 'Chest press')[0], '2026-11-19');
  assert.equal(previousWorkout(data, '2026-11-17', 'Chest press'), undefined);
  assert.equal(previousWorkout(data, '2026-11-21', 'Not present'), undefined);
  assert.equal(performance({ weight: '7', reps: '12', resistance: 'level', difficulty: 'moderate' }), 'Level 7 × 12 · Moderate');
});
test('validation rejects malformed data without mutating its source', () => {
  for (const mutate of [
    d => { d.days['2026-02-30'] = { type: 'Rest', completed: false, sets: {}, exercises: [] }; },
    d => { d.templates.Push[0].sets = 0; },
    d => { d.preferences.machine = 'pounds-levels'; },
    d => { d.notes = [{}]; },
    d => { d.days['2026-11-18'] = { type: 'Push', completed: false, exercises: routines.Push, sets: { 'Chest press:0': { weight: '7.5', reps: '12', resistance: 'level', done: true } } }; },
    d => { d.days['2026-11-18'] = { type: 'Push', completed: false, exercises: routines.Push, sets: { 'bogus:0': { weight: '', reps: '', resistance: 'weight', done: false } } }; },
  ]) { const data = blank(); mutate(data); assert.equal(validateBackup(data), false); assert.throws(() => migrate(data)); }
});
test('partial decimal input and optional difficulty clear survive backup validation', () => {
  const data = blank();
  data.days['2026-11-21'] = { type: 'Push', completed: false, exercises: data.templates.Push, sets: {
    'Chest press:0': { weight: '7.', reps: '', done: false, resistance: 'weight', difficulty: null }
  } };
  assert.equal(validateBackup(data), true);
});
test('week calculation uses local Monday-to-Sunday dates over year boundaries', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});
test('storage key remains unchanged and unreadable data is never overwritten during load', () => {
  assert.equal(storageKey, 'strength-log:v1:/strength-log/');
  const raw = '{invalid';
  globalThis.localStorage = { getItem: () => raw, setItem: () => assert.fail('load must never overwrite storage') };
  assert.throws(loadData);
  globalThis.localStorage = { getItem: () => JSON.stringify(legacy()) };
  assert.equal(loadData().version, 2);
  delete globalThis.localStorage;
});
test('new routines match requested starting sets', () => {
  assert.equal(routines.Push.reduce((n, e) => n + e.sets, 0), 17);
  assert.equal(routines.Pull.reduce((n, e) => n + e.sets, 0), 17);
  assert.equal(routines.Legs.reduce((n, e) => n + e.sets, 0), 18);
});
