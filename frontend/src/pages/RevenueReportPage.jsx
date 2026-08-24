import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { DollarSign, Users, Percent, TrendingUp } from 'lucide-react'
import api from '../services/api'
import { useToast } from '../components/Toast'

export default function RevenueReportPage() {
  const { eventId } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/events/${eventId}/bookings`),
      api.get(`/events/${eventId}/revenue`),
    ]).then(([bRes, rRes]) => {
      setData(bRes.data)
      setRevenue(rRes.data)
    }).catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false))
  }, [eventId])

  if (loading) return <div className="page container"><div className="spinner-lg" style={{ margin: '80px auto' }} /></div>

  const summary = data?.summary || {}
  const bookings = data?.bookings || []
  const cats = revenue?.revenueByCategory || []

  const statCards = [
    { label: 'Total Revenue', value: `₹${parseFloat(summary.totalRevenue || 0).toLocaleString()}`, icon: <DollarSign size={20} />, color: 'var(--color-primary)' },
    { label: 'Bookings', value: summary.totalBookings || 0, icon: <Users size={20} />, color: 'var(--color-success)' },
    { label: 'Cancellations', value: summary.cancellations || 0, icon: <TrendingUp size={20} />, color: 'var(--color-warning)' },
  ]

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: 32 }}>Revenue Report</h1>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          {statCards.map(s => (
            <div key={s.label} className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <span className="badge badge-muted">{s.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Revenue by category */}
        {cats.length > 0 && (
          <div className="card" style={{ padding: 24, marginBottom: 32 }}>
            <h3 style={{ marginBottom: 20 }}>Revenue by Category</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cats.map(c => (
                <div key={c.categoryName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(108,99,255,0.07)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.categoryName}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{c.ticketsSold} tickets sold</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ₹{parseFloat(c.revenue || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking list */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 20 }}>Booking List</h3>
          {bookings.length === 0 ? (
            <p style={{ color: 'var(--color-text-dim)', fontSize: 14 }}>No bookings yet</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Reference', 'Customer', 'Seats', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-dim)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: 12 }}>{b.bookingReference}</td>
                      <td style={{ padding: '10px 12px' }}>{b.firstName} {b.lastName}<br /><span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{b.customerEmail}</span></td>
                      <td style={{ padding: '10px 12px' }}>{b.seats?.length || 0}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--color-success)' }}>₹{parseFloat(b.totalAmount).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${b.status === 'confirmed' ? 'badge-success' : 'badge-danger'}`}>{b.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
