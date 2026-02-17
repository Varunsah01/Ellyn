import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const ROOT = process.cwd()
const TARGET_DIRS = ['app/api', 'lib', 'components', 'hooks']

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      files.push(...walk(fullPath))
      continue
    }
    if (!entry.isFile()) continue
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.d\.ts$/.test(entry.name)) continue
    files.push(fullPath)
  }
  return files
}

function normalizePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

function hasJsDoc(node, sourceFile) {
  const leading = sourceFile.text.slice(node.getFullStart(), node.getStart(sourceFile))
  return /\/\*\*[\s\S]*?\*\//.test(leading)
}

function getLineIndent(text, pos) {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const lineText = text.slice(lineStart, pos)
  const match = lineText.match(/^[ \t]*/)
  return match ? match[0] : ''
}

function buildComment({ indent, summary, paramType, returnType, example }) {
  return [
    `${indent}/**`,
    `${indent} * ${summary}`,
    `${indent} * @param {${paramType}} props - Component props.`,
    `${indent} * @returns {${returnType}} JSX output.`,
    `${indent} * @example`,
    `${indent} * ${example}`,
    `${indent} */`,
    '',
  ].join('\n')
}

let updatedFiles = 0
let updatedBlocks = 0

const files = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))

for (const filePath of files) {
  const text = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const localExported = new Set()
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier) continue
    const clause = statement.exportClause
    if (!clause || !ts.isNamedExports(clause)) continue
    for (const elem of clause.elements) {
      localExported.add(elem.propertyName ? elem.propertyName.text : elem.name.text)
    }
  }

  if (localExported.size === 0) continue

  const inserts = []

  const declByName = new Map()

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      declByName.set(statement.name.text, { node: statement, kind: 'function', decl: statement })
    }

    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        declByName.set(d.name.text, { node: statement, kind: 'variable', decl: d })
      }
    }
  }

  for (const exportName of localExported) {
    const target = declByName.get(exportName)
    if (!target) continue
    if (hasJsDoc(target.node, sourceFile)) continue

    if (target.kind === 'function') {
      const fn = target.decl
      const param = fn.parameters[0]
      const paramType = param?.type ? param.type.getText(sourceFile) : 'unknown'
      const returnType = fn.type ? fn.type.getText(sourceFile) : 'unknown'
      const indent = getLineIndent(text, target.node.getStart(sourceFile))
      const comment = [
        `${indent}/**`,
        `${indent} * Render the ${exportName} function.`,
        ...(param
          ? [`${indent} * @param {${paramType}} ${ts.isIdentifier(param.name) ? param.name.text : 'props'} - Function input.`]
          : []),
        `${indent} * @returns {${returnType}} Computed ${returnType}.`,
        `${indent} * @example`,
        `${indent} * ${exportName}()`,
        `${indent} */`,
        '',
      ].join('\n')
      inserts.push({ pos: target.node.getStart(sourceFile), text: comment })
      continue
    }

    const decl = target.decl
    const init = decl.initializer

    if (init && ts.isCallExpression(init)) {
      const callText = init.expression.getText(sourceFile)
      if (callText.includes('forwardRef') || callText.includes('memo')) {
        const typeArgs = init.typeArguments || []
        const propsType = typeArgs[1] ? typeArgs[1].getText(sourceFile) : 'Record<string, unknown>'
        const indent = getLineIndent(text, target.node.getStart(sourceFile))
        const comment = buildComment({
          indent,
          summary: `Render the ${exportName} component.`,
          paramType: propsType,
          returnType: 'JSX.Element',
          example: `<${exportName} />`,
        })
        inserts.push({ pos: target.node.getStart(sourceFile), text: comment })
        continue
      }
    }

    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
      const param = init.parameters[0]
      const paramType = param?.type ? param.type.getText(sourceFile) : 'unknown'
      const returnType = decl.type
        ? decl.type.getText(sourceFile)
        : init.type
          ? init.type.getText(sourceFile)
          : 'unknown'
      const indent = getLineIndent(text, target.node.getStart(sourceFile))
      const comment = [
        `${indent}/**`,
        `${indent} * ${exportName.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}.`,
        ...(param
          ? [`${indent} * @param {${paramType}} ${ts.isIdentifier(param.name) ? param.name.text : 'props'} - Function input.`]
          : []),
        `${indent} * @returns {${returnType}} Computed ${returnType}.`,
        `${indent} * @example`,
        `${indent} * ${exportName}()`,
        `${indent} */`,
        '',
      ].join('\n')
      inserts.push({ pos: target.node.getStart(sourceFile), text: comment })
    }
  }

  if (inserts.length === 0) continue

  inserts.sort((a, b) => b.pos - a.pos)
  let nextText = text
  for (const edit of inserts) {
    nextText = nextText.slice(0, edit.pos) + edit.text + nextText.slice(edit.pos)
    updatedBlocks += 1
  }

  fs.writeFileSync(filePath, nextText, 'utf8')
  updatedFiles += 1
}

console.log(`Added export-list JSDoc blocks: ${updatedBlocks}`)
console.log(`Updated files: ${updatedFiles}`)
