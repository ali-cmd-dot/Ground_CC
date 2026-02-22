'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { Save, MapPin } from 'lucide-react'

const S = `
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
input,select,textarea{font-family:'Outfit',system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9px;font-size:13px;outline:none;width:100%;padding:10px 12px}
input,select{height:38px;padding:0 12px}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.2)}
input:focus,select:focus,textarea:focus{border-color:rgba(34,211,238,.3);background:rgba(34,211,238,.04)}
label{font-size:10px;font-weight:600;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:5px}
.fgroup{display:flex;flex-direction:column;gap:5px}
.btn{height:38px;border-radius:9px;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'Outfit',system-ui,sans-serif;transition:all .15s;padding:0 16px}
.btn:active{transform:scale(.97)}
.sec{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:16px;padding:20px;margin-bottom:14px}
.sec-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:800;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px}
`

export default function CreateIssuePage() {
  const router = useRouter()
  const [loading,    setLoading]    = useState(false)
  const [techs,      setTechs]      = useState<{id:string;name:string;email:string}[]>([])
  const [gettingLoc, setGettingLoc] = useState(false)
  const [userName,   setUserName]   = useState('')
  const [form, setForm] = useState({
    vehicle_no:'', client:'', poc_name:'', poc_number:'',
    issue:'', city:'', location:'', latitude:0, longitude:0,
    availability:'', priority:'medium', assigned_to:'',
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data:t } = await supabase.from('technicians').select('*').eq('id',session.user.id).single()
    if (t) setUserName(t.name)
    const { data:td } = await supabase.from('technicians').select('id,name,email').eq('role','technician')
    if (td) setTechs(td)
  }

  const getLocation = () => {
    setGettingLoc(true)
    navigator.geolocation.getCurrentPosition(
      p => { setForm(prev => ({ ...prev, latitude:p.coords.latitude, longitude:p.coords.longitude, location:`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}` })); setGettingLoc(false) },
      err => { alert('Location error: '+err.message); setGettingLoc(false) }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const { error } = await supabase.from('issues').insert({ ...form, status:form.assigned_to?'assigned':'pending' })
      if (error) throw error
      router.push('/admin')
    } catch(err:any) { alert('Error: '+err.message) }
    finally { setLoading(false) }
  }

  const f = (id: string, val: string) => setForm(prev => ({ ...prev, [id]:val }))

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  return (
    <AppShell role="admin" userName={userName} onLogout={logout}>
      <style>{S}</style>
      <div style={{ flex:1, overflowY:'auto', padding:'28px', minWidth:0, maxWidth:'720px' }}>

        <div style={{ marginBottom:'24px', animation:'fu .4s ease' }}>
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'5px' }}>New</p>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1 }}>Create Issue</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ animation:'fu .4s ease .05s both' }}>
          {/* Vehicle */}
          <div className="sec">
            <p className="sec-title">Vehicle</p>
            <div className="fgroup">
              <label htmlFor="vehicle_no">Vehicle Number *</label>
              <input id="vehicle_no" value={form.vehicle_no} onChange={e => f('vehicle_no',e.target.value)} placeholder="MH01AB1234" required />
            </div>
          </div>

          {/* Client */}
          <div className="sec">
            <p className="sec-title">Client</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
              <div className="fgroup" style={{ gridColumn:'1/-1' }}>
                <label htmlFor="client">Client Name *</label>
                <input id="client" value={form.client} onChange={e => f('client',e.target.value)} placeholder="Company name" required />
              </div>
              <div className="fgroup">
                <label htmlFor="poc_name">POC Name</label>
                <input id="poc_name" value={form.poc_name} onChange={e => f('poc_name',e.target.value)} placeholder="John" />
              </div>
              <div className="fgroup" style={{ gridColumn:'span 2' }}>
                <label htmlFor="poc_number">POC Number</label>
                <input id="poc_number" value={form.poc_number} onChange={e => f('poc_number',e.target.value)} placeholder="9876543210" />
              </div>
            </div>
          </div>

          {/* Issue */}
          <div className="sec">
            <p className="sec-title">Issue Details</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div className="fgroup" style={{ gridColumn:'1/-1' }}>
                <label htmlFor="issue">Description *</label>
                <textarea id="issue" value={form.issue} onChange={e => f('issue',e.target.value)} placeholder="Describe the issue…" style={{ minHeight:'80px', resize:'vertical' }} required />
              </div>
              <div className="fgroup">
                <label htmlFor="priority">Priority *</label>
                <select id="priority" value={form.priority} onChange={e => f('priority',e.target.value)}>
                  {['low','medium','high','urgent'].map(o => <option key={o} value={o} style={{ background:'#0b0b17' }}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                </select>
              </div>
              <div className="fgroup">
                <label htmlFor="availability">Availability</label>
                <input id="availability" value={form.availability} onChange={e => f('availability',e.target.value)} placeholder="9am–7pm" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="sec">
            <p className="sec-title">Location</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div className="fgroup">
                <label htmlFor="city">City</label>
                <input id="city" value={form.city} onChange={e => f('city',e.target.value)} placeholder="Mumbai" />
              </div>
              <div className="fgroup">
                <label htmlFor="location">Area</label>
                <input id="location" value={form.location} onChange={e => f('location',e.target.value)} placeholder="Bandra West" />
              </div>
            </div>
            <button type="button" onClick={getLocation} disabled={gettingLoc} className="btn"
              style={{ background:'rgba(34,211,238,.08)', border:'1px solid rgba(34,211,238,.18)', color:'#22d3ee' }}>
              <MapPin size={13} style={{ animation:gettingLoc?'spin 1s linear infinite':'none' }} />
              {gettingLoc ? 'Getting GPS…' : 'Capture GPS Coordinates'}
            </button>
            {form.latitude !== 0 && (
              <p style={{ fontSize:'11px', color:'#4ade80', marginTop:'8px', fontFamily:'monospace' }}>
                ✓ {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </p>
            )}
          </div>

          {/* Assignment */}
          <div className="sec">
            <p className="sec-title">Assignment</p>
            <div className="fgroup">
              <label htmlFor="assigned_to">Assign to Technician</label>
              <select id="assigned_to" value={form.assigned_to} onChange={e => f('assigned_to',e.target.value)}>
                <option value="" style={{ background:'#0b0b17' }}>— Leave Unassigned —</option>
                {techs.map(t => <option key={t.id} value={t.id} style={{ background:'#0b0b17' }}>{t.name} ({t.email})</option>)}
              </select>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display:'flex', gap:'8px' }}>
            <button type="submit" disabled={loading} className="btn"
              style={{ flex:1, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', border:'none', color:'#fff', boxShadow:'0 4px 18px rgba(34,211,238,.2)' }}>
              <Save size={14} />{loading ? 'Creating…' : 'Create Issue'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn"
              style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', color:'rgba(255,255,255,.4)' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
