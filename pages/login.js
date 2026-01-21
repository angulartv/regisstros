import React, { useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
    const [password, setPassword] = useState('')
    const [errorObj, setErrorObj] = useState(null)
    const router = useRouter()

    async function handleSubmit(e) {
        e.preventDefault()
        setErrorObj(null)

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            })

            if (res.ok) {
                router.push('/')
            } else {
                const data = await res.json()
                setErrorObj(data.message)
            }
        } catch (error) {
            setErrorObj('An unexpected error occurred')
        }
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--bg-color)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Acceso Restringido</h1>

                <form onSubmit={handleSubmit}>
                    <label style={{ display: 'block', marginBottom: '1rem' }}>
                        Contraseña
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Ingrese su contraseña"
                            required
                            autoFocus
                            style={{ marginTop: '0.5rem' }}
                        />
                    </label>

                    {errorObj && (
                        <div style={{
                            color: 'var(--danger)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {errorObj}
                        </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    )
}
