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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.session) {
        const { data: tech } = await supabase
          .from('technicians').select('role').eq('id', data.session.user.id).single()
        if (tech?.role === 'admin' || tech?.role === 'manager') {
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
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 55% 45%;
          background: #050507;
          font-family: 'Outfit', sans-serif;
          overflow: hidden;
        }

        .left {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #060608;
        }

        .vlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            90deg,
            transparent 0px,
            transparent 119px,
            rgba(255,255,255,0.04) 119px,
            rgba(255,255,255,0.04) 120px
          );
        }

        .hline {
          position: absolute;
          left: 0; right: 0;
          top: 50%;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 80%, transparent 100%);
        }

        .vline-center {
          position: absolute;
          top: 0; bottom: 0;
          left: 50%;
          width: 1px;
          background: linear-gradient(180deg, transparent 0%, rgba(0,120,255,0.15) 30%, rgba(0,120,255,0.4) 50%, rgba(0,120,255,0.15) 70%, transparent 100%);
          animation: vp 4s ease-in-out infinite;
        }
        @keyframes vp { 0%,100%{opacity:.5} 50%{opacity:1} }

        .ambient {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,60,200,0.07) 0%, transparent 70%);
        }

        .shield-scene {
          position: relative;
          z-index: 2;
          width: 340px;
          height: 340px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .shield-backdrop {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle at 38% 33%, #16162a 0%, #0a0a16 55%, #050508 100%);
          box-shadow: 0 0 80px rgba(0,80,200,0.18), 0 0 160px rgba(0,80,200,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .shield-backdrop::before {
          content: '';
          position: absolute;
          top: 10%; left: 15%; right: 15%;
          height: 30%;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%);
          border-radius: 50%;
          filter: blur(10px);
        }

        .shield-img {
          position: relative;
          z-index: 1;
          width: 210px;
          height: 210px;
          object-fit: contain;
          filter: drop-shadow(0 0 35px rgba(0,160,255,0.55)) drop-shadow(0 0 90px rgba(0,80,200,0.22)) drop-shadow(0 10px 30px rgba(0,0,0,0.9));
          animation: sf 5s ease-in-out infinite;
        }
        @keyframes sf {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .right {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 56px;
          background: #07070a;
          border-left: 1px solid rgba(255,255,255,0.04);
        }

        .form-box {
          width: 100%;
          max-width: 400px;
        }

        .brand {
          font-size: 50px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -2.5px;
          line-height: 1;
          margin-bottom: 6px;
          display: flex;
          align-items: flex-end;
        }
        .brand-dot {
          width: 10px; height: 10px;
          background: #2563eb;
          border-radius: 50%;
          margin-left: 4px;
          margin-bottom: 8px;
          flex-shrink: 0;
          box-shadow: 0 0 18px rgba(37,99,235,1), 0 0 36px rgba(37,99,235,0.5);
          animation: dg 2.5s ease-in-out infinite;
        }
        @keyframes dg { 0%,100%{box-shadow:0 0 10px rgba(37,99,235,.7),0 0 20px rgba(37,99,235,.3)} 50%{box-shadow:0 0 22px rgba(37,99,235,1),0 0 44px rgba(37,99,235,.6)} }

        .heading {
          font-size: 32px;
          font-weight: 600;
          color: #d0d0d0;
          margin-bottom: 44px;
          letter-spacing: -0.5px;
        }

        .field { margin-bottom: 24px; }
        .flabel {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #888;
          margin-bottom: 9px;
        }
        .iwrap { position: relative; }
        .finput {
          width: 100%;
          height: 56px;
          padding: 0 18px;
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: 'Outfit', sans-serif;
          font-weight: 400;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .finput::placeholder { color: rgba(255,255,255,0.18); }
        .finput:focus {
          border-color: rgba(37,99,235,0.7);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .finput.pw { padding-right: 52px; }

        .eyebtn {
          position: absolute;
          right: 16px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.25);
          display: flex; padding: 4px;
          transition: color .2s;
        }
        .eyebtn:hover { color: rgba(255,255,255,0.6); }

        .forgot {
          display: inline-block;
          margin-top: 9px;
          font-size: 13.5px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
          transition: color .2s;
        }
        .forgot:hover { color: #60a5fa; }

        .errbox {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .submitbtn {
          width: 100%; height: 56px;
          margin-top: 12px;
          background: #2563eb;
          color: #fff; border: none;
          border-radius: 12px;
          font-size: 17px; font-weight: 700;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.3px;
          cursor: pointer;
          position: relative; overflow: hidden;
          transition: background .2s, transform .15s, box-shadow .2s;
        }
        .submitbtn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.09) 0%, transparent 100%);
          pointer-events: none;
        }
        .submitbtn:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(37,99,235,0.5);
        }
        .submitbtn:active:not(:disabled) { transform: translateY(0); }
        .submitbtn:disabled { opacity: 0.55; cursor: not-allowed; }

        .spin {
          display: inline-block;
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sp .7s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        @keyframes sp { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .page { grid-template-columns: 1fr; }
          .left { height: 260px; }
          .shield-scene { width: 220px; height: 220px; }
          .shield-backdrop { width: 200px; height: 200px; }
          .shield-img { width: 140px; height: 140px; }
          .right { padding: 36px 24px; }
          .brand { font-size: 40px; }
          .heading { font-size: 26px; margin-bottom: 32px; }
        }
      `}</style>

      <div className="page">
        <div className="left">
          <div className="vlines"></div>
          <div className="hline"></div>
          <div className="vline-center"></div>
          <div className="ambient"></div>
          <div className="shield-scene">
            <div className="shield-backdrop"></div>
            <img src="/cautio_shield.webp" alt="Cautio Shield" className="shield-img" />
          </div>
        </div>

        <div className="right">
          <div className="form-box">
            <div className="brand">cautio<span className="brand-dot"></span></div>
            <div className="heading">Sign in</div>

            <form onSubmit={handleLogin}>
              <div className="field">
                <label className="flabel">Email</label>
                <div className="iwrap">
                  <input type="email" className="finput" placeholder="example@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
                </div>
              </div>

              <div className="field">
                <label className="flabel">Password</label>
                <div className="iwrap">
                  <input type={showPassword ? 'text' : 'password'} className="finput pw"
                    placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} required disabled={loading} />
                  <button type="button" className="eyebtn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                <a href="#" className="forgot">Forgot Password?</a>
              </div>

              {error && <div className="errbox"><AlertCircle size={16}/>{error}</div>}

              <button type="submit" className="submitbtn" disabled={loading}>
                {loading ? <><span className="spin"></span>Signing in...</> : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
