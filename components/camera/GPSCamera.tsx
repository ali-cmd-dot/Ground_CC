'use client'

import { useState, useRef } from 'react'
import { Camera, MapPin, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GPSCameraProps {
  onPhotoCapture: (photoData: {
    dataUrl: string
    latitude: number
    longitude: number
    timestamp: string
  }) => void
  issueId?: string
}

export function GPSCamera({ onPhotoCapture }: GPSCameraProps) {
  const [hasLocation, setHasLocation] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [capturing, setCapturing] = useState(false)
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
      const coords = await getLocation()

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

    // Read file as data URL
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      
      // Call callback with photo data
      onPhotoCapture({
        dataUrl,
        latitude: location.lat,
        longitude: location.lng,
        timestamp: new Date().toISOString()
      })

      setCapturing(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsDataURL(file)
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
        {hasLocation && location && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">
              GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

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

        <p className="text-xs text-muted-foreground text-center">
          Photo will be tagged with GPS coordinates and timestamp
        </p>
      </CardContent>
    </Card>
  )
}
