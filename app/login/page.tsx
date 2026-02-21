'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.session) {
        const { data: tech } = await supabase.from('technicians').select('role').eq('id', data.session.user.id).single()
        router.push(tech?.role === 'admin' || tech?.role === 'manager' ? '/admin' : '/technician')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#06060e]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Left Panel - Logo */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden bg-[#08081a]">
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ position: 'relative', textAlign: 'center' }}>
          {/* Big logo */}
          <div style={{
            width: '260px', height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, rgba(37,99,235,0.15) 0%, rgba(10,10,30,0.8) 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 0 80px rgba(37,99,235,0.2), 0 0 160px rgba(37,99,235,0.08)',
            border: '1px solid rgba(37,99,235,0.15)',
          }}>
            <img
              src="/cautio_shield.webp"
              alt="Cautio"
              style={{ width: '190px', height: '190px', objectFit: 'contain', filter: 'drop-shadow(0 0 30px rgba(37,99,235,0.4))' }}
            />
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#fff', letterSpacing: '-1px', marginBottom: '8px' }}>
            cautio<span style={{
              display: 'inline-block', width: '9px', height: '9px',
              background: '#2563eb', borderRadius: '50%',
              marginLeft: '4px', marginBottom: '8px',
              boxShadow: '0 0 20px rgba(37,99,235,0.9)'
            }}></span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Field Service Management
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#06060e]">
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Mobile logo */}
          <div className="flex lg:hidden justify-center mb-8">
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, #08081a 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(37,99,235,0.2)',
              border: '1px solid rgba(37,99,235,0.15)',
            }}>
              <img src="/cautio_shield.webp" alt="Cautio" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
            </div>
          </div>

          <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#fff', marginBottom: '4px', letterSpacing: '-0.5px' }}>
            Sign in
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: '36px', fontSize: '14px' }}>
            Welcome back to Cautio
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', letterSpacing: '0.3px' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="admin@cautio.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%', height: '50px',
                  padding: '0 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#fff', fontSize: '15px', outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(37,99,235,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{
                    width: '100%', height: '50px',
                    padding: '0 48px 0 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    color: '#fff', fontSize: '15px', outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(37,99,235,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.25)', display: 'flex',
                    padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <a href="#" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>Forgot password?</a>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                color: '#f87171', fontSize: '13px',
                marginBottom: '20px',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: '50px',
                background: loading ? 'rgba(37,99,235,0.5)' : '#2563eb',
                color: '#fff', border: 'none',
                borderRadius: '12px',
                fontSize: '15px', fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 20px rgba(37,99,235,0.3)',
                letterSpacing: '0.3px',
              }}
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>
            © 2025 Cautio · Field Service Management
          </p>
        </div>
      </div>
    </div>
  )
}
