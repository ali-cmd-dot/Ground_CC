'use client'

import { useState, useRef } from 'react'
import { Camera, MapPin, Upload, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'

interface GPSCameraProps {
  issueId: string
  onPhotoUploaded?: () => void
}

export function GPSCamera({ issueId, onPhotoUploaded }: GPSCameraProps) {
  const [hasLocation, setHasLocation] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [photoType, setPhotoType] = useState<'before' | 'during' | 'after'>('before')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getLocation = () => {
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
          setLocation({ lat: coords.latitude, lng: coords.longitude })
          setHasLocation(true)
          resolve(coords)
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )
    })
  }

  const handleCapture = async () => {
    try {
      setCapturing(true)
      
      // Get GPS location first
      await getLocation()

      // Trigger file input
      fileInputRef.current?.click()
    } catch (error) {
      console.error('Error getting location:', error)
      alert('Unable to get GPS location. Please enable location services.')
      setCapturing(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !location) {
      setCapturing(false)
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    setCapturing(false)
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    )

    if (!response.ok) throw new Error('Upload failed')

    const data = await response.json()
    return data.secure_url
  }

  const handleUpload = async () => {
    if (!preview || !location) return

    setUploading(true)
    try {
      // Convert preview back to file
      const response = await fetch(preview)
      const blob = await response.blob()
      const file = new File([blob], `issue-${issueId}-${Date.now()}.jpg`, { type: 'image/jpeg' })

      // Upload to Cloudinary
      const photoUrl = await uploadToCloudinary(file)

      // Save to database
      const { error } = await supabase.from('issue_photos').insert({
        issue_id: issueId,
        photo_url: photoUrl,
        photo_type: photoType,
        latitude: location.lat,
        longitude: location.lng,
        taken_at: new Date().toISOString()
      })

      if (error) throw error

      alert('Photo uploaded successfully!')
      setPreview(null)
      setLocation(null)
      setHasLocation(false)
      
      if (onPhotoUploaded) onPhotoUploaded()
    } catch (error: any) {
      alert('Upload error: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          GPS Camera
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* GPS Status */}
        {hasLocation && location && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">
              GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </span>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="relative">
            <img 
              src={preview} 
              alt="Preview" 
              className="w-full rounded-lg border"
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 bg-white/80 hover:bg-white"
              onClick={() => {
                setPreview(null)
                setLocation(null)
                setHasLocation(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Photo Type Selection */}
        {preview && (
          <div>
            <label className="text-sm font-medium mb-2 block">Photo Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['before', 'during', 'after'] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={photoType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPhotoType(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Action Buttons */}
        {!preview ? (
          <Button
            onClick={handleCapture}
            disabled={capturing}
            className="w-full"
            size="lg"
          >
            {capturing ? (
              <>
                <Upload className="h-5 w-5 mr-2 animate-spin" />
                Getting GPS...
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-2" />
                Take Photo with GPS
              </>
            )}
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null)
                setLocation(null)
                setHasLocation(false)
              }}
            >
              Retake
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Photo will be tagged with GPS coordinates and timestamp
        </p>
      </CardContent>
    </Card>
  )
}
