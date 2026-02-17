import fs from 'fs'
import path from 'path'
import ts from 'typescript'

const ROOT = process.cwd()
const TARGET_DIRS = ['app/api', 'components']
const HTTP_METHODS = new Set(['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'])

function walk(dir){
  const out=[]
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name)
    if(e.isDirectory()) out.push(...walk(p))
    else if(e.isFile() && /\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p)
  }
  return out
}

function hasJsDoc(node,sf){
  const lead=sf.text.slice(node.getFullStart(), node.getStart(sf))
  return /\/\*\*[\s\S]*?\*\//.test(lead)
}

function indentAt(text,pos){
  const start=text.lastIndexOf('\n',pos-1)+1
  const m=text.slice(start,pos).match(/^[ \t]*/)
  return m?m[0]:''
}

function routePathFrom(file){
  const rel=path.relative(ROOT,file).replace(/\\/g,'/')
  if(!rel.startsWith('app/api/')) return '/api'
  if(rel.endsWith('/route.ts')||rel.endsWith('/route.tsx')){
    return `/${rel.replace(/^app\//,'').replace(/\/route\.tsx?$/,'')}`
  }
  return `/${rel.replace(/^app\//,'').replace(/\.tsx?$/,'')}`
}

let updatedFiles=0
let updatedBlocks=0

for(const file of TARGET_DIRS.flatMap(d=>walk(path.join(ROOT,d)))){
  const text=fs.readFileSync(file,'utf8')
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  const rel=path.relative(ROOT,file).replace(/\\/g,'/')

  const inserts=[]

  for(const st of sf.statements){
    if(!ts.isVariableStatement(st)) continue
    const exported=(ts.getCombinedModifierFlags(st)&ts.ModifierFlags.Export)!==0
    if(!exported) continue
    if(hasJsDoc(st,sf)) continue

    for(const d of st.declarationList.declarations){
      if(!ts.isIdentifier(d.name) || !d.initializer || !ts.isCallExpression(d.initializer)) continue
      const name=d.name.text
      const callExprText=d.initializer.expression.getText(sf)

      if(rel.startsWith('app/api/') && HTTP_METHODS.has(name)){
        const routePath=routePathFrom(file)
        const ind=indentAt(text, st.getStart(sf))
        const comment=[
          `${ind}/**`,
          `${ind} * Handle ${name} requests for \`${routePath}\`.`,
          `${ind} * @returns {RouteHandler} Versioned route handler for ${name} ${routePath}.`,
          `${ind} * @throws {AuthenticationError} If the request is not authenticated.`,
          `${ind} * @throws {Error} If an unexpected server error occurs.`,
          `${ind} * @example`,
          `${ind} * // ${name} ${routePath}`,
          `${ind} * fetch('${routePath}', { method: '${name}' })`,
          `${ind} */`,
          '',
        ].join('\n')
        inserts.push({pos:st.getStart(sf), text:comment})
        break
      }

      if(rel.startsWith('components/') && /^[A-Z]/.test(name) && (callExprText.includes('forwardRef') || callExprText.includes('memo'))){
        const typeArgs=d.initializer.typeArguments||[]
        const propsType=typeArgs[1]?typeArgs[1].getText(sf):'Record<string, unknown>'
        const ind=indentAt(text, st.getStart(sf))
        const comment=[
          `${ind}/**`,
          `${ind} * Render the ${name} component.`,
          `${ind} * @param {${propsType}} props - Component props.`,
          `${ind} * @returns {JSX.Element} JSX output for ${name}.`,
          `${ind} * @example`,
          `${ind} * <${name} />`,
          `${ind} */`,
          '',
        ].join('\n')
        inserts.push({pos:st.getStart(sf), text:comment})
        break
      }
    }
  }

  if(!inserts.length) continue
  inserts.sort((a,b)=>b.pos-a.pos)
  let next=text
  for(const ins of inserts){
    next=next.slice(0,ins.pos)+ins.text+next.slice(ins.pos)
    updatedBlocks++
  }
  fs.writeFileSync(file,next,'utf8')
  updatedFiles++
}

console.log(`Added call-expression JSDoc blocks: ${updatedBlocks}`)
console.log(`Updated files: ${updatedFiles}`)
