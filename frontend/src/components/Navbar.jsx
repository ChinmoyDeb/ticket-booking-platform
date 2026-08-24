import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Ticket, LogOut, User, Calendar, LayoutDashboard, Building2, Menu, X } from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '../stores/authStore'

export default function Navbar() {
  const { user, token, logout } = useAuthStore()
  const isAuthenticated = !!(user && token)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <Ticket size={24} style={{ color: 'var(--color-primary)' }} />
          Ticket<span>Hub</span>
        </Link>

        {/* Desktop links */}
        <div className="navbar-links" style={{ display: 'flex' }}>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Events
          </NavLink>

          {isAuthenticated && user?.role === 'customer' && (
            <NavLink to="/bookings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              My Bookings
            </NavLink>
          )}
          {isAuthenticated && (user?.role === 'organizer' || user?.role === 'admin') && (
            <NavLink to="/organizer/events" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={14} /> Dashboard
            </NavLink>
          )}
          {isAuthenticated && (user?.role === 'admin' || user?.role === 'organizer') && (
            <NavLink to="/admin/venues" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={14} /> Venues
            </NavLink>
          )}

          <div style={{ width: 1, background: 'var(--color-border)', margin: '0 8px' }} />

          {isAuthenticated ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                <User size={14} />
                {user?.firstName || user?.email?.split('@')[0]}
                <span className="badge badge-primary" style={{ fontSize: 10 }}>{user?.role}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/auth/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="btn btn-ghost btn-sm" style={{ display: 'none' }} onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu" id="mobile-menu-btn">
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  )
}
