'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Map, Users, BarChart2,
  FileText, LogOut, Home, Camera, User, Package,
  Calendar, ChevronRight, Bell,
} from 'lucide-react'

interface NavItem { icon: any; label: string; path: string }

const ADMIN_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: ClipboardList,   label: 'Issues',    path: '/admin/issues' },
  { icon: Map,             label: 'Live Map',  path: '/admin/map' },
  { icon: Users,           label: 'Team',      path: '/admin/technicians' },
  { icon: BarChart2,       label: 'Analytics', path: '/admin/analytics' },
  { icon: Package,         label: 'Inventory', path: '/admin/inventory' },
  { icon: FileText,        label: 'Invoices',  path: '/admin/invoices' },
]

const TECH_NAV: NavItem[] = [
  { icon: Home,        label: 'Home',       path: '/technician' },
  { icon: ClipboardList, label: 'Issues',   path: '/technician/issues' },
  { icon: Map,         label: 'Map',        path: '/technician/map' },
  { icon: Camera,      label: 'Camera',     path: '/technician/camera' },
  { icon: Calendar,    label: 'Attendance', path: '/technician/attendance' },
  { icon: Package,     label: 'Inventory',  path: '/technician/inventory' },
  { icon: User,        label: 'Profile',    path: '/technician/profile' },
]

interface Props {
  children: React.ReactNode
  role: 'admin' | 'technician'
  userName?: string
  onLogout?: () => void
}

