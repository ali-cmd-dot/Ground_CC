'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import {
  ClipboardList, CheckCircle, Clock, Users, AlertTriangle,
  Plus, Upload, Eye, Search, X, RefreshCw, MapPin, Phone,
  ArrowUpRight, Package,
} from 'lucide-react'
import type { Issue, Technician } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

/* ── colour maps ── */
const PC: Record<string,{c:string;bg:string}> = {
  urgent:{ c:'#f87171', bg:'rgba(248,113,113,.12)' },
  high:  { c:'#fb923c', bg:'rgba(251,146,60,.12)'  },
  medium:{ c:'#fbbf24', bg:'rgba(251,191,36,.12)'  },
  low:   { c:'#4ade80', bg:'rgba(74,222,128,.12)'  },
}
const SC: Record<string,{c:string;bg:string}> = {
  pending:     { c:'#fb923c', bg:'rgba(251,146,60,.12)' },
  assigned:    { c:'#22d3ee', bg:'rgba(34,211,238,.1)'  },
  'in-progress':{ c:'#a78bfa',bg:'rgba(167,139,250,.12)'},
  completed:   { c:'#4ade80', bg:'rgba(74,222,128,.12)' },
  cancelled:   { c:'#6b7280', bg:'rgba(107,114,128,.1)' },
}

const S = `
@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
input,select,textarea{font-family:'Outfit',system-ui,sans-serif}
input::placeholder{color:rgba(255,255,255,.18)}
.row{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s}
.row:hover{background:rgba(255,255,255,.03)}
.row:last-child{border-bottom:none}
.tag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap}
.qcard{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);cursor:pointer;transition:all .2s;font-family:'Outfit',system-ui,sans-serif;text-align:left}
.qcard:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);transform:translateY(-1px)}
.statcard{padding:18px;border-radius:16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05)}
`

