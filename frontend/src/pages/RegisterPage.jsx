import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Ticket } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import { useToast } from '../components/Toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { register, isLoading } = useAuthStore()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'customer' })
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    try {
      await register(form.email, form.password, form.role, form.firstName, form.lastName)
      toast.success('Account created! Welcome to TicketHub.')
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at 50% 0%, rgba(224,64,251,0.12) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Ticket size={32} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--color-text)' }}>
              Ticket<span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
            </span>
          </Link>
        </div>

        <div className="card card-glass" style={{ padding: 36 }}>
          <h2 style={{ marginBottom: 6 }}>Create your account</h2>
          <p style={{ marginBottom: 28, fontSize: 14 }}>Join TicketHub and start booking amazing events</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Role */}
            <div style={{ display: 'flex', gap: 8 }}>
              {['customer', 'organizer'].map(r => (
                <button type="button" key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                  className={`btn btn-full ${form.role === r ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize', fontSize: 13 }} id={`role-${r}-btn`}>
                  {r === 'customer' ? '🎫 Customer' : '🎭 Organizer'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" placeholder="John" value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} id="reg-firstName" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" placeholder="Doe" value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} id="reg-lastName" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-input" placeholder="you@example.com"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required id="reg-email" />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="form-input" placeholder="Min. 8 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                  style={{ paddingRight: 44 }} id="reg-password" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={isLoading} id="register-btn" style={{ marginTop: 8 }}>
              {isLoading ? <><span className="spinner" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-muted)' }}>
            Already have an account?{' '}
            <Link to="/auth/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
