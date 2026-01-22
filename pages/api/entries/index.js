import prisma from '../../../lib/prisma'
import { withIronSessionApiRoute } from 'iron-session/next'
import { sessionOptions } from '../../../lib/session'

export default withIronSessionApiRoute(handler, sessionOptions)

async function handler(req, res) {
  if (!req.session.user || req.session.user.isLoggedIn !== true) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const entries = await prisma.entry.findMany({ orderBy: { date: 'desc' } })
      return res.status(200).json(entries)
    }

    if (req.method === 'POST') {
      const { date, hours, type, note, requiresMemo, memoDone } = req.body
      if (!date) return res.status(400).json({ error: 'date required' })
      const created = await prisma.entry.create({ data: { date, hours: Number(hours) || 0, type: type || 'extra', note: note || '', requiresMemo: Boolean(requiresMemo), memoDone: Boolean(memoDone) } })
      return res.status(201).json(created)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error', details: error.message })
  }

  res.setHeader('Allow', 'GET,POST')
  res.status(405).end('Method Not Allowed')
}
