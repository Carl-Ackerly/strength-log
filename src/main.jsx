import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  routines, focus, dateKey, fromKey, formatDate, blank, storageKey, setKey,
  isLogged, countSets, doneSets, totalSets, volume, performance, previousWorkout,
  resistanceTypes, difficulties, migrate, loadData, validateBackup, weekDates,
} from './data.js';
import './style.css';

const uid = () => crypto.randomUUID();
const niceNumber = n => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
function download(text, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const readRoute = () => {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { page: parts[0] || 'home', date: parts[1], index: Number(parts[2] || 0) };
};
const go = path => { location.hash = '/' + path; window.scrollTo({ top: 0 }); };
const dayLabel = day => day?.type === 'Rest' ? 'Rest day' : day ? day.type + ' Day' : 'No workout planned';
const status = day => day?.type === 'Rest' ? 'Recovery' : day?.completed ? 'Completed' : countSets(day) ? 'In progress' : 'Planned';
const Status = ({ day }) => <span className={'status ' + (day?.completed ? 'complete' : '')}>{status(day)}</span>;

function App() {
  const [initial] = useState(() => {
    try { return { data: loadData() }; }
    catch { return { data: blank(), error: true }; }
  });
  const [data, setData] = useState(initial.data);
  const current = useRef(data);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const blockedRef = useRef(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error ? 'Saved data could not be read. It has been left untouched. Download the recovery file or restore a valid backup in Settings.' : '');
  const [route, setRoute] = useState(readRoute);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [calendarDate, setCalendarDate] = useState(today);
  const [notebook, setNotebook] = useState(false);
  const [editing, setEditing] = useState(null);
  const [progressId, setProgressId] = useState('');
  useEffect(() => {
    const change = () => setRoute(readRoute());
    const refresh = () => setToday(dateKey(new Date()));
    window.addEventListener('hashchange', change);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const id = setInterval(refresh, 60000);
    return () => { window.removeEventListener('hashchange', change); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); clearInterval(id); };
  }, []);
  // Persist inside each input event, before navigation or phone suspension.
  function persist(update, { restoring = false } = {}) {
    if (blockedRef.current && !restoring) { setNotice('Restore a backup before editing; unreadable saved data is protected.'); return false; }
    const next = typeof update === 'function' ? update(current.current) : update;
    try {
      const old = localStorage.getItem(storageKey);
      if (!restoring && old && JSON.parse(old).version === 1 && !localStorage.getItem(storageKey + ':before-v2')) {
        localStorage.setItem(storageKey + ':before-v2', old);
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the in-memory draft available for export if device storage is full.
      current.current = next; setData(next);
      setNotice('Device storage could not save this change. Export a backup in Settings before closing the app.');
      return false;
    }
    current.current = next; setData(next);
    if (restoring) { blockedRef.current = false; setBlocked(false); }
    return true;
  }
  const changeDay = (date, fn) => persist(d => ({ ...d, days: { ...d.days, [date]: fn(d.days[date]) } }));
  function assign(date, type) {
    const old = current.current.days[date];
    if (old?.type === type) return true;
    if (old && (Object.keys(old.sets).length || old.completed) && !window.confirm('Replace this day and clear its recorded sets? Export a backup first if you need to keep them.')) return false;
    return changeDay(date, () => ({ type, completed: false, sets: {}, exercises: type === 'Rest' ? [] : structuredClone(current.current.templates[type]) }));
  }
  function saveSet(date, exercise, index, patch) {
    changeDay(date, day => {
      if (!day || day.completed) return day;
      const key = setKey(exercise.id, index);
      const old = day.sets[key] || { weight: '', reps: '', done: false, resistance: current.current.preferences[exercise.id] || 'weight' };
      const next = { ...old, ...patch };
      if (!isLogged(next) || (['weight', 'level'].includes(next.resistance) && next.weight === '')) next.done = false;
      return { ...day, sets: { ...day.sets, [key]: next } };
    });
  }
  function setResistance(date, exercise, type) {
    const day = current.current.days[date];
    const es = Object.keys(day.sets).filter(k => k.startsWith(exercise.id + ':'));
    if (es.some(k => day.sets[k].weight || day.sets[k].reps) &&
        !window.confirm('Change resistance type for this exercise in this workout? Resistance values will be cleared; reps and difficulty will stay. Previous workouts will keep their original units.')) return;
    persist(d => {
      const sets = { ...d.days[date].sets };
      for (const k of es) sets[k] = { ...sets[k], weight: '', done: false, resistance: type };
      return { ...d, preferences: { ...d.preferences, [exercise.id]: type }, days: { ...d.days, [date]: { ...d.days[date], sets } } };
    });
  }
  async function restore(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const next = migrate(JSON.parse(await file.text()));
      if (!window.confirm('Replace this device’s workouts, routines, schedule and notes with this backup? Export your current data first if you need it.')) return;
      // Retain the replaced state on-device, including an unreadable original.
      const old = localStorage.getItem(storageKey);
      if (old) localStorage.setItem(storageKey + ':before-restore', old);
      if (persist(next, { restoring: true })) { setNotice('Backup restored.'); go('home'); }
    } catch { setNotice('This is not a valid Training Journal or legacy Strength Log backup. No data was replaced.'); }
  }
  const history = Object.entries(data.days).sort(([a], [b]) => b.localeCompare(a));
  const completed = history.filter(([, d]) => d.completed && d.type !== 'Rest');
  const week = weekDates(today);
  const weekCompleted = completed.filter(([date]) => week.includes(date));
  const planned = week.filter(date => data.days[date] && data.days[date].type !== 'Rest');
  const page = ['workout', 'exercise'].includes(route.page) ? 'workouts' : route.page;
  const selected = route.date && /^\d{4}-\d{2}-\d{2}$/.test(route.date) && dateKey(fromKey(route.date)) === route.date ? route.date : today;
  const session = data.days[selected];
  const context = route.page === 'exercise' ? dayLabel(session) + ' / ' + (session?.exercises[route.index]?.name || 'Exercise') + ' / ' + selected : route.page + (route.date ? ' / ' + selected : '');
  const exportBackup = () => download(JSON.stringify(current.current, null, 2), 'training-journal-' + today + '.json');
  return <div className="app">
    <header className="app-header">
      <button className="brand" onClick={() => go('home')} aria-label="Training Journal home"><span className="brand-icon" aria-hidden="true">TJ</span><span>TRAINING<span className="brand-sub">JOURNAL</span></span></button>
      <button className="icon-button" aria-label="Settings and backup" onClick={() => go('settings')}>⚙</button>
    </header>
    {notice && <div className="notice row" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
    <main>
    {route.page === 'home' && <>
      <div className="page-heading"><p className="eyebrow">{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>Your training,<br/><span>one set at a time.</span></h1></div>
      <section className="panel today-card">
        <div className="row"><p className="eyebrow">Today's session</p>{data.days[today] && <Status day={data.days[today]} />}</div>
        <h2>{dayLabel(data.days[today])}</h2><p>{focus[data.days[today]?.type] || (data.days[today]?.type === 'Rest' ? 'Recover today. Build again tomorrow.' : 'Give your next session a place in the week.')}</p>
        {data.days[today] && data.days[today].type !== 'Rest' ? <>
          <p className="meta">{data.days[today].exercises.length} exercises · {doneSets(data.days[today])}/{totalSets(data.days[today])} sets complete</p>
          <button className="primary wide" onClick={() => go('workout/' + today)}>{data.days[today].completed ? 'View workout' : countSets(data.days[today]) ? 'Resume workout' : 'Open workout'}</button>
        </> : <button className="primary wide" onClick={() => { setCalendarDate(today); go('calendar'); }}>Open weekly schedule</button>}
      </section>
      <div className="stats-grid">
        <div className="panel stat"><strong>{completed.length}</strong><span>Workouts completed</span></div>
        <div className="panel stat"><strong>{niceNumber(completed.reduce((n, [, d]) => n + volume(d), 0))}<small> lb</small></strong><span>Total weight volume</span></div>
      </div>
      <section className="panel">
        <div className="row"><h2>This week</h2><button className="text-button" onClick={() => go('calendar')}>Schedule</button></div>
        <p>{weekCompleted.length} of {planned.length} scheduled workouts complete</p>
        <div className="week-strip">{week.map(date => <button key={date} className={(date === today ? 'today ' : '') + (data.days[date]?.completed ? 'finished' : '')} onClick={() => { setCalendarDate(date); go('calendar'); }} aria-label={formatDate(date) + ', ' + dayLabel(data.days[date]) + (data.days[date] ? ', ' + status(data.days[date]) : '')}>
          <small>{formatDate(date, { weekday: 'narrow' })}</small><strong>{fromKey(date).getDate()}</strong><span>{data.days[date]?.completed ? '✓' : data.days[date]?.type === 'Rest' ? '–' : data.days[date] ? '•' : ' '}</span>
        </button>)}</div>
        <progress aria-label="Weekly workout completion" value={weekCompleted.length} max={Math.max(planned.length, 1)} />
      </section>
      {history.some(([date, d]) => date !== today && !d.completed && countSets(d)) && <section className="panel"><h2>Keep going</h2>{history.filter(([date, d]) => date !== today && !d.completed && countSets(d)).slice(0, 3).map(([date, d]) => <button className="list-item" key={date} onClick={() => go('workout/' + date)}><span>{d.type} Day<small>{formatDate(date)} · {countSets(d)} sets logged</small></span><span className="link-text">Resume</span></button>)}<p className="meta">Every edit is saved on this device.</p></section>}
    </>}
    {route.page === 'workouts' && <>
      <PageHeading eyebrow="Your routines" title="Workouts" text="Train in any order. Make each session yours." />
      {Object.entries(data.templates).map(([type, exercises]) => <section className="panel" key={type}><div className="row"><div><h2>{type} Day</h2><p>{focus[type]}</p></div><span className="routine-icon" aria-hidden="true">{type === 'Push' ? 'P' : type === 'Pull' ? 'P' : 'L'}</span></div><p className="meta">{exercises.length} exercises · {exercises.reduce((n, e) => n + e.sets, 0)} sets</p><div className="actions"><button className="primary" onClick={() => { if (assign(today, type)) go('workout/' + today); }}>Open for today</button><button onClick={() => setEditing(type)}>Customize</button></div></section>)}
    </>}
    {route.page === 'calendar' && <>
      <PageHeading eyebrow="Plan & recover" title="Calendar" text="Each date has its own plan. Change any week." />
      <Calendar selected={calendarDate} select={setCalendarDate} days={data.days} today={today} />
      <section className="panel"><p className="eyebrow">{formatDate(calendarDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><div className="row"><h2>{dayLabel(data.days[calendarDate])}</h2>{data.days[calendarDate] && <Status day={data.days[calendarDate]} />}</div>
        <div className="schedule-choices">{['Push', 'Pull', 'Legs', 'Rest'].map(type => <button key={type} aria-pressed={data.days[calendarDate]?.type === type} onClick={() => assign(calendarDate, type)}>{type}</button>)}</div>
        {data.days[calendarDate]?.type !== 'Rest' && data.days[calendarDate] && <button className="primary wide" onClick={() => go('workout/' + calendarDate)}>Open workout</button>}
        {data.days[calendarDate] && <button className="text-button" onClick={() => {
          if ((Object.keys(data.days[calendarDate].sets).length || data.days[calendarDate].completed) && !window.confirm('Remove this day and its logged sets?')) return;
          persist(d => { const days = { ...d.days }; delete days[calendarDate]; return { ...d, days }; });
        }}>Remove day</button>}
      </section>
      <section className="panel"><div className="row"><button aria-label="Previous week" onClick={() => { const d = fromKey(calendarDate); d.setDate(d.getDate() - 7); setCalendarDate(dateKey(d)); }}>‹</button><h2>Week of {formatDate(weekDates(calendarDate)[0])}</h2><button aria-label="Next week" onClick={() => { const d = fromKey(calendarDate); d.setDate(d.getDate() + 7); setCalendarDate(dateKey(d)); }}>›</button></div>
        {weekDates(calendarDate).map(date => <button className="list-item" key={date} onClick={() => setCalendarDate(date)}><span>{formatDate(date, { weekday: 'short', day: 'numeric' })}<small>{dayLabel(data.days[date])}</small></span>{data.days[date] && <Status day={data.days[date]} />}</button>)}
      </section>
    </>}
    {['workout', 'exercise'].includes(route.page) && (!session || session.type === 'Rest' ? <section className="panel"><h1>{dayLabel(session)}</h1><button onClick={() => { setCalendarDate(selected); go('calendar'); }}>Open schedule</button></section> : route.page === 'workout' ? <>
      <button className="text-button back" onClick={() => go('home')}>Back to Home</button>
      <PageHeading eyebrow={formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })} title={session.type + ' Day'} text={focus[session.type]} />
      <section className="panel"><div className="row"><span>{doneSets(session)} / {totalSets(session)} sets complete</span><Status day={session} /></div><progress aria-label="Workout sets complete" value={doneSets(session)} max={totalSets(session)} /></section>
      <section className="panel exercise-list"><h2>Exercises</h2><p className="meta">Equipment busy? Pick any exercise.</p>{session.exercises.map((e, i) => {
        const done = Array.from({ length: e.sets }, (_, n) => session.sets[setKey(e.id, n)]).filter(s => s?.done).length;
        return <button className="list-item" key={e.id} onClick={() => go('exercise/' + selected + '/' + i)}><span className={'exercise-number ' + (done === e.sets ? 'finished' : '')}>{done === e.sets ? '✓' : String(i + 1).padStart(2, '0')}</span><span className="grow"><strong>{e.name}</strong><small>{e.sets} × {e.reps} reps</small></span><span className="meta">{done}/{e.sets}</span></button>;
      })}</section>
      <section className="panel"><button className="primary wide" disabled={!session.completed && !countSets(session)} onClick={() => {
        if (!session.completed && doneSets(session) < totalSets(session) && !window.confirm('Finish this workout with some sets unchecked? Only entered sets will be included in the completed workout.')) return;
        changeDay(selected, d => ({ ...d, completed: !d.completed }));
      }}>{session.completed ? 'Reopen workout to edit' : 'Finish workout'}</button><p className="meta">{session.completed ? 'Completed workouts are protected from accidental edits.' : 'Sets save as you type. Finish when your session is done.'}</p>
      {!session.completed && !Object.keys(session.sets).length && <button className="text-button" onClick={() => changeDay(selected, d => ({ ...d, exercises: structuredClone(current.current.templates[d.type]) }))}>Use latest routine</button>}</section>
    </> : <ExerciseScreen key={selected + ':' + route.index} data={data} date={selected} session={session} index={route.index} saveSet={saveSet} setResistance={setResistance} />)}
    {route.page === 'progress' && <Progress data={data} history={history} completed={completed} progressId={progressId} setProgressId={setProgressId} />}
    {route.page === 'settings' && <>
      <PageHeading eyebrow="Make it yours" title="Settings & backup" />
      <section className="panel"><label className="row"><span><strong>Set difficulty controls</strong><small>Show Easy, Moderate and Hard while logging.</small></span><input type="checkbox" checked={data.showDifficulty} onChange={e => persist(d => ({ ...d, showDifficulty: e.target.checked }))} /></label><p className="meta">Hiding controls keeps your saved ratings and comparisons.</p></section>
      <section className="panel"><h2>Backup & restore</h2><p>Your schedule, workouts, routines and feedback stay on this device. Export regularly to keep a separate copy.</p><div className="actions"><button className="primary" onClick={exportBackup}>Export backup</button><label className="button restore">Restore backup<input aria-label="Restore backup file" type="file" accept=".json,application/json" onChange={restore} /></label></div><p className="meta">Accepts original Strength Log v1 and Training Journal v2 backups.</p>
        <button className="text-button" onClick={() => {
          const raw = localStorage.getItem(storageKey + ':before-v2') || localStorage.getItem(storageKey + ':before-restore') || localStorage.getItem(storageKey);
          if (raw) download(raw, 'strength-log-recovery-' + today + '.json');
          else setNotice('No saved recovery data is available yet.');
        }}>Download original / recovery data</button>{blocked && <p className="notice">Editing is paused until you restore a valid backup. Your original storage has not been overwritten.</p>}
      </section>
      <section className="panel"><h2>Offline on iPhone</h2><p>Open in Safari, then Share → Add to Home Screen. After one full online load, workouts are available offline.</p><p className="meta">To load an app update, close all Training Journal tabs and the installed app, then reopen online. Backups are recommended before clearing any browser data.</p></section>
    </>}
    {!['home', 'workouts', 'calendar', 'workout', 'exercise', 'progress', 'settings'].includes(route.page) && <section className="panel"><h1>Page not found</h1><button onClick={() => go('home')}>Home</button></section>}
    </main>
    <button className="feedback-fab" aria-label="Open Feedback Notebook" onClick={() => setNotebook(v => !v)}><span aria-hidden="true">✎</span><span>Feedback</span></button>
    <nav className="bottom-nav" aria-label="Main navigation">{[['home', '⌂', 'Home'], ['workouts', '▤', 'Workouts'], ['calendar', '▦', 'Calendar'], ['progress', '▥', 'Progress']].map(([id, icon, label]) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
    {notebook && <Notebook data={data} persist={persist} context={context} close={() => setNotebook(false)} notice={setNotice} />}
    {editing && <TemplateEditor type={editing} exercises={data.templates[editing]} close={() => setEditing(null)} save={exercises => {
      if (persist(d => ({ ...d, templates: { ...d.templates, [editing]: exercises } }))) { setEditing(null); setNotice('Routine saved for new sessions. Existing workouts keep their exercise lists.'); }
    }} />}
  </div>;
}
function PageHeading({ eyebrow, title, text }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{text && <p>{text}</p>}</div>;
}
function Calendar({ selected, select, days, today }) {
  const [month, setMonth] = useState(() => fromKey(selected));
  useEffect(() => setMonth(fromKey(selected)), [selected]);
  const year = month.getFullYear(), index = month.getMonth();
  const offset = (new Date(year, index, 1).getDay() + 6) % 7;
  return <section className="panel calendar" aria-label="Workout calendar">
    <div className="row"><button aria-label="Previous month" onClick={() => setMonth(new Date(year, index - 1, 1))}>‹</button><h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><button aria-label="Next month" onClick={() => setMonth(new Date(year, index + 1, 1))}>›</button></div>
    <div className="calendar-grid">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <small key={i}>{d}</small>)}{Array.from({ length: offset }, (_, i) => <span key={'blank' + i} />)}
    {Array.from({ length: new Date(year, index + 1, 0).getDate() }, (_, i) => {
      const key = dateKey(new Date(year, index, i + 1)), day = days[key];
      return <button key={key} aria-pressed={selected === key} aria-current={key === today ? 'date' : undefined} className={day?.completed ? 'finished' : ''} aria-label={formatDate(key, { month: 'long', day: 'numeric' }) + ', ' + dayLabel(day) + (day ? ', ' + status(day) : '')} onClick={() => select(key)}>{i + 1}<span className="calendar-mark">{day?.completed ? '✓' : day?.type === 'Rest' ? '–' : day ? '•' : ''}</span></button>;
    })}</div>
    <div className="row"><small>• Planned · ✓ Completed · – Rest</small><button className="text-button" onClick={() => { select(today); setMonth(fromKey(today)); }}>Today</button></div>
  </section>;
}
function ExerciseScreen({ data, date, session, index, saveSet, setResistance }) {
  const e = session.exercises[index];
  if (!e) return <section className="panel"><h1>Exercise not found</h1><button onClick={() => go('workout/' + date)}>Back to Exercise List</button></section>;
  const previous = previousWorkout(data, date, e.id);
  const first = Object.entries(session.sets).find(([k]) => k.startsWith(e.id + ':'))?.[1];
  const type = first?.resistance || data.preferences[e.id] || 'weight';
  return <>
    <button className="text-button back" onClick={() => go('workout/' + date)}>Back to Exercise List</button>
    <PageHeading eyebrow={session.type + ' Day · Exercise ' + (index + 1) + ' of ' + session.exercises.length} title={e.name} text={e.sets + ' sets · Target ' + e.reps + ' reps'} />
    <section className="panel"><label className="field">Resistance type<select aria-label="Resistance type" value={type} disabled={session.completed} onChange={event => setResistance(date, e, event.target.value)}>{Object.entries(resistanceTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><p className="meta">{type === 'level' ? 'Machine levels are not pounds and never count toward weight volume.' : type === 'weight' ? 'Enter the resistance shown by your machine in pounds.' : 'Track repetitions without weight volume.'}</p></section>
    {previous ? <p className="comparison-heading">Previous completed session · {formatDate(previous[0])}</p> : <p className="comparison-heading">Your first completed comparison starts here.</p>}
    {Array.from({ length: e.sets }, (_, i) => {
      const s = session.sets[setKey(e.id, i)] || { weight: '', reps: '', done: false, resistance: type };
      const prev = previous?.[1].sets[setKey(e.id, i)];
      const valid = isLogged(s) && (!['weight', 'level'].includes(type) || s.weight !== '') && Number(s.reps) <= 1e8;
      return <section className={'panel set-card ' + (s.done ? 'set-done' : '')} key={i}>
        <div className="row"><h2>Set {i + 1}</h2><label className="check-label"><input type="checkbox" aria-label={'Complete set ' + (i + 1)} checked={s.done} disabled={session.completed || !valid} onChange={event => saveSet(date, e, i, { done: event.target.checked })} /><span>Done</span></label></div>
        <p className="previous">Last: {performance(prev)}</p>
        <div className="set-inputs">{['weight', 'level'].includes(type) ? <label className="field">{type === 'level' ? 'Machine level' : 'Resistance (lb)'}<input aria-label={'Set ' + (i + 1) + ' ' + (type === 'level' ? 'level' : 'weight')} inputMode={type === 'level' ? 'numeric' : 'decimal'} value={s.weight} placeholder="—" disabled={session.completed} onChange={event => {
          const value = event.target.value.replace(',', '.');
          if ((value === '' || (type === 'level' ? /^[1-9]\d*$/ : /^\d+(?:\.\d*)?$/).test(value)) && Number(value) <= 1e8) saveSet(date, e, i, { weight: value });
        }} /></label> : <div className="resistance-label">{resistanceTypes[type]}</div>}
        <label className="field">Repetitions<input aria-label={'Set ' + (i + 1) + ' reps'} inputMode="numeric" value={s.reps} placeholder="—" disabled={session.completed} onChange={event => {
          const value = event.target.value; if ((value === '' || /^[1-9]\d*$/.test(value)) && Number(value) <= 1e8) saveSet(date, e, i, { reps: value });
        }} /></label></div>
        {data.showDifficulty && <div className="difficulty" role="group" aria-label={'Set ' + (i + 1) + ' difficulty'}><small>Effort</small>{Object.entries(difficulties).map(([value, [icon, label]]) => <button key={value} className={value} aria-label={'Set ' + (i + 1) + ' ' + label} aria-pressed={s.difficulty === value} disabled={session.completed} onClick={() => saveSet(date, e, i, { difficulty: s.difficulty === value ? null : value })}><span aria-hidden="true">{icon}</span><span>{label}</span></button>)}</div>}
      </section>;
    })}
    <p className="meta">Saved as you type · {session.completed ? 'Reopen the workout to edit.' : 'Tap a selected effort to clear it.'}</p>
    <div className="exercise-controls"><button onClick={() => go('workout/' + date)}>Back to Exercise List</button><button className="primary" onClick={() => go(index < session.exercises.length - 1 ? 'exercise/' + date + '/' + (index + 1) : 'workout/' + date)}>{index < session.exercises.length - 1 ? 'Next Exercise' : 'Review workout'}</button></div>
  </>;
}
function Progress({ data, history, completed, progressId, setProgressId }) {
  const exercises = new Map();
  for (const [, d] of history) for (const e of d.exercises) exercises.set(e.id, e.name);
  const id = exercises.has(progressId) ? progressId : exercises.keys().next().value;
  const [resistance, setType] = useState('weight');
  const points = completed.slice().reverse().flatMap(([date, day]) => {
    const sets = Object.entries(day.sets).filter(([k, s]) => k.startsWith(id + ':') && isLogged(s) && s.resistance === resistance).map(([, s]) => s);
    if (!sets.length) return [];
    const best = sets.slice().sort((a, b) => (Number(b.weight) - Number(a.weight)) || Number(b.reps) - Number(a.reps))[0];
    return [{ date, best }];
  });
  const records = points.slice().sort((a, b) => Number(b.best.weight) - Number(a.best.weight) || Number(b.best.reps) - Number(a.best.reps));
  return <>
    <PageHeading eyebrow="Built by consistency" title="Progress" text="Your logged training. No estimated numbers." />
    <div className="stats-grid"><div className="panel stat"><strong>{completed.length}</strong><span>Completed workouts</span></div><div className="panel stat"><strong>{niceNumber(completed.reduce((n, [, d]) => n + volume(d), 0))}<small> lb</small></strong><span>Weight × reps volume</span></div></div>
    <section className="panel"><h2>Strength progression</h2>{exercises.size ? <>
      <label className="field">Exercise<select aria-label="Exercise" value={id} onChange={e => setProgressId(e.target.value)}>{[...exercises].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label className="field">Resistance type<select aria-label="Resistance type" value={resistance} onChange={e => setType(e.target.value)}>{Object.entries(resistanceTypes).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      {records.length ? <div className="record"><p className="eyebrow">Personal record · best recorded set</p><strong>{performance(records[0].best)}</strong><small>{formatDate(records[0].date, { month: 'short', day: 'numeric', year: 'numeric' })}</small></div> : <p className="empty">No completed sets for this exercise and resistance type yet.</p>}
      <p className="meta">{resistance === 'level' ? 'Levels compare this exercise only, on the same machine. They are excluded from weight volume.' : 'Best set per completed session, ranked by resistance then repetitions. Bodyweight and reps-only records rank by repetitions.'}</p>
      {points.slice(-12).map(({ date, best }) => <div className="progress-point" key={date}><small>{formatDate(date)}</small><strong>{performance(best)}</strong><div className="bar-track"><span style={{ width: Math.max(2, 100 * Number(['weight', 'level'].includes(resistance) ? best.weight || 0 : best.reps) / Math.max(1, ...points.map(p => Number(['weight', 'level'].includes(resistance) ? p.best.weight || 0 : p.best.reps)))) + '%' }} /></div></div>)}
    </> : <p className="empty">Log your first workout to start tracking progression.</p>}</section>
    <section className="panel"><h2>Workout history</h2>{history.filter(([, d]) => d.type !== 'Rest' && (d.completed || countSets(d))).map(([date, day]) => <button className="list-item" key={date} onClick={() => go('workout/' + date)}><span><strong>{day.type} Day</strong><small>{formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' })} · {countSets(day)} sets</small><small>{niceNumber(volume(day))} lb volume</small></span><Status day={day} /></button>)}{!history.some(([, d]) => d.completed || countSets(d)) && <p className="empty">No workouts logged yet.</p>}<p className="meta">Volume = pounds × reps. Completed workouts include all entered sets; in-progress workouts include checked sets. Machine levels, bodyweight and reps-only sets are excluded.</p></section>
  </>;
}
function Notebook({ data, persist, context, close, notice }) {
  const draft = data.noteDraft;
  const panel = useRef(null);
  useEffect(() => { panel.current?.focus(); }, []);
  const update = patch => persist(d => ({ ...d, noteDraft: { ...d.noteDraft, context: d.noteDraft.text ? d.noteDraft.context : context, createdAt: d.noteDraft.text && d.noteDraft.createdAt ? d.noteDraft.createdAt : new Date().toISOString(), ...patch } }));
  const exportNotes = draft.text.trim() ? [{ ...draft, createdAt: draft.createdAt || new Date().toISOString(), text: draft.text + ' (draft)' }, ...data.notes] : data.notes;
  const text = exportNotes.map(n => '[' + new Date(n.createdAt).toLocaleString() + '] ' + n.category + ' · ' + n.context + '\n' + n.text).join('\n\n');
  return <aside className="notebook" aria-label="Feedback Notebook" ref={panel} tabIndex={-1} onKeyDown={e => { if (e.key === 'Escape') close(); }}>
    <div className="row"><h2>Feedback Notebook</h2><button aria-label="Close Feedback Notebook" onClick={close}>×</button></div>
    <p className="meta">Draft saved automatically · {draft.context || context}</p>
    <label className="field">Category<select aria-label="Category" value={draft.category} onChange={e => update({ category: e.target.value })}>{['Bug', 'Improvement', 'Idea'].map(c => <option key={c}>{c}</option>)}</select></label>
    <label className="field">Note<textarea aria-label="Note" rows="3" maxLength={10000} placeholder="What did you notice?" value={draft.text} onChange={e => update({ text: e.target.value })} /></label>
    <button className="primary wide" disabled={!draft.text.trim()} onClick={() => persist(d => ({ ...d, notes: [{ id: uid(), category: d.noteDraft.category, text: d.noteDraft.text.trim(), createdAt: d.noteDraft.createdAt || new Date().toISOString(), context: d.noteDraft.context || context }, ...d.notes], noteDraft: { category: d.noteDraft.category, text: '', context: '' } }))}>Save note</button>
    <div className="actions"><button disabled={!exportNotes.length} onClick={async () => { try { await navigator.clipboard.writeText(text); notice('Feedback copied.'); } catch { notice('Clipboard unavailable. Use Export notes to share your feedback.'); } }}>Copy notes</button><button disabled={!exportNotes.length} onClick={() => download(text, 'training-feedback-' + dateKey(new Date()) + '.txt', 'text/plain')}>Export notes</button></div>
    <div className="notes-list">{data.notes.map(n => <article key={n.id}><strong>{n.category}</strong><small>{new Date(n.createdAt).toLocaleString()} · {n.context}</small><p>{n.text}</p></article>)}</div>
  </aside>;
}
function TemplateEditor({ type, exercises, save, close }) {
  const [items, setItems] = useState(() => structuredClone(exercises));
  const dialog = useRef(null);
  useEffect(() => { const d = dialog.current; d.showModal(); return () => d.close(); }, []);
  const change = (i, patch) => setItems(rows => rows.map((e, n) => n === i ? { ...e, ...patch } : e));
  return <dialog ref={dialog} className="template-dialog" onCancel={close}><form onSubmit={e => {
    e.preventDefault(); const next = items.map(x => ({ ...x, name: x.name.trim(), reps: x.reps.trim() }));
    const trial = blank(); trial.templates[type] = next; if (validateBackup(trial)) save(next);
  }}><div className="row"><h2>Customize {type}</h2><button type="button" aria-label="Close routine editor" onClick={close}>×</button></div><p>Applies to new sessions. Existing logs keep their exercises and set counts.</p>
    {items.map((e, i) => <section className="editor-exercise" key={e.id}><label className="field">Exercise {i + 1}<input required maxLength={199} aria-label={'Exercise ' + (i + 1) + ' name'} value={e.name} onChange={event => change(i, { name: event.target.value })} /></label><div className="set-inputs"><label className="field">Sets<input required type="number" min="1" max="50" value={e.sets} onChange={event => change(i, { sets: event.target.value === '' ? '' : Number(event.target.value) })} /></label><label className="field">Target reps<input required maxLength={79} value={e.reps} onChange={event => change(i, { reps: event.target.value })} /></label></div><div className="actions"><button type="button" disabled={i === 0} onClick={() => setItems(rows => { const next = [...rows]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>Move up</button><button type="button" disabled={items.length < 2} onClick={() => setItems(rows => rows.filter((_, n) => n !== i))}>Remove</button></div></section>)}
    <div className="actions"><button type="button" disabled={items.length >= 100} onClick={() => setItems(rows => [...rows, { id: 'custom-' + uid(), name: '', sets: 3, reps: '8–12' }])}>Add exercise</button><button type="submit" className="primary">Save routine</button><button type="button" onClick={close}>Cancel</button></div>
  </form></dialog>;
}
createRoot(document.getElementById('root')).render(<App />);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(error => console.error('Offline setup failed:', error));
}


