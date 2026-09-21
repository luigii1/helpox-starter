# Inspection reports

One file per brick, written by the inspector subagent: `<brick-id>.json`.
The command center reads these files. Never edit a report by hand; re-run the inspection instead.

```json
{
  "brick": "E4",
  "inspected_at": "2026-10-04T18:22:00+03:00",
  "result": "pass",
  "summary_fi": "Webhook tarkistaa allekirjoituksen ja lisää krediitit vain kerran.",
  "checks": [
    { "check": "Invalid signature returns 403 before any processing", "result": "pass",
      "evidence": "test webhook.spec.ts > rejects forged signature" },
    { "check": "Replayed event returns 200 and grants nothing", "result": "pass",
      "evidence": "test webhook.spec.ts > replay is idempotent" }
  ]
}
```

`result` is `pass` only when every check passes. `summary_fi` is one plain-Finnish sentence for the commander.
