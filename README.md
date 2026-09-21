# helpox-starter

The reusable foundation for small paid web apps by Helpox: auth, database, payments with credits,
security, privacy and deployment, solved once.

## How this repo is built

The base is built like a Lego robot from an instruction manual: one page per robot part, one numbered step
at a time, in the order given in `docs/build-map.json`. Claude Code builds, a separate inspector agent checks
every step, and the owners approve by trying things out, not by reading code. Rules are in `CLAUDE.md`.

## Command center

```bash
node center/serve.mjs
```

Open http://localhost:4400 to see the robot, the manual page you are on, what waits for your check and what
Claude Code should do next. Requires Node.js 20 or newer. No other dependencies.

## Start

Open this folder in Claude Code and say:

> Lue CLAUDE.md ja tee seuraava vaihe.
