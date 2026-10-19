// MILO OS — app shell: state machine, data, panels, chat, voice wiring.
import { createSphere } from './sphere.js';
import { createVoice } from './voice.js';
import { Brain } from './brain.js';

const $ = (id) => document.getElementById(id);
const USER = 'Josh';

/* ---------------- seed data (fallback when opened via file://) ---------------- */
const SEED_QUEUE = [
  { id: 't1', title: 'Overnight: triage inbox', detail: 'Flag anything urgent · due 7 AM', status: 'done', owner: 'MILO', notes: 'Inbox swept at 4:12 AM. 3 newsletters archived, 1 prof email flagged (MISA midterm moved to Oct 21 — already on your calendar). Nothing urgent.' },
  { id: 't2', title: 'Draft QM midterm formula sheet', detail: 'Modules 1-2 · annuity, amortization, EAR', status: 'done', owner: 'KARMA', notes: 'One-page sheet drafted: future value of annuity, loan balance formula, EAR conversion, amortization layout. KARMA has it ready to review.' },
  { id: 't3', title: 'Research: Quebec City NYE program', detail: 'Grande Allée official lineup · TBA watch', status: 'working', owner: 'KARMA', notes: 'Watching the official program page. Nothing published yet — KARMA checks nightly.' },
  { id: 't4', title: 'Draft IG caption: Lucid eval week 1', detail: 'Faceless @bearrtrades tone', status: 'idle', owner: 'PULSE', notes: '' },
  { id: 't5', title: 'Overnight: scan for schedule changes', detail: 'Classes, gym, shifts', status: 'idle', owner: 'MILO', notes: '' },
];
const SEED_RESULTS = [
  { taskId: 't1', title: 'Inbox triage — done', body: 'Swept at 4:12 AM. 3 newsletters archived. 1 email flagged: MISA midterm moved to Wed Oct 21 (on calendar). Zero urgent items.' },
  { taskId: 't2', title: 'QM formula sheet — done', body: 'Drafted one-pager: FV of annuity, loan balance Bal_k, EAR = (1+r/m)^m − 1, amortization table layout. Ready for your review before the Oct 26 midterm.' },
];
const SEED_KNOWLEDGE = [
  ['QM midterm', 'Oct 26 · modules 1-2'], ['MISA midterm', 'Oct 21 · Excel ch 1-5'],
  ['Micro midterm', 'Oct 21 · evening'], ['QM A2', 'due Oct 23 noon'],
  ['Quebec trip', 'Dec 29 – Jan 3'], ['Lucid eval', 'week of Oct 19'],
  ['Gym', 'Tue / Thu / Sun 8:30 AM'], ['Work', 'Fri / Sat 12–11 PM'],
  ['@bearrtrades', 'faceless IG · trading journey'],
];

/* ---------------- state ---------------- */
let queue = [];
let results = [];
let pulseLog = [];
let companions = ['MILO', 'KARMA', 'PULSE'];
let compIdx = 0;
let chatTab = 'MILO';
let chatHist = { MILO: [], KARMA: [], PULSE: [] };
let OS = null, sphere = null, voice = null;

async function loadData() {
  try {
    const q = await (await fetch('data/queue.json')).json();
    const r = await (await fetch('data/results.json')).json();
    queue = q.tasks || q; results = r.results || r;
  } catch (_) { queue = JSON.parse(JSON.stringify(SEED_QUEUE)); results = JSON.parse(JSON.stringify(SEED_RESULTS)); }
  // session additions persist in localStorage
  try {
    const extra = JSON.parse(localStorage.getItem('milo-os-queue') || '[]');
    queue = queue.concat(extra);
  } catch (_) {}
}

