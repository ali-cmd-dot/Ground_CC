'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, MapPin, Phone, User, Clock,
  AlertCircle, CheckCircle, XCircle, PlayCircle,
  Camera, Edit, Trash2, Package, FileText, PenTool
} from 'lucide-react'
import type { Issue, IssuePhoto, DigitalSignature, PartsUsage } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function IssueDetailPage() {
  const router = useRouter()
  const params = useParams()
  const issueId = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [photos, setPhotos] = useState<IssuePhoto[]>([])
  const [signature, setSignature] = useState<DigitalSignature | null>(null)
  const [partsUsed, setPartsUsed] = useState<PartsUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [technician, setTechnician] = useState<any>(null)

  useEffect(() => {
    fetchIssueDetails()
    fetchPhotos()
    fetchSignature()
    fetchPartsUsed()
  }, [issueId])

  const fetchIssueDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*, technicians:assigned_to (id, name, email, phone)')
        .eq('id', issueId).single()
      if (error) throw error
      setIssue(data)
      if (data.assigned_to) setTechnician((data as any).technicians)
    } catch {
      alert('Issue not found')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const fetchPhotos = async () => {
    const { data } = await supabase.from('issue_photos').select('*').eq('issue_id', issueId).order('taken_at', { ascending: false })
    if (data) setPhotos(data)
  }

  const fetchSignature = async () => {
    const { data } = await supabase.from('digital_signatures').select('*').eq('issue_id', issueId).maybeSingle()
    if (data) setSignature(data)
  }

  const fetchPartsUsed = async () => {
    const { data } = await supabase.from('parts_usage')
      .select('*, inventory_items(name, unit_price)').eq('issue_id', issueId)
    if (data) setPartsUsed(data)
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'in-progress' && !issue?.started_at) updates.started_at = new Date().toISOString()
      if (newStatus === 'completed' && !issue?.completed_at) updates.completed_at = new Date().toISOString()
      const { error } = await supabase.from('issues').update(updates).eq('id', issueId)
      if (error) throw error
      fetchIssueDetails()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const deleteIssue = async () => {
    if (!confirm('Delete this issue?')) return
    const { error } = await supabase.from('issues').delete().eq('id', issueId)
    if (error) alert('Error: ' + error.message)
    else { alert('Deleted!'); router.push('/admin') }
  }

  const handleAssignTech = async (techId: string) => {
    const { error } = await supabase.from('issues').update({
      assigned_to: techId || null, status: techId ? 'assigned' : 'pending'
    }).eq('id', issueId)
    if (!error) fetchIssueDetails()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
  if (!issue) return null

  const partsCost = partsUsed.reduce((s, p) => s + (p.quantity * (p.unit_price || (p as any).inventory_items?.unit_price || 0)), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/issues/${issueId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={deleteIssue}>
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{issue.vehicle_no}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(issue.status)}`}>{issue.status}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getPriorityColor(issue.priority)}`}>{issue.priority}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Client</p><p className="font-medium">{issue.client}</p></div>
                  {issue.poc_name && <div><p className="text-muted-foreground">POC</p><p className="font-medium">{issue.poc_name}</p></div>}
                  {issue.poc_number && <div><p className="text-muted-foreground">Contact</p>
                    <a href={`tel:${issue.poc_number}`} className="font-medium text-blue-600 flex items-center gap-1">
                      <Phone className="h-3 w-3" />{issue.poc_number}
                    </a>
                  </div>}
                  {issue.city && <div><p className="text-muted-foreground">Location</p>
                    <p className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{issue.city}{issue.location && ` - ${issue.location}`}</p>
                  </div>}
                  {issue.availability && <div><p className="text-muted-foreground">Availability</p><p className="font-medium">{issue.availability}</p></div>}
                  {issue.days && <div><p className="text-muted-foreground">Days</p><p className="font-medium">{issue.days}</p></div>}
                </div>

                <div>
                  <p className="text-muted-foreground text-sm mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Issue</p>
                  <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{issue.issue}</p>
                </div>

                {issue.latitude && issue.longitude && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <a href={`https://maps.google.com/?q=${issue.latitude},${issue.longitude}`} target="_blank"
                      className="text-sm text-blue-600 hover:underline">
                      View on Map ({Number(issue.latitude).toFixed(4)}, {Number(issue.longitude).toFixed(4)})
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground border-t pt-4">
                  <div><p>Created</p><p className="font-medium">{formatDateTime(issue.created_at)}</p></div>
                  {issue.started_at && <div><p>Started</p><p className="font-medium">{formatDateTime(issue.started_at)}</p></div>}
                  {issue.completed_at && <div><p>Completed</p><p className="font-medium">{formatDateTime(issue.completed_at)}</p></div>}
                </div>
              </CardContent>
            </Card>

            {/* Status Actions */}
            <Card>
              <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {issue.status === 'pending' && (
                    <Button onClick={() => updateStatus('assigned')} disabled={updating}>
                      <PlayCircle className="h-4 w-4 mr-2" />Mark Assigned
                    </Button>
                  )}
                  {issue.status === 'assigned' && (
                    <Button onClick={() => updateStatus('in-progress')} disabled={updating}>
                      <PlayCircle className="h-4 w-4 mr-2" />Start Work
                    </Button>
                  )}
                  {issue.status === 'in-progress' && (
                    <Button onClick={() => updateStatus('completed')} disabled={updating} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" />Complete
                    </Button>
                  )}
                  <Button onClick={() => updateStatus('cancelled')} disabled={updating} variant="destructive">
                    <XCircle className="h-4 w-4 mr-2" />Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Parts Used */}
            {partsUsed.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />Parts Used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {partsUsed.map(p => (
                      <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                        <span>{(p as any).inventory_items?.name || 'Unknown'} × {p.quantity}</span>
                        <span className="font-medium">₹{(p.quantity * (p.unit_price || (p as any).inventory_items?.unit_price || 0)).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold">
                      <span>Total Parts Cost</span>
                      <span>₹{partsCost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />Photos ({photos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {photos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No photos uploaded yet</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map(photo => (
                      <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img src={photo.photo_url} alt="Issue photo" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 capitalize">
                          {photo.photo_type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Digital Signature */}
            {signature && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />Client Signature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {signature.client_name && <p className="text-sm font-medium">Signed by: {signature.client_name}</p>}
                    <img src={signature.signature_url} alt="Client signature" className="border rounded-lg max-h-32 bg-white" />
                    <p className="text-xs text-muted-foreground">Signed at: {formatDateTime(signature.signed_at)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right - Assignment & Quick Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Assigned To</CardTitle></CardHeader>
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
                      <a href={`tel:${technician.phone}`}>
                        <Button variant="outline" className="w-full" size="sm">
                          <Phone className="h-4 w-4 mr-2" />Call Technician
                        </Button>
                      </a>
                    )}
                    <Button variant="outline" className="w-full" size="sm" onClick={() => handleAssignTech('')}>
                      Unassign
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-3">Not assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start"
                  onClick={() => router.push(`/admin/issues/${issueId}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />Edit Issue
                </Button>
                {issue.latitude && issue.longitude && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href={`https://maps.google.com/?q=${issue.latitude},${issue.longitude}`} target="_blank">
                      <MapPin className="h-4 w-4 mr-2" />Open in Maps
                    </a>
                  </Button>
                )}
                <Button variant="outline" className="w-full justify-start"
                  onClick={() => router.push(`/admin/invoices`)}>
                  <FileText className="h-4 w-4 mr-2" />Create Invoice
                </Button>
                {issue.poc_number && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href={`tel:${issue.poc_number}`}>
                      <Phone className="h-4 w-4 mr-2" />Call Client
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {issue.last_rectification_status && (
              <Card>
                <CardHeader><CardTitle>Previous Status</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm">{issue.last_rectification_status}</p>
                  {issue.last_rectification_date && <p className="text-xs text-muted-foreground mt-1">{issue.last_rectification_date}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
