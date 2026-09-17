import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { relative, resolve, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactsRoot = resolve(projectRoot, 'artifacts')

async function findHtmlFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      await findHtmlFiles(fullPath, files)
      continue
    }

    if (extname(entry.name).toLowerCase() === '.html') files.push(fullPath)
  }

  return files
}

function extractMetaAttributes(html) {
  const metaTags = []

  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = {}

    for (const match of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      const value = match[2] ?? match[3] ?? match[4] ?? ''
      attributes[match[1].toLowerCase()] = value
    }

    metaTags.push(attributes)
  }

  return metaTags
}

function readMeta(html, property) {
  for (const attributes of extractMetaAttributes(html)) {
    const key = (attributes.name || attributes.property || '').toLowerCase()
    if (key === property.toLowerCase()) return attributes.content || ''
  }

  return ''
}

function clean(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeFallbackName(value) {
  return clean(value)
    .replace(/x5f/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGenericTitle(text) {
  const genericTitles = ['react app', 'react artifact', 'document', 'untitled', 'example', 'home', 'index']
  return !text || genericTitles.includes(text.toLowerCase())
}

function extractHeadingTitle(html, fallback) {
  const candidates = [
    readMeta(html, 'og:title'),
    readMeta(html, 'twitter:title'),
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    ...[...html.matchAll(/<(h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => clean(match[2]))
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (isGenericTitle(candidate)) continue
    const normalized = candidate.replace(/x5f/gi, ' ').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (normalized.length >= 2 && normalized.length <= 120) return normalized
  }

  return decodeFallbackName(fallback)
}

function normalizeTitle(value, fallback) {
  const title = clean(value)
  if (!title || isGenericTitle(title)) return decodeFallbackName(fallback)
  return title
}

function resolvePreview(image, artifactUrl) {
  if (!image || image.startsWith('data:')) return ''
  if (/^https?:\/\//i.test(image)) return image

  try {
    return new URL(image, `https://artifact.local${artifactUrl}`).pathname
  } catch {
    return ''
  }
}

await mkdir(artifactsRoot, { recursive: true })
const files = await findHtmlFiles(artifactsRoot)
const artifacts = await Promise.all(files.map(async (file, index) => {
  const html = await readFile(file, 'utf8')
  const filePath = relative(projectRoot, file).split('\\').join('/')
  const url = `/${filePath}`
  const fallback = decodeFallbackName(basename(file, extname(file)))
  const title = normalizeTitle(extractHeadingTitle(html, fallback), fallback)

  return {
    id: filePath,
    title,
    description: clean(readMeta(html, 'description') || readMeta(html, 'og:description')) || 'Open the full artifact and view the source details.',
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
