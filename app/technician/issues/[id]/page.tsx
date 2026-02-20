'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GPSCamera } from '@/components/camera/GPSCamera'
import { DigitalSignature } from '@/components/signature/DigitalSignature'
import {
  ArrowLeft, MapPin, Phone, User, PlayCircle,
  CheckCircle, Navigation, Camera, Clock, PenTool, Package
} from 'lucide-react'
import type { Issue, IssuePhoto } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function TechnicianIssueDetail() {
  const router = useRouter()
  const params = useParams()
  const issueId = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [photos, setPhotos] = useState<IssuePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [partsUsed, setPartsUsed] = useState<any[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [showPartsForm, setShowPartsForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState('')
  const [partQty, setPartQty] = useState(1)
  const [techId, setTechId] = useState('')

  useEffect(() => {
    fetchIssue()
    fetchPhotos()
    fetchSignature()
    fetchPartsUsed()
    getCurrentTech()
    fetchInventory()
  }, [issueId])

  const getCurrentTech = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) setTechId(session.user.id)
  }

  const fetchIssue = async () => {
    try {
      const { data, error } = await supabase.from('issues').select('*').eq('id', issueId).single()
      if (error) throw error
      setIssue(data)
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
    const { data } = await supabase.from('digital_signatures').select('id').eq('issue_id', issueId).maybeSingle()
    setHasSignature(!!data)
  }

  const fetchPartsUsed = async () => {
    const { data } = await supabase.from('parts_usage')
      .select('*, inventory_items(name, unit_price)').eq('issue_id', issueId)
    if (data) setPartsUsed(data)
  }

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('id, name, quantity, unit_price').gt('quantity', 0)
    if (data) setInventoryItems(data)
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'in-progress' && !issue?.started_at) updates.started_at = new Date().toISOString()
      if (newStatus === 'completed' && !issue?.completed_at) updates.completed_at = new Date().toISOString()
      const { error } = await supabase.from('issues').update(updates).eq('id', issueId)
      if (error) throw error
      fetchIssue()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const openNavigation = () => {
    if (issue?.latitude && issue?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`, '_blank')
    } else if (issue?.city || issue?.location) {
      const query = `${issue?.location || ''} ${issue?.city || ''}`.trim()
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
    } else {
      alert('Location not available')
    }
  }

  const handleAddPart = async () => {
    if (!selectedItem || partQty < 1) return
    const item = inventoryItems.find(i => i.id === selectedItem)
    if (!item) return
    if (item.quantity < partQty) { alert('Not enough stock!'); return }

    try {
      // Record usage
      const { error: usageError } = await supabase.from('parts_usage').insert({
        issue_id: issueId, item_id: selectedItem,
        technician_id: techId, quantity: partQty, unit_price: item.unit_price
      })
      if (usageError) throw usageError

      // Reduce inventory
      const { error: invError } = await supabase.from('inventory_items')
        .update({ quantity: item.quantity - partQty }).eq('id', selectedItem)
      if (invError) throw invError

      alert('Part added!')
      setSelectedItem('')
      setPartQty(1)
      setShowPartsForm(false)
      fetchPartsUsed()
      fetchInventory()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  if (!issue) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Tasks
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Issue Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{issue.vehicle_no}</CardTitle>
                <p className="text-muted-foreground">{issue.client}</p>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(issue.status)}`}>{issue.status}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getPriorityColor(issue.priority)}`}>{issue.priority}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {issue.city && (
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{issue.city}{issue.location && ` - ${issue.location}`}</p>
                </div>
              </div>
            )}
            {issue.poc_name && (
              <div className="flex items-start gap-2">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Point of Contact</p>
                  <p className="text-sm text-muted-foreground">{issue.poc_name}{issue.poc_number && ` • ${issue.poc_number}`}</p>
                </div>
              </div>
            )}
            <div>
              <p className="font-medium mb-1">Issue Description</p>
              <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{issue.issue}</p>
            </div>
            {issue.availability && (
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div><p className="font-medium">Availability</p><p className="text-sm text-muted-foreground">{issue.availability}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button onClick={openNavigation} className="w-full" size="lg">
              <Navigation className="h-5 w-5 mr-2" />Navigate to Location
            </Button>

            {issue.status === 'assigned' && (
              <Button onClick={() => updateStatus('in-progress')} disabled={updating} className="w-full" size="lg">
                <PlayCircle className="h-5 w-5 mr-2" />Start Work
              </Button>
            )}

            {issue.status === 'in-progress' && (
              <Button onClick={() => updateStatus('completed')} disabled={updating}
                className="w-full bg-green-600 hover:bg-green-700" size="lg">
                <CheckCircle className="h-5 w-5 mr-2" />Mark as Completed
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setShowCamera(!showCamera)} variant="outline" size="lg">
                <Camera className="h-5 w-5 mr-2" />{showCamera ? 'Hide' : 'Camera'}
              </Button>
              <Button onClick={() => setShowSignature(!showSignature)} variant="outline" size="lg"
                className={hasSignature ? 'border-green-500 text-green-600' : ''}>
                <PenTool className="h-5 w-5 mr-2" />{hasSignature ? '✓ Signed' : 'Signature'}
              </Button>
            </div>

            <Button onClick={() => setShowPartsForm(!showPartsForm)} variant="outline" className="w-full" size="lg">
              <Package className="h-5 w-5 mr-2" />Add Parts Used
            </Button>

            {issue.poc_number && (
              <Button variant="outline" className="w-full" size="lg" asChild>
                <a href={`tel:${issue.poc_number}`}>
                  <Phone className="h-5 w-5 mr-2" />Call Client
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Add Parts Form */}
        {showPartsForm && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Add Parts Used</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
                className="w-full h-10 px-3 border rounded-md bg-background">
                <option value="">-- Select Part --</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} (Stock: {item.quantity}) - ₹{item.unit_price}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <input type="number" min="1" value={partQty} onChange={e => setPartQty(parseInt(e.target.value) || 1)}
                  className="w-24 h-10 px-3 border rounded-md bg-background" />
                <Button onClick={handleAddPart} className="flex-1" disabled={!selectedItem}>Add Part</Button>
                <Button variant="outline" onClick={() => setShowPartsForm(false)}>Cancel</Button>
              </div>

              {/* Parts Used List */}
              {partsUsed.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Parts used so far:</p>
                  {partsUsed.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span>{(p as any).inventory_items?.name} × {p.quantity}</span>
                      <span>₹{(p.quantity * ((p as any).inventory_items?.unit_price || 0)).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* GPS Camera */}
        {showCamera && (
          <GPSCamera issueId={issueId} onPhotoUploaded={() => { fetchPhotos(); setShowCamera(false) }} />
        )}

        {/* Digital Signature */}
        {showSignature && !hasSignature && (
          <DigitalSignature issueId={issueId} onSigned={() => { setHasSignature(true); setShowSignature(false) }} />
        )}

        {/* Photos Gallery */}
        <Card>
          <CardHeader><CardTitle>Photos ({photos.length})</CardTitle></CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No photos yet. Use camera to document work.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={photo.photo_url} alt="Issue photo" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                      <p className="font-medium capitalize">{photo.photo_type}</p>
                      <p className="opacity-80">{new Date(photo.taken_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
