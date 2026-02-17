'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Car,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  PlayCircle,
  Camera,
  Edit,
  Trash2
} from 'lucide-react'
import type { Issue, IssuePhoto } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function IssueDetailPage() {
  const router = useRouter()
  const params = useParams()
  const issueId = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [photos, setPhotos] = useState<IssuePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [technician, setTechnician] = useState<any>(null)

  useEffect(() => {
    fetchIssueDetails()
    fetchPhotos()
  }, [issueId])

  const fetchIssueDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          technicians:assigned_to (id, name, email, phone)
        `)
        .eq('id', issueId)
        .single()

      if (error) throw error
      
      setIssue(data)
      if (data.assigned_to) {
        setTechnician((data as any).technicians)
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Issue not found')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from('issue_photos')
      .select('*')
      .eq('issue_id', issueId)
      .order('taken_at', { ascending: false })

    if (data) setPhotos(data)
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const updates: any = { status: newStatus }
      
      if (newStatus === 'in-progress' && !issue?.started_at) {
        updates.started_at = new Date().toISOString()
      }
      
      if (newStatus === 'completed' && !issue?.completed_at) {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('issues')
        .update(updates)
        .eq('id', issueId)

      if (error) throw error

      alert('Status updated successfully!')
      fetchIssueDetails()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const deleteIssue = async () => {
    if (!confirm('Are you sure you want to delete this issue?')) return

    try {
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', issueId)

      if (error) throw error

      alert('Issue deleted successfully!')
      router.push('/admin')
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

  if (!issue) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={deleteIssue}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status & Priority */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{issue.vehicle_no}</CardTitle>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getPriorityColor(issue.priority)}`}>
                      {issue.priority}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Info */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{issue.client}</p>
                    </div>
                    {issue.poc_name && (
                      <div>
                        <p className="text-muted-foreground">POC</p>
                        <p className="font-medium">{issue.poc_name}</p>
                      </div>
                    )}
                    {issue.poc_number && (
                      <div>
                        <p className="text-muted-foreground">Contact</p>
                        <p className="font-medium flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {issue.poc_number}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {issue.city && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </h3>
                    <p className="text-sm">
                      {issue.city} {issue.location && `- ${issue.location}`}
                    </p>
                    {issue.latitude && issue.longitude && (
                      <p className="text-xs text-muted-foreground mt-1">
                        GPS: {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                )}

                {/* Issue Description */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Issue Description
                  </h3>
                  <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {issue.issue}
                  </p>
                </div>

                {/* Availability */}
                {issue.availability && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Availability
                    </h3>
                    <p className="text-sm">{issue.availability}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p>Created</p>
                    <p className="font-medium">{formatDateTime(issue.created_at)}</p>
                  </div>
                  {issue.started_at && (
                    <div>
                      <p>Started</p>
                      <p className="font-medium">{formatDateTime(issue.started_at)}</p>
                    </div>
                  )}
                  {issue.completed_at && (
                    <div>
                      <p>Completed</p>
                      <p className="font-medium">{formatDateTime(issue.completed_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {issue.status === 'pending' && (
                    <Button 
                      onClick={() => updateStatus('assigned')}
                      disabled={updating}
                      className="w-full"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Assign
                    </Button>
                  )}
                  
                  {issue.status === 'assigned' && (
                    <Button 
                      onClick={() => updateStatus('in-progress')}
                      disabled={updating}
                      className="w-full"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Start Work
                    </Button>
                  )}
                  
                  {issue.status === 'in-progress' && (
                    <Button 
                      onClick={() => updateStatus('completed')}
                      disabled={updating}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                  )}

                  <Button 
                    onClick={() => updateStatus('cancelled')}
                    disabled={updating}
                    variant="destructive"
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Photos ({photos.length})
                  </CardTitle>
                  <Button size="sm" variant="outline">
                    Upload Photo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {photos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No photos uploaded yet
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img 
                          src={photo.photo_url} 
                          alt="Issue photo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                          {photo.photo_type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Assignment & Info */}
          <div className="space-y-6">
            {/* Assigned Technician */}
            <Card>
              <CardHeader>
                <CardTitle>Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                {technician ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{technician.name}</p>
                        <p className="text-sm text-muted-foreground">{technician.email}</p>
                      </div>
                    </div>
                    {technician.phone && (
                      <Button variant="outline" className="w-full" size="sm">
                        <Phone className="h-4 w-4 mr-2" />
                        Call Technician
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-3">Not assigned yet</p>
                    <Button size="sm">Assign Now</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="h-4 w-4 mr-2" />
                  View on Map
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Camera className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Client
                </Button>
              </CardContent>
            </Card>

            {/* Additional Info */}
            {issue.last_rectification_status && (
              <Card>
                <CardHeader>
                  <CardTitle>Previous Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{issue.last_rectification_status}</p>
                  {issue.last_rectification_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {issue.last_rectification_date}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
