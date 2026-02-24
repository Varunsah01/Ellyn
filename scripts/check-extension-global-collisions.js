const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const extensionRoot = path.join(repoRoot, "extension");
const sidepanelHtmlPath = path.join(extensionRoot, "sidepanel.html");
const backgroundPath = path.join(extensionRoot, "background.js");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseSidepanelScripts(html) {
  const scripts = [];
  const scriptPattern = /<script\s+[^>]*src="([^"]+)"/gi;
  for (const match of html.matchAll(scriptPattern)) {
    scripts.push(match[1]);
  }
  return scripts;
}

function parseWorkerScripts(backgroundSource) {
  const scripts = [];

  const loadOptionalPattern = /loadOptionalScript\(\s*['"]([^'"]+)['"]/g;
  for (const match of backgroundSource.matchAll(loadOptionalPattern)) {
    scripts.push(match[1]);
  }

  const importScriptsPattern = /importScripts\(([^)]+)\)/g;
  for (const match of backgroundSource.matchAll(importScriptsPattern)) {
    const args = match[1];
    const stringPattern = /['"]([^'"]+)['"]/g;
    for (const argMatch of args.matchAll(stringPattern)) {
      scripts.push(argMatch[1]);
    }
  }

  return Array.from(new Set(scripts));
}

function collectTopLevelDeclarations(source) {
  const lines = source.split(/\r?\n/);
  let depth = 0;
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateQuote = false;
  let escapeNext = false;

  const declarations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (depth === 0) {
      const declarationMatch = line.match(
        /^\s*(?:export\s+)?(const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/
      );
      if (declarationMatch) {
        declarations.push({
          kind: declarationMatch[1],
          name: declarationMatch[2],
          line: index + 1,
        });
      }
    }

    let inLineComment = false;

    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inLineComment) {
        break;
      }

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (inSingleQuote) {
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === "'") {
          inSingleQuote = false;
        }
        continue;
      }

      if (inDoubleQuote) {
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (inTemplateQuote) {
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === "`") {
          inTemplateQuote = false;
        }
        continue;
      }

      if (inBlockComment) {
        if (char === "*" && nextChar === "/") {
          inBlockComment = false;
          charIndex += 1;
        }
        continue;
      }

      if (char === "/" && nextChar === "/") {
        inLineComment = true;
        break;
      }

      if (char === "/" && nextChar === "*") {
        inBlockComment = true;
        charIndex += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }

      if (char === "`") {
        inTemplateQuote = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
  }

  return declarations;
}

function findCollisions(contextName, scriptPaths) {
  const declarationMap = new Map();
  const missingScripts = [];

  for (const relativeScriptPath of scriptPaths) {
    const absolutePath = path.join(extensionRoot, relativeScriptPath);
    if (!fs.existsSync(absolutePath)) {
      missingScripts.push(relativeScriptPath);
      continue;
    }

    const source = readFile(absolutePath);
    const declarations = collectTopLevelDeclarations(source);

    for (const declaration of declarations) {
      const key = declaration.name;
      if (!declarationMap.has(key)) {
        declarationMap.set(key, []);
      }
      declarationMap.get(key).push({
        context: contextName,
        script: relativeScriptPath,
        line: declaration.line,
        kind: declaration.kind,
      });
    }
  }

  const collisions = [];
  for (const [name, entries] of declarationMap.entries()) {
    if (entries.length > 1) {
      collisions.push({ name, entries });
    }
  }

  return { collisions, missingScripts };
}

function printCollisions(contextName, collisions) {
  for (const collision of collisions) {
    console.error(`[${contextName}] duplicate top-level declaration: ${collision.name}`);
    for (const entry of collision.entries) {
      console.error(`  - ${entry.script}:${entry.line} (${entry.kind})`);
    }
  }
}

function main() {
  if (!fs.existsSync(sidepanelHtmlPath)) {
    throw new Error(`Missing sidepanel HTML: ${sidepanelHtmlPath}`);
  }
  if (!fs.existsSync(backgroundPath)) {
    throw new Error(`Missing background service worker: ${backgroundPath}`);
  }

  const sidepanelScripts = parseSidepanelScripts(readFile(sidepanelHtmlPath));
  const workerScripts = parseWorkerScripts(readFile(backgroundPath));

  const sidepanelResult = findCollisions("sidepanel", sidepanelScripts);
  const workerResult = findCollisions("worker", [path.relative(extensionRoot, backgroundPath), ...workerScripts]);

  let hasFailures = false;

  if (sidepanelResult.missingScripts.length > 0) {
    hasFailures = true;
    console.error("[sidepanel] missing scripts:");
    for (const scriptPath of sidepanelResult.missingScripts) {
      console.error(`  - ${scriptPath}`);
    }
  }

  if (workerResult.missingScripts.length > 0) {
    hasFailures = true;
    console.error("[worker] missing scripts:");
    for (const scriptPath of workerResult.missingScripts) {
      console.error(`  - ${scriptPath}`);
    }
  }

  if (sidepanelResult.collisions.length > 0) {
    hasFailures = true;
    printCollisions("sidepanel", sidepanelResult.collisions);
  }

  if (workerResult.collisions.length > 0) {
    hasFailures = true;
    printCollisions("worker", workerResult.collisions);
  }

  if (hasFailures) {
    process.exit(1);
  }

  console.log("Extension global collision check passed.");
}

main();
