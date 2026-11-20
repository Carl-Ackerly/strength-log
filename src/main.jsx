import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  routines, focus, dateKey, fromKey, formatDate, modes, blank, storageKey,
  isLogged, countSets, setKey, validateBackup, loadData,
} from './data.js';
import './style.css';

function Calendar({ selected, select, days }) {
  const [month, setMonth] = useState(() => fromKey(selected));
  useEffect(() => setMonth(fromKey(selected)), [selected]);
  const year = month.getFullYear();
  const index = month.getMonth();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  const length = new Date(year, index + 1, 0).getDate();
  const today = dateKey(new Date());
  return <section className="panel calendar" aria-label="Workout calendar">
    <div className="row">
      <button aria-label="Previous month" onClick={() => setMonth(new Date(year, index - 1, 1))}>‹</button>
      <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
      <button aria-label="Next month" onClick={() => setMonth(new Date(year, index + 1, 1))}>›</button>
    </div>
    <div className="calendar-grid">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <small key={day}>{day}</small>)}
      {Array.from({ length: offset }, (_, i) => <span key={'space' + i} />)}
      {Array.from({ length }, (_, i) => {
        const key = dateKey(new Date(year, index, i + 1));
        const day = days[key];
        const status = day ? (day.completed ? 'completed' : 'planned') : '';
        return <button key={key} className={status} aria-pressed={selected === key}
          aria-current={today === key ? 'date' : undefined}
          aria-label={formatDate(key, { month: 'long', day: 'numeric' }) + (day ? ', ' + day.type + ' ' + status : '')}
          onClick={() => select(key)}>{i + 1}{day && <span className="dot" />}</button>;
      })}
    </div>
    <div className="row legend"><span><i /> Planned <i className="ice" /> Completed</span>
      <button onClick={() => { select(today); setMonth(fromKey(today)); }}>Today</button></div>
  </section>;
}

function SetRow({ index, entry, previous, save }) {
  const [weight, setWeight] = useState(entry?.weight ?? '');
  const [reps, setReps] = useState(entry?.reps ?? '');
  const changed = weight !== (entry?.weight ?? '') || reps !== (entry?.reps ?? '');
  const valid = /^[1-9]\d*$/.test(reps) && Number.isSafeInteger(Number(reps)) &&
    (weight === '' || (/^\d*(?:\.\d+)?$/.test(weight) && Number.isFinite(Number(weight))));
  return <form className="set" onSubmit={event => {
    event.preventDefault();
    if (valid) save({ weight, reps, done: Boolean(entry?.done) }, 'log');
  }}>
    <span className="set-number">{index + 1}</span>
    <input aria-label={'Set ' + (index + 1) + ' weight'} inputMode="decimal" value={weight}
      placeholder={previous?.weight || 'lb'} onChange={event => setWeight(event.target.value.replace(',', '.'))} />
    <input aria-label={'Set ' + (index + 1) + ' reps'} inputMode="numeric" value={reps}
      placeholder={previous?.reps || 'Reps'} onChange={event => setReps(event.target.value)} />
    <button disabled={!valid || !changed} type="submit">{entry ? (changed ? 'Save' : 'Saved') : 'Log'}</button>
    <button type="button" className="check" disabled={!valid} aria-pressed={Boolean(entry?.done)}
      aria-label={entry?.done ? 'Undo set completion' : 'Complete set'}
      onClick={() => save({ weight, reps, done: !entry?.done }, entry?.done ? null : 'complete')}>✓</button>
  </form>;
}

function Timer({ deadline, start, stop, data, save }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [deadline]);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const active = deadline > 0 && remaining > 0;
  return <section className="panel timer">
    <div className="row"><div><h2>Rest timer</h2><small aria-live="polite">{deadline && !active ? 'Rest complete' : 'Between sets'}</small></div>
      <strong role="timer">{Math.floor((deadline ? remaining : data.seconds) / 60)}:{String((deadline ? remaining : data.seconds) % 60).padStart(2, '0')}</strong></div>
    <div className="timer-controls">
      <label>Starts<select value={data.mode} onChange={event => save({ ...data, mode: event.target.value })}>
        {Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Seconds<select value={data.seconds} onChange={event => save({ ...data, seconds: Number(event.target.value) })}>
        {[...new Set([30, 45, 60, 90, 120, 180, 240, 300, data.seconds])].sort((a, b) => a - b)
          .map(value => <option key={value}>{value}</option>)}
      </select></label>
      <button className="primary" onClick={active ? stop : start}>{active ? 'Stop' : 'Start'}</button>
    </div>
  </section>;
}

