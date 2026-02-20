'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PenTool, Trash2, CheckCircle, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface DigitalSignatureProps {
  issueId: string
  onSigned?: () => void
}

export function DigitalSignature({ issueId, onSigned }: DigitalSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [clientName, setClientName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    lastPos.current = pos
    setIsDrawing(true)
    setHasSignature(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !lastPos.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    lastPos.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSaved(false)
  }

  const handleSave = async () => {
    if (!hasSignature) { alert('Please sign first'); return }
    setSaving(true)
    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas not ready')

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas to blob failed')), 'image/png')
      })

      // Upload to Supabase Storage (or Cloudinary)
      const fileName = `signatures/${issueId}-${Date.now()}.png`

      // Try Supabase Storage first
      let signatureUrl = ''
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, { contentType: 'image/png' })

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('signatures').getPublicUrl(fileName)
        signatureUrl = publicUrl
      } else {
        // Fallback: use Cloudinary
        const formData = new FormData()
        formData.append('file', blob)
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
        formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)
        formData.append('folder', 'signatures')
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: 'POST', body: formData }
        )
        const data = await res.json()
        signatureUrl = data.secure_url
      }

      // Get current location
      let lat, lng
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}

      // Save to database
      const { error: dbError } = await supabase.from('digital_signatures').insert({
        issue_id: issueId,
        signature_url: signatureUrl,
        client_name: clientName,
        latitude: lat,
        longitude: lng
      })
      if (dbError) throw dbError

      setSaved(true)
      if (onSigned) onSigned()
      alert('Signature saved successfully!')
    } catch (err: any) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (saved) return (
    <Card className="border-green-200">
      <CardContent className="pt-6 text-center py-10">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-700">Signature Saved!</h3>
        <p className="text-sm text-muted-foreground mt-1">Client has signed the work completion</p>
      </CardContent>
    </Card>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Client Signature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Client Name</Label>
          <Input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="Enter client name"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="mb-2 block">Signature (Draw below)</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full cursor-crosshair bg-white"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          {!hasSignature && (
            <p className="text-xs text-muted-foreground text-center mt-1">Please sign in the box above</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || !hasSignature} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Signature'}
          </Button>
          <Button variant="outline" onClick={clearCanvas} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-2" />Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
