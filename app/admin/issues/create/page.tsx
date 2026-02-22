'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { GPSCamera } from '@/components/camera/GPSCamera'
import { ArrowLeft, MapPin, Phone, PlayCircle, CheckCircle, Navigation, Camera, Clock } from 'lucide-react'
import type { Issue, IssuePhoto } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

const PC: Record<string,{c:string;bg:string}> = {
  urgent:{ c:'#f87171',bg:'rgba(248,113,113,.12)' }, high:{c:'#fb923c',bg:'rgba(251,146,60,.12)'},
  medium:{ c:'#fbbf24',bg:'rgba(251,191,36,.12)'  }, low: {c:'#4ade80',bg:'rgba(74,222,128,.12)'},
}
const SC: Record<string,{c:string;bg:string}> = {
  assigned:{c:'#22d3ee',bg:'rgba(34,211,238,.1)'}, 'in-progress':{c:'#a78bfa',bg:'rgba(167,139,250,.12)'},
  completed:{c:'#4ade80',bg:'rgba(74,222,128,.12)'}, cancelled:{c:'#6b7280',bg:'rgba(107,114,128,.1)'},
}

const S = `
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
.act{width:100%;height:44px;border-radius:12px;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:'Outfit',system-ui,sans-serif;transition:all .15s}
.act:active{transform:scale(.98)}
.ibox{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:13px}
.sec{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.055);border-radius:16px;padding:18px}
`

