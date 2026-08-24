import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Clock, Ticket, Users } from 'lucide-react'

const TYPE_COLORS = {
  concert: 'event-type-concert',
  movie:   'event-type-movie',
  sports:  'event-type-sports',
}

const TYPE_EMOJI = { concert: '🎵', movie: '🎬', sports: '⚽' }

export default function EventCard({ event }) {
  const navigate = useNavigate()
  const available = parseInt(event.availableSeats) || 0
  const total = parseInt(event.totalSeats) || 1
  const pct = Math.round((available / total) * 100)
  const isSoldOut = available === 0

  return (
    <article
      className="card card-hover"
      onClick={() => navigate(`/events/${event.id}`)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/events/${event.id}`)}
      aria-label={`${event.title} — ${event.eventDate}`}
    >
      {/* Event type banner */}
      <div className={`${TYPE_COLORS[event.eventType] || 'event-type-concert'}`}
        style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, position: 'relative' }}>
        <span>{TYPE_EMOJI[event.eventType] || '🎫'}</span>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{event.eventType}</span>
        </div>
        {isSoldOut && (
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <span className="badge badge-danger">Sold Out</span>
          </div>
        )}
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <h3 style={{ color: 'var(--color-text)', fontSize: 16, fontWeight: 700, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {event.title}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <Calendar size={13} style={{ flexShrink: 0 }} />
            {new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <Clock size={13} style={{ flexShrink: 0 }} />
            {event.eventTime?.slice(0, 5)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <MapPin size={13} style={{ flexShrink: 0 }} />
            {event.venueName}, {event.venueCity}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 2 }}>From</div>
            <div style={{ fontSize: 18, fontWeight: 700, background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ₹{parseFloat(event.minPrice || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Users size={12} style={{ color: isSoldOut ? 'var(--color-danger)' : 'var(--color-text-dim)' }} />
            <span style={{ color: isSoldOut ? 'var(--color-danger)' : available < 10 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
              {isSoldOut ? 'Sold out' : `${available} left`}
            </span>
          </div>
        </div>

        {/* Availability bar */}
        {!isSoldOut && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct < 15 ? 'var(--color-danger)' : pct < 40 ? 'var(--color-warning)' : 'var(--color-success)',
              borderRadius: 2, transition: 'width 0.5s',
            }} />
          </div>
        )}
      </div>
    </article>
  )
}