/* ---------------- status / state machine ---------------- */
function setState(s) {
  OS.state = s;
  const pill = $('statusPill');
  pill.dataset.state = s === 'idle' ? 'idle' : s;
  $('pillText').textContent = s.toUpperCase();
  sphere.setMode(s);
  if (s === 'working') pulse(`<b>${companions[compIdx]}</b> picked up background work`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- captions (karaoke) ---------------- */
function showCaptions(words, hotIdx) {
  const el = $('captions');
  el.innerHTML = words.map((w, i) =>
    `<span class="w${i === hotIdx ? ' hot' : ''}">${w}</span>`).join(' ');
}
function clearCaptions() { $('captions').innerHTML = ''; }

/* ---------------- speak ---------------- */
async function speak(text) {
  setState('speaking');
  addMsg('MILO', 'agent', text);
  const words = text.split(/\s+/);
  showCaptions(words, -1);
  await voice.speak(text, (i) => {
    showCaptions(words, i);
    sphere.setEnergy(0.35 + (i / Math.max(1, words.length)) * 0.65);
  });
  sphere.setEnergy(0);
  clearCaptions();
  setState('idle');
}

/* ---------------- conversation turn ---------------- */
async function handleUserText(text) {
  if (!text.trim()) return;
  addMsg('MILO', 'user', text);
  setState('thinking');
  const typing = addMsg('MILO', 'agent', 'Milo is thinking…', true);
  await sleep(500 + Math.random() * 500);
  const reply = await Brain.respond(text, {
    queue, results, userName: USER,
    addTask: (title, detail, owner) => addTask(title, detail, owner || 'MILO'),
  });
  typing.remove();
  await speak(reply);
}

function addTask(title, detail, owner) {
  const t = {
    id: 't' + Date.now().toString(36),
    title, detail: detail || 'Added by voice', status: 'idle', owner, notes: '',
  };
  queue.push(t);
  try {
    const extra = JSON.parse(localStorage.getItem('milo-os-queue') || '[]');
    extra.push(t);
    localStorage.setItem('milo-os-queue', JSON.stringify(extra));
  } catch (_) {}
  renderQueue(); renderStats();
  pulse(`<b>${owner}</b> queued “${title}”`);
  return t;
}

/* ---------------- voice wiring ---------------- */
function wireVoice() {
  voice = createVoice({
    onListenStart: () => setState('listening'),
    onListenEnd: () => { if (OS.state === 'listening') setState('idle'); },
    onTranscript: (text) => handleUserText(text),
    onInterim: () => {},
    onError: (e) => {
      if (e === 'no-stt') addMsg('MILO', 'agent', 'Voice input needs Chrome or Edge, Josh — the text box works everywhere.');
      else if (e === 'not-allowed') addMsg('MILO', 'agent', 'Mic blocked — allow microphone access and tap again.');
      if (OS.state === 'listening') setState('idle');
    },
  });

  const tapOrb = () => {
    if (OS.state === 'speaking') { voice.bargeIn(); pulse('<b>You</b> cut in — listening'); }
    else if (OS.state === 'listening') voice.stopListening();
    else voice.startListening();
  };
  $('sphere').addEventListener('click', tapOrb);
  $('micBtn').addEventListener('click', tapOrb);
  $('chatMicBtn').addEventListener('click', tapOrb);
  // Right Alt = mic toggle (talk mode). Skipped while typing in a field.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'AltRight') return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    tapOrb();
  });
  $('muteBtn').addEventListener('click', () => {
    const m = voice.toggleMute();
    $('muteBtn').innerHTML = m ? '&#128263;' : '&#128266;';
    pulse(m ? 'Voice output muted' : 'Voice output on');
  });
  if (!voice.supported) $('micBtn').classList.remove('live');
}

/* ---------------- queue panel ---------------- */
function renderQueue() {
  const list = $('taskList');
  list.innerHTML = '';
  queue.forEach(t => {
    const d = document.createElement('div');
    d.className = 'task';
    d.innerHTML = `
      <div class="t-row"><span class="sdot ${t.status}"></span>
      <span class="t-title">${esc(t.title)}</span>
      <span class="t-owner">${t.owner}</span></div>
      <div class="t-detail">${esc(t.detail || '')}</div>
      ${t.notes ? `<div class="t-notes">${esc(t.notes)}</div>` : ''}`;
    d.addEventListener('click', () => d.classList.toggle('open'));
    list.appendChild(d);
  });
}