export default function AdminDashboard() {
  const router = useRouter()
  const [issues,      setIssues]      = useState<Issue[]>([])
  const [filtered,    setFiltered]    = useState<Issue[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [stFilter,    setStFilter]    = useState('all')
  const [prFilter,    setPrFilter]    = useState('all')
  const [userName,    setUserName]    = useState('')
  const [stats,       setStats]       = useState({ total:0, pending:0, completed:0, techs:0 })

  useEffect(() => {
    checkAuth(); fetchData()
    const sub = supabase.channel('iss')
      .on('postgres_changes',{ event:'*', schema:'public', table:'issues' }, fetchData)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [])

  useEffect(() => {
    let f = issues
    if (search)       f = f.filter(i =>
      [i.vehicle_no,i.client,i.city,i.poc_name,i.poc_number].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )
    if (stFilter !== 'all') f = f.filter(i => i.status === stFilter)
    if (prFilter !== 'all') f = f.filter(i => i.priority === prFilter)
    setFiltered(f)
  }, [issues, search, stFilter, prFilter])

  const checkAuth = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data:t } = await supabase.from('technicians').select('*').eq('id', session.user.id).single()
    if (t) setUserName(t.name)
    if (t?.role !== 'admin' && t?.role !== 'manager') router.push('/technician')
  }

  const fetchData = async () => {
    const [ir, tr] = await Promise.all([
      supabase.from('issues').select('*, technicians:assigned_to(name)').order('created_at',{ ascending:false }),
      supabase.from('technicians').select('*'),
    ])
    if (ir.data) {
      setIssues(ir.data)
      setStats({ total: ir.data.length,
        pending:   ir.data.filter(i => i.status==='pending'||i.status==='assigned').length,
        completed: ir.data.filter(i => i.status==='completed').length,
        techs:     tr.data?.length ?? 0 })
    }
    if (tr.data) setTechnicians(tr.data)
    setLoading(false)
  }

  const assign = async (issueId:string, techId:string) => {
    await supabase.from('issues').update({ assigned_to:techId, status:'assigned' }).eq('id', issueId)
    fetchData()
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07070f' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'34px', height:'34px', border:'2px solid #22d3ee', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  )

  const hasFilt = search || stFilter !== 'all' || prFilter !== 'all'

  const STAT_CARDS = [
    { label:'Total Issues',  val:stats.total,     icon:ClipboardList, c:'#22d3ee' },
    { label:'Open',          val:stats.pending,   icon:Clock,         c:'#fbbf24' },
    { label:'Completed',     val:stats.completed, icon:CheckCircle,   c:'#4ade80' },
    { label:'Technicians',   val:stats.techs,     icon:Users,         c:'#a78bfa' },
  ]

  return (
    <AppShell role="admin" userName={userName} onLogout={logout}>
      <style>{S}</style>

      <div style={{ flex:1, overflowY:'auto', padding:'28px', minWidth:0 }}>
        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'24px', animation:'fu .4s ease' }}>
          <div>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'5px' }}>Overview</p>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1, letterSpacing:'-0.3px' }}>Dashboard</h1>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={fetchData}
              style={{ height:'34px', padding:'0 12px', borderRadius:'9px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', color:'rgba(255,255,255,.4)', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', fontFamily:'inherit' }}>
              <RefreshCw size={12} />Refresh
            </button>
            <button onClick={() => router.push('/admin/issues/create')}
              style={{ height:'34px', padding:'0 14px', borderRadius:'9px', background:'linear-gradient(135deg,#0ea5e9,#6366f1)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:'700', fontFamily:'inherit', boxShadow:'0 4px 18px rgba(34,211,238,.2)' }}>
              <Plus size={13} />New Issue
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
          {STAT_CARDS.map((s, i) => (
            <div key={s.label} className="statcard" style={{ animation:`fu .4s ease ${i*.07}s both` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:`${s.c}18`, border:`1px solid ${s.c}28`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <s.icon size={15} color={s.c} />
                </div>
                <ArrowUpRight size={13} color="rgba(255,255,255,.12)" />
              </div>
              <p style={{ fontSize:'26px', fontFamily:"'Syne',sans-serif", fontWeight:'800', color:'#fff', lineHeight:1, marginBottom:'4px' }}>{s.val}</p>
              <p style={{ fontSize:'12px', fontWeight:'600', color:'rgba(255,255,255,.4)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Quick actions ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'24px' }}>
          {[
            { label:'Create Issue', sub:'Add manually', icon:Plus,   c:'#22d3ee', path:'/admin/issues/create'   },
            { label:'Import CSV',   sub:'Bulk upload',  icon:Upload,  c:'#4ade80', path:'/admin/import'           },
            { label:'Technicians',  sub:'Manage team',  icon:Users,   c:'#a78bfa', path:'/admin/technicians'      },
            { label:'Issues Map',   sub:'View routes',  icon:MapPin,  c:'#fb923c', path:'/admin/issues/map'       },
          ].map(item => (
            <button key={item.path} className="qcard" onClick={() => router.push(item.path)}>
              <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`${item.c}14`, border:`1px solid ${item.c}24`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <item.icon size={14} color={item.c} />
              </div>
              <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>{item.label}</p>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.28)' }}>{item.sub}</p>
            </button>
          ))}
        </div>

        {/* ── Issues table ── */}
        <div style={{ borderRadius:'16px', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', overflow:'hidden' }}>
          {/* filters bar */}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.04)', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff', flexShrink:0 }}>
              All Issues
              <span style={{ fontSize:'11px', fontWeight:'500', color:'rgba(255,255,255,.25)', marginLeft:'6px' }}>
                {filtered.length}{hasFilt ? ` / ${issues.length}` : ''}
              </span>
            </p>

            {/* search */}
            <div style={{ flex:1, minWidth:'140px', position:'relative' }}>
              <Search size={12} style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.2)', pointerEvents:'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search vehicle, client, city…"
                style={{ width:'100%', height:'32px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'8px', color:'#fff', fontSize:'12px', paddingLeft:'28px', paddingRight:'8px', outline:'none' }} />
              {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:'7px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.3)' }}><X size={11} /></button>}
            </div>

            {/* status */}
            <select value={stFilter} onChange={e => setStFilter(e.target.value)}
              style={{ height:'32px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'8px', color: stFilter!=='all'?'#22d3ee':'rgba(255,255,255,.35)', fontSize:'12px', padding:'0 8px', cursor:'pointer', outline:'none' }}>
              {['all','pending','assigned','in-progress','completed','cancelled'].map(o => (
                <option key={o} value={o} style={{ background:'#0b0b17' }}>{o==='all'?'All Status': o.charAt(0).toUpperCase()+o.slice(1)}</option>
              ))}
            </select>

            {/* priority */}
            <select value={prFilter} onChange={e => setPrFilter(e.target.value)}
              style={{ height:'32px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'8px', color: prFilter!=='all'?'#22d3ee':'rgba(255,255,255,.35)', fontSize:'12px', padding:'0 8px', cursor:'pointer', outline:'none' }}>
              {['all','urgent','high','medium','low'].map(o => (
                <option key={o} value={o} style={{ background:'#0b0b17' }}>{o==='all'?'All Priority': o.charAt(0).toUpperCase()+o.slice(1)}</option>
              ))}
            </select>

            {hasFilt && (
              <button onClick={() => { setSearch(''); setStFilter('all'); setPrFilter('all') }}
                style={{ height:'32px', padding:'0 10px', borderRadius:'8px', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.14)', color:'#f87171', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'3px' }}>
                <X size={11} />Clear
              </button>
            )}
          </div>

          {/* rows */}
          {filtered.length === 0 ? (
            <div style={{ padding:'50px 20px', textAlign:'center' }}>
              <AlertTriangle size={28} color="rgba(255,255,255,.1)" style={{ margin:'0 auto 8px' }} />
              <p style={{ color:'rgba(255,255,255,.2)', fontSize:'13px' }}>
                {hasFilt ? 'No issues match your filters' : 'No issues yet'}
              </p>
            </div>
          ) : filtered.map(issue => {
            const p = PC[issue.priority] ?? { c:'#9ca3af', bg:'rgba(156,163,175,.1)' }
            const s = SC[issue.status]   ?? { c:'#9ca3af', bg:'rgba(156,163,175,.1)' }
            return (
              <div key={issue.id} className="row" onClick={() => router.push(`/admin/issues/${issue.id}`)}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'14px', fontFamily:"'Syne',sans-serif", fontWeight:'800', color:'#fff' }}>{issue.vehicle_no}</span>
                    <span className="tag" style={{ color:s.c, background:s.bg }}>{issue.status}</span>
                    <span className="tag" style={{ color:p.c, background:p.bg }}>{issue.priority}</span>
                  </div>
                  <p style={{ fontSize:'12px', fontWeight:'600', color:'rgba(255,255,255,.5)', marginBottom:'4px' }}>{issue.client}</p>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    {issue.city && <span style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={9} />{issue.city}{issue.location?` · ${issue.location}`:''}</span>}
                    {issue.poc_name && <span style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', gap:'3px' }}><Phone size={9} />{issue.poc_name}{issue.poc_number?` · ${issue.poc_number}`:''}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                  {!issue.assigned_to ? (
                    <select onClick={e => e.stopPropagation()}
                      onChange={e => { if(e.target.value) assign(issue.id, e.target.value) }}
                      style={{ height:'28px', background:'rgba(251,146,60,.08)', border:'1px solid rgba(251,146,60,.2)', borderRadius:'7px', color:'#fb923c', fontSize:'11px', padding:'0 6px', cursor:'pointer', outline:'none' }}>
                      <option value="" style={{ background:'#0b0b17' }}>Assign…</option>
                      {technicians.filter(t => t.role==='technician').map(t => (
                        <option key={t.id} value={t.id} style={{ background:'#0b0b17' }}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize:'11px', color:'#22d3ee', fontWeight:'600' }}>👷 {(issue as any).technicians?.name}</span>
                  )}
                  <button onClick={e => { e.stopPropagation(); router.push(`/admin/issues/${issue.id}`) }}
                    style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.06)', color:'rgba(255,255,255,.35)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Eye size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
