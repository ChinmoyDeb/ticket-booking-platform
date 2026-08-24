import { useState, useEffect, useCallback } from 'react'
import { Search, SlidersHorizontal, Calendar, Zap } from 'lucide-react'
import api from '../services/api'
import EventCard from '../components/EventCard'

export default function HomePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', eventType: '', sortBy: 'date' })
  const [searchInput, setSearchInput] = useState('')

  const fetchEvents = useCallback(async (pg = 1, f = filters) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: pg, limit: 12, ...f }
      Object.keys(params).forEach(k => !params[k] && delete params[k])
      const { data } = await api.get('/events', { params })
      if (pg === 1) setEvents(data.events)
      else setEvents(prev => [...prev, ...data.events])
      setTotal(data.total)
      setPage(pg)
    } catch (e) {
      setError('Failed to load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchEvents(1, filters)
  }, [filters])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilters(f => ({ ...f, search: searchInput })), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
  }

  return (
    <div className="page">
      <div className="container">
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '48px 0 40px' }} className="fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: 'var(--color-primary)', marginBottom: 20 }}>
            <Zap size={13} /> Live Events & Concerts
          </div>
          <h1 style={{ marginBottom: 16 }}>
            Find Your Next<br />
            <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Unforgettable Experience
            </span>
          </h1>
          <p style={{ fontSize: 16, maxWidth: 480, margin: '0 auto 36px' }}>
            Book seats for concerts, movies, and sports events. Real-time seat selection with instant QR ticket delivery.
          </p>

          {/* Search bar */}
          <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)', pointerEvents: 'none' }} />
            <input
              id="event-search"
              className="form-input"
              style={{ paddingLeft: 46, height: 52, fontSize: 15, borderRadius: 'var(--radius-xl)' }}
              placeholder="Search concerts, movies, sports..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Search events"
            />
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13 }}>
            <SlidersHorizontal size={14} /> Filters:
          </div>

          <select className="form-input" style={{ width: 'auto', padding: '8px 14px' }}
            value={filters.eventType} onChange={e => handleFilterChange('eventType', e.target.value)}
            aria-label="Event type filter">
            <option value="">All Types</option>
            <option value="concert">Concert</option>
            <option value="movie">Movie</option>
            <option value="sports">Sports</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} style={{ color: 'var(--color-text-dim)' }} />
            <input type="date" className="form-input" style={{ width: 'auto', padding: '8px 14px' }}
              value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)}
              aria-label="From date" />
            <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>to</span>
            <input type="date" className="form-input" style={{ width: 'auto', padding: '8px 14px' }}
              value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)}
              aria-label="To date" />
          </div>

          <select className="form-input" style={{ width: 'auto', padding: '8px 14px' }}
            value={filters.sortBy} onChange={e => handleFilterChange('sortBy', e.target.value)}
            aria-label="Sort by">
            <option value="date">Sort: Upcoming</option>
            <option value="price">Sort: Lowest Price</option>
            <option value="availability">Sort: Most Available</option>
          </select>

          {(filters.search || filters.eventType || filters.dateFrom || filters.dateTo) && (
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setFilters({ search: '', dateFrom: '', dateTo: '', eventType: '', sortBy: 'date' })
              setSearchInput('')
            }}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Results count */}
        {!loading && (
          <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 20 }}>
            {total} event{total !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="card" style={{ padding: 24, textAlign: 'center', borderColor: 'rgba(239,68,68,0.3)' }}>
            <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary" onClick={() => fetchEvents(1)}>Retry</button>
          </div>
        )}

        {/* Events grid */}
        {loading && page === 1 ? (
          <div className="grid-events">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card" style={{ height: 340 }}>
                <div className="skeleton" style={{ height: 140 }} />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="skeleton" style={{ height: 18, width: '70%' }} />
                  <div className="skeleton" style={{ height: 12, width: '50%' }} />
                  <div className="skeleton" style={{ height: 12, width: '60%' }} />
                  <div className="skeleton" style={{ height: 12, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎭</div>
            <h3 style={{ color: 'var(--color-text-muted)', marginBottom: 8 }}>No events found</h3>
            <p style={{ color: 'var(--color-text-dim)' }}>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <>
            <div className="grid-events">
              {events.map(e => <EventCard key={e.id} event={e} />)}
            </div>
            {/* Load more */}
            {events.length < total && (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <button className="btn btn-secondary btn-lg"
                  onClick={() => fetchEvents(page + 1)}
                  disabled={loading}
                  id="load-more-btn">
                  {loading ? <><span className="spinner" /> Loading...</> : `Load More (${total - events.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
