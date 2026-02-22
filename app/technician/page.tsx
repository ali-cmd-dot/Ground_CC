'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { ArrowLeft, MapPin, Phone, PlayCircle, CheckCircle, XCircle, Camera, Trash2, Edit } from 'lucide-react'
import type { Issue, IssuePhoto } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

const PC: Record<string,{c:string;bg:string}> = {
  urgent:{c:'#f87171',bg:'rgba(248,113,113,.12)'}, high:{c:'#fb923c',bg:'rgba(251,146,60,.12)'},
  medium:{c:'#fbbf24',bg:'rgba(251,191,36,.12)' }, low: {c:'#4ade80',bg:'rgba(74,222,128,.12)'},
}
const SC: Record<string,{c:string;bg:string}> = {
  pending:{c:'#fb923c',bg:'rgba(251,146,60,.12)'}, assigned:{c:'#22d3ee',bg:'rgba(34,211,238,.1)'},
  'in-progress':{c:'#a78bfa',bg:'rgba(167,139,250,.12)'}, completed:{c:'#4ade80',bg:'rgba(74,222,128,.12)'},
  cancelled:{c:'#6b7280',bg:'rgba(107,114,128,.1)'},
}

const S = `
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
.act{height:36px;border-radius:9px;border:none;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Outfit',system-ui,sans-serif;transition:all .15s;padding:0 14px}
.act:active{transform:scale(.97)}
.ibox{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.055);border-radius:10px;padding:12px}
.sec{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:18px}
`