function renderStats() {
  const active = queue.filter(t => t.status === 'idle' || t.status === 'working').length;
  const done = queue.filter(t => t.status === 'done').length;
  $('numActive').textContent = active;
  $('numDone').textContent = done;
  const working = queue.filter(t => t.status === 'working');
  $('crewLine').textContent = working.length
    ? `${working.map(t => t.owner).join(', ')} on it — ${working.length} running.`
    : 'All companions idle.';
}

/* ---------------- chat tabs ---------------- */
function addMsg(tab, author, text, typing) {
  const m = { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6), author, text };
  chatHist[tab].push(m);
  let el = null;
  if (tab === chatTab) {
    el = document.createElement('div');
    el.className = 'msg ' + (author === 'user' ? 'user' : 'agent') + (typing ? ' typing' : '');
    el.dataset.mid = m.id;
    el.innerHTML = `${esc(text)}<span class="t">${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`;
    $('chatLog').appendChild(el);
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
  }
  return el;
}

function renderChatTab() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === chatTab));
  const log = $('chatLog');
  log.innerHTML = '';
  if (chatTab === 'KARMA') {
    // overnight report view
    if (!results.length) log.innerHTML = '<div class="msg agent">Nothing filed yet — the crew reports here after a night shift.</div>';
    results.forEach(r => {
      const el = document.createElement('div');
      el.className = 'result-block';
      el.innerHTML = `<div class="r-title">${esc(r.title)}</div><div class="r-body">${esc(r.body)}</div>`;
      log.appendChild(el);
    });
    return;
  }
  if (chatTab === 'PULSE') {
    // activity log
    if (!pulseLog.length) log.innerHTML = '<div class="log-line">No activity yet.</div>';
    pulseLog.forEach(line => {
      const el = document.createElement('div');
      el.className = 'log-line';
      el.innerHTML = line;
      log.appendChild(el);
    });
    return;
  }
  chatHist.MILO.forEach(m => {
    const el = document.createElement('div');
    el.className = 'msg ' + (m.author === 'user' ? 'user' : 'agent');
    el.innerHTML = `${esc(m.text)}<span class="t">${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`;
    log.appendChild(el);
  });
  log.scrollTop = log.scrollHeight;
}

function pulse(html) {
  const ts = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  pulseLog.unshift(`${ts} — ${html}`);
  if (chatTab === 'PULSE') renderChatTab();
}

/* ---------------- calendar (demo month grid) ---------------- */
function renderCalendar() {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth();
  $('calTitle').textContent = 'CALENDAR — ' + now.toLocaleDateString([], { month: 'long', year: 'numeric' }).toUpperCase();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const grid = $('calGrid');
  grid.innerHTML = '';
  ['S','M','T','W','T','F','S'].forEach(d => {
    const e = document.createElement('div'); e.className = 'dow'; e.textContent = d; grid.appendChild(e);
  });
  for (let i = 0; i < first; i++) { const e = document.createElement('div'); e.className = 'day other'; grid.appendChild(e); }
  const demoEvents = [3, 9, 14, 21];
  for (let d = 1; d <= days; d++) {
    const e = document.createElement('div');
    e.className = 'day' + (d === now.getDate() ? ' today' : '');
    if (demoEvents.includes(d)) e.classList.add('has-ev');
    if (d === now.getDate() + 1) e.classList.add('milo'); // Milo added a focus block tomorrow
    e.textContent = d;
    grid.appendChild(e);
  }
  $('calFoot').textContent = 'TODAY — ' + (demoEvents.includes(now.getDate()) ? 'events scheduled' : 'No events');
}

/* ---------------- knowledge view ---------------- */
function renderKnowledge() {
  $('knowledgeNodes').innerHTML = SEED_KNOWLEDGE.map(([k, v]) =>
    `<span class="k-node">${esc(k)}<small>${esc(v)}</small></span>`).join('');
}

