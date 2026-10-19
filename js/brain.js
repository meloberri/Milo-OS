// MILO OS — local brain. Intent router, no API key needed.
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

export const Brain = {
  // ctx: { queue, results, addTask(title, detail), userName }
  async respond(text, ctx) {
    const t = text.trim();
    const low = t.toLowerCase();
    const name = (ctx && ctx.userName) || 'Josh';

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
      return `Talk to me, ${name} — I'll queue overnight tasks, report on the crew, and keep the lights on. Try "add a task: draft the gym plan".`;

    // thanks
    if (/thank|thanks|appreciated|good (job|work)/.test(low))
      return pick([`Anytime, ${name}.`, `That's what I'm here for.`, `Sleep well — I'll keep working.`]);

    // who are you
    if (/who are you|your name/.test(low))
      return `I'm Milo — your OS, your crew, your 3 AM shift.`;

    // fallback: queue it for the real Milo overnight
    const title = t.length > 60 ? t.slice(0, 60) + '…' : t;
    ctx.addTask(title, `From conversation: "${t}" · needs the real Milo`, 'MILO');
    return pick([
      `That's above my pay grade in here, ${name} — but I queued it for the overnight crew. I'll brief you in the morning.`,
      `Handed that to the real me for tonight. Check the queue in the morning, ${name}.`,
    ]);
  },
};
