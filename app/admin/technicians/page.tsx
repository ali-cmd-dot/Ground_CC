'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Mail, Phone, Shield, Trash2, MapPin, Edit2, Check, X } from 'lucide-react'
import type { Technician } from '@/lib/types'

interface TechWithCities extends Technician {
  cities?: string
}

export default function TechniciansPage() {
  const router = useRouter()
  const [technicians, setTechnicians] = useState<TechWithCities[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingCities, setEditingCities] = useState<Record<string, string>>({})
  const [savingCities, setSavingCities] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '', password: '', name: '', phone: '', role: 'technician', cities: ''
  })

  useEffect(() => {
    checkAuth(); fetchTechnicians()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchTechnicians = async () => {
    try {
      const { data } = await supabase.from('technicians').select('*').order('created_at', { ascending: false })
      if (data) setTechnicians(data)
    } finally { setLoading(false) }
  }

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email, password: formData.password,
        options: { data: { name: formData.name } }
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      const { error: dbError } = await supabase.from('technicians').insert({
        id: authData.user.id, email: formData.email, name: formData.name,
        phone: formData.phone, role: formData.role, cities: formData.cities || null
      })
      if (dbError) throw dbError

      alert('Technician created!')
      setFormData({ email: '', password: '', name: '', phone: '', role: 'technician', cities: '' })
      setShowForm(false); fetchTechnicians()
    } catch (err: any) { alert('Error: ' + err.message) }
    finally { setCreating(false) }
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete technician ${email}?`)) return
    const { error } = await supabase.from('technicians').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else { alert('Deleted!'); fetchTechnicians() }
  }

  const startEditCities = (tech: TechWithCities) => {
    setEditingCities(prev => ({ ...prev, [tech.id]: tech.cities || '' }))
  }

  const saveCities = async (techId: string) => {
    setSavingCities(techId)
    const { error } = await supabase.from('technicians').update({ cities: editingCities[techId] }).eq('id', techId)
    setSavingCities(null)
    if (error) { alert('Error: ' + error.message); return }
    setEditingCities(prev => { const n = { ...prev }; delete n[techId]; return n })
    fetchTechnicians()
  }

  const cancelEdit = (techId: string) => {
    setEditingCities(prev => { const n = { ...prev }; delete n[techId]; return n })
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-500/20 text-red-400 border-red-500/30',
    manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    technician: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#080810]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810]">
      <header className="bg-[#0a0a12] border-b border-white/8 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <h1 className="text-xl font-bold text-white">Technician Management</h1>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />Add Technician
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Create Form */}
        {showForm && (
          <div className="bg-[#0d0d16] border border-white/10 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-5">Add New Technician</h2>
            <form onSubmit={handleCreateTechnician} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Full Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
                <div>
                  <Label className="text-gray-400">Email *</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com" required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
                <div>
                  <Label className="text-gray-400">Password *</Label>
                  <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 characters" minLength={6} required className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
                <div>
                  <Label className="text-gray-400">Phone Number</Label>
                  <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210" className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
                <div>
                  <Label className="text-gray-400">Role *</Label>
                  <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full mt-1 h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-white [color-scheme:dark]">
                    <option value="technician">Technician</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <Label className="text-gray-400 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Cities (comma separated)</Label>
                  <Input value={formData.cities} onChange={e => setFormData({ ...formData, cities: e.target.value })}
                    placeholder="Mumbai, Pune, Thane" className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700">
                  {creating ? 'Creating...' : 'Create Technician'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}
                  className="border-white/10 text-gray-300 hover:bg-white/5">Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {/* Technicians List */}
        <div className="bg-[#0d0d16] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/8">
            <h2 className="text-lg font-bold text-white">All Technicians ({technicians.length})</h2>
          </div>
          <div className="divide-y divide-white/5">
            {technicians.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No technicians found. Add your first technician.</p>
            ) : (
              technicians.map(tech => (
                <div key={tech.id} className="p-5 hover:bg-white/2 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-bold text-white text-lg">{tech.name}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${roleColors[tech.role]}`}>
                          {tech.role}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
                        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{tech.email}</span>
                        {tech.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{tech.phone}</span>}
                      </div>

                      {/* Cities editing */}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                        {editingCities[tech.id] !== undefined ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingCities[tech.id]}
                              onChange={e => setEditingCities(prev => ({ ...prev, [tech.id]: e.target.value }))}
                              placeholder="Mumbai, Pune, Thane"
                              className="h-8 text-sm bg-white/5 border-white/10 text-white flex-1"
                            />
                            <Button size="sm" onClick={() => saveCities(tech.id)}
                              disabled={savingCities === tech.id}
                              className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => cancelEdit(tech.id)}
                              className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {tech.cities ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {tech.cities.split(',').map(c => c.trim()).filter(Boolean).map(city => (
                                  <span key={city} className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                    {city}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600 italic">No cities assigned</span>
                            )}
                            <button onClick={() => startEditCities(tech)}
                              className="text-gray-500 hover:text-blue-400 transition-colors ml-1">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(tech.id, tech.email)}
                      className="shrink-0 h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