export default function TechnicianIssueDetail() {
  const router   = useRouter()
  const params   = useParams()
  const issueId  = params.id as string
  const [issue,      setIssue]      = useState<Issue|null>(null)
  const [photos,     setPhotos]     = useState<IssuePhoto[]>([])
  const [loading,    setLoading]    = useState(true)
  const [updating,   setUpdating]   = useState(false)
  const [showCam,    setShowCam]    = useState(false)
  const [techName,   setTechName]   = useState('')
  const [techId,     setTechId]     = useState('')

  useEffect(() => { init() }, [issueId])

  const init = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechId(session.user.id)
    const { data:t } = await supabase.from('technicians').select('*').eq('id',session.user.id).single()
    if (t) setTechName(t.name)
    const { data, error } = await supabase.from('issues').select('*').eq('id',issueId).single()
    if (error) { router.back(); return }
    setIssue(data); setLoading(false)
    const { data:ph } = await supabase.from('issue_photos').select('*').eq('issue_id',issueId).order('taken_at',{ascending:false})
    if (ph) setPhotos(ph)
  }

  const updateStatus = async (st: string) => {
    setUpdating(true)
    const u: any = { status:st }
    if (st==='in-progress' && !issue?.started_at)  u.started_at  = new Date().toISOString()
    if (st==='completed'   && !issue?.completed_at) u.completed_at = new Date().toISOString()
    await supabase.from('issues').update(u).eq('id',issueId)
    const { data } = await supabase.from('issues').select('*').eq('id',issueId).single()
    if (data) setIssue(data)
    setUpdating(false)
  }

  const openNav = () => {
    if (!issue) return
    const url = (issue.latitude&&issue.longitude)
      ? `https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${issue.location||''} ${issue.city||''}`)}`
    window.open(url,'_blank')
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading || !issue) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07070f' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'34px', height:'34px', border:'2px solid #22d3ee', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  )

  const p = PC[issue.priority] ?? { c:'#9ca3af',bg:'rgba(156,163,175,.1)' }
  const s = SC[issue.status]   ?? { c:'#9ca3af',bg:'rgba(156,163,175,.1)' }

  return (
    <AppShell role="technician" userName={techName} onLogout={logout}>
      <style>{S}</style>

      <div style={{ flex:1, overflowY:'auto', padding:'24px', minWidth:0 }}>
        {/* breadcrumb */}
        <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'20px', animation:'fu .3s ease' }}>
          <button onClick={() => router.back()} style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.3)', fontSize:'12px', fontFamily:'inherit', padding:0 }}>
            <ArrowLeft size={13} />Back
          </button>
          <span style={{ color:'rgba(255,255,255,.12)' }}>·</span>
          <span style={{ fontSize:'12px', color:'rgba(255,255,255,.4)', fontFamily:"'Syne',sans-serif", fontWeight:'700' }}>{issue.vehicle_no}</span>
        </div>

        {/* Mobile: single column | Desktop: 2-col */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr min(320px,38%)', gap:'16px', alignItems:'start' }}>

          {/* ── Left ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* hero */}
            <div className="sec" style={{ animation:'fu .4s ease' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px' }}>
                <div>
                  <p style={{ fontSize:'10px', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'5px' }}>Issue Detail</p>
                  <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'26px', fontWeight:'800', color:'#fff', lineHeight:1.1, letterSpacing:'-0.3px' }}>{issue.vehicle_no}</h1>
                </div>
                <div style={{ display:'flex', gap:'5px' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'7px', color:s.c, background:s.bg }}>{issue.status}</span>
                  <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'7px', color:p.c, background:p.bg }}>{issue.priority}</span>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px', marginBottom:'10px' }}>
                {[
                  { lbl:'VEHICLE',  val:issue.vehicle_no   },
                  { lbl:'CLIENT',   val:issue.client        },
                  { lbl:'POC',      val:issue.poc_name||'—' },
                  { lbl:'CONTACT',  val:issue.poc_number||'—' },
                ].map(x => (
                  <div key={x.lbl} className="ibox">
                    <p style={{ fontSize:'9px', color:'rgba(255,255,255,.22)', letterSpacing:'1.2px', marginBottom:'5px' }}>{x.lbl}</p>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>{x.val}</p>
                  </div>
                ))}
              </div>

              <div className="ibox">
                <p style={{ fontSize:'9px', color:'rgba(255,255,255,.22)', letterSpacing:'1.2px', marginBottom:'5px' }}>ISSUE</p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,.65)', lineHeight:1.6 }}>{issue.issue}</p>
              </div>

              {(issue.city||issue.location) && (
                <div className="ibox" style={{ marginTop:'9px', display:'flex', alignItems:'center', gap:'7px' }}>
                  <MapPin size={13} color="#22d3ee" />
                  <span style={{ fontSize:'12px', color:'rgba(255,255,255,.5)' }}>{issue.city}{issue.location?` · ${issue.location}`:''}</span>
                </div>
              )}

              {issue.availability && (
                <div className="ibox" style={{ marginTop:'9px', display:'flex', alignItems:'center', gap:'7px' }}>
                  <Clock size={13} color="#fbbf24" />
                  <span style={{ fontSize:'12px', color:'rgba(255,255,255,.5)' }}>Available: {issue.availability}</span>
                </div>
              )}
            </div>

            {/* photos */}
            <div className="sec" style={{ animation:'fu .4s ease .1s both' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
                <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>
                  Photos <span style={{ fontSize:'11px', color:'rgba(255,255,255,.28)', fontWeight:'500' }}>{photos.length}</span>
                </p>
                <button onClick={() => setShowCam(!showCam)}
                  style={{ height:'30px', padding:'0 10px', borderRadius:'8px', background:'rgba(34,211,238,.08)', border:'1px solid rgba(34,211,238,.18)', color:'#22d3ee', fontSize:'11px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontFamily:'inherit' }}>
                  <Camera size={11} />{showCam?'Close':'Take Photo'}
                </button>
              </div>
              {showCam && (
                <div style={{ marginBottom:'14px' }}>
                  <GPSCamera issueId={issueId} onPhotoUploaded={async () => {
                    const { data:ph } = await supabase.from('issue_photos').select('*').eq('issue_id',issueId).order('taken_at',{ascending:false})
                    if (ph) setPhotos(ph); setShowCam(false)
                  }} />
                </div>
              )}
              {photos.length === 0 ? (
                <p style={{ textAlign:'center', color:'rgba(255,255,255,.18)', fontSize:'12px', padding:'20px 0' }}>No photos yet</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px' }}>
                  {photos.map(ph => (
                    <div key={ph.id} style={{ aspectRatio:'1', borderRadius:'9px', overflow:'hidden', position:'relative', border:'1px solid rgba(255,255,255,.06)' }}>
                      <img src={ph.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top,rgba(0,0,0,.7),transparent)', padding:'6px 5px 3px', fontSize:'9px', color:'rgba(255,255,255,.7)', textTransform:'capitalize', fontWeight:'700' }}>{ph.photo_type}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: actions ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', animation:'fu .4s ease .08s both' }}>
            <div className="sec">
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'12px' }}>Actions</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <button className="act" onClick={openNav}
                  style={{ background:'linear-gradient(135deg,rgba(34,211,238,.12),rgba(14,165,233,.08))', border:'1px solid rgba(34,211,238,.22)', color:'#22d3ee' }}>
                  <Navigation size={16} />Navigate
                </button>
                {issue.status==='assigned' && (
                  <button className="act" onClick={() => updateStatus('in-progress')} disabled={updating}
                    style={{ background:'rgba(167,139,250,.1)', border:'1px solid rgba(167,139,250,.22)', color:'#a78bfa' }}>
                    <PlayCircle size={16} />Start Work
                  </button>
                )}
                {issue.status==='in-progress' && (
                  <button className="act" onClick={() => updateStatus('completed')} disabled={updating}
                    style={{ background:'linear-gradient(135deg,rgba(74,222,128,.12),rgba(16,185,129,.08))', border:'1px solid rgba(74,222,128,.25)', color:'#4ade80' }}>
                    <CheckCircle size={16} />Mark Completed
                  </button>
                )}
                {issue.poc_number && (
                  <button className="act" onClick={() => window.open(`tel:${issue.poc_number}`,'_self')}
                    style={{ background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.18)', color:'#fbbf24' }}>
                    <Phone size={16} />Call POC
                  </button>
                )}
              </div>
            </div>

            {/* timeline */}
            <div className="sec">
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'12px' }}>Timeline</p>
              {[
                { lbl:'Created',   val:formatDateTime(issue.created_at), c:'#22d3ee'  },
                issue.started_at  ?{ lbl:'Started',   val:formatDateTime(issue.started_at!),   c:'#a78bfa' }:null,
                issue.completed_at?{ lbl:'Completed', val:formatDateTime(issue.completed_at!),  c:'#4ade80' }:null,
              ].filter(Boolean).map(t => (
                <div key={t!.lbl} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'10px' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:t!.c, marginTop:'4px', flexShrink:0, boxShadow:`0 0 6px ${t!.c}80` }} />
                  <div>
                    <p style={{ fontSize:'10px', color:'rgba(255,255,255,.25)' }}>{t!.lbl}</p>
                    <p style={{ fontSize:'11px', color:'rgba(255,255,255,.55)', fontWeight:'600' }}>{t!.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
