import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const ROOT = process.cwd()
const TARGET_DIRS = ['app/api', 'lib', 'components', 'hooks']
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])

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

function getLineIndent(text, pos) {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const slice = text.slice(lineStart, pos)
  const match = slice.match(/^[ \t]*/)
  return match ? match[0] : ''
}

function hasJsDoc(node, sourceFile) {
  const leading = sourceFile.text.slice(node.getFullStart(), node.getStart(sourceFile))
  return /\/\*\*[\s\S]*?\*\//.test(leading)
}

function splitCamel(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
}

function sentenceCase(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

function getRoutePath(filePath) {
  const normalized = normalizePath(filePath)
  if (!normalized.startsWith('app/api/')) return null

  if (normalized.endsWith('/route.ts') || normalized.endsWith('/route.tsx')) {
    const noSuffix = normalized.replace(/\/route\.tsx?$/, '')
    return `/${noSuffix.replace(/^app\//, '')}`
  }

  return `/${normalized.replace(/^app\//, '').replace(/\.tsx?$/, '')}`
}

function isExported(node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
}

function getTypeText(typeNode, sourceFile) {
  return typeNode ? typeNode.getText(sourceFile) : 'unknown'
}

function safeIdentifierName(nameNode, index, isComponent) {
  if (ts.isIdentifier(nameNode)) return nameNode.text
  if (ts.isObjectBindingPattern(nameNode)) return isComponent && index === 0 ? 'props' : `param${index + 1}`
  if (ts.isArrayBindingPattern(nameNode)) return `param${index + 1}`
  return `param${index + 1}`
}

function inferExampleArg(typeText, name) {
  const type = typeText.toLowerCase()
  if (type.includes('string')) return `'${name}'`
  if (type.includes('number')) return '0'
  if (type.includes('boolean')) return 'true'
  if (type.includes('[]') || type.includes('array')) return '[]'
  if (type.includes('date')) return 'new Date()'
  if (type.includes('request')) return 'request'
  if (type.includes('nextrequest')) return 'request'
  return '{}'
}

function buildSummary({ name, isApiRoute, method, routePath, isHook, isComponent, relPath }) {
  if (isApiRoute && method && routePath) {
    return `Handle ${method} requests for \`${routePath}\`.`
  }

  if (isHook) {
    const body = splitCamel(name.replace(/^use/, '')) || 'shared auth state'
    return `Custom hook for ${body}.`
  }

  if (isComponent) {
    return `Render the ${name} component.`
  }

  if (relPath.startsWith('lib/')) {
    return `${sentenceCase(splitCamel(name))}.`
  }

  return `${sentenceCase(splitCamel(name))}.`
}

function buildReturnDescription({ isApiRoute, method, routePath, isComponent, returnType, isHook, name }) {
  if (isApiRoute && method && routePath) {
    return `JSON response for the ${method} ${routePath} request.`
  }

  const rt = (returnType || 'unknown').replace(/\s+/g, ' ').trim()

  if (isComponent || rt.includes('JSX.Element') || rt.includes('ReactNode')) {
    return `JSX output for ${name}.`
  }

  if (isHook) {
    return `Hook state and actions for ${splitCamel(name.replace(/^use/, ''))}.`
  }

  if (rt === 'void') return 'No return value.'

  return `Computed ${rt}.`
}

function buildExample({ isApiRoute, method, routePath, name, params, isHook, isComponent }) {
  if (isApiRoute && method && routePath) {
    if (method === 'GET') {
      return [`// ${method} ${routePath}`, `fetch('${routePath}')`]
    }

    return [
      `// ${method} ${routePath}`,
      `fetch('${routePath}', { method: '${method}' })`,
    ]
  }

  if (isComponent) {
    return [`<${name} />`]
  }

  if (isHook) {
    return [`const state = ${name}()`]
  }

  const args = params.map((p) => inferExampleArg(p.type, p.name)).join(', ')
  return [`${name}(${args})`]
}

function buildThrows({ isApiRoute, method, isAsync }) {
  const lines = []

  if (isApiRoute && method) {
    lines.push('{AuthenticationError} If the request is not authenticated.')
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      lines.push('{ValidationError} If the request payload fails validation.')
    }
    lines.push('{Error} If an unexpected server error occurs.')
    return lines
  }

  if (isAsync) {
    lines.push('{Error} If the operation fails.')
  }

  return lines
}

