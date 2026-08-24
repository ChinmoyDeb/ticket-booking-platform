import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Calendar, MapPin, Ticket } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'

export default function BookingDetailPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/bookings/${bookingId}`)
      .then(r => setBooking(r.data))
      .catch(() => toast.error('Booking not found'))
      .finally(() => setLoading(false))
  }, [bookingId])

  const handleDownloadQR = () => {
    if (!booking?.qrCodePath) return toast.warning('QR code not available for download here — check your email.')
    toast.info('QR code was sent to your email.')
  }

  if (loading) return <div className="page container"><div className="spinner-lg" style={{ margin: '80px auto' }} /></div>
  if (!booking) return (
    <div className="page container" style={{ textAlign: 'center' }}>
      <p>Booking not found</p>
      <button className="btn btn-primary" onClick={() => navigate('/bookings')} style={{ marginTop: 16 }}>My Bookings</button>
    </div>
  )

  const isUpcoming = new Date(`${booking.eventDate.split('T')[0]}T${booking.eventTime}`) > new Date()

  return (
    <div className="page">
      <div className="container-sm">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/bookings')} style={{ marginBottom: 24 }}>
          <ArrowLeft size={14} /> My Bookings
        </button>

        {/* Status header */}
        <div className="card" style={{ padding: 28, marginBottom: 24, borderColor: booking.status === 'confirmed' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>Booking Reference</div>
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: 'var(--color-primary)' }}>{booking.bookingReference}</div>
            </div>
            <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
              {booking.status}
            </span>
          </div>
        </div>

        {/* Event details */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>{booking.eventTitle}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: <Calendar size={14} />, text: new Date(booking.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              { icon: <MapPin size={14} />, text: `${booking.venueName}, ${booking.venueCity}` },
              { icon: <Ticket size={14} />, text: `${booking.seats?.length} seat${booking.seats?.length !== 1 ? 's' : ''}` },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: 'var(--color-text-muted)' }}>
                <span style={{ color: 'var(--color-primary)' }}>{item.icon}</span> {item.text}
              </div>
            ))}
          </div>

          <div className="divider" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {booking.seats?.map((seat, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 12px', background: 'rgba(108,99,255,0.07)', borderRadius: 8 }}>
                <span>Row {seat.row}, Seat {seat.seat} — {seat.category}</span>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>₹{parseFloat(seat.price).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontWeight: 700, fontSize: 16 }}>
            <span>Total Paid</span>
            <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 20 }}>
              ₹{parseFloat(booking.totalAmount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* QR Section */}
        {booking.status === 'confirmed' && isUpcoming && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8 }}>Your Entry QR Code</h3>
            <p style={{ fontSize: 13, marginBottom: 20 }}>Present this at the venue entrance for check-in</p>
            <div style={{ background: 'white', width: 200, height: 200, margin: '0 auto 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#333' }}>
              {/* QR is emailed; show placeholder */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
                <div>QR sent to your email</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={handleDownloadQR} id="download-qr-btn">
              <Download size={14} /> Check Email for QR
            </button>
            <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 12 }}>
              Valid until: {new Date(booking.eventDate).toLocaleDateString()} at {booking.venueName}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
