import fs from 'fs'
import path from 'path'

const DATA_PATH = path.resolve(process.cwd(), 'data', 'backup.json')

function ensureDir() {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]')
}

export default function handler(req, res) {
  const key = process.env.BACKUP_KEY || 'dev-key'
  const provided = req.headers['x-api-key'] || req.query.key
  if (provided !== key) return res.status(401).json({ error: 'invalid key' })

  ensureDir()

  if (req.method === 'GET') {
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    return res.status(200).json({ data: JSON.parse(raw) })
  }

  if (req.method === 'POST') {
    const payload = req.body
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2))
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: String(e) })
    }
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
