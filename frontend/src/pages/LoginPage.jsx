import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Ticket } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import { useToast } from '../components/Toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { login, isLoading } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.firstName || user.email}!`)
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.15) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Ticket size={32} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--color-text)' }}>
              Ticket<span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
            </span>
          </Link>
        </div>

        <div className="card card-glass" style={{ padding: 36 }}>
          <h2 style={{ marginBottom: 6 }}>Welcome back</h2>
          <p style={{ marginBottom: 28, fontSize: 14 }}>Sign in to your account to book tickets</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input id="login-email" type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoComplete="email" />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" type={showPw ? 'text' : 'password'} className="form-input"
                  placeholder="••••••••" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required autoComplete="current-password"
                  style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)' }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <Link to="/auth/forgot-password" style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={isLoading} id="login-btn" style={{ marginTop: 8 }}>
              {isLoading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/auth/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign up</Link>
          </p>

          {/* Demo credentials */}
          <div style={{ marginTop: 20, background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.15)', borderRadius: 'var(--radius-md)', padding: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Demo Credentials</div>
            {[
              { label: 'Customer', email: 'customer@tickethub.com', pw: 'Customer@123' },
              { label: 'Organizer', email: 'organizer@tickethub.com', pw: 'Organizer@123' },
              { label: 'Admin', email: 'admin@tickethub.com', pw: 'Admin@12345' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-dim)', marginBottom: 4 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{d.label}:</span>
                <span style={{ fontFamily: 'monospace' }}>{d.email} / {d.pw}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
