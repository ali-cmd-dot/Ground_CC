'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import {
  Navigation, Camera, PlayCircle, CheckCircle,
  MapPin, Phone, AlertCircle, RefreshCw, Locate,
  ArrowUpRight,
} from 'lucide-react'
import type { Issue } from '@/lib/types'

type IssueD = Issue & { distance?: number }

const PC: Record<string,{c:string;bg:string}> = {
  urgent:{ c:'#f87171', bg:'rgba(248,113,113,.12)' },
  high:  { c:'#fb923c', bg:'rgba(251,146,60,.12)'  },
  medium:{ c:'#fbbf24', bg:'rgba(251,191,36,.12)'  },
  low:   { c:'#4ade80', bg:'rgba(74,222,128,.12)'  },
}
const SC: Record<string,{c:string;bg:string}> = {
  assigned:     { c:'#22d3ee', bg:'rgba(34,211,238,.1)'  },
  'in-progress':{ c:'#a78bfa', bg:'rgba(167,139,250,.12)'},
}

function greet() {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

const S = `
@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
.icard{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:16px;cursor:pointer;transition:all .2s}
.icard:hover,.icard:active{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1)}
.ibtn{height:38px;border-radius:10px;border:none;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Outfit',system-ui,sans-serif;transition:all .15s}
.ibtn:active{transform:scale(.97)}
.tag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap}
`

export default function TechnicianDashboard() {
  const router = useRouter()
  const [issues,     setIssues]     = useState<IssueD[]>([])
  const [loading,    setLoading]    = useState(true)
  const [techId,     setTechId]     = useState('')
  const [techName,   setTechName]   = useState('')
  const [checkedIn,  setCheckedIn]  = useState(false)
  const [checkTime,  setCheckTime]  = useState<string|null>(null)
  const [loc,        setLoc]        = useState<{lat:number;lng:number}|null>(null)
  const [gettingLoc, setGettingLoc] = useState(false)

  useEffect(() => { initAuth() }, [])
  useEffect(() => { if (techId) getLocation() }, [techId])
  useEffect(() => { if (techId) fetchIssues() }, [loc, techId])

  const dist = (a:number,b:number,c:number,d:number) => {
    const R=6371,dLat=(c-a)*Math.PI/180,dLon=(d-b)*Math.PI/180
    const x=Math.sin(dLat/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLon/2)**2
    return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
  }

  const getLocation = () => {
    setGettingLoc(true)
    navigator.geolocation?.getCurrentPosition(
      p => { setLoc({ lat:p.coords.latitude, lng:p.coords.longitude }); setGettingLoc(false) },
      ()  => setGettingLoc(false),
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    )
  }

  const initAuth = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechId(session.user.id)
    const { data:t } = await supabase.from('technicians').select('*').eq('id', session.user.id).single()
    if (t) setTechName(t.name)
    const today = new Date().toISOString().split('T')[0]
    const { data:att } = await supabase.from('attendance').select('*')
      .eq('technician_id', session.user.id).eq('date', today).is('check_out', null).single()
    if (att) { setCheckedIn(true); setCheckTime(new Date(att.check_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})) }
  }

  const fetchIssues = async () => {
    const { data } = await supabase.from('issues').select('*')
      .eq('assigned_to', techId).in('status',['assigned','in-progress'])
    if (data) {
      const d = data.map(i => ({
        ...i,
        distance: (i.latitude&&i.longitude&&loc) ? dist(loc.lat,loc.lng,i.latitude,i.longitude) : 999999
      }))
      d.sort((a,b) => (a.distance??999999)-(b.distance??999999))
      setIssues(d)
    }
    setLoading(false)
  }

  const checkIn = async () => {
    if (!loc) { getLocation(); return }
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    await supabase.from('attendance').insert({ technician_id:techId, check_in:now, latitude:loc.lat, longitude:loc.lng, date:today })
    setCheckedIn(true)
    setCheckTime(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
  }

  const checkOut = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*')
      .eq('technician_id',techId).eq('date',today).is('check_out',null).single()
    if (data) {
      const hours = (Date.now()-new Date(data.check_in).getTime())/3600000
      await supabase.from('attendance').update({ check_out:new Date().toISOString(), total_hours:hours }).eq('id',data.id)
      setCheckedIn(false); setCheckTime(null)
    }
  }

  const startWork = async (e:React.MouseEvent, id:string) => {
    e.stopPropagation()
    await supabase.from('issues').update({ status:'in-progress', started_at:new Date().toISOString() }).eq('id',id)
    fetchIssues()
  }

  const navigate = (e:React.MouseEvent, issue:Issue) => {
    e.stopPropagation()
    const url = (issue.latitude&&issue.longitude)
      ? `https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${issue.location||''} ${issue.city||''}`)}`
    window.open(url,'_blank')
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const inProg = issues.filter(i => i.status==='in-progress').length

  if (loading) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07070f' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'34px', height:'34px', border:'2px solid #22d3ee', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <AppShell role="technician" userName={techName} onLogout={logout}>
      <style>{S}</style>

      <div style={{ flex:1, overflowY:'auto', padding:'28px', minWidth:0 }}>

        {/* ── Greeting ── */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'24px', animation:'fu .4s ease' }}>
          <div>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'5px' }}>{greet()}</p>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1, letterSpacing:'-0.3px' }}>
              {techName.split(' ')[0]} 👋
            </h1>
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={getLocation} disabled={gettingLoc}
              style={{ height:'32px', padding:'0 10px', borderRadius:'8px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', color: loc?'#4ade80':'rgba(255,255,255,.3)', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', fontFamily:'inherit' }}>
              <Locate size={12} style={{ animation:gettingLoc?'spin 1s linear infinite':'none' }} />
              {loc ? `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` : 'Get GPS'}
            </button>
            <button onClick={fetchIssues}
              style={{ width:'32px', height:'32px', borderRadius:'8px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', color:'rgba(255,255,255,.3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* ── Attendance + stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'12px', marginBottom:'24px', animation:'fu .4s ease .07s both' }}>

          {/* attendance — 2 cols */}
          <div style={{
            gridColumn:'span 2', padding:'20px',
            borderRadius:'16px',
            background: checkedIn
              ? 'linear-gradient(135deg,rgba(4,47,46,.9),rgba(6,78,59,.6))'
              : 'linear-gradient(135deg,rgba(12,12,28,.9),rgba(15,23,42,.8))',
            border:`1px solid ${checkedIn?'rgba(34,211,238,.2)':'rgba(255,255,255,.06)'}`,
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px',
          }}>
            <div>
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.28)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'8px' }}>Attendance</p>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                {checkedIn && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80', display:'inline-block', animation:'pulse 2s infinite' }} />}
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'18px', fontWeight:'800', color:'#fff' }}>
                  {checkedIn ? 'Checked In' : 'Not Checked In'}
                </p>
              </div>
              {checkedIn&&checkTime && <p style={{ fontSize:'11px', color:'rgba(255,255,255,.3)' }}>Since {checkTime}</p>}
            </div>
            <button onClick={checkedIn ? checkOut : checkIn}
              style={{ padding:'9px 16px', borderRadius:'10px', border:`1px solid ${checkedIn?'rgba(248,113,113,.3)':'rgba(34,211,238,.3)'}`, background:checkedIn?'rgba(248,113,113,.1)':'rgba(34,211,238,.1)', color:checkedIn?'#f87171':'#22d3ee', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
              {checkedIn ? 'Check Out' : 'Check In'}
            </button>
          </div>

          {/* stat cards */}
          {[
            { val:issues.length, label:'Total',  sub:'Tasks today', c:'#22d3ee' },
            { val:inProg,        label:'Active',  sub:'In progress', c:'#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ padding:'18px', borderRadius:'16px', background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)' }}>
              <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`${s.c}14`, border:`1px solid ${s.c}22`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px' }}>
                <ArrowUpRight size={14} color={s.c} />
              </div>
              <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1, marginBottom:'4px' }}>{s.val}</p>
              <p style={{ fontSize:'12px', fontWeight:'600', color:'rgba(255,255,255,.4)' }}>{s.label}</p>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.2)' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Issues grid ── */}
        <div style={{ animation:'fu .4s ease .14s both' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>
              Today's Tasks
              <span style={{ fontSize:'11px', fontWeight:'500', color:'rgba(255,255,255,.28)', marginLeft:'6px' }}>{issues.length}</span>
            </p>
            {loc && issues.some(i => i.distance && i.distance < 999999) && (
              <span style={{ fontSize:'10px', color:'#4ade80', background:'rgba(74,222,128,.08)', border:'1px solid rgba(74,222,128,.15)', padding:'3px 9px', borderRadius:'20px' }}>
                ↑ Nearest first
              </span>
            )}
          </div>

          {issues.length === 0 ? (
            <div style={{ padding:'48px 20px', textAlign:'center', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', borderRadius:'16px' }}>
              <CheckCircle size={28} color="rgba(255,255,255,.1)" style={{ margin:'0 auto 8px' }} />
              <p style={{ color:'rgba(255,255,255,.2)', fontSize:'13px' }}>No tasks assigned</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'12px' }}>
              {issues.map((issue, idx) => {
                const p = PC[issue.priority] ?? { c:'#9ca3af', bg:'rgba(156,163,175,.1)' }
                const s = SC[issue.status]   ?? { c:'#9ca3af', bg:'rgba(156,163,175,.1)' }
                const nearest = idx===0 && issue.distance!==undefined && issue.distance<999999
                return (
                  <div key={issue.id} className="icard"
                    onClick={() => router.push(`/technician/issues/${issue.id}`)}>

                    {/* top */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'9px', minWidth:0 }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'9px', flexShrink:0, background:nearest?'rgba(74,222,128,.1)':'rgba(255,255,255,.05)', border:`1px solid ${nearest?'rgba(74,222,128,.22)':'rgba(255,255,255,.07)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', color:nearest?'#4ade80':'rgba(255,255,255,.3)' }}>
                          {idx+1}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:'800', fontSize:'15px', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{issue.vehicle_no}</p>
                          <p style={{ fontSize:'11px', color:'rgba(255,255,255,.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{issue.client}</p>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'3px', flexShrink:0, marginLeft:'8px' }}>
                        <span className="tag" style={{ color:s.c, background:s.bg }}>{issue.status}</span>
                        <span className="tag" style={{ color:p.c, background:p.bg }}>{issue.priority}</span>
                      </div>
                    </div>

                    {/* distance chip */}
                    {issue.distance !== undefined && issue.distance < 999999 ? (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:nearest?'rgba(74,222,128,.07)':'rgba(255,255,255,.04)', border:`1px solid ${nearest?'rgba(74,222,128,.16)':'rgba(255,255,255,.06)'}`, borderRadius:'8px', padding:'3px 9px', marginBottom:'10px' }}>
                        <Navigation size={10} color={nearest?'#4ade80':'rgba(255,255,255,.3)'} />
                        <span style={{ fontSize:'11px', fontWeight:'700', color:nearest?'#4ade80':'rgba(255,255,255,.4)' }}>
                          {issue.distance<1?`${(issue.distance*1000).toFixed(0)}m`:`${issue.distance.toFixed(1)}km`}
                          {nearest?' · Nearest':''}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:'3px', marginBottom:'10px' }}>
                        <AlertCircle size={10} color="rgba(255,255,255,.18)" />
                        <span style={{ fontSize:'10px', color:'rgba(255,255,255,.18)' }}>No GPS</span>
                      </div>
                    )}

                    {/* issue desc */}
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,.38)', marginBottom:'10px', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {issue.issue}
                    </p>

                    {/* meta */}
                    <div style={{ display:'flex', gap:'10px', marginBottom:'13px', flexWrap:'wrap' }}>
                      {(issue.city||issue.location) && <span style={{ fontSize:'10px', color:'rgba(255,255,255,.25)', display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={9} />{issue.city}{issue.location?` · ${issue.location}`:''}</span>}
                      {issue.poc_name && <span style={{ fontSize:'10px', color:'rgba(255,255,255,.25)', display:'flex', alignItems:'center', gap:'3px' }}><Phone size={9} />{issue.poc_name}{issue.poc_number?` · ${issue.poc_number}`:''}</span>}
                    </div>

                    {/* actions */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
                      <button className="ibtn" onClick={e => navigate(e, issue)}
                        style={{ background:'rgba(34,211,238,.08)', border:'1px solid rgba(34,211,238,.18)', color:'#22d3ee' }}>
                        <Navigation size={12} />Navigate
                      </button>
                      <button className="ibtn" onClick={e => { e.stopPropagation(); router.push(`/technician/issues/${issue.id}`) }}
                        style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', color:'rgba(255,255,255,.5)' }}>
                        <Camera size={12} />Details
                      </button>
                      {issue.status==='assigned' && (
                        <button className="ibtn" style={{ gridColumn:'1/-1', background:'rgba(251,146,60,.1)', border:'1px solid rgba(251,146,60,.2)', color:'#fb923c' }}
                          onClick={e => startWork(e, issue.id)}>
                          <PlayCircle size={12} />Start Work
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
