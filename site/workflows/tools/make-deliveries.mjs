// Builds site/data/workflows/deliveries.json from this repository's own history on dev: for each commit, the agent its
// Agent: line names (only names on /data/agents/roster.json), the other roster agents its message names (a message),
// and the parts of the site its files changed (a deliverable). Commit text is cut to its subject, session links hidden.
//   git fetch origin dev && node site/workflows/tools/make-deliveries.mjs
// mistral.workflows@SovereignWebsite.dinis for Dinis Cruz, 21 November 2026. Code Apache-2.0.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const roster = JSON.parse(readFileSync('site/data/agents/roster.json', 'utf8')).agents;
const names = roster.map((a) => a.name);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = names.filter((n) => n.includes('.')).map((n) => ({ n, re: new RegExp(`(^|[^\\w.@-])${esc(n)}(?![\\w-]|\\.\\w)`, 'i') }));
const hide = (s) => String(s).replace(/https?:\/\/claude\.ai\/\S*/gi, '[session link hidden]').replace(/session_[A-Za-z0-9]{6,}/g, '[session id hidden]');
const SEP = '\u001e', FS = '\u001f';
const raw = execFileSync('git', ['log', 'origin/dev', '--reverse', '--name-only', `--format=${SEP}%H${FS}%aI${FS}%B${FS}`], { encoding: 'utf8', maxBuffer: 64e6 });
const part = (f) => { const p = f.split('/'); if (p[0] !== 'site') return p[0] === 'tools' || p[0] === 'docs' ? p[0] : 'repository'; if (p.length === 2) return 'home and root files'; return p[1] === 'data' ? 'data/' + (p[2] || '') : p[1]; };
const commits = raw.split(SEP).filter(Boolean).map((c) => {
  const [sha, at, body, files] = c.split(FS);
  const lines = body.split('\n'), tr = lines.filter((l) => /^Agent:/i.test(l.trim()));
  const a = tr.length ? tr[tr.length - 1].trim().slice(6).trim().split('@')[0].toLowerCase() : null;
  const agent = a && names.includes(a) ? a : null;
  const text = lines.filter((l) => !/^(Agent|Claude-Session|Co-Authored-By|Signed-off-by):/i.test(l.trim())).join('\n');
  const fl = files.split('\n').map((x) => x.trim()).filter(Boolean);
  const parts = {}; for (const f of fl) { const k = part(f); parts[k] = (parts[k] || 0) + 1; }
  return { sha: sha.slice(0, 7), at, agent, mentions: agent ? RE.filter((x) => x.n !== agent && x.re.test(text)).map((x) => x.n) : [], subject: hide(lines[0]).slice(0, 160), files: fl.length, parts };
});
writeFileSync('site/data/workflows/deliveries.json', JSON.stringify({ about: 'Every commit on dev of SovereignWebsite/Site__Provider__Mistral, as messages (the roster agents a commit names) and deliverables (the parts of the site its files changed). Made from git by site/workflows/tools/make-deliveries.mjs; names only from /data/agents/roster.json.', made: new Date().toISOString(), commits }, null, 1));
const by = {}; for (const c of commits) by[c.agent || '(none)'] = (by[c.agent || '(none)'] || 0) + 1;
console.log(commits.length, 'commits', JSON.stringify(by), commits.filter((c) => c.mentions.length).length, 'with mentions');
