import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, Clock, MapPin, Tag, Users, ArrowLeft, AlertCircle } from 'lucide-react'
import api from '../services/api'
import SeatMap from '../components/SeatMap'
import useAuthStore from '../stores/authStore'
import useBookingStore from '../stores/bookingStore'
import { useToast } from '../components/Toast'

export default function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, token } = useAuthStore()
  const isAuthenticated = !!(user && token)
  const { selectedSeats, setEventId, clearSeats, setHolds, setTotalPrice, setCheckoutStep } = useBookingStore()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [holding, setHolding] = useState(false)
  const [waitlistCat, setWaitlistCat] = useState('')
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)

  useEffect(() => {
    setEventId(id)
    clearSeats()
    api.get(`/events/${id}`)
      .then(({ data }) => setEvent(data))
      .catch(() => toast.error('Failed to load event'))
      .finally(() => setLoading(false))
  }, [id])

  const totalPrice = selectedSeats.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
  const isSoldOut = event?.pricing?.every(p => parseInt(p.availableSeats) === 0)

  const handleHoldAndCheckout = async () => {
    if (!isAuthenticated) return navigate('/auth/login')
    if (selectedSeats.length === 0) return toast.warning('Please select at least one seat')
    setHolding(true)
    try {
      const { data } = await api.post(`/bookings/events/${id}/seats/hold`, {
        seatIds: selectedSeats.map(s => s.id),
      })
      setHolds(data.holds, data.holds[0]?.expiresAt || new Date(Date.now() + data.expiresIn * 1000))
      setTotalPrice(totalPrice)
      setCheckoutStep('details')
      navigate(`/checkout/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to hold seats. Please try again.')
    } finally {
      setHolding(false)
    }
  }

  const handleJoinWaitlist = async () => {
    if (!isAuthenticated) return navigate('/auth/login')
    if (!waitlistCat) return toast.warning('Please select a category')
    setJoiningWaitlist(true)
    try {
      const { data } = await api.post(`/waitlist/events/${id}/join`, { categoryId: waitlistCat })
      toast.success(`Added to waitlist at position #${data.position}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join waitlist')
    } finally {
      setJoiningWaitlist(false)
    }
  }

  if (loading) return (
    <div className="page container">
      <div className="skeleton" style={{ height: 36, width: 200, marginBottom: 32, borderRadius: 8 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 24 }} />
    </div>
  )

  if (!event) return (
    <div className="page container" style={{ textAlign: 'center' }}>
      <AlertCircle size={40} style={{ color: 'var(--color-danger)', marginBottom: 12 }} />
      <h2>Event not found</h2>
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
          {/* Left: event info + seat map */}
          <div>
            {/* Event header */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{event.eventType}</span>
                <span className={`badge ${event.status === 'published' ? 'badge-success' : 'badge-muted'}`} style={{ textTransform: 'capitalize' }}>{event.status}</span>
              </div>
              <h1 style={{ fontSize: '1.8rem', marginBottom: 16 }}>{event.title}</h1>
              <p style={{ marginBottom: 20 }}>{event.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { icon: <Calendar size={16} />, label: 'Date', value: new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
                  { icon: <Clock size={16} />, label: 'Time', value: event.eventTime?.slice(0, 5) },
                  { icon: <MapPin size={16} />, label: 'Venue', value: `${event.venueName}, ${event.venueCity}` },
                  { icon: <Tag size={16} />, label: 'By', value: `${event.organizerFirst} ${event.organizerLast}` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--color-primary)', marginTop: 2 }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pricing by category */}
              {event.pricing && event.pricing.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>Pricing</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {event.pricing.map(p => (
                      <div key={p.categoryId} style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 14px' }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.categoryName}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>₹{parseFloat(p.price).toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: parseInt(p.availableSeats) === 0 ? 'var(--color-danger)' : 'var(--color-text-dim)' }}>
                          {parseInt(p.availableSeats) === 0 ? 'Sold out' : `${p.availableSeats} left`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seat Map */}
            {!isSoldOut && (
              <div className="card" style={{ padding: 28 }}>
                <h3 style={{ marginBottom: 20 }}>Select Your Seats</h3>
                <SeatMap eventId={id} pricing={event.pricing || []} />
              </div>
            )}

            {/* Sold out + waitlist */}
            {isSoldOut && (
              <div className="card" style={{ padding: 28, borderColor: 'rgba(239,68,68,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <AlertCircle size={20} style={{ color: 'var(--color-danger)' }} />
                  <h3 style={{ margin: 0 }}>This event is sold out</h3>
                </div>
                <p style={{ marginBottom: 20 }}>Join the waitlist and we'll notify you when a seat becomes available.</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <select className="form-input" style={{ flex: 1 }} value={waitlistCat}
                    onChange={e => setWaitlistCat(e.target.value)} aria-label="Category for waitlist">
                    <option value="">Select category...</option>
                    {event.pricing?.map(p => <option key={p.categoryId} value={p.categoryId}>{p.categoryName} — ₹{p.price}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={handleJoinWaitlist} disabled={joiningWaitlist} id="join-waitlist-btn">
                    {joiningWaitlist ? <span className="spinner" /> : null}
                    Join Waitlist
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: booking summary */}
          {!isSoldOut && (
            <div style={{ position: 'sticky', top: 88 }}>
              <div className="card card-glass" style={{ padding: 24 }}>
                <h3 style={{ marginBottom: 20 }}>Booking Summary</h3>

                {selectedSeats.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-dim)', fontSize: 14 }}>
                    <Users size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                    Click seats on the map to select them
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {selectedSeats.map(seat => (
                        <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '8px 12px', background: 'rgba(108,99,255,0.08)', borderRadius: 8 }}>
                          <span style={{ color: 'var(--color-text)' }}>Row {seat.rowNumber}, Seat {seat.seatNumber}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{seat.categoryName}</span>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>₹{parseFloat(seat.price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="divider" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                      <span style={{ fontWeight: 600 }}>Total</span>
                      <span style={{ fontSize: 20, fontWeight: 700, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        ₹{totalPrice.toLocaleString()}
                      </span>
                    </div>

                    <button className="btn btn-primary btn-full btn-lg" onClick={handleHoldAndCheckout}
                      disabled={holding} id="hold-checkout-btn">
                      {holding ? <><span className="spinner" /> Holding seats...</> : `Proceed to Checkout (${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''})`}
                    </button>
                    <p style={{ fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center', marginTop: 10 }}>
                      Seats held for 10 minutes after clicking
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 900px) { .event-detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
