'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        const { data: technician } = await supabase
          .from('technicians')
          .select('role')
          .eq('id', data.session.user.id)
          .single()

        if (technician?.role === 'admin' || technician?.role === 'manager') {
          router.push('/admin')
        } else {
          router.push('/technician')
        }
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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #080808;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }

        /* LEFT SIDE */
        .left-panel {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0a;
          overflow: hidden;
        }

        .left-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0, 80, 255, 0.08) 0%, transparent 70%),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 80px,
              rgba(255,255,255,0.015) 80px,
              rgba(255,255,255,0.015) 81px
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 80px,
              rgba(255,255,255,0.015) 80px,
              rgba(255,255,255,0.015) 81px
            );
        }

        /* Vertical lines like in screenshot */
        .grid-lines {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .grid-lines span {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255,255,255,0.04) 20%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.04) 80%,
            transparent 100%
          );
          animation: linePulse 4s ease-in-out infinite;
        }

        .grid-lines span:nth-child(1) { left: 15%; animation-delay: 0s; }
        .grid-lines span:nth-child(2) { left: 30%; animation-delay: 0.5s; }
        .grid-lines span:nth-child(3) { left: 45%; animation-delay: 1s; }
        .grid-lines span:nth-child(4) { left: 60%; animation-delay: 1.5s; }
        .grid-lines span:nth-child(5) { left: 75%; animation-delay: 2s; }
        .grid-lines span:nth-child(6) { left: 90%; animation-delay: 0.8s; }

        /* Horizontal line that runs top to bottom (like in screenshot) */
        .center-line {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255,255,255,0.1) 30%,
            rgba(0, 100, 255, 0.3) 50%,
            rgba(255,255,255,0.1) 70%,
            transparent 100%
          );
        }

        @keyframes linePulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .logo-container {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shield-wrapper {
          position: relative;
          width: 280px;
          height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shield-glow {
          position: absolute;
          inset: -40px;
          background: radial-gradient(circle, rgba(0, 80, 255, 0.12) 0%, transparent 70%);
          border-radius: 50%;
          animation: glowPulse 3s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        .shield-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 40px rgba(0, 80, 255, 0.3)) drop-shadow(0 0 80px rgba(0, 80, 255, 0.1));
          animation: shieldFloat 6s ease-in-out infinite;
        }

        @keyframes shieldFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        /* RIGHT SIDE */
        .right-panel {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: #0d0d0d;
          border-left: 1px solid rgba(255,255,255,0.05);
        }

        .right-panel::before {
          content: '';
          position: absolute;
          top: -200px;
          right: -200px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(0, 80, 255, 0.05) 0%, transparent 70%);
          pointer-events: none;
        }

        .form-container {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 2;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 42px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -1px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .brand-name .dot {
          width: 8px;
          height: 8px;
          background: #2563eb;
          border-radius: 50%;
          display: inline-block;
          margin-left: 2px;
          box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);
          animation: dotPulse 2s ease-in-out infinite;
        }

        @keyframes dotPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(37, 99, 235, 0.6); }
          50% { box-shadow: 0 0 20px rgba(37, 99, 235, 1); }
        }

        .signin-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 600;
          color: #e0e0e0;
          margin-bottom: 40px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #a0a0a0;
          margin-bottom: 8px;
          font-family: 'Inter', sans-serif;
        }

        .input-wrapper {
          position: relative;
        }

        .form-input {
          width: 100%;
          height: 52px;
          padding: 0 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #ffffff;
          font-size: 15px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: all 0.2s ease;
        }

        .form-input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .form-input:focus {
          border-color: rgba(37, 99, 235, 0.6);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .form-input.has-icon {
          padding-right: 48px;
        }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }

        .eye-btn:hover {
          color: rgba(255,255,255,0.7);
        }

        .forgot-link {
          display: block;
          text-align: left;
          margin-top: 8px;
          font-size: 13px;
          color: #2563eb;
          text-decoration: none;
          font-family: 'Inter', sans-serif;
          transition: color 0.2s;
        }

        .forgot-link:hover {
          color: #3b82f6;
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 20px;
          font-family: 'Inter', sans-serif;
        }

        .login-btn {
          width: 100%;
          height: 52px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          font-family: 'Syne', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.5px;
          margin-top: 8px;
        }

        .login-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .login-btn:hover::before {
          opacity: 1;
        }

        .login-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
        }

        .login-btn:active {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .login-root {
            grid-template-columns: 1fr;
          }
          .left-panel {
            height: 260px;
          }
          .shield-wrapper {
            width: 180px;
            height: 180px;
          }
          .right-panel {
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="login-root">
        {/* Left Panel - Shield Logo */}
        <div className="left-panel">
          <div className="grid-lines">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="center-line"></div>

          <div className="logo-container">
            <div className="shield-wrapper">
              <div className="shield-glow"></div>
              <img
                src="/cautio_shield.webp"
                alt="Cautio Shield"
                className="shield-img"
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="right-panel">
          <div className="form-container">
            {/* Brand */}
            <div className="brand-name">
              cautio<span className="dot"></span>
            </div>

            <div className="signin-title">Sign in</div>

            <form onSubmit={handleLogin}>
              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    className="form-input"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input has-icon"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword
                      ? <EyeOff size={18} />
                      : <Eye size={18} />
                    }
                  </button>
                </div>
                <a href="#" className="forgot-link">Forgot Password?</a>
              </div>

              {/* Error */}
              {error && (
                <div className="error-box">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="login-btn"
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner"></span>Signing in...</>
                  : 'Login'
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
