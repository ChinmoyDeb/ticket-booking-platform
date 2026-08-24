import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, BarChart2, Calendar, MapPin, Users } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'
import useAuthStore from '../stores/authStore'

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', eventType: 'concert', eventDate: '', eventTime: '', venueId: '', pricing: [] })
  const [creating, setCreating] = useState(false)
  const { user } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/events/organizer/me'),
      api.get('/venues'),
    ]).then(([evRes, vRes]) => {
      setEvents(evRes.data.events)
      setVenues(vRes.data)
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const handleVenueChange = (venueId) => {
    const venue = venues.find(v => v.id === venueId)
    const pricing = (venue?.categories || []).map(c => ({ categoryId: c.id, categoryName: c.categoryName, price: c.basePrice || 0 }))
    setForm(f => ({ ...f, venueId, pricing }))
  }

  const handleCreate = async () => {
    if (!form.title || !form.eventDate || !form.eventTime || !form.venueId) return toast.warning('Please fill all required fields')
    setCreating(true)
    try {
      await api.post('/events', { ...form, pricing: form.pricing.map(p => ({ categoryId: p.categoryId, price: parseFloat(p.price) })) })
      toast.success('Event created! Publish it to make it live.')
      setShowCreate(false)
      const r = await api.get('/events/organizer/me')
      setEvents(r.data.events)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  const handlePublish = async (eventId) => {
    try {
      await api.patch(`/events/${eventId}/publish`)
      toast.success('Event published!')
      const r = await api.get('/events/organizer/me')
      setEvents(r.data.events)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1>Organizer Dashboard</h1>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)} id="create-event-btn">
            <Plus size={16} /> Create Event
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card" style={{ padding: 28, marginBottom: 32, borderColor: 'rgba(108,99,255,0.3)' }}>
            <h3 style={{ marginBottom: 20 }}>Create New Event</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Event Title *</label>
                <input className="form-input" placeholder="e.g. QuantumBeat Live 2025" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} id="event-title" />
              </div>
              <div className="form-group">
                <label className="form-label">Event Type *</label>
                <select className="form-input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                  <option value="concert">Concert</option>
                  <option value="movie">Movie</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Venue *</label>
                <select className="form-input" value={form.venueId} onChange={e => handleVenueChange(e.target.value)} id="event-venue">
                  <option value="">Select venue...</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}, {v.city}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.eventDate}
                  onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} id="event-date" />
              </div>
              <div className="form-group">
                <label className="form-label">Time *</label>
                <input type="time" className="form-input" value={form.eventTime}
                  onChange={e => setForm(f => ({ ...f, eventTime: e.target.value }))} id="event-time" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Pricing per category */}
              {form.pricing.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>Category Pricing</label>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {form.pricing.map((p, i) => (
                      <div key={p.categoryId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px' }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{p.categoryName}</span>
                        <span>₹</span>
                        <input type="number" className="form-input" style={{ width: 90, padding: '4px 8px' }}
                          value={p.price} onChange={e => {
                            const pricing = [...form.pricing]
                            pricing[i] = { ...pricing[i], price: e.target.value }
                            setForm(f => ({ ...f, pricing }))
                          }} min={0} id={`price-${p.categoryId}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating} id="submit-create-event">
                {creating ? <span className="spinner" /> : null} Create Event
              </button>
            </div>
          </div>
        )}

        {/* Events list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 16 }} />)}
          </div>
        ) : events.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
            <p style={{ color: 'var(--color-text-muted)' }}>No events yet. Create your first event!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(event => (
              <div key={event.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span className={`badge ${event.status === 'published' ? 'badge-success' : event.status === 'draft' ? 'badge-warning' : 'badge-muted'}`}>{event.status}</span>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{event.eventType}</span>
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{event.title}</h3>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <Calendar size={12} /> {new Date(event.eventDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <MapPin size={12} /> {event.venueName}
                      </span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <Users size={12} /> {event.availableSeats}/{event.totalSeats} seats available
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {event.status === 'draft' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handlePublish(event.id)} id={`publish-${event.id}`}>
                        Publish
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/organizer/events/${event.id}/bookings`)} id={`view-bookings-${event.id}`}>
                      <BarChart2 size={13} /> Revenue
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/events/${event.id}`)} id={`preview-${event.id}`}>
                      <Eye size={13} /> Preview
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
