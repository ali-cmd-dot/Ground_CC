'use client'

import { useState, useEffect } from 'react'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        .lp-root {
          height: 100dvh;
          width: 100vw;
          background: #050508;
          font-family: 'DM Sans', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Falling lines ── */
        .lines-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .fall-line {
          position: absolute;
          top: -150px;
          width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(74,222,128,0.6), transparent);
          animation: fallLine var(--dur) linear var(--delay) infinite;
          opacity: 0;
        }
        @keyframes fallLine {
          0%   { transform: translateY(0); opacity: 0; }
          5%   { opacity: 1; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(110vh); opacity: 0; }
        }

        /* ── Background logo ── */
        .bg-logo-wrap {
          position: absolute;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Desktop: left half */
        @media (min-width: 769px) {
          .bg-logo-wrap {
            left: 0; top: 0; bottom: 0;
            width: 50%;
          }
          .bg-logo-img { width: 340px; height: 340px; }
        }

        /* Mobile: full screen behind form */
        @media (max-width: 768px) {
          .bg-logo-wrap {
            inset: 0;
            width: 100%;
          }
          .bg-logo-img { width: 240px; height: 240px; }
        }

        .bg-logo-glow {
          position: absolute;
          width: 480px; height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 68%);
        }
        .bg-logo-img {
          object-fit: contain;
          position: relative;
          filter: drop-shadow(0 0 50px rgba(74,222,128,0.4)) drop-shadow(0 0 100px rgba(74,222,128,0.15));
          opacity: 0.9;
        }

        /* Desktop divider */
        .v-divider {
          position: absolute;
          left: 50%;
          top: 8%; height: 84%;
          width: 1px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.06) 75%, transparent);
        }
        @media (max-width: 768px) { .v-divider { display: none; } }

        /* ── Form panel ── */
        .form-panel {
          position: relative;
          z-index: 20;
          width: 100%;
          max-width: 420px;
          padding: 44px 40px;
          background: rgba(6,6,12,0.9);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05);
          transition: opacity 0.7s ease, transform 0.7s ease;
          opacity: ${mounted ? 1 : 0};
        }

        @media (min-width: 769px) {
          .form-panel {
            position: absolute;
            right: 7%;
            top: 50%;
            transform: translateY(-50%);
            margin: 0;
          }
        }

        @media (max-width: 768px) {
          .form-panel {
            margin: 0 16px;
            padding: 36px 28px;
          }
        }

        /* Brand */
        .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
        .brand-icon {
          width: 34px; height: 34px; object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(74,222,128,0.5));
        }
        .brand-name {
          font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px;
        }
        .brand-dot {
          display: inline-block; width: 6px; height: 6px;
          background: #4ade80; border-radius: 50%;
          margin-left: 2px; margin-bottom: 4px;
          box-shadow: 0 0 12px #4ade80;
        }

        .form-title { font-size: 27px; font-weight: 700; color: #fff; letter-spacing: -0.4px; margin-bottom: 4px; }
        .form-sub { font-size: 13px; color: rgba(255,255,255,0.27); margin-bottom: 30px; }

        .field { margin-bottom: 16px; }
        .field-label {
          display: block; font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.32); letter-spacing: 0.8px;
          text-transform: uppercase; margin-bottom: 7px;
        }
        .field-input {
          width: 100%; height: 48px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 12px; color: #fff;
          font-size: 15px; font-family: inherit;
          padding: 0 14px; outline: none;
          transition: border-color 0.2s, background 0.2s;
          -webkit-appearance: none;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.14); }
        .field-input:focus {
          border-color: rgba(74,222,128,0.4);
          background: rgba(74,222,128,0.03);
        }

        .pw-wrap { position: relative; }
        .pw-wrap .field-input { padding-right: 44px; }
        .pw-toggle {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: rgba(255,255,255,0.22); cursor: pointer;
          display: flex; padding: 4px;
          -webkit-tap-highlight-color: transparent;
        }

        .forgot { display: inline-block; margin-top: 7px; font-size: 12px; color: rgba(74,222,128,0.6); text-decoration: none; }
        .forgot:hover { color: #4ade80; }

        .error-box {
          margin-bottom: 16px; padding: 11px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; color: #fca5a5; font-size: 13px;
        }

        .login-btn {
          width: 100%; height: 50px;
          background: #4ade80; color: #041a0a;
          border: none; border-radius: 13px;
          font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; margin-top: 8px;
          transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
          box-shadow: 0 4px 24px rgba(74,222,128,0.3);
          -webkit-tap-highlight-color: transparent;
        }
        .login-btn:hover:not(:disabled) { background: #86efac; box-shadow: 0 6px 32px rgba(74,222,128,0.4); }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .footer { margin-top: 24px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.1); }
      `}</style>

      <div className="lp-root">
        {/* Falling lines */}
        <div className="lines-canvas">
          {[...Array(20)].map((_, i) => {
            const leftPct = (i / 20) * 100
            const dur = `${2.8 + (i % 5) * 0.6}s`
            const delay = `${(i * 0.3) % 4}s`
            const h = 80 + (i % 4) * 40
            return (
              <div key={i} className="fall-line" style={{
                left: `${leftPct}%`,
                height: `${h}px`,
                '--dur': dur,
                '--delay': delay,
              } as any} />
            )
          })}
        </div>

        {/* Desktop divider */}
        <div className="v-divider" />

        {/* Background logo */}
        <div className="bg-logo-wrap">
          <div className="bg-logo-glow" />
          <img src="/cautio_shield.webp" alt="" className="bg-logo-img" />
        </div>

        {/* Form */}
        <div className="form-panel">
          <div className="brand">
            <img src="/cautio_shield.webp" className="brand-icon" alt="Cautio" />
            <span className="brand-name">cautio<span className="brand-dot" /></span>
          </div>

          <div className="form-title">Sign in</div>
          <div className="form-sub">Enter your credentials to continue</div>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                type="email" className="field-input"
                placeholder="you@cautio.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required disabled={loading} autoComplete="email"
              />
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <div className="pw-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="field-input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required disabled={loading} autoComplete="current-password"
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <a href="#" className="forgot">Forgot password?</a>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="footer">© 2025 Cautio</div>
        </div>
      </div>
    </>
  )
}
