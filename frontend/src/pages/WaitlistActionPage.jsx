import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../stores/authStore'
import { useToast } from '../components/Toast'

export default function WaitlistActionPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const action = window.location.pathname.includes('accept') ? 'accept' : 'decline'
  const navigate = useNavigate()
  const { user, token: authToken } = useAuthStore()
  const isAuthenticated = !!(user && authToken)
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      // Save token and redirect to login, then come back
      sessionStorage.setItem('waitlist_token', token)
      sessionStorage.setItem('waitlist_action', action)
      navigate(`/auth/login`)
    }
  }, [isAuthenticated])

  const handleAction = async () => {
    if (!token) return toast.error('Invalid offer link')
    setLoading(true)
    try {
      if (action === 'accept') {
        const { data } = await api.post(`/waitlist/accept?token=${token}`)
        setResult(data)
        toast.success('Offer accepted! Your booking is confirmed.')
      } else {
        await api.post(`/waitlist/decline?token=${token}`)
        toast.info('Offer declined.')
      }
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process offer')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ padding: 40, maxWidth: 420, textAlign: 'center' }}>
          {action === 'accept' ? (
            <>
              <CheckCircle size={48} style={{ color: 'var(--color-success)', margin: '0 auto 16px' }} />
              <h2 style={{ color: 'var(--color-success)', marginBottom: 8 }}>Booking Confirmed!</h2>
              {result?.booking && (
                <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 20, fontFamily: 'monospace', fontSize: 18, color: 'var(--color-primary)', fontWeight: 700 }}>
                  {result.booking.bookingReference}
                </div>
              )}
              <p style={{ marginBottom: 24 }}>Check your email for the QR code ticket.</p>
              <button className="btn btn-primary" onClick={() => navigate('/bookings')}>View My Bookings</button>
            </>
          ) : (
            <>
              <XCircle size={48} style={{ color: 'var(--color-text-dim)', margin: '0 auto 16px' }} />
              <h2 style={{ marginBottom: 8 }}>Offer Declined</h2>
              <p style={{ marginBottom: 24 }}>The seat has been offered to the next person in the waitlist.</p>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>Browse Events</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ padding: 40, maxWidth: 420, textAlign: 'center' }}>
        {action === 'accept' ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎫</div>
            <h2 style={{ marginBottom: 8 }}>Seat Offer</h2>
            <p style={{ marginBottom: 28 }}>A waitlisted seat is being offered to you. Accept to confirm your booking now.</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={handleAction} disabled={loading} id="accept-offer-btn">
              {loading ? <span className="spinner" /> : '✅ Accept Offer & Book'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ marginBottom: 8 }}>Decline Seat Offer?</h2>
            <p style={{ marginBottom: 28 }}>The seat will be offered to the next person in the waitlist.</p>
            <button className="btn btn-ghost btn-lg btn-full" onClick={handleAction} disabled={loading} id="decline-offer-btn">
              {loading ? <span className="spinner" /> : 'Decline Offer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