/* ---------------- overnight simulation ---------------- */
async function overnightDemo() {
  const pending = queue.find(t => t.status === 'idle');
  if (!pending) { await speak(`Nothing pending, ${USER}. The queue is already clean.`); return; }
  setState('working');
  pending.status = 'working';
  renderQueue(); renderStats();
  pulse(`<b>${pending.owner}</b> started “${esc(pending.title)}”`);
  await speak(`On it, ${USER}. ${pending.owner === 'KARMA' ? "Karma's" : pending.owner === 'PULSE' ? "Pulse is" : "I'm"} taking "${pending.title}" overnight.`);
  setState('working');
  await sleep(6000);
  pending.status = 'done';
  pending.notes = 'Finished in the overnight window. Full brief filed under KARMA.';
  results.unshift({ taskId: pending.id, title: `${pending.title} — done`, body: 'Completed overnight. Brief filed and ready for your review.' });
  renderQueue(); renderStats();
  pulse(`<b>${pending.owner}</b> finished “${esc(pending.title)}”`);
  await speak(`Done, ${USER}. "${pending.title}" is finished — check the KARMA tab for the brief.`);
}

/* ---------------- companions switcher ---------------- */
function cycleCompanion(dir) {
  compIdx = (compIdx + dir + companions.length) % companions.length;
  $('agentLabel').textContent = companions[compIdx];
  pulse(`Switched companion to <b>${companions[compIdx]}</b>`);
}

/* ---------------- misc ---------------- */
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function tickClock() {
  $('clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/* ---------------- boot ---------------- */
async function boot() {
  OS = { state: 'idle' };
  await loadData();
  sphere = createSphere($('sphere'));
  wireVoice();
  renderQueue(); renderStats(); renderChatTab(); renderCalendar(); renderKnowledge();
  tickClock(); setInterval(tickClock, 15000);

  pulse('<b>System</b> online — sphere initialized');
  pulse(`<b>Queue</b> loaded: ${queue.length} tasks`);

  addMsg('MILO', 'agent', `Hey ${USER}. Milo OS is live — tap the sphere or hit the mic and talk to me.`);

  $('sendBtn').addEventListener('click', () => { handleUserText($('chatText').value); $('chatText').value = ''; });
  $('chatText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { handleUserText($('chatText').value); $('chatText').value = ''; }
  });
  document.querySelectorAll('.tab').forEach(b =>
    b.addEventListener('click', () => { chatTab = b.dataset.tab; renderChatTab(); }));
  $('prevAgent').addEventListener('click', () => cycleCompanion(-1));
  $('nextAgent').addEventListener('click', () => cycleCompanion(1));
  $('knowledgeBtn').addEventListener('click', () =>
    $('knowledgeOverlay').classList.toggle('open'));
  $('insertBtn').addEventListener('click', () => {
    const title = prompt('New task title:');
    if (title) addTask(title, 'Added manually', companions[compIdx]);
  });
  $('uploadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) {
      addTask(`Review upload: ${f.name}`, 'File attached by Josh', 'MILO');
      addMsg('MILO', 'agent', `Got "${f.name}" — queued for the overnight crew.`);
    }
  });
  $('overnightBtn').addEventListener('click', overnightDemo);
  $('statActive').addEventListener('click', () => {
    const act = queue.filter(t => t.status !== 'done').map(t => t.title).join('; ') || 'none';
    addMsg('MILO', 'agent', `Active tasks: ${act}.`);
    if (chatTab !== 'MILO') { chatTab = 'MILO'; renderChatTab(); }
  });
  $('statDone').addEventListener('click', () => {
    chatTab = 'KARMA'; renderChatTab();
  });
  document.querySelectorAll('.mobile-tabs button').forEach(b =>
    b.addEventListener('click', () => {
      document.body.dataset.mtab = b.dataset.mtab;
      document.querySelectorAll('.mobile-tabs button').forEach(x => x.classList.toggle('on', x === b));
    }));
}

document.addEventListener('DOMContentLoaded', boot);
