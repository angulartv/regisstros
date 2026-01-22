import React, { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { withIronSessionSsr } from 'iron-session/next'
import { sessionOptions } from '../lib/session'
import { useRouter } from 'next/router'

function formatDateISO(d) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Home({ user }) {
  const [entries, setEntries] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    date: formatDateISO(new Date()),
    hours: 2,
    type: 'extra',
    note: '',
    requiresMemo: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    fetch('/api/entries')
      .then((r) => {
        if (r.status === 401) {
          router.push('/login')
          throw new Error('Unauthorized')
        }
        return r.json()
      })
      .then((data) => {
        if (mounted) {
          setEntries(data || [])
          setIsLoading(false)
        }
      })
      .catch((e) => {
        console.error('failed to load entries', e)
        setIsLoading(false)
      })
    return () => { mounted = false }
  }, [router])

  async function logout() {
    await fetch('/api/logout')
    router.push('/login')
  }

  function addEntry(e) {
    if (e) e.preventDefault()
    const hours = Number(form.hours) || 0
    // Validation: hours required for some types, others can be 0
    if (!form.date) return
    if (['extra', 'use', 'familiar'].includes(form.type) && hours <= 0) return

    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `/api/entries/${editingId}` : '/api/entries'

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        hours,
        type: form.type,
        note: form.note,
        requiresMemo: form.requiresMemo,
        memoDone: editingId ? entries.find(e => e.id === editingId)?.memoDone : false
      })
    })
      .then((r) => r.json())
      .then((saved) => {
        if (editingId) {
          setEntries((cur) => cur.map(e => e.id === editingId ? saved : e))
          setEditingId(null)
        } else {
          setEntries((cur) => [saved, ...cur])
        }
        setForm({
          date: formatDateISO(new Date()),
          hours: 2,
          type: 'extra',
          note: '',
          requiresMemo: false
        })
      })
      .catch((err) => alert('Error al guardar: ' + String(err)))
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setForm({
      date: entry.date,
      hours: entry.hours,
      type: entry.type,
      note: entry.note || '',
      requiresMemo: entry.requiresMemo
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({
      date: formatDateISO(new Date()),
      hours: 2,
      type: 'extra',
      note: '',
      requiresMemo: false
    })
  }

  async function removeEntry(id) {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return
    try {
      await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      setEntries((cur) => cur.filter((r) => r.id !== id))
    } catch (e) {
      alert('Error al eliminar: ' + String(e))
    }
  }

  async function toggleMemo(entry) {
    const newVal = !entry.memoDone
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, memoDone: newVal })
      })
      const updated = await res.json()
      setEntries((cur) => cur.map(e => e.id === entry.id ? updated : e))
    } catch (e) {
      alert('Error al actualizar memo: ' + String(e))
    }
  }

  // CSV export
  function exportCSV() {
    const csv = Papa.unparse(entries.map(e => ({
      ...e,
      requiresMemo: e.requiresMemo ? 'Yes' : 'No',
      memoDone: e.memoDone ? 'Yes' : 'No'
    })))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registros_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importCSV(file) {
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: async (res) => {
        const parsed = res.data
        const normalized = parsed
          .filter((r) => r.date)
          .map((r) => ({
            date: r.date,
            hours: Number(r.hours) || 0,
            type: r.type || 'extra',
            note: r.note || '',
            requiresMemo: r.requiresMemo === 'Yes' || r.requiresMemo === 'true',
            memoDone: r.memoDone === 'Yes' || r.memoDone === 'true'
          }))
        try {
          const created = await Promise.all(normalized.map((n) => fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) }).then((r) => r.json())))
          setEntries((cur) => [...created, ...cur])
          alert(`Importados ${created.length} registros`)
        } catch (e) {
          alert('Error al importar CSV: ' + String(e))
        }
      },
    })
  }

  // Drag and drop
  function onDragStart(ev, id) {
    ev.dataTransfer.setData('text/plain', String(id))
  }

  async function onDropToDay(ev, day) {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/plain')
    if (!id) return

    const dstr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // Find entry and update locally + DB
    const entry = entries.find(e => String(e.id) === String(id))
    if (!entry || entry.date === dstr) return

    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, date: dstr })
      })
      const updated = await res.json()
      setEntries((cur) => cur.map((e) => (String(e.id) === String(id) ? updated : e)))
    } catch (e) {
      console.error(e)
    }
  }

  function onDragOver(ev) { ev.preventDefault() }

  const totals = useMemo(() => {
    const totalExtra = entries.filter((e) => e.type === 'extra').reduce((s, e) => s + Number(e.hours), 0)
    const totalUsed = entries.filter((e) => e.type === 'use').reduce((s, e) => s + Number(e.hours), 0)
    const diasFamiliares = entries.filter((e) => e.type === 'familiar').length
    const pendingMemos = entries.filter(e => e.requiresMemo && !e.memoDone).length
    return { totalExtra, totalUsed, net: totalExtra - totalUsed, diasFamiliares, pendingMemos }
  }, [entries])

  // Simple month calendar mapping
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function entriesForDay(day) {
    const dstr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return entries.filter((e) => e.date === dstr)
  }

  return (
    <div>
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '1rem 0' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>Horas Extras</h1>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gestión de tiempo - Hola, {user?.login || 'Admin'}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={logout} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>Salir</button>
            <button onClick={exportCSV} className="btn-primary" style={{ background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Exportar CSV</button>
            <label className="btn-primary" style={{ cursor: 'pointer', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              Importar CSV
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => importCSV(e.target.files[0])} />
            </label>
          </div>
        </div>
      </header>

      <div className="container">
        <main>
          <div className="cards">
            <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Horas Disponibles</h3>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{totals.net} <span style={{ fontSize: '1rem' }}>h</span></p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Horas Acumuladas</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: '600' }}>{totals.totalExtra} h</p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Horas Usadas</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: '600' }}>{totals.totalUsed} h</p>
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Días Familiares</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: '600' }}>{totals.diasFamiliares}</p>
            </div>
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Memos Pendientes</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: '600', color: totals.pendingMemos > 0 ? 'var(--warning)' : 'inherit' }}>{totals.pendingMemos}</p>
            </div>
          </div>

          <form onSubmit={addEntry} className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{editingId ? 'Editar Evento' : 'Registrar Nuevo Evento'}</h3>
              {editingId && (
                <button type="button" onClick={cancelEdit} style={{ background: 'none', border: '1px solid var(--text-secondary)', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Cancelar Edición
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <label>
                Fecha
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <label>
                Tipo
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="extra">Hora extra (+)</option>
                  <option value="use">Usar horas (-)</option>
                  <option value="familiar">Día familiar</option>
                  <option value="memo">Memo Informativo</option>
                  <option value="change">Cambio de Turno</option>
                </select>
              </label>
              {['extra', 'use', 'familiar'].includes(form.type) && (
                <label>
                  Horas
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })}
                    required
                  />
                </label>
              )}
              <label style={{ gridColumn: 'span 2' }}>
                Nota
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Detalles adicionales..."
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={form.requiresMemo}
                  onChange={(e) => setForm({ ...form, requiresMemo: e.target.checked })}
                  style={{ width: 'auto', margin: 0 }}
                />
                Requiere Memo
              </label>
              <button type="submit" className="btn-primary" style={{ background: editingId ? 'var(--primary)' : undefined }}>
                {editingId ? 'Actualizar' : 'Agregar Registro'}
              </button>
            </div>
          </form>

          <div className="calendar card" style={{ marginBottom: '2rem' }}>
            <div style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
              <h2>{today.toLocaleString('es-ES', { month: 'long' })} <span style={{ color: 'var(--text-secondary)' }}>{year}</span></h2>
            </div>
            <div className="calendar-grid">
              {days.map((d) => {
                const dayEntries = entriesForDay(d)
                return (
                  <div key={d} className="day" onDrop={(e) => onDropToDay(e, d)} onDragOver={onDragOver}>
                    <strong>{d}</strong>
                    {dayEntries.map((ev) => (
                      <div key={ev.id} className="note" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderLeft: `3px solid ${ev.type === 'extra' ? 'var(--success)' :
                            ev.type === 'use' ? 'var(--danger)' :
                              ev.type === 'familiar' ? 'var(--primary)' :
                                ev.type === 'memo' ? '#f59e0b' : '#8b5cf6'
                          }`
                      }}>
                        <span>
                          {ev.type === 'extra' ? `+${ev.hours}h` :
                            ev.type === 'use' ? `-${ev.hours}h` :
                              ev.type === 'familiar' ? 'Fam.' :
                                ev.type === 'memo' ? 'Memo' : 'Camb.'}
                        </span>
                        {ev.requiresMemo && (
                          <span
                            style={{ cursor: 'pointer', fontSize: '10px' }}
                            onClick={() => toggleMemo(ev)}
                            title={ev.memoDone ? "Memo completado" : "Memo pendiente"}
                          >
                            {ev.memoDone ? '✅' : '⚠️'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3>Historial Reciente</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Fecha</th>
                    <th style={{ padding: '0.75rem' }}>Tipo</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Horas</th>
                    <th style={{ padding: '0.75rem' }}>Nota</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Memo</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .slice()
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((ev) => (
                      <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }} draggable onDragStart={(e) => onDragStart(e, ev.id)}>
                        <td style={{ padding: '0.75rem' }}>{ev.date}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className={`status-badge ${ev.type === 'extra' ? 'success' : ev.type === 'use' ? 'warning' : 'primary'}`}
                            style={{
                              background: ev.type === 'extra' ? '#dcfce7' : ev.type === 'use' ? '#fee2e2' : ev.type === 'familiar' ? '#dbeafe' : ev.type === 'memo' ? '#fef3c7' : '#ede9fe',
                              color: ev.type === 'extra' ? '#166534' : ev.type === 'use' ? '#991b1b' : ev.type === 'familiar' ? '#1e40af' : ev.type === 'memo' ? '#92400e' : '#5b21b6'
                            }}>
                            {ev.type === 'extra' ? 'Extra' : ev.type === 'use' ? 'Uso' : ev.type === 'familiar' ? 'Familiar' : ev.type === 'memo' ? 'Memo' : 'Cambio'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>{ev.hours}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.note}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {ev.requiresMemo && (
                            <button
                              onClick={() => toggleMemo(ev)}
                              style={{ background: 'none', border: 'none', fontSize: '1.2rem' }}
                              title={ev.memoDone ? "Marcar como pendiente" : "Marcar como listo"}
                            >
                              {ev.memoDone ? '✅' : '⚠️'}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => startEdit(ev)} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button onClick={() => removeEntry(ev.id)} style={{ color: 'var(--danger)', background: 'none', border: 'none', padding: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </main >
      </div >
    </div >
  )
}

export const getServerSideProps = withIronSessionSsr(
  async function getServerSideProps({ req }) {
    const user = req.session.user

    if (!user || user.isLoggedIn !== true) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      }
    }

    return {
      props: {
        user: req.session.user,
      },
    }
  },
  sessionOptions
)