export default function AdminIssueDetail() {
  const router  = useRouter()
  const params  = useParams()
  const issueId = params.id as string
  const [issue,    setIssue]    = useState<Issue|null>(null)
  const [photos,   setPhotos]   = useState<IssuePhoto[]>([])
  const [tech,     setTech]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId,   setUserId]   = useState('')

  useEffect(() => { init() }, [issueId])

  const init = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const { data:t } = await supabase.from('technicians').select('*').eq('id',session.user.id).single()
    if (t) setUserName(t.name)
    const { data, error } = await supabase.from('issues').select('*, technicians:assigned_to(id,name,email,phone)').eq('id',issueId).single()
    if (error) { router.back(); return }
    setIssue(data); if (data.assigned_to) setTech((data as any).technicians); setLoading(false)
    const { data:ph } = await supabase.from('issue_photos').select('*').eq('issue_id',issueId).order('taken_at',{ascending:false})
    if (ph) setPhotos(ph)
  }

  const updateStatus = async (st:string) => {
    setUpdating(true)
    const u:any={ status:st }
    if (st==='in-progress'&&!issue?.started_at)  u.started_at  = new Date().toISOString()
    if (st==='completed'  &&!issue?.completed_at) u.completed_at= new Date().toISOString()
    await supabase.from('issues').update(u).eq('id',issueId)
    const { data } = await supabase.from('issues').select('*, technicians:assigned_to(id,name,email,phone)').eq('id',issueId).single()
    if (data) { setIssue(data); if(data.assigned_to) setTech((data as any).technicians) }
    setUpdating(false)
  }

  const deleteIssue = async () => {
    if (!confirm('Delete this issue?')) return
    await supabase.from('issues').delete().eq('id',issueId)
    router.push('/admin')
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading||!issue) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07070f' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'34px', height:'34px', border:'2px solid #22d3ee', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  )

  const p = PC[issue.priority]??{c:'#9ca3af',bg:'rgba(156,163,175,.1)'}
  const s = SC[issue.status]  ??{c:'#9ca3af',bg:'rgba(156,163,175,.1)'}

  return (
    <AppShell role="admin" userName={userName} onLogout={logout}>
      <style>{S}</style>

      <div style={{ flex:1, overflowY:'auto', padding:'24px', minWidth:0 }}>
        {/* breadcrumb + actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', animation:'fu .3s ease' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <button onClick={() => router.back()} style={{ display:'flex', alignItems:'center', gap:'5px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.3)', fontSize:'12px', fontFamily:'inherit', padding:0 }}>
              <ArrowLeft size={13} />Back
            </button>
            <span style={{ color:'rgba(255,255,255,.12)' }}>·</span>
            <span style={{ fontSize:'12px', color:'rgba(255,255,255,.4)', fontFamily:"'Syne',sans-serif", fontWeight:'700' }}>{issue.vehicle_no}</span>
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button className="act" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', color:'rgba(255,255,255,.4)' }}>
              <Edit size={12} />Edit
            </button>
            <button className="act" onClick={deleteIssue} style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.15)', color:'#f87171' }}>
              <Trash2 size={12} />Delete
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr min(300px,35%)', gap:'14px', alignItems:'start' }}>
          {/* ── Left ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
            <div className="sec" style={{ animation:'fu .4s ease' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px' }}>
                <div>
                  <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1, letterSpacing:'-0.3px' }}>{issue.vehicle_no}</h1>
                  <p style={{ fontSize:'13px', color:'rgba(255,255,255,.4)', marginTop:'3px' }}>{issue.client}</p>
                </div>
                <div style={{ display:'flex', gap:'5px' }}>
                  <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'7px', color:s.c, background:s.bg }}>{issue.status}</span>
                  <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 9px', borderRadius:'7px', color:p.c, background:p.bg }}>{issue.priority}</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'9px' }}>
                {[{lbl:'CLIENT',val:issue.client},{lbl:'POC',val:issue.poc_name||'—'},{lbl:'CONTACT',val:issue.poc_number||'—'},{lbl:'CITY',val:issue.city?(issue.city+(issue.location?' · '+issue.location:'')):'—'}].map(x=>(
                  <div key={x.lbl} className="ibox">
                    <p style={{ fontSize:'9px', color:'rgba(255,255,255,.22)', letterSpacing:'1.2px', marginBottom:'5px' }}>{x.lbl}</p>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>{x.val}</p>
                  </div>
                ))}
              </div>
              <div className="ibox">
                <p style={{ fontSize:'9px', color:'rgba(255,255,255,.22)', letterSpacing:'1.2px', marginBottom:'5px' }}>ISSUE DESCRIPTION</p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,.62)', lineHeight:1.6 }}>{issue.issue}</p>
              </div>
            </div>

            {/* status actions */}
            <div className="sec" style={{ animation:'fu .4s ease .08s both' }}>
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'10px' }}>Update Status</p>
              <div style={{ display:'flex', gap:'7px', flexWrap:'wrap' }}>
                {issue.status==='pending'     && <button className="act" onClick={()=>updateStatus('assigned')} disabled={updating} style={{ background:'rgba(34,211,238,.08)',border:'1px solid rgba(34,211,238,.18)',color:'#22d3ee' }}><PlayCircle size={13} />Assign</button>}
                {issue.status==='assigned'    && <button className="act" onClick={()=>updateStatus('in-progress')} disabled={updating} style={{ background:'rgba(167,139,250,.08)',border:'1px solid rgba(167,139,250,.18)',color:'#a78bfa' }}><PlayCircle size={13} />Start Work</button>}
                {issue.status==='in-progress' && <button className="act" onClick={()=>updateStatus('completed')} disabled={updating} style={{ background:'rgba(74,222,128,.08)',border:'1px solid rgba(74,222,128,.18)',color:'#4ade80' }}><CheckCircle size={13} />Complete</button>}
                <button className="act" onClick={()=>updateStatus('cancelled')} disabled={updating} style={{ background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.14)',color:'#f87171' }}><XCircle size={13} />Cancel</button>
              </div>
            </div>

            {/* photos */}
            <div className="sec" style={{ animation:'fu .4s ease .15s both' }}>
              <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff', marginBottom:'12px' }}>Photos <span style={{ color:'rgba(255,255,255,.28)', fontWeight:'500', fontSize:'11px' }}>{photos.length}</span></p>
              {photos.length===0 ? (
                <p style={{ textAlign:'center', color:'rgba(255,255,255,.18)', fontSize:'12px', padding:'18px 0' }}>No photos uploaded yet</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'7px' }}>
                  {photos.map(ph => (
                    <div key={ph.id} style={{ aspectRatio:'1', borderRadius:'9px', overflow:'hidden', position:'relative', border:'1px solid rgba(255,255,255,.06)' }}>
                      <img src={ph.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top,rgba(0,0,0,.65),transparent)', padding:'5px', fontSize:'9px', color:'rgba(255,255,255,.7)', textTransform:'capitalize', fontWeight:'700' }}>{ph.photo_type}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', animation:'fu .4s ease .06s both' }}>
            {/* assigned tech */}
            <div className="sec">
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'12px' }}>Assigned To</p>
              {tech ? (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'linear-gradient(135deg,#22d3ee,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', color:'#000', flexShrink:0 }}>
                      {tech.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tech.name}</p>
                      <p style={{ fontSize:'10px', color:'rgba(255,255,255,.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tech.email}</p>
                    </div>
                  </div>
                  {tech.phone && (
                    <button onClick={() => window.open(`tel:${tech.phone}`,'_self')}
                      style={{ width:'100%', height:'34px', borderRadius:'9px', background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.16)', color:'#fbbf24', fontSize:'11px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontFamily:'inherit' }}>
                      <Phone size={11} />Call Technician
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,.2)', textAlign:'center', padding:'10px 0' }}>Not assigned</p>
              )}
            </div>

            {/* GPS */}
            {issue.latitude && issue.longitude && (
              <div className="sec">
                <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'10px' }}>Location</p>
                <button onClick={() => window.open(`https://maps.google.com/maps?q=${issue.latitude},${issue.longitude}`,'_blank')}
                  style={{ width:'100%', height:'34px', borderRadius:'9px', background:'rgba(34,211,238,.07)', border:'1px solid rgba(34,211,238,.15)', color:'#22d3ee', fontSize:'11px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontFamily:'inherit' }}>
                  <MapPin size={11} />Open in Maps
                </button>
                <p style={{ fontSize:'10px', color:'rgba(255,255,255,.18)', marginTop:'7px', textAlign:'center', fontFamily:'monospace' }}>
                  {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                </p>
              </div>
            )}

            {/* timeline */}
            <div className="sec">
              <p style={{ fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'12px' }}>Timeline</p>
              {[
                { lbl:'Created',   val:formatDateTime(issue.created_at),    c:'#22d3ee' },
                issue.started_at  ?{lbl:'Started',   val:formatDateTime(issue.started_at!),    c:'#a78bfa'}:null,
                issue.completed_at?{lbl:'Completed', val:formatDateTime(issue.completed_at!),   c:'#4ade80'}:null,
              ].filter(Boolean).map(t=>(
                <div key={t!.lbl} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'9px' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:t!.c, marginTop:'3px', flexShrink:0, boxShadow:`0 0 5px ${t!.c}70` }} />
                  <div>
                    <p style={{ fontSize:'10px', color:'rgba(255,255,255,.25)' }}>{t!.lbl}</p>
                    <p style={{ fontSize:'11px', color:'rgba(255,255,255,.5)', fontWeight:'600' }}>{t!.val}</p>
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
