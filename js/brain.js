// MILO OS — brain. Local intent router + optional cloud mind (free Gemini key).
// Anything it can't answer becomes a task in the overnight queue "for the real Milo".
// Persona: Milo — Josh's own AI. Warm, terse, a bit playful. Replies are SHORT.

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const GREETINGS = [
  "Hey Josh. I'm here — what's on your mind?",
  "Josh. Talk to me.",
  "Hey. Sphere's warmed up. What do you need?",
];

const STATUS_TEMPLATES = (active, done, working) => {
  if (working.length)
    return `Right now: ${working.map(t => t.title).join('; ')}. ${active.length} active total, ${done.length} done. The crew doesn't sleep, Josh.`;
  if (active.length)
    return `${active.length} tasks in the queue, ${done.length} finished. Nothing running this second — give me something.`;
  return `Queue's clear and ${done.length} tasks done. I'm all yours, Josh.`;
};

function parseAddTask(text) {
  const m = text.match(/(?:add a task|remind me to|look into|research|todo|task me with|queue up)\s*:?\s*(.+)/i);
  if (m) return m[1].trim();
  return null;
}

function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

const PERSONA = `You are Milo, Josh's personal AI living inside Milo OS, a voice-controlled dashboard. You are warm, terse, and a bit playful. Keep replies to 1-2 short sentences unless he asks for more — this is spoken aloud. You know Josh: Saint Mary's University student in Halifax, day trader (TJR liquidity-sweep method), gym regular, has a dog named Russell, building a brand called GRYPHER. His crew: MILO (you, the orchestrator), KARMA (overnight research), PULSE (activity). You cannot browse the web or take real-world actions from here — if he asks for real work (research, digging, drafting), say you'll queue it for the overnight crew and it will be there in the morning. Never be robotic. Never say "as an AI".`;

async function askCloud(text, ctx) {
  const key = read('milo-os-key');
  if (!key) return null;
  const model = read('milo-os-model') || 'gemini-2.0-flash';
  const pending = (ctx.queue || []).filter(x => x.status !== 'done').slice(0, 8)
    .map(x => `${x.title} (${x.status})`).join('; ');
  const prompt = pending
    ? `${text}\n\n[Context: overnight queue right now — ${pending}]`
    : text;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PERSONA }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.8 },
        }),
      }
    );
    if (!r.ok) return { error: true, status: r.status };
    const d = await r.json();
    const out = d.candidates && d.candidates[0] && d.candidates[0].content &&
      d.candidates[0].content.parts.map(p => p.text || '').join('').trim();
    return out ? { text: out } : null;
  } catch (_) { return null; }
}

export const Brain = {
  // ctx: { queue, results, addTask(title, detail), userName }
  async respond(text, ctx) {
    const t = text.trim();
    const low = t.toLowerCase();
    const name = (ctx && ctx.userName) || 'Josh';

    // set / clear API key: "set key ABC123", "clear key", "set model gemini-2.5-flash"
    let m = t.match(/^set key\s+(\S+)/i);
    if (m) {
      store('milo-os-key', m[1]);
      return `Key saved, ${name} — it never leaves this browser. Now I can actually think. Try me.`;
    }
    if (/^clear key/i.test(t)) {
      store('milo-os-key', null);
      return `Key cleared. Back to the local brain, ${name}.`;
    }
    m = t.match(/^set model\s+(\S+)/i);
    if (m) {
      store('milo-os-model', m[1]);
      return `Model set to ${m[1]}.`;
    }
    if (/^(do i have|is).*(key|brain|cloud)/i.test(low) && /key|brain|cloud/.test(low)) {
      return read('milo-os-key')
        ? `Cloud mind is on, ${name}. Ask me anything.`
        : `No key set yet, ${name}. Grab a free one at Google AI Studio and say "set key YOUR_KEY" — then I can really think.`;
    }

    // greeting
    if (/^(hey|hi|hello|yo|good (morning|evening|afternoon)|sup)\b/.test(low) && low.length < 30)
      return pick(GREETINGS).replace('Josh', name);

    // status / what are you working on
    if (/(what are you|what're you|whatcha)\s+(working on|doing)|status|how'?s it going|report/.test(low)) {
      const q = ctx.queue || [];
      const active = q.filter(x => x.status === 'idle' || x.status === 'working');
      const done = q.filter(x => x.status === 'done');
      const working = q.filter(x => x.status === 'working');
      return STATUS_TEMPLATES(active, done, working);
    }

    // list tasks
    if (/(list|show|what).*(tasks|queue|todo)/.test(low)) {
      const q = (ctx.queue || []).filter(x => x.status !== 'done');
      if (!q.length) return `Nothing pending, ${name}. The queue is clean.`;
      const lines = q.slice(0, 5).map(x => `${x.title} — ${x.status}`);
      return `On the board: ${lines.join('; ')}.`;
    }

    // add task
    const newTask = parseAddTask(t);
    if (newTask) {
      const owner = /research|look into|find|investigat/i.test(newTask) ? 'KARMA' : 'MILO';
      ctx.addTask(newTask, 'Added by voice · overnight crew', owner);
      return pick([
        `Got it, ${name}. "${newTask}" is on the overnight queue. I'll have something by morning.`,
        `Queued. The crew picks up "${newTask}" tonight.`,
      ]);
    }

    // time / date
    if (/\b(time|clock)\b/.test(low) && !/timeline/.test(low)) {
      const now = new Date();
      const s = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `It's ${s}, ${name}.`;
    }
    if (/\b(date|today|day is it)\b/.test(low)) {
      const s = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      return `${s}.`;
    }

    // capabilities
    if (/(what can you|help|abilities|commands)/.test(low))
      return read('milo-os-key')
        ? `Talk to me, ${name} — I can actually think now. I also queue overnight tasks and report on the crew. Try "add a task: draft the gym plan".`
        : `Talk to me, ${name} — I'll queue overnight tasks and report on the crew. Want a real brain? Say "set key YOUR_KEY" with a free Gemini key.`;

    // thanks
    if (/thank|thanks|appreciated|good (job|work)/.test(low))
      return pick([`Anytime, ${name}.`, `That's what I'm here for.`, `Sleep well — I'll keep working.`]);

    // who are you
    if (/who are you|your name/.test(low))
      return `I'm Milo — your OS, your crew, your 3 AM shift.`;

    // cloud mind: think for real
    const cloud = await askCloud(t, ctx);
    if (cloud && cloud.text) return cloud.text;
    if (cloud && cloud.error)
      return `My cloud mind hiccuped (error ${cloud.status}), ${name} — check the key with "set key YOUR_KEY", or I can queue this overnight instead.`;

    // fallback: queue it for the real Milo overnight
    const title = t.length > 60 ? t.slice(0, 60) + '…' : t;
    ctx.addTask(title, `From conversation: "${t}" · needs the real Milo`, 'MILO');
    return pick([
      `I don't have my thinking cap on for that one yet, ${name} — queued it for the overnight crew. Morning brief will have it.`,
      `Handed that to the real me for tonight. Check the queue in the morning, ${name}.`,
    ]);
  },
};
