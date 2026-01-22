import prisma from '../../../lib/prisma'
import { withIronSessionApiRoute } from 'iron-session/next'
import { sessionOptions } from '../../../lib/session'

export default withIronSessionApiRoute(handler, sessionOptions)

async function handler(req, res) {
  if (!req.session.user || req.session.user.isLoggedIn !== true) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { id } = req.query
    if (req.method === 'DELETE') {
      await prisma.entry.delete({ where: { id: Number(id) } })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'PUT') {
      const { date, hours, type, note, requiresMemo, memoDone } = req.body
      const updated = await prisma.entry.update({ where: { id: Number(id) }, data: { date, hours: Number(hours) || 0, type, note, requiresMemo, memoDone } })
      return res.status(200).json(updated)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal Server Error', details: error.message })
  }

  res.setHeader('Allow', 'DELETE,PUT')
  res.status(405).end('Method Not Allowed')
}
