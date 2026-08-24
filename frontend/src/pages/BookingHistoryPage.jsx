import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Ticket, CheckCircle, XCircle, Clock } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'

export default function BookingHistoryPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()

  const fetchBookings = async () => {
    try {
      const { data } = await api.get('/bookings/customer/all')
      setBookings(data)
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [])

  const handleCancel = async (bookingId, ref) => {
    if (!confirm(`Cancel booking ${ref}? This cannot be undone.`)) return
    setCancelling(bookingId)
    try {
      await api.put(`/bookings/${bookingId}/cancel`)
      toast.success('Booking cancelled successfully')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel booking')
    } finally {
      setCancelling(null)
    }
  }

  const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(`${b.eventDate.split('T')[0]}T${b.eventTime}`) > new Date())
  const past = bookings.filter(b => b.status === 'confirmed' && new Date(`${b.eventDate.split('T')[0]}T${b.eventTime}`) <= new Date())
  const cancelled = bookings.filter(b => b.status === 'cancelled')

  if (loading) return (
    <div className="page container">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />)}
    </div>
  )

  const BookingCard = ({ booking }) => {
    const isUpcoming = new Date(`${booking.eventDate.split('T')[0]}T${booking.eventTime}`) > new Date()
    const statusColor = { confirmed: 'badge-success', cancelled: 'badge-danger', refunded: 'badge-warning' }
    return (
      <div className="card" style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
        onClick={() => navigate(`/bookings/${booking.id}`)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span className={`badge ${statusColor[booking.status] || 'badge-muted'}`}>{booking.status}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-primary)' }}>{booking.bookingReference}</span>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{booking.eventTitle}</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', alignItems: 'center' }}>
                <Calendar size={12} />
                {new Date(booking.eventDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', alignItems: 'center' }}>
                <MapPin size={12} /> {booking.venueName}
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--color-text-muted)', alignItems: 'center' }}>
                <Ticket size={12} /> {booking.seats?.length} seat{booking.seats?.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ₹{parseFloat(booking.totalAmount).toLocaleString()}
            </div>
            {isUpcoming && booking.status === 'confirmed' && (
              <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleCancel(booking.id, booking.bookingReference) }}
                disabled={cancelling === booking.id} id={`cancel-${booking.id}`}>
                {cancelling === booking.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const Section = ({ title, items, icon, empty }) => (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {icon}
        <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
        <span className="badge badge-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-dim)', fontSize: 14 }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(b => <BookingCard key={b.id} booking={b} />)}
        </div>
      )}
    </div>
  )

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 780 }}>
        <h1 style={{ marginBottom: 36 }}>My Bookings</h1>
        <Section title="Upcoming" items={upcoming} icon={<Clock size={20} style={{ color: 'var(--color-primary)' }} />} empty="No upcoming bookings" />
        <Section title="Past Events" items={past} icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />} empty="No past events" />
        <Section title="Cancelled" items={cancelled} icon={<XCircle size={20} style={{ color: 'var(--color-danger)' }} />} empty="No cancelled bookings" />
      </div>
    </div>
  )
}
