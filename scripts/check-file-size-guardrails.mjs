#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const GUARDRAILS = [
  { path: 'extension/scripts/sidepanel.js', maxLines: 4600 },
  { path: 'extension/background.js', maxLines: 5600 },
  { path: 'app/dashboard/templates/page.tsx', maxLines: 1000 },
];

let failed = false;
for (const { path, maxLines } of GUARDRAILS) {
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n').length;
  if (lines > maxLines) {
    failed = true;
    console.error(`❌ ${path} has ${lines} lines (max ${maxLines}).`);
  } else {
    console.log(`✅ ${path} has ${lines} lines (max ${maxLines}).`);
  }
}

if (failed) process.exit(1);
