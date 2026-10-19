# MILO OS

A personal AI-agent command center — a dark, cinematic dashboard where **Milo**, a living particle sphere, runs your overnight crew: research, inbox, calendar, drafts. Inspired by the "Zoey" reel, rebuilt under our own name and design.

## Run it

No build step. Either:

- Open `index.html` directly in Chrome or Edge, or
- Serve it locally: `python3 -m http.server 8080` then visit `http://localhost:8080`

(Use the local server if `data/queue.json` doesn't load — browsers block `fetch()` on `file://` URLs. The app falls back to built-in seed data if that happens.)

## Voice

- **Talk:** tap the sphere, the mic button, or the mic in the chat box — then speak.
- **Barge-in:** tap the sphere while Milo is talking to cut it off and start listening.
- **Mute:** speaker icon top-right of the stage.
- Requirements: **Chrome or Edge** (Web Speech API), microphone permission, internet connection (browser speech recognition runs in the cloud). iOS Safari support is shaky — text chat always works.

Try: *"add a task: research flight prices for December"*, *"what are you working on?"*, *"list my tasks"*.

## The two-brain design (the honest part)

There are two Milos in this system, and that's deliberate:

1. **Instant brain** (`js/brain.js`) — a local intent router that runs in your browser. No API key, no server, no cost. It handles greetings, status reports (reads the live queue), adding tasks, listing tasks, time/date, and help. Anything it *can't* answer becomes a task in the overnight queue — and it tells you so, out loud.

2. **The real Milo** — me, the AI agent that built this. I process `data/queue.json` on a schedule (e.g. nightly): I take each `idle` task, do the actual work (research, drafting, triage), write the result into `data/results.json`, and flip the task to `done`. That's what makes "you sleep, Milo works" real instead of a demo trick.

### Overnight queue contract

`data/queue.json`:
```json
{ "tasks": [ { "id", "title", "detail", "status": "idle|working|blocked|done",
               "owner": "MILO|KARMA|PULSE", "created", "result" } ] }
```

`data/results.json`:
```json
{ "results": [ { "taskId", "title", "body" } ] }
```

The dashboard reads both files on load. Tasks added by voice in the browser are stored in `localStorage` for the session; the canonical overnight queue is the repo's `queue.json`, which the agent updates between runs.

## Layout

- **Left:** companion stats (Active / Done — tap to filter) + calendar (demo month grid for v1).
- **Center:** the sphere — ~2,500 midnight-blue particles (`#1e40d8`) wrapped in a blue-glow halo (`#5b86ff`), two satellite mini-spheres (the crew), MILO label, companion switcher, Knowledge View overlay, karaoke captions.
- **Right:** task queue (click a row to expand notes; UPLOAD / INSERT / ▶ OVERNIGHT) + chat tabs — **MILO** (talk), **KARMA** (overnight report), **PULSE** (activity log).

State machine: `idle → listening → thinking → speaking → idle`, plus `working` (blue pulse) for silent background work.

## Roadmap

- [ ] Wake word ("Milo") via always-on mic — phase 2
- [ ] Real calendar integration (Google Calendar)
- [ ] Knowledge View: particle node-graph of what Milo knows
- [ ] Mobile layout polish + PWA install
- [ ] Inbox/email connectors for real overnight triage
- [ ] Push the overnight queue through the GitHub repo so the agent and the dashboard share one source of truth live

## Giving Milo a real brain (free)

The built-in brain only knows a handful of things. To make Milo actually think and converse:

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and create a free API key (no credit card).
2. On the Milo OS site, type: `set key YOUR_KEY_HERE`
3. That's it — the key is stored only in your browser's local storage, never in the code or the repo. Type `clear key` anytime to remove it.

Optional: `set model gemini-2.5-flash` to switch models.
