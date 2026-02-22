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

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.session) {
        const { data: tech } = await supabase
          .from('technicians').select('role').eq('id', data.session.user.id).single()
        router.push(tech?.role === 'admin' || tech?.role === 'manager' ? '/admin' : '/technician')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          background: #080810;
          font-family: 'DM Sans', sans-serif;
        }

        /* Left panel */
        .login-left {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #06060d;
        }

        /* Vertical lines background */
        .lines-bg {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: space-around;
          pointer-events: none;
        }
        .line {
          width: 1px;
          height: 100%;
          background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 70%, transparent 100%);
        }

        /* Radial glow behind logo */
        .logo-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74,222,128,0.06) 0%, rgba(34,197,94,0.03) 40%, transparent 70%);
          pointer-events: none;
        }

        .logo-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
          opacity: ${mounted ? 1 : 0};
          transform: translateY(${mounted ? '0' : '20px'});
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .logo-ring {
          position: relative;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 40% 35%, #1c1c28 0%, #0e0e18 60%, #080810 100%);
          border: 1px solid rgba(74,222,128,0.08);
          box-shadow:
            0 0 0 1px rgba(74,222,128,0.05),
            0 0 40px rgba(74,222,128,0.06),
            0 0 80px rgba(74,222,128,0.03),
            inset 0 1px 0 rgba(255,255,255,0.05);
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        .logo-img {
          width: 170px;
          height: 170px;
          object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(74,222,128,0.25)) drop-shadow(0 0 40px rgba(74,222,128,0.1));
          animation: logoBreath 4s ease-in-out infinite;
        }

        @keyframes logoBreath {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(74,222,128,0.25)) drop-shadow(0 0 40px rgba(74,222,128,0.1)); }
          50% { filter: drop-shadow(0 0 30px rgba(74,222,128,0.4)) drop-shadow(0 0 60px rgba(74,222,128,0.15)); }
        }

        /* Orbiting dot */
        .orbit-ring {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          border: 1px dashed rgba(74,222,128,0.08);
          animation: orbitSpin 20s linear infinite;
        }
        .orbit-dot {
          position: absolute;
          top: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 10px #4ade80, 0 0 20px rgba(74,222,128,0.5);
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .brand-name {
          font-family: 'DM Sans', sans-serif;
          font-size: 20px;
          font-weight: 300;
          color: rgba(255,255,255,0.3);
          letter-spacing: 6px;
          text-transform: uppercase;
        }

        /* Right panel */
        .login-right {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 56px;
          background: #080810;
          border-left: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }

        .form-wrap {
          width: 100%;
          opacity: ${mounted ? 1 : 0};
          transform: translateX(${mounted ? '0' : '20px'});
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 40px;
        }
        .brand-logo img {
          width: 32px;
          height: 32px;
          object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(74,222,128,0.4));
        }
        .brand-text {
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.5px;
        }
        .brand-text span {
          display: inline-block;
          width: 7px;
          height: 7px;
          background: #4ade80;
          border-radius: 50%;
          margin-left: 3px;
          margin-bottom: 5px;
          box-shadow: 0 0 12px #4ade80;
        }

        .form-title {
          font-size: 30px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 6px;
          letter-spacing: -0.5px;
        }
        .form-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 36px;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.4);
          margin-bottom: 8px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .field-input {
          width: 100%;
          height: 50px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          padding: 0 16px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .field-input::placeholder { color: rgba(255,255,255,0.18); }
        .field-input:focus {
          border-color: rgba(74,222,128,0.3);
          background: rgba(74,222,128,0.03);
        }

        .pw-wrap { position: relative; }
        .pw-wrap .field-input { padding-right: 48px; }
        .pw-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          display: flex;
          padding: 4px;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: rgba(255,255,255,0.5); }

        .forgot {
          display: inline-block;
          margin-top: 8px;
          font-size: 13px;
          color: rgba(74,222,128,0.7);
          text-decoration: none;
          transition: color 0.2s;
        }
        .forgot:hover { color: #4ade80; }

        .error-box {
          padding: 12px 16px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: 10px;
          color: #fca5a5;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .submit-btn {
          width: 100%;
          height: 50px;
          background: #4ade80;
          color: #0a1a0e;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 24px rgba(74,222,128,0.25);
        }
        .submit-btn:hover:not(:disabled) {
          background: #86efac;
          box-shadow: 0 6px 32px rgba(74,222,128,0.35);
          transform: translateY(-1px);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .footer-text {
          text-align: center;
          margin-top: 32px;
          font-size: 12px;
          color: rgba(255,255,255,0.15);
        }

        /* Mobile */
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right {
            width: 100%;
            padding: 40px 24px;
            border-left: none;
          }
        }
      `}</style>

      <div className="login-root">
        {/* Left — animated logo */}
        <div className="login-left">
          <div className="lines-bg">
            {[...Array(8)].map((_, i) => <div key={i} className="line" />)}
          </div>
          <div className="logo-glow" />
          <div className="logo-container">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="orbit-ring">
                <div className="orbit-dot" />
              </div>
              <div className="logo-ring">
                <img src="/cautio_shield.webp" alt="Cautio" className="logo-img" />
              </div>
            </div>
            <div className="brand-name">Field Service</div>
          </div>
        </div>

        {/* Right — form */}
        <div className="login-right">
          <div className="form-wrap">
            <div className="brand-logo">
              <img src="/cautio_shield.webp" alt="Cautio" />
              <div className="brand-text">cautio<span /></div>
            </div>

            <div className="form-title">Sign in</div>
            <div className="form-subtitle">Welcome back — enter your credentials</div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '18px' }}>
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="admin@cautio.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="field-label">Password</label>
                <div className="pw-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="field-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <a href="#" className="forgot">Forgot password?</a>
              </div>

              {error && <div className="error-box">{error}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            <div className="footer-text">© 2025 Cautio · Field Service Management</div>
          </div>
        </div>
      </div>
    </>
  )
}
