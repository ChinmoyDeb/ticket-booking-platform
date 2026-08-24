import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import { ToastProvider } from './components/Toast'
import useAuthStore from './stores/authStore'

// Pages
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BookingHistoryPage from './pages/BookingHistoryPage'
import BookingDetailPage from './pages/BookingDetailPage'
import OrganizerDashboard from './pages/OrganizerDashboard'
import RevenueReportPage from './pages/RevenueReportPage'
import AdminVenuesPage from './pages/AdminVenuesPage'
import WaitlistActionPage from './pages/WaitlistActionPage'

// Protected route wrapper
function Protected({ children, roles }) {
  const { user, token } = useAuthStore()
  const isAuthenticated = !!(user && token)
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

// Auth-only (redirect if already logged in)
function AuthRoute({ children }) {
  const { user, token } = useAuthStore()
  const isAuthenticated = !!(user && token)
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { loadToken } = useAuthStore()

  useEffect(() => {
    loadToken()
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />

              {/* Auth */}
              <Route path="/auth/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
              <Route path="/auth/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />

              {/* Customer */}
              <Route path="/checkout/:eventId" element={<Protected roles={['customer', 'organizer', 'admin']}><CheckoutPage /></Protected>} />
              <Route path="/bookings" element={<Protected><BookingHistoryPage /></Protected>} />
              <Route path="/bookings/:bookingId" element={<Protected><BookingDetailPage /></Protected>} />

              {/* Waitlist offer actions (from email links) */}
              <Route path="/waitlist/accept" element={<Protected><WaitlistActionPage /></Protected>} />
              <Route path="/waitlist/decline" element={<Protected><WaitlistActionPage /></Protected>} />

              {/* Organizer */}
              <Route path="/organizer/events" element={<Protected roles={['organizer', 'admin']}><OrganizerDashboard /></Protected>} />
              <Route path="/organizer/events/:eventId/bookings" element={<Protected roles={['organizer', 'admin']}><RevenueReportPage /></Protected>} />

              {/* Venues (Admin & Organizer) */}
              <Route path="/admin/venues" element={<Protected roles={['organizer', 'admin']}><AdminVenuesPage /></Protected>} />

              {/* Fallback */}
              <Route path="*" element={
                <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
                  <div style={{ fontSize: 80 }}>🎭</div>
                  <h1 style={{ margin: '24px 0 8px' }}>Page Not Found</h1>
                  <p>The page you are looking for does not exist.</p>
                  <a href="/" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 24 }}>Go Home</a>
                </div>
              } />
            </Routes>
          </main>

          {/* Footer */}
          <footer style={{ borderTop: '1px solid var(--color-border)', padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-dim)' }}>
            <div className="container">
              <span>© 2025 TicketHub — Book events, concerts & sports · Real-time seat selection</span>
            </div>
          </footer>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}
