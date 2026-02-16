'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Users, Mail, Phone, Shield, Trash2 } from 'lucide-react'
import type { Technician } from '@/lib/types'

export default function TechniciansPage() {
  const router = useRouter()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'technician'
  })

  useEffect(() => {
    checkAuth()
    fetchTechnicians()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: tech } = await supabase
      .from('technicians')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (tech?.role !== 'admin' && tech?.role !== 'manager') {
      router.push('/technician')
    }
  }

  const fetchTechnicians = async () => {
    try {
      const { data } = await supabase
        .from('technicians')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setTechnicians(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      // Step 1: Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('User creation failed')

      // Step 2: Insert into technicians table
      const { error: dbError } = await supabase
        .from('technicians')
        .insert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          role: formData.role
        })

      if (dbError) throw dbError

      alert('Technician created successfully!')
      setFormData({ email: '', password: '', name: '', phone: '', role: 'technician' })
      setShowForm(false)
      fetchTechnicians()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete technician ${email}?`)) return

    try {
      // Delete from technicians table (Auth user should be deleted manually from dashboard)
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Technician deleted from database. Please also delete from Supabase Auth dashboard.')
      fetchTechnicians()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Technician Management</h1>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Technician
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Form */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add New Technician</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTechnician} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Min 6 characters"
                      minLength={6}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Role *</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="technician">Technician</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Technician'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Technicians List */}
        <Card>
          <CardHeader>
            <CardTitle>All Technicians ({technicians.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {technicians.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No technicians found. Add your first technician to get started.
                </p>
              ) : (
                technicians.map((tech) => (
                  <div
                    key={tech.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{tech.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tech.role === 'admin' ? 'bg-red-500 text-white' :
                          tech.role === 'manager' ? 'bg-blue-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {tech.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {tech.email}
                        </span>
                        {tech.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {tech.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {tech.id}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(tech.id, tech.email)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
