import fs from 'node:fs'
import path from 'node:path'

const REQUIRED_VARS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]

const PLACEHOLDER_TOKENS = ['your_', 'placeholder', 'example', 'changeme', 'replace', 'dummy']

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    if (!trimmed.includes('=')) return

    const [rawKey, ...rawValueParts] = trimmed.split('=')
    const key = String(rawKey || '').trim()
    if (!key) return

    const value = rawValueParts.join('=').trim()
    if (!(key in process.env)) {
      process.env[key] = value
    }
  })
}

function looksLikePlaceholder(value) {
  const input = String(value || '').trim().toLowerCase()
  if (!input) return true
  return PLACEHOLDER_TOKENS.some((token) => input.includes(token))
}

loadDotEnvLocal()

const invalid = REQUIRED_VARS.filter((name) => looksLikePlaceholder(process.env[name]))

if (invalid.length > 0) {
  console.error('\n[env-check] Missing/placeholder Firebase env vars:')
  invalid.forEach((name) => console.error(`- ${name}`))
  console.error('\nAdd real values in your deploy environment before production build/deploy.\n')
  process.exit(1)
}

console.log('[env-check] Firebase public env vars look valid.')
