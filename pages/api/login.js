import { withIronSessionApiRoute } from 'iron-session/next'
import { sessionOptions } from '../../lib/session'

export default withIronSessionApiRoute(loginRoute, sessionOptions)

async function loginRoute(req, res) {
    const { password } = req.body

    if (password === process.env.APP_PASSWORD) {
        req.session.user = {
            isLoggedIn: true,
            login: 'admin',
        }
        await req.session.save()
        res.json({ isLoggedIn: true })
    } else {
        res.status(401).json({ message: 'Contraseña incorrecta' })
    }
}