function App() {
  const [initial] = useState(() => {
    try { return { data: loadData() }; }
    catch { return { data: blank, error: 'Saved data could not be read. Restore a backup to recover it.' }; }
  });
  const [data, setData] = useState(initial.data);
  const [notice, setNotice] = useState(initial.error ?? '');
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [tab, setTab] = useState('Workout');
  const [deadline, setDeadline] = useState(0);
  const session = data.days[selected];
  const start = () => setDeadline(Date.now() + data.seconds * 1000);
  const history = Object.entries(data.days).sort(([a], [b]) => b.localeCompare(a));

  function persist(next) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice('Device storage is unavailable. Export a backup before closing the app.'); }
    setData(next);
  }

  function saveDay(next) {
    const days = { ...data.days };
    if (next) days[selected] = next;
    else delete days[selected];
    persist({ ...data, days });
  }

  function choose(type) {
    if (session?.type === type) return;
    if (session && (Object.keys(session.sets).length || session.completed) &&
        !window.confirm('Change this day’s workout and clear its recorded sets?')) return;
    saveDay(type ? { type, sets: {}, completed: false } : null);
  }

  function saveSet(id, next, action) {
    const old = session.sets[id];
    saveDay({ ...session, sets: { ...session.sets, [id]: next } });
    if ((data.mode === 'log' && action && !isLogged(old)) ||
        (data.mode === 'complete' && action === 'complete')) start();
  }

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'strength-log-backup-' + dateKey(new Date()) + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setNotice('Backup exported.');
  }

  async function restore(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!validateBackup(parsed)) throw new Error('Invalid backup');
      if (!window.confirm('Replace the workouts and timer settings on this device with this backup?')) return;
      setNotice('Backup restored.');
      persist(parsed);
      setDeadline(0);
    } catch { setNotice('This file is not a valid Strength Log backup.'); }
  }

  return <div className="app">
    <header><div className="brand-mark" aria-hidden="true">SL</div><h1>Strength Log</h1></header>
    <nav aria-label="Main navigation">{['Workout', 'History', 'Backup'].map(label =>
      <button key={label} aria-current={tab === label ? 'page' : undefined} onClick={() => setTab(label)}>{label}</button>)}</nav>
    {notice && <div className="notice row" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
    {tab === 'Workout' && <main className="dashboard">
      <aside>
        <Calendar selected={selected} select={setSelected} days={data.days} />
        <Timer deadline={deadline} start={start} stop={() => setDeadline(0)} data={data} save={persist} />
      </aside>
      <section className="panel workout">
        <div className="row workout-heading"><div>
          <p className="eyebrow">{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2>{session ? session.type + ' Day' : 'Choose a workout'}</h2>
          {session && <p>{focus[session.type]}</p>}
        </div>{session && <span className={'status ' + (session.completed ? 'ice' : '')}>{session.completed ? 'Completed' : 'Planned'}</span>}</div>
        <div className="choices">{Object.keys(routines).map(type =>
          <button key={type} className={type.toLowerCase()} aria-pressed={session?.type === type}
            onClick={() => choose(type)}>{type}</button>)}</div>
        {session ? <>
          <div className="progress row"><span>{countSets(session)} of {routines[session.type].reduce((sum, item) => sum + item[1], 0)} sets logged</span>
            <progress aria-label="Sets logged" value={countSets(session)} max={routines[session.type].reduce((sum, item) => sum + item[1], 0)} /></div>
          <div key={selected + session.type}>
            {routines[session.type].map(([name, count, target], exerciseIndex) => {
              const previous = history.find(([date, day]) => date < selected && day.type === session.type &&
                Object.entries(day.sets).some(([key, set]) => key.startsWith(name + ':') && isLogged(set)))?.[1];
              const entries = Array.from({ length: count }, (_, i) => setKey(name, i));
              return <details key={name} className="exercise">
                <summary><span className="exercise-index" aria-hidden="true">{String(exerciseIndex + 1).padStart(2, '0')}</span>
                  <span><strong>{name}</strong><small>{count} × {target} reps</small></span>
                  <small>{entries.filter(id => session.sets[id]?.done).length}/{count} done</small></summary>
                <div className="exercise-body">
                  {previous && <p className="previous">Last logged · {entries.map(id => {
                    const set = previous.sets[id];
                    return isLogged(set) ? (set.weight ? set.weight + ' lb × ' : '') + set.reps + ' reps' : '—';
                  }).join(' / ')}</p>}
                  <div className="set-labels" aria-hidden="true"><span>Set</span><span>Weight (lb)</span><span>Reps</span></div>
                  {entries.map((id, index) => <SetRow key={id + ':' + JSON.stringify(session.sets[id] ?? {})}
                    index={index} entry={session.sets[id]} previous={previous?.sets[id]}
                    save={(next, action) => saveSet(id, next, action)} />)}
                </div>
              </details>;
            })}
          </div>
          <div className="row workout-actions">
            <button onClick={() => choose(null)}>Clear day</button>
            <button className="primary" disabled={!session.completed && !countSets(session)}
              onClick={() => saveDay({ ...session, completed: !session.completed })}>
              {session.completed ? 'Reopen workout' : 'Complete workout'}</button>
          </div>
        </> : <p className="empty">Choose Push, Pull, or Legs to plan this day and open its exercises.</p>}
      </section>
    </main>}
    {tab === 'History' && <main className="panel secondary"><h2>Workout history</h2>
      {history.filter(([, day]) => day.completed || countSets(day)).map(([date, day]) =>
        <button className="history row" key={date} onClick={() => { setSelected(date); setTab('Workout'); }}>
          <span><strong>{day.type} Day</strong><small>{formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}</small></span>
          <span>{countSets(day)} sets · {day.completed ? 'Completed' : 'In progress'}</span></button>)}
      {!history.some(([, day]) => day.completed || countSets(day)) && <p>No sets logged yet.</p>}
    </main>}
    {tab === 'Backup' && <main className="panel secondary"><h2>Backup & restore</h2>
      <p>Your workouts and settings are saved on this device. Export a backup to keep a copy or move your log to another device.</p>
      <div className="backup-actions"><button className="primary" onClick={exportBackup}>Export JSON</button>
        <label className="button restore">Restore backup<input type="file" accept=".json,application/json" onChange={restore} /></label></div>
    </main>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(error => {
    console.error('Offline setup failed:', error);
  });
}

