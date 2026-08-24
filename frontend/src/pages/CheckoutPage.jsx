import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, CreditCard, User, Ticket, ArrowLeft, X } from 'lucide-react'
import api from '../services/api'
import useBookingStore from '../stores/bookingStore'
import useAuthStore from '../stores/authStore'
import { useToast } from '../components/Toast'

const STEPS = [
  { id: 'details', label: 'Details', icon: <User size={14} /> },
  { id: 'payment', label: 'Payment', icon: <CreditCard size={14} /> },
  { id: 'confirmation', label: 'Confirmed', icon: <CheckCircle size={14} /> },
]

export default function CheckoutPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const { selectedSeats, holds, totalPrice, checkoutStep, setCheckoutStep, setLastBooking, clearBooking, secondsRemaining } = useBookingStore()

  const [step, setStep] = useState('details')
  const [formData, setFormData] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', email: user?.email || '', phone: '' })
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(false)
  const [event, setEvent] = useState(null)

  useEffect(() => {
    api.get(`/events/${eventId}`).then(r => setEvent(r.data)).catch(() => {})
    if (selectedSeats.length === 0) navigate(`/events/${eventId}`)
  }, [eventId])

  // If hold expired, redirect back
  useEffect(() => {
    if (secondsRemaining === 0 && step !== 'confirmation') {
      toast.error('Your seat hold has expired. Please select seats again.')
      clearBooking()
      navigate(`/events/${eventId}`)
    }
  }, [secondsRemaining])

  const handleConfirmPayment = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/bookings', {
        eventId,
        seatIds: selectedSeats.map(s => s.id),
      })
      setBooking(data)
      setLastBooking(data)
      setStep('confirmation')
      clearBooking()
      toast.success('Booking confirmed! Check your email for the QR ticket.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel checkout and release your held seats?')) return
    try {
      for (const hold of holds) {
        await api.delete(`/bookings/events/${eventId}/seats/${hold.seatId}/hold`).catch(() => {})
      }
    } catch {}
    clearBooking()
    navigate(`/events/${eventId}`)
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="page">
      <div className="container-sm" style={{ maxWidth: 620 }}>
        {/* Progress stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div className={`step-circle ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`}>
                  {i < stepIndex ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i === stepIndex ? 'var(--color-primary)' : 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < stepIndex ? 'done' : ''}`} style={{ margin: '0 8px', marginBottom: 20 }} />
              )}
            </div>
          ))}
        </div>

        {/* Hold timer reminder */}
        {secondsRemaining !== null && step !== 'confirmation' && (
          <div className={`hold-timer ${secondsRemaining < 120 ? 'urgent' : ''}`} style={{ marginBottom: 24 }}>
            ⏱ Seats held for: <strong>{Math.floor(secondsRemaining/60)}:{String(secondsRemaining%60).padStart(2,'0')}</strong>
          </div>
        )}

        {/* STEP: Details */}
        {step === 'details' && (
          <div className="card card-glass" style={{ padding: 32 }}>
            <h2 style={{ marginBottom: 24 }}>Your Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="firstName">First Name *</label>
                <input id="firstName" className="form-input" value={formData.firstName}
                  onChange={e => setFormData(f => ({ ...f, firstName: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lastName">Last Name *</label>
                <input id="lastName" className="form-input" value={formData.lastName}
                  onChange={e => setFormData(f => ({ ...f, lastName: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="email">Email Address *</label>
              <input id="email" type="email" className="form-input" value={formData.email}
                onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ marginBottom: 28 }}>
              <label className="form-label" htmlFor="phone">Phone Number *</label>
              <input id="phone" type="tel" className="form-input" placeholder="+91 98765 43210"
                value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} required />
            </div>

            {/* Order summary */}
            <div className="divider" />
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>Order Summary — {event?.title}</div>
              {selectedSeats.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>Row {s.rowNumber}, Seat {s.seatNumber} ({s.categoryName})</span>
                  <span style={{ color: 'var(--color-primary)' }}>₹{parseFloat(s.price).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 18 }}>
                  ₹{totalPrice.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={handleCancel}>
                <X size={14} /> Cancel
              </button>
              <button className="btn btn-primary btn-full" onClick={() => {
                if (!formData.firstName || !formData.email || !formData.phone) return toast.warning('Please fill in all required fields')
                setStep('payment')
              }} id="proceed-to-payment-btn">
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {/* STEP: Payment */}
        {step === 'payment' && (
          <div className="card card-glass" style={{ padding: 32 }}>
            <h2 style={{ marginBottom: 8 }}>Payment</h2>
            <p style={{ marginBottom: 28 }}>Enter your card details below. This is a demo environment.</p>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Card Number</label>
              <input className="form-input" placeholder="4242 4242 4242 4242" maxLength={19}
                defaultValue="4242 4242 4242 4242" id="card-number" readOnly style={{ fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
              <div className="form-group">
                <label className="form-label">Expiry</label>
                <input className="form-input" placeholder="MM/YY" defaultValue="12/26" readOnly id="card-expiry" />
              </div>
              <div className="form-group">
                <label className="form-label">CVC</label>
                <input className="form-input" placeholder="•••" defaultValue="123" readOnly id="card-cvc" />
              </div>
            </div>

            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 24, fontSize: 13, color: 'var(--color-success)' }}>
              🔒 Demo mode — no real payment is processed
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>Total Amount</span>
              <span style={{ fontSize: 24, fontWeight: 800, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ₹{totalPrice.toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setStep('details')}>← Back</button>
              <button className="btn btn-primary btn-full btn-lg" onClick={handleConfirmPayment} disabled={loading} id="confirm-payment-btn">
                {loading ? <><span className="spinner" /> Processing...</> : `Confirm Payment — ₹${totalPrice.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* STEP: Confirmation */}
        {step === 'confirmation' && booking && (
          <div className="card" style={{ padding: 40, textAlign: 'center', borderColor: 'rgba(16,185,129,0.3)' }} id="booking-confirmation">
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>
              ✅
            </div>
            <h2 style={{ color: 'var(--color-success)', marginBottom: 8 }}>Booking Confirmed!</h2>
            <p style={{ marginBottom: 24 }}>Your tickets have been booked. A confirmation email with your QR code has been sent.</p>

            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 24px', display: 'inline-block', marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4 }}>Booking Reference</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                {booking.booking?.bookingReference}
              </div>
            </div>

            {booking.qrDataUrl && (
              <div style={{ marginBottom: 28 }}>
                <img src={booking.qrDataUrl} alt="QR Code Ticket" style={{ width: 180, height: 180, borderRadius: 12, border: '3px solid var(--color-primary)' }} />
                <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 8 }}>Scan at venue entrance</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => navigate(`/bookings/${booking.booking?.bookingId}`)}>
                <Ticket size={14} /> View Ticket
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>Browse More Events</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
