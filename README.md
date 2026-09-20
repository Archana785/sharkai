# SharkAI

Get honest, easy-to-read feedback on a startup idea, then turn it into a pitch.
**React + Vite** frontend, **Node + Express** backend, **Ollama** (local LLM) for the AI.

```
Browser (React)  ->  Express API  ->  Ollama (llama3.1:8b)  ->  structured JSON  ->  Report / Journey / Pitch
```

## Quick start

You need [Node.js 20+](https://nodejs.org) and [Ollama](https://ollama.com).

```bash
ollama pull llama3.1:8b        # once (about 5 GB)
ollama serve                   # if Ollama is not already running

npm install                    # installs client + server
npm run dev                    # API on :8787, app on http://localhost:5173
```

Open http://localhost:5173, type an idea (or click an example), and press **Enter**.

Production style (one process, one port):

```bash
npm run build && npm start     # http://localhost:8787
```

## Folder structure

```
sharkai/
  package.json              npm workspaces + scripts (dev, build, start, test)
  client/                   React + Vite
    src/
      pages/                Home, Report, Journey, Pitch      (the four screens)
      components/           Workspace (input + in-place loading/result), QuestionCard, ScoreRing, Background, ...
      context/EvalContext   shared state: idea, phase, result (saved to localStorage)
      hooks/                useSpeech (voice input), useCountUp, useInView
      lib/                  api.js (fetch + friendly errors), examples.js, format.js
      styles/global.css     design tokens and components
      __tests__/            UI tests (vitest)
  server/                   Express + Ollama
    src/
      index.js, app.js      startup, middleware, one error format, serves client/dist in production
      config.js             environment settings
      routes/api.js         the endpoints
      services/ollama.js    talks to Ollama (timeouts, friendly errors, health)
      services/evaluate.js  evaluateIdea() and generatePitch() with retry
      prompts/              evaluate.js (system prompt + JSON schema), pitch.js
      lib/normalize.js      parse and validate the model's JSON
      lib/extract.js        text from .pdf .pptx .docx .txt .md
    test/                   API tests against a fake Ollama (node:test)
```

## API endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | | `{ ok, ollama: "up"\|"down", model, modelInstalled }` |
| POST | `/api/evaluate` | `{ idea }` (15 to 4000 chars) | the evaluation JSON below |
| POST | `/api/pitch` | `{ idea, strengths?, improvements?, variant? }` | `{ pitch }` (one paragraph) |
| POST | `/api/extract` | multipart, field `file` (8 MB max) | `{ text, truncated }` |

Every error has the same shape: `{ "error": { "code": "OLLAMA_DOWN", "message": "friendly text" } }`.

### The evaluation JSON

```jsonc
{
  "overallScore": 74,                 // recomputed on the server from the six scores (weighted)
  "verdict": "One friendly sentence.",
  "strengths":    ["...", "...", "..."],
  "improvements": ["...", "...", "..."],
  "evaluation": {
    "problem":     { "score": 84, "title": "Does this solve a real problem?", "description": "...", "insight": "...", "businessTerm": "Problem Validation" },
    "market":      { "...": "Will people actually use it?      / Market Potential" },
    "competition": { "...": "How crowded is the market?       / Competition Analysis" },
    "difference":  { "...": "What makes it different?         / USP (Unique Selling Proposition)" },
    "growth":      { "...": "Can this grow?                   / Scalability" },
    "revenue":     { "...": "Can it make money?               / Revenue Model" }
  },
  "roadmap": ["Short title: one concrete sentence.", "...", "...", "..."],
  "pitch": "One paragraph, written to be spoken."
}
```

`insight` is one addition to your spec: one sentence on what would raise that score. It powers the hover tooltips.

## How the AI flow works

1. **Frontend** (`Workspace.jsx`): Enter or click *Evaluate Idea*. The button spins and the box shows six stages. Nothing navigates.
2. **Express** (`routes/api.js`): validates the idea, rate limits, then calls `evaluateIdea()`.
3. **Ollama** (`services/ollama.js`): `POST /api/chat` with `format: <JSON schema>`. Ollama constrains decoding to that schema, so the reply is always valid JSON in the right shape. `stream: false`, `temperature 0.4`, `num_ctx 8192`.
4. **Parse and validate** (`lib/normalize.js`): strips code fences, fixes trailing commas, clamps scores to 0-100, enforces exactly 3 strengths, 3 improvements and 4 roadmap steps, forces the canonical card titles and business terms, and recomputes `overallScore`. If the reply is unusable it retries once with the reason added to the prompt.
5. **Pitch**: it comes in the same JSON. If it is shorter than 120 words the server writes it with a separate call. *Regenerate* uses `/api/pitch` with a different opening style each time.
6. **Frontend** stores the JSON in `EvalContext` (and `localStorage`). The score ring appears in the same box; *See full report* opens `/report`, which renders the summary and six cards straight from the JSON. `/journey` uses `roadmap`, `/pitch` uses `pitch`.

### Prompt engineering (see `server/src/prompts/`)

- A mentor persona with a plain-English rule ("jargon only in `businessTerm`").
- **Scoring rubric** so the numbers mean something: 90+ is rare, most early ideas land 45 to 80, areas must differ. For competition, a *higher* score means better positioned.
- **No invented facts**: no statistics, prices or competitor names that the founder did not give.
- The idea is wrapped in `<idea>` tags and declared to be data, which blunts prompt injection.
- Property order in the schema makes the model write the six area assessments **before** the verdict, strengths, roadmap and pitch, so those are informed by the analysis.
- Roadmap steps use "Short title: sentence" so the UI can label each stage.

### Error handling

| Situation | Code | What the user sees |
|---|---|---|
| Ollama not running | `OLLAMA_DOWN` | Message plus a hint to run `ollama serve` |
| Model not downloaded | `MODEL_MISSING` | The exact `ollama pull ...` command |
| Model too slow | `TIMEOUT` | Suggests a smaller model (limit: `OLLAMA_TIMEOUT_MS`, default 5 min) |
| Bad or incomplete JSON | `BAD_MODEL_OUTPUT` | After one automatic retry: try again or use a larger model |
| Idea too short or long | `IDEA_TOO_SHORT` / `IDEA_TOO_LONG` | Inline message |
| Too many requests | `RATE_LIMITED` | Wait a minute |
| Server not running | `NETWORK` | Hint to run `npm run dev` |

If the user cancels or closes the tab, the request to Ollama is aborted too.
While waiting, the box shows six progress stages; after 25 s it adds "Running on your computer. Bigger models can take a minute or two."

## Choosing a model

Set `OLLAMA_MODEL` in `server/.env` (copy `server/.env.example`).

- `llama3.1:8b` is the default and a solid all-rounder.
- Worth trying if answers are weak or the format breaks: `qwen2.5:7b` or `mistral-nemo`.
- On a slow or low-memory machine: `llama3.2:3b` (faster, lower quality).

I could not benchmark models here, so try two or three and keep the one whose feedback you like best.

## Homepage changes in this version

Badge removed. Heading unchanged but calmer: Space Grotesk 700, about 62px on desktop, tighter line height, two balanced lines. New shorter subtitle. Card keeps the title "Describe your startup idea", loses the helper text, and gets a beginner-friendly placeholder. Two icon-only tools with tooltips: **Upload File** (reads .pdf, .pptx, .docx, .txt, .md) and **Voice Input** (browser speech recognition: Chrome, Edge, Safari). Evaluate is teal (gold is now only for the score ring, labels and speaking time). "Try an example startup" chips fill the box. "How it works" is three plain steps. Spacing between heading, subtitle and card is tighter.

## Tests

```bash
npm test          # server (node:test, fake Ollama) + client (vitest)
```

The tests use a fake Ollama, so they run without downloading a model. Voice input needs a real browser and microphone, so it is not covered by them.
