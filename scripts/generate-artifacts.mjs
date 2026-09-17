import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { relative, resolve, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactsRoot = resolve(projectRoot, 'artifacts')

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = resolve(directory, entry.name)
    return entry.isDirectory() ? findHtmlFiles(fullPath) : [fullPath]
  }))
  return files.flat().filter((file) => extname(file).toLowerCase() === '.html')
}

function readMeta(html, property) {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = {}
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)) attributes[match[1].toLowerCase()] = match[3]
    if ((attributes.name || attributes.property || '').toLowerCase() === property.toLowerCase()) return attributes.content || ''
  }
  return ''
}

function clean(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, '').trim()
}

function resolvePreview(image, artifactUrl) {
  if (!image || image.startsWith('data:')) return ''
  if (/^https?:\/\//i.test(image)) return image
  try { return new URL(image, `https://artifact.local${artifactUrl}`).pathname } catch { return '' }
}

await mkdir(artifactsRoot, { recursive: true })
const files = await findHtmlFiles(artifactsRoot)
const artifacts = await Promise.all(files.map(async (file, index) => {
  const html = await readFile(file, 'utf8')
  const filePath = relative(projectRoot, file).split('\\').join('/')
  const url = `/${filePath}`
  const fallback = basename(file, extname(file)).replace(/[-_]+/g, ' ')
  return {
    id: filePath,
    title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || fallback),
    description: clean(readMeta(html, 'description') || readMeta(html, 'og:description')),
    image: resolvePreview(readMeta(html, 'og:image') || readMeta(html, 'twitter:image'), url),
    type: clean(readMeta(html, 'artifact:type') || 'Behind the scenes'),
    date: clean(readMeta(html, 'artifact:date')),
    url,
    accent: index % 3,
  }
}))

artifacts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title, 'th'))
await writeFile(resolve(artifactsRoot, 'manifest.json'), `${JSON.stringify({ artifacts }, null, 2)}\n`)
console.log(`Artifact registry: ${artifacts.length} HTML file(s)`)
