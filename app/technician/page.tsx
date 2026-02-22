'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { AppShell } from '@/components/layout/AppShell'
import { Plus, Mail, Phone, Trash2, X } from 'lucide-react'
import type { Technician } from '@/lib/types'

const S = `
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
input,select{font-family:'Outfit',system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9px;height:38px;padding:0 12px;font-size:13px;outline:none;width:100%}
input::placeholder{color:rgba(255,255,255,.2)}
input:focus,select:focus{border-color:rgba(34,211,238,.3);background:rgba(34,211,238,.04)}
label{font-size:11px;font-weight:600;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px}
.btn{height:36px;border-radius:9px;border:none;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;font-family:'Outfit',system-ui,sans-serif;transition:all .15s;padding:0 14px}
.btn:active{transform:scale(.97)}
.trow{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s}
.trow:hover{background:rgba(255,255,255,.025)}
.trow:last-child{border-bottom:none}
`

const ROLE_COLORS: Record<string,{c:string;bg:string}> = {
  admin:   {c:'#f87171',bg:'rgba(248,113,113,.1)'},
  manager: {c:'#22d3ee',bg:'rgba(34,211,238,.1)'},
  technician:{c:'#4ade80',bg:'rgba(74,222,128,.1)'},
}

export default function TechniciansPage() {
  const router = useRouter()
  const [techs,     setTechs]     = useState<Technician[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [creating,  setCreating]  = useState(false)
  const [userName,  setUserName]  = useState('')
  const [form, setForm] = useState({ email:'', password:'', name:'', phone:'', role:'technician' })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data:{ session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data:t } = await supabase.from('technicians').select('*').eq('id',session.user.id).single()
    if (t) setUserName(t.name)
    if (t?.role!=='admin'&&t?.role!=='manager') router.push('/technician')
    fetchTechs()
  }

  const fetchTechs = async () => {
    const { data } = await supabase.from('technicians').select('*').order('created_at',{ascending:false})
    if (data) setTechs(data)
    setLoading(false)
  }

  const createTech = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true)
    try {
      const { data:auth, error:ae } = await supabase.auth.signUp({ email:form.email, password:form.password, options:{data:{name:form.name}} })
      if (ae) throw ae
      if (!auth.user) throw new Error('User creation failed')
      const { error:de } = await supabase.from('technicians').insert({ id:auth.user.id, email:form.email, name:form.name, phone:form.phone, role:form.role })
      if (de) throw de
      setForm({ email:'', password:'', name:'', phone:'', role:'technician' })
      setShowForm(false); fetchTechs()
    } catch(err:any) { alert('Error: '+err.message) }
    finally { setCreating(false) }
  }

  const deleteTech = async (id:string, email:string) => {
    if (!confirm(`Delete ${email}?`)) return
    await supabase.from('technicians').delete().eq('id',id)
    fetchTechs()
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#07070f' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'34px', height:'34px', border:'2px solid #22d3ee', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <AppShell role="admin" userName={userName} onLogout={logout}>
      <style>{S}</style>
      <div style={{ flex:1, overflowY:'auto', padding:'28px', minWidth:0 }}>

        {/* header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'24px', animation:'fu .4s ease' }}>
          <div>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,.22)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'5px' }}>Manage</p>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:'24px', fontWeight:'800', color:'#fff', lineHeight:1 }}>Technicians</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn"
            style={{ background:'linear-gradient(135deg,#0ea5e9,#6366f1)', border:'none', color:'#fff', boxShadow:'0 4px 18px rgba(34,211,238,.2)' }}>
            {showForm ? <X size={13} /> : <Plus size={13} />}
            {showForm ? 'Cancel' : 'Add Technician'}
          </button>
        </div>

        {/* create form */}
        {showForm && (
          <div style={{ marginBottom:'20px', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:'16px', padding:'20px', animation:'fu .3s ease' }}>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'14px', fontWeight:'800', color:'#fff', marginBottom:'16px' }}>New Technician</p>
            <form onSubmit={createTech}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px', marginBottom:'14px' }}>
                {[
                  { id:'name',     lbl:'Full Name',    ph:'John Doe',          type:'text'     },
                  { id:'email',    lbl:'Email',        ph:'john@example.com',  type:'email'    },
                  { id:'password', lbl:'Password',     ph:'Min 6 characters',  type:'password' },
                  { id:'phone',    lbl:'Phone',        ph:'+91 98765 43210',   type:'text'     },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id}>{f.lbl}</label>
                    <input id={f.id} type={f.type} placeholder={f.ph} required={f.id!=='phone'}
                      minLength={f.id==='password'?6:undefined}
                      value={(form as any)[f.id]}
                      onChange={e => setForm(prev => ({ ...prev, [f.id]:e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label htmlFor="role">Role</label>
                  <select id="role" value={form.role} onChange={e => setForm(prev => ({ ...prev, role:e.target.value }))}>
                    <option value="technician" style={{ background:'#0b0b17' }}>Technician</option>
                    <option value="manager"    style={{ background:'#0b0b17' }}>Manager</option>
                    <option value="admin"      style={{ background:'#0b0b17' }}>Admin</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={creating} className="btn"
                style={{ background:'linear-gradient(135deg,#0ea5e9,#6366f1)', border:'none', color:'#fff' }}>
                {creating ? 'Creating…' : 'Create Technician'}
              </button>
            </form>
          </div>
        )}

        {/* list */}
        <div style={{ borderRadius:'16px', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.05)', overflow:'hidden' }}>
          <div style={{ padding:'13px 16px', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#fff' }}>
              All Technicians
              <span style={{ fontSize:'11px', fontWeight:'500', color:'rgba(255,255,255,.28)', marginLeft:'6px' }}>{techs.length}</span>
            </p>
          </div>

          {techs.length === 0 ? (
            <p style={{ textAlign:'center', color:'rgba(255,255,255,.2)', fontSize:'13px', padding:'40px 0' }}>No technicians yet</p>
          ) : techs.map(t => {
            const rc = ROLE_COLORS[t.role] ?? { c:'#9ca3af', bg:'rgba(156,163,175,.1)' }
            return (
              <div key={t.id} className="trow">
                <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,#22d3ee,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', color:'#000', flexShrink:0 }}>
                  {t.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                    <p style={{ fontFamily:"'Syne',sans-serif", fontSize:'14px', fontWeight:'800', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</p>
                    <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'6px', color:rc.c, background:rc.bg, flexShrink:0 }}>{t.role}</span>
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'11px', color:'rgba(255,255,255,.28)', display:'flex', alignItems:'center', gap:'3px' }}><Mail size={9} />{t.email}</span>
                    {t.phone && <span style={{ fontSize:'11px', color:'rgba(255,255,255,.28)', display:'flex', alignItems:'center', gap:'3px' }}><Phone size={9} />{t.phone}</span>}
                  </div>
                </div>
                <button onClick={() => deleteTech(t.id, t.email)} className="btn"
                  style={{ background:'rgba(239,68,68,.07)', border:'1px solid rgba(239,68,68,.14)', color:'#f87171' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
