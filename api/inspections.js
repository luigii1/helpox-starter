// Vercel serverless mirror of the local command center's /api/inspections route
// (see center/serve.mjs). Read-only: reads docs/inspections/*.json and returns them
// as one JSON array. No user-controlled paths.
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const dir = path.join(process.cwd(), 'docs', 'inspections');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');

  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return res.status(200).json([]);
  }

  const reports = [];
  for (const name of names) {
    if (!/^[A-Z][0-9]+\.json$/.test(name)) continue;
    try {
      reports.push(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
    } catch {
      reports.push({
        brick: name.replace('.json', ''),
        result: 'fail',
        summary_fi: 'Raportti on rikki eikä sitä voi lukea.',
        checks: [],
      });
    }
  }
  return res.status(200).json(reports);
};
