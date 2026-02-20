'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, User, Camera, Save, Phone, Mail, Lock, LogOut } from 'lucide-react'

export default function TechnicianProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [tech, setTech] = useState<any>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [stats, setStats] = useState({ totalIssues: 0, completedIssues: 0, attendanceDays: 0 })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase.from('technicians').select('*').eq('id', session.user.id).single()
    if (data) {
      setTech(data)
      setFormData({ name: data.name, phone: data.phone || '', email: data.email })
    }

    // Fetch stats
    const [issuesRes, attRes] = await Promise.all([
      supabase.from('issues').select('id, status').eq('assigned_to', session.user.id),
      supabase.from('attendance').select('id').eq('technician_id', session.user.id)
    ])

    setStats({
      totalIssues: issuesRes.data?.length || 0,
      completedIssues: issuesRes.data?.filter(i => i.status === 'completed').length || 0,
      attendanceDays: attRes.data?.length || 0
    })
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('technicians').update({
        name: formData.name,
        phone: formData.phone
      }).eq('id', tech.id)
      if (error) throw error
      alert('Profile updated!')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
      formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)
      formData.append('folder', 'profiles')

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )
      const data = await res.json()

      const { error } = await supabase.from('technicians').update({ photo_url: data.secure_url }).eq('id', tech.id)
      if (error) throw error

      setTech({ ...tech, photo_url: data.secure_url })
      alert('Photo updated!')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordForm.newPass !== passwordForm.confirm) { alert('Passwords do not match!'); return }
    if (passwordForm.newPass.length < 6) { alert('Password too short (min 6 chars)'); return }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
      if (error) throw error
      alert('Password changed!')
      setPasswordForm({ current: '', newPass: '', confirm: '' })
      setShowPasswordForm(false)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/technician')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <h1 className="text-xl font-bold">My Profile</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />Logout
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Photo */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {tech?.photo_url ? (
                    <img src={tech.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-primary" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white shadow"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">{tech?.name}</h2>
                <p className="text-muted-foreground capitalize">{tech?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalIssues}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Issues</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completedIssues}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.attendanceDays}</p>
              <p className="text-xs text-muted-foreground mt-1">Days Present</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile */}
        <Card>
          <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><User className="h-4 w-4" />Full Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" />Phone Number</Label>
              <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
              <Input value={formData.email} disabled className="mt-1 opacity-60" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Password</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                {showPasswordForm ? 'Cancel' : 'Change'}
              </Button>
            </div>
          </CardHeader>
          {showPasswordForm && (
            <CardContent className="space-y-4">
              <div>
                <Label>New Password</Label>
                <Input type="password" value={passwordForm.newPass}
                  onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                  placeholder="Min 6 characters" className="mt-1" />
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input type="password" value={passwordForm.confirm}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  placeholder="Repeat password" className="mt-1" />
              </div>
              <Button onClick={handlePasswordChange} className="w-full">Update Password</Button>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}
