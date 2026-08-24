import { useState, useEffect } from 'react'
import { Plus, Building2, Trash2 } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'

const EMPTY_CAT = { categoryName: '', basePrice: 500, quantity: 20 }

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', description: '', categories: [{ ...EMPTY_CAT }] })
  const toast = useToast()

  const fetchVenues = async () => {
    try {
      const { data } = await api.get('/venues')
      setVenues(data)
    } catch { toast.error('Failed to load venues') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchVenues() }, [])

  const handleCreate = async () => {
    if (!form.name || !form.city || form.categories.length === 0) return toast.warning('Please fill all required fields')
    for (const c of form.categories) {
      if (!c.categoryName || c.quantity <= 0) return toast.warning('All categories must have a name and quantity > 0')
    }
    setCreating(true)
    try {
      await api.post('/venues', form)
      toast.success('Venue created successfully!')
      setShowCreate(false)
      setForm({ name: '', city: '', address: '', description: '', categories: [{ ...EMPTY_CAT }] })
      fetchVenues()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create venue')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this venue? This cannot be undone.')) return
    try {
      await api.delete(`/venues/${id}`)
      toast.success('Venue deleted')
      fetchVenues()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete venue')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1>Manage Venues</h1>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)} id="create-venue-btn">
            <Plus size={16} /> Add Venue
          </button>
        </div>

        {showCreate && (
          <div className="card" style={{ padding: 28, marginBottom: 32, borderColor: 'rgba(108,99,255,0.3)' }}>
            <h3 style={{ marginBottom: 20 }}>Create New Venue</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Venue Name *</label>
                <input className="form-input" placeholder="Nexus Amphitheater" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} id="venue-name" />
              </div>
              <div className="form-group">
                <label className="form-label">City *</label>
                <input className="form-input" placeholder="Mumbai" value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))} id="venue-city" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="42, Bandra West, Mumbai 400050" value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Seat categories */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label">Seat Categories *</label>
                <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, categories: [...f.categories, { ...EMPTY_CAT }] }))}>
                  <Plus size={13} /> Add Category
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.categories.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input className="form-input" placeholder="Category Name (e.g. Premium)" style={{ flex: 2 }}
                      value={cat.categoryName} onChange={e => {
                        const cats = [...form.categories]; cats[i] = { ...cats[i], categoryName: e.target.value }
                        setForm(f => ({ ...f, categories: cats }))
                      }} id={`cat-name-${i}`} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>Base ₹</span>
                      <input type="number" className="form-input" style={{ flex: 1 }} min={0}
                        value={cat.basePrice} onChange={e => {
                          const cats = [...form.categories]; cats[i] = { ...cats[i], basePrice: parseFloat(e.target.value) }
                          setForm(f => ({ ...f, categories: cats }))
                        }} id={`cat-price-${i}`} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>Qty</span>
                      <input type="number" className="form-input" style={{ flex: 1 }} min={1}
                        value={cat.quantity} onChange={e => {
                          const cats = [...form.categories]; cats[i] = { ...cats[i], quantity: parseInt(e.target.value) }
                          setForm(f => ({ ...f, categories: cats }))
                        }} id={`cat-qty-${i}`} />
                    </div>
                    {form.categories.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, categories: f.categories.filter((_, j) => j !== i) }))}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 8 }}>
                Total seats: {form.categories.reduce((s, c) => s + (c.quantity || 0), 0)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating} id="submit-venue">
                {creating ? <span className="spinner" /> : null} Create Venue
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />)}
          </div>
        ) : venues.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <Building2 size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
            <p>No venues yet. Create your first venue!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {venues.map(v => (
              <div key={v.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px' }}>{v.name}</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 10px' }}>{v.city}{v.address ? ` · ${v.address}` : ''}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(v.categories || []).map(c => (
                        <span key={c.id} className="badge badge-muted">{c.categoryName} · {c.quantity} seats · ₹{c.basePrice}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-dim)', margin: '8px 0 0' }}>Total: {v.totalSeats} seats</p>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)} id={`delete-venue-${v.id}`}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
