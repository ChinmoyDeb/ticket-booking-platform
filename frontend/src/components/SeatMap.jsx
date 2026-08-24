import { useState, useEffect, useCallback, useRef } from 'react'
import { Timer, RefreshCw } from 'lucide-react'
import api from '../services/api'
import useBookingStore from '../stores/bookingStore'
import useAuthStore from '../stores/authStore'

const POLL_INTERVAL = 5000

export default function SeatMap({ eventId, pricing = [] }) {
  const [seatMap, setSeatMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const { user } = useAuthStore()
  const { selectedSeats, addSeat, removeSeat, holds, secondsRemaining } = useBookingStore()
  const pollRef = useRef(null)

  const getPriceForCategory = (categoryName) => {
    const p = pricing.find(p => p.categoryName === categoryName)
    return p ? parseFloat(p.price) : 0
  }

  const fetchSeatMap = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setUpdating(true)
    try {
      const { data } = await api.get(`/events/${eventId}/seat-map`)
      setSeatMap(data.seatMap || {})
    } catch (e) {
      console.error('[SeatMap] Fetch error:', e.message)
    } finally {
      setLoading(false)
      setUpdating(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchSeatMap(false)
    pollRef.current = setInterval(() => fetchSeatMap(true), POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [fetchSeatMap])

  const isSelected = (seatId) => selectedSeats.some(s => s.id === seatId)
  const isHeldByMe = (seatId) => holds.some(h => h.seatId === seatId)

  const handleSeatClick = (seat) => {
    if (seat.status !== 'available' && !isSelected(seat.id)) return
    if (isSelected(seat.id)) {
      removeSeat(seat.id)
    } else {
      addSeat(seat)
    }
  }

  const getSeatClass = (seat) => {
    if (isSelected(seat.id)) return 'seat seat-selected'
    if (isHeldByMe(seat.id)) return 'seat seat-selected'
    if (seat.status === 'available') return 'seat seat-available'
    if (seat.status === 'held') return 'seat seat-held seat-unavailable'
    if (seat.status === 'booked') return 'seat seat-booked seat-unavailable'
    if (seat.status === 'blocked') return 'seat seat-blocked seat-unavailable'
    return 'seat seat-available'
  }

  const timerUrgent = secondsRemaining !== null && secondsRemaining < 120
  const timerMin = secondsRemaining !== null ? Math.floor(secondsRemaining / 60) : 0
  const timerSec = secondsRemaining !== null ? secondsRemaining % 60 : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 38, width: '100%', borderRadius: 6 }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Hold timer */}
      {secondsRemaining !== null && (
        <div className={`hold-timer ${timerUrgent ? 'urgent' : ''}`} style={{ marginBottom: 16 }}
          role="timer" aria-live="assertive" aria-label="Seat hold timer">
          <Timer size={16} />
          Hold expires in: <strong>{timerMin}:{String(timerSec).padStart(2, '0')}</strong>
          {timerUrgent && <span style={{ fontSize: 12 }}> — Complete checkout now!</span>}
        </div>
      )}

      {/* Updating indicator */}
      {updating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          <RefreshCw size={11} className="spinning" /> Updating seat map...
        </div>
      )}

      {/* Stage */}
      <div className="stage">🎭 Stage / Screen</div>

      {/* Seat grid */}
      <div className="seat-map-container">
        {Object.entries(seatMap)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([rowNum, seats]) => (
            <div key={rowNum} className="seat-row">
              <div className="seat-row-label">R{rowNum}</div>
              {seats.map(seat => (
                <div
                  key={seat.id}
                  className={getSeatClass(seat)}
                  onClick={() => handleSeatClick(seat)}
                  onMouseEnter={(e) => setTooltip({ seat, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  role="button"
                  tabIndex={seat.status === 'available' || isSelected(seat.id) ? 0 : -1}
                  aria-label={`Row ${rowNum} Seat ${seat.seatNumber} ${seat.categoryName} ₹${seat.price} — ${isSelected(seat.id) ? 'Selected' : seat.status}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleSeatClick(seat)}
                  title={`R${rowNum}-S${seat.seatNumber}`}
                >
                  {seat.seatNumber}
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 60, zIndex: 200,
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: '8px 12px',
          fontSize: 12, pointerEvents: 'none', boxShadow: 'var(--shadow-float)',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
            Row {tooltip.seat.rowNumber}, Seat {tooltip.seat.seatNumber}
          </div>
          <div style={{ color: 'var(--color-text-muted)' }}>{tooltip.seat.categoryName} · ₹{tooltip.seat.price}</div>
          <div style={{ color: tooltip.seat.status === 'available' ? 'var(--color-success)' : 'var(--color-danger)', textTransform: 'capitalize' }}>
            {isSelected(tooltip.seat.id) ? 'Selected' : tooltip.seat.status}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="seat-legend" style={{ marginTop: 20 }}>
        {[
          { label: 'Available',  color: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
          { label: 'Selected',   color: 'rgba(108,99,255,0.3)',  border: 'var(--color-primary)' },
          { label: 'Held',       color: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
          { label: 'Booked',     color: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
          { label: 'Blocked',    color: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
        ].map(l => (
          <div key={l.label} className="legend-item">
            <div className="legend-dot" style={{ background: l.color, borderColor: l.border }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}