function formatJSDoc({
  indent,
  summary,
  params,
  returnType,
  returnDescription,
  throwsLines,
  exampleLines,
}) {
  const lines = []
  lines.push(`${indent}/**`)
  lines.push(`${indent} * ${summary}`)

  for (const param of params) {
    lines.push(
      `${indent} * @param {${param.type}} ${param.name} - ${param.description}`,
    )
  }

  if (returnType) {
    lines.push(`${indent} * @returns {${returnType}} ${returnDescription}`)
  }

  for (const throwLine of throwsLines) {
    lines.push(`${indent} * @throws ${throwLine}`)
  }

  if (exampleLines.length > 0) {
    lines.push(`${indent} * @example`)
    for (const line of exampleLines) {
      lines.push(`${indent} * ${line}`)
    }
  }

  lines.push(`${indent} */`)
  return `${lines.join('\n')}\n`
}

function extractExportedFunctions(sourceFile, relPath) {
  const items = []

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && isExported(node) && node.name) {
      items.push({
        kind: 'function',
        node,
        name: node.name.text,
        params: node.parameters,
        returnType: node.type,
        isAsync: Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)),
      })
    }

    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        if (!decl.initializer) continue

        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          items.push({
            kind: 'variable',
            node,
            name: decl.name.text,
            params: decl.initializer.parameters,
            returnType: decl.type ?? decl.initializer.type,
            isAsync: Boolean(decl.initializer.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)),
          })
          break
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return items.filter((item) => {
    if (item.kind === 'function' && item.name === 'default') return false
    // Skip factory wrapped handlers where generated docs are noisy.
    if (relPath.endsWith('app/api/v1/_utils.ts') && item.name === 'createVersionedHandler') return false
    return true
  })
}

function buildParamDescriptions(paramsMeta, { isComponent }) {
  return paramsMeta.map((param, index) => {
    if (isComponent && index === 0) {
      return {
        ...param,
        description: 'Component props.',
      }
    }

    const readable = splitCamel(param.name)
    return {
      ...param,
      description: readable ? `${sentenceCase(readable)} input.` : 'Function input.',
    }
  })
}

let updatedFiles = 0
let updatedBlocks = 0
const fileList = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))

for (const filePath of fileList) {
  const text = fs.readFileSync(filePath, 'utf8')
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind)
  const relPath = normalizePath(filePath)
  const entries = extractExportedFunctions(sourceFile, relPath)

  const inserts = []

  for (const entry of entries) {
    const targetNode = entry.node
    if (hasJsDoc(targetNode, sourceFile)) continue

    const name = entry.name
    const routePath = relPath.startsWith('app/api/') ? getRoutePath(filePath) : null
    const method = HTTP_METHODS.has(name) ? name : null
    const isApiRoute = relPath.startsWith('app/api/')
    const isHook = /^use[A-Z0-9]/.test(name)
    const isComponent = relPath.startsWith('components/') && /^[A-Z]/.test(name)

    const paramsMeta = entry.params.map((param, index) => ({
      name: safeIdentifierName(param.name, index, isComponent),
      type: getTypeText(param.type, sourceFile),
      optional: Boolean(param.questionToken || param.initializer),
    }))

    const paramsWithDescriptions = buildParamDescriptions(paramsMeta, { isComponent })
    const returnTypeText = getTypeText(entry.returnType, sourceFile)

    const jsdoc = formatJSDoc({
      indent: getLineIndent(text, targetNode.getStart(sourceFile)),
      summary: buildSummary({ name, isApiRoute, method, routePath, isHook, isComponent, relPath }),
      params: paramsWithDescriptions,
      returnType: returnTypeText,
      returnDescription: buildReturnDescription({
        isApiRoute,
        method,
        routePath,
        isComponent,
        returnType: returnTypeText,
        isHook,
        name,
      }),
      throwsLines: buildThrows({ isApiRoute, method, isAsync: entry.isAsync }),
      exampleLines: buildExample({
        isApiRoute,
        method,
        routePath,
        name,
        params: paramsMeta,
        isHook,
        isComponent,
      }),
    })

    inserts.push({ pos: targetNode.getStart(sourceFile), text: jsdoc })
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

console.log(`Added JSDoc blocks: ${updatedBlocks}`)
console.log(`Updated files: ${updatedFiles}`)