export function AppShell({ children, role, userName = '', onLogout }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mobile,   setMobile]   = useState(false)

  const nav       = role === 'admin' ? ADMIN_NAV : TECH_NAV
  const firstName = userName.split(' ')[0] || 'User'
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    fn(); window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/technician') return pathname === path
    return pathname.startsWith(path)
  }

  const go = (path: string) => router.push(path)

  /* ─────────────────────────────── MOBILE ──────────────────────────────── */
  if (mobile) {
    const btmNav = nav.slice(0, 5)
    return (
      <div style={{ height:'100dvh', display:'flex', flexDirection:'column',
                    background:'#07070f', fontFamily:"'Outfit',system-ui,sans-serif", overflow:'hidden' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
          *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
          ::-webkit-scrollbar{display:none}
          body{font-family:'Outfit',system-ui,sans-serif;background:#07070f}
        `}</style>

        <div style={{ flex:1, overflowY:'auto', paddingBottom:'64px' }}>
          {children}
        </div>

        <nav style={{
          position:'fixed', bottom:0, left:0, right:0,
          height:'64px',
          background:'rgba(8,8,18,0.96)',
          backdropFilter:'blur(32px) saturate(180%)',
          borderTop:'1px solid rgba(255,255,255,0.05)',
          display:'flex',
          zIndex:100,
        }}>
          {btmNav.map((item, i) => {
            const active = isActive(item.path)
            const isMid  = i === 2  // map = center
            return (
              <button key={item.path} onClick={() => go(item.path)} style={{
                flex:1, height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:'3px',
                background:'none', border:'none', cursor:'pointer',
                color: active ? '#22d3ee' : 'rgba(255,255,255,0.22)',
                fontFamily:'inherit', transition:'color .18s',
                position:'relative', padding:'4px 0 0',
              }}>
                {active && (
                  <span style={{
                    position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
                    width:'28px', height:'2px', borderRadius:'99px',
                    background:'#22d3ee', boxShadow:'0 0 10px #22d3ee80',
                  }}/>
                )}
                {isMid ? (
                  <div style={{
                    width:'42px', height:'42px', borderRadius:'50%',
                    background: active
                      ? 'linear-gradient(135deg,#22d3ee,#0ea5e9)'
                      : 'rgba(34,211,238,0.1)',
                    border:`1.5px solid ${active ? 'transparent' : 'rgba(34,211,238,0.25)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    marginTop:'-14px',
                    boxShadow: active ? '0 4px 20px rgba(34,211,238,.5)' : 'none',
                    transition:'all .25s',
                  }}>
                    <item.icon size={18} color={active ? '#000' : '#22d3ee'} strokeWidth={2} />
                  </div>
                ) : (
                  <item.icon size={21} strokeWidth={active ? 2.5 : 1.6} />
                )}
                {!isMid && (
                  <span style={{ fontSize:'10px', fontWeight: active ? '700':'500', letterSpacing:'.3px' }}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  /* ─────────────────────────────── DESKTOP ─────────────────────────────── */
  return (
    <div style={{ height:'100dvh', display:'flex', background:'#07070f',
                  fontFamily:"'Outfit',system-ui,sans-serif", overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Outfit:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        body{font-family:'Outfit',system-ui,sans-serif;background:#07070f}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:99px}
        .sb-btn{all:unset;display:flex;align-items:center;cursor:pointer;border-radius:10px;
                 transition:background .15s, color .15s;font-family:'Outfit',system-ui,sans-serif;}
        .sb-btn:hover{background:rgba(255,255,255,0.045)!important;}
      `}</style>

      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: expanded ? '212px' : '58px',
          flexShrink:0, height:'100dvh',
          background:'#0b0b17',
          borderRight:'1px solid rgba(255,255,255,0.04)',
          display:'flex', flexDirection:'column',
          transition:'width .26s cubic-bezier(.16,1,.3,1)',
          overflow:'hidden', zIndex:20,
        }}>

        {/* logo row */}
        <div style={{
          height:'60px', flexShrink:0,
          display:'flex', alignItems:'center', gap:'10px',
          padding: expanded ? '0 14px' : '0',
          justifyContent: expanded ? 'flex-start' : 'center',
          borderBottom:'1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{
            width:'32px', height:'32px', borderRadius:'8px', flexShrink:0,
            background:'linear-gradient(135deg,rgba(34,211,238,.18),rgba(14,165,233,.08))',
            border:'1px solid rgba(34,211,238,.22)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <img src="/cautio_shield.webp" alt="" style={{ width:'19px', objectFit:'contain' }} />
          </div>
          {expanded && (
            <div>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'15px', fontWeight:'800', color:'#fff', lineHeight:1 }}>cautio</p>
              <p style={{ fontSize:'9px', color:'rgba(255,255,255,.18)', textTransform:'uppercase', letterSpacing:'1.8px', marginTop:'2px' }}>
                {role === 'admin' ? 'command center' : 'field ops'}
              </p>
            </div>
          )}
        </div>

        {/* nav items */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'8px 6px' }}>
          {nav.map(item => {
            const active = isActive(item.path)
            return (
              <button key={item.path} className="sb-btn"
                onClick={() => go(item.path)}
                title={!expanded ? item.label : undefined}
                style={{
                  width:'100%', height:'38px', marginBottom:'1px',
                  padding: expanded ? '0 10px' : '0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  gap: expanded ? '10px' : '0',
                  color: active ? '#22d3ee' : 'rgba(255,255,255,.3)',
                  background: active ? 'rgba(34,211,238,.08)' : 'transparent',
                  fontWeight: active ? '700' : '500',
                  fontSize:'13px',
                  borderLeft: active ? '2px solid #22d3ee' : '2px solid transparent',
                  borderRadius: active ? '0 10px 10px 0' : '10px',
                }}>
                <item.icon size={16} strokeWidth={active ? 2.4 : 1.7} style={{ flexShrink:0 }} />
                {expanded && (
                  <>
                    <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                      {item.label}
                    </span>
                    {active && <ChevronRight size={12} style={{ opacity:.4, flexShrink:0 }} />}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* user + logout */}
        <div style={{ padding:'6px', borderTop:'1px solid rgba(255,255,255,.04)', flexShrink:0 }}>
          {/* user */}
          <div style={{
            display:'flex', alignItems:'center', gap:'8px', height:'38px',
            padding: expanded ? '0 10px' : '0',
            justifyContent: expanded ? 'flex-start' : 'center',
            borderRadius:'10px', marginBottom:'2px',
          }}>
            <div style={{
              width:'26px', height:'26px', borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg,#22d3ee,#6366f1)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'10px', fontWeight:'800', color:'#000',
            }}>{initials}</div>
            {expanded && (
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'12px', fontWeight:'700', color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{firstName}</p>
                <p style={{ fontSize:'9px', color:'rgba(255,255,255,.22)', textTransform:'capitalize' }}>{role}</p>
              </div>
            )}
          </div>
          {/* logout */}
          <button className="sb-btn" onClick={onLogout}
            title={!expanded ? 'Sign out' : undefined}
            style={{
              width:'100%', height:'36px',
              padding: expanded ? '0 10px' : '0',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: expanded ? '10px' : '0',
              color:'rgba(248,113,113,.5)', fontSize:'13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.color='#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.color='rgba(248,113,113,.5)' }}>
            <LogOut size={15} style={{ flexShrink:0 }} />
            {expanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {children}
      </main>
    </div>
  )
}
