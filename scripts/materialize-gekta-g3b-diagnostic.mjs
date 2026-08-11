#!/usr/bin/env node
import fs from 'node:fs';

const path = '.github/workflows/gekta-p0-speed-model-host-diagnostic.yml';
let text = fs.readFileSync(path, 'utf8');
const start = "          file=.github/workflows/gekta-p0-speed-model-host-diagnostic.yml\n          for forbidden in \\\n";
const startIndex = text.indexOf(start);
if (startIndex < 0) throw new Error('diagnostic contract start marker not found');
if (text.indexOf(start, startIndex + start.length) >= 0) throw new Error('diagnostic contract start marker ambiguous');
const endMarker = "          done\n          GITHUB_HEAD_REF=fix/gekta-p0-speed-g3b-diagnostic-3896 BASE_REF=origin/main bash scripts/p7-autopilot-guard.sh\n";
const endIndex = text.indexOf(endMarker, startIndex);
if (endIndex < 0) throw new Error('diagnostic contract end marker not found');
const replacement = `          file=.github/workflows/gekta-p0-speed-model-host-diagnostic.yml\n          node - "$file" <<'NODE'\n          const fs = require('node:fs');\n          const text = fs.readFileSync(process.argv[2], 'utf8');\n          const begin = text.indexOf("<<'REMOTE'\\n");\n          const end = begin < 0 ? -1 : text.indexOf('\\n          REMOTE', begin);\n          if (begin < 0 || end < 0) throw new Error('remote diagnostic heredoc not found');\n          const remote = text.slice(begin, end);\n          for (const forbidden of [\n            'systemctl restart', 'systemctl start', 'systemctl stop',\n            'systemctl enable', 'systemctl disable', 'systemctl daemon-reload',\n            'apt ', 'apt-get ', 'dnf ', 'yum ', 'chmod ', 'chown ',\n            'kill ', 'pkill ', 'rm -', 'tee /'\n          ]) {\n            if (remote.includes(forbidden)) throw new Error(\`forbidden remote mutation token: \${forbidden}\`);\n          }\n          NODE\n          GITHUB_HEAD_REF=fix/gekta-p0-speed-g3b-diagnostic-3896 BASE_REF=origin/main bash scripts/p7-autopilot-guard.sh\n`;
text = `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex + endMarker.length)}`;
fs.writeFileSync(path, text, 'utf8');
console.log('GEKTA_G3B_DIAGNOSTIC_CONTRACT_MATERIALIZED=1');
