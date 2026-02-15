'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapProps {
  latitude: number
  longitude: number
  zoom?: number
  markers?: Array<{
    lat: number
    lng: number
    title: string
    popup?: string
  }>
  className?: string
}

export function Map({ latitude, longitude, zoom = 13, markers, className }: MapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Initialize map
    const map = L.map(containerRef.current).setView([latitude, longitude], zoom)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map)

    // Fix icon paths (Leaflet issue with Next.js)
    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })

    // Add markers
    if (markers && markers.length > 0) {
      markers.forEach(marker => {
        const m = L.marker([marker.lat, marker.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${marker.title}</strong>${marker.popup ? `<br>${marker.popup}` : ''}`)
      })
    } else {
      // Add default marker
      L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup('Location')
    }

    mapRef.current = map

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [latitude, longitude, zoom, markers])

  return <div ref={containerRef} className={className || 'h-[400px] w-full rounded-lg'} />
}
