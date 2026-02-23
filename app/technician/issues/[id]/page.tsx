'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { GPSCamera } from '@/components/camera/GPSCamera'
import {
  ArrowLeft, MapPin, Phone, User, PlayCircle,
  CheckCircle, Navigation, Camera, Clock, ChevronRight
} from 'lucide-react'
import type { Issue, IssuePhoto } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'
import { SlideToComplete } from '@/components/ui/SlideToComplete'

export default function TechnicianIssueDetail() {
  const router = useRouter()
  const params = useParams()
  const issueId = params.id as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [photos, setPhotos] = useState<IssuePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  useEffect(() => { fetchIssue(); fetchPhotos() }, [issueId])

  const fetchIssue = async () => {
    try {
      const { data, error } = await supabase.from('issues').select('*').eq('id', issueId).single()
      if (error) throw error
      setIssue(data)
    } catch { router.back() }
    finally { setLoading(false) }
  }

  const fetchPhotos = async () => {
    const { data } = await supabase.from('issue_photos').select('*')
      .eq('issue_id', issueId).order('taken_at', { ascending: false })
    if (data) setPhotos(data)
  }

  const updateStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'in-progress' && !issue?.started_at) updates.started_at = new Date().toISOString()
      if (newStatus === 'completed') updates.completed_at = new Date().toISOString()
      const { error } = await supabase.from('issues').update(updates).eq('id', issueId)
      if (error) throw error
      fetchIssue()
    } catch (err: any) { alert('Error: ' + err.message) }
    finally { setUpdating(false) }
  }

  const openNavigation = () => {
    if (issue?.latitude && issue?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}&travelmode=driving`, '_blank')
    } else if (issue?.city) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${issue.location || ''} ${issue.city}`)}`, '_blank')
    }
  }

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e'
  }
  const STATUS_BG: Record<string, string> = {
    pending: 'rgba(249,115,22,0.1)', assigned: 'rgba(59,130,246,0.1)',
    'in-progress': 'rgba(139,92,246,0.1)', completed: 'rgba(34,197,94,0.1)'
  }
  const STATUS_BORDER: Record<string, string> = {
    pending: 'rgba(249,115,22,0.25)', assigned: 'rgba(59,130,246,0.25)',
    'in-progress': 'rgba(139,92,246,0.25)', completed: 'rgba(34,197,94,0.25)'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!issue) return null

  const prColor = PRIORITY_COLORS[issue.priority] || '#6b7280'

  return (
    <div style={{ minHeight: '100vh', background: '#06060d', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn-nav { display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:52px;border-radius:14px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s; }
        .btn-nav:active { transform:scale(0.97); }
      `}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,6,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#fff', fontFamily: 'monospace', letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.vehicle_no}</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.client}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', background: `${prColor}18`, color: prColor, border: `1px solid ${prColor}30`, whiteSpace: 'nowrap' }}>
            {issue.priority}
          </span>
          <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', background: STATUS_BG[issue.status] || 'rgba(255,255,255,0.05)', color: '#fff', border: `1px solid ${STATUS_BORDER[issue.status] || 'rgba(255,255,255,0.1)'}`, whiteSpace: 'nowrap' }}>
            {issue.status}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Issue Description */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Issue</p>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.6' }}>{issue.issue}</p>
          {issue.availability && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: '#60a5fa', fontSize: '13px' }}>
              <Clock size={14} /><span>{issue.availability}</span>
            </div>
          )}
          {issue.availability_date && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              Date: {new Date(issue.availability_date).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Client & Location */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {issue.poc_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={16} color="#60a5fa" />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{issue.poc_name}</p>
                {issue.poc_number && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{issue.poc_number}</p>}
              </div>
              {issue.poc_number && (
                <a href={`tel:${issue.poc_number}`} style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '8px 14px', color: '#4ade80', fontSize: '13px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Call
                </a>
              )}
            </div>
          )}
          {(issue.city || issue.location) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={16} color="#f87171" />
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                {[issue.location, issue.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button className="btn-nav" onClick={openNavigation}
            style={{ background: '#2563eb', color: '#fff' }}>
            <Navigation size={18} />Navigate
          </button>
          <button className="btn-nav" onClick={() => setShowCamera(!showCamera)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
            <Camera size={18} />{showCamera ? 'Hide Camera' : 'Add Photo'}
          </button>
        </div>

        {/* Start Work */}
        {issue.status === 'assigned' && (
          <button className="btn-nav" onClick={() => updateStatus('in-progress')} disabled={updating}
            style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c', width: '100%' }}>
            <PlayCircle size={18} />Start Work
          </button>
        )}

        {/* Slide to Complete */}
        {issue.status === 'in-progress' && (
          <SlideToComplete
            onComplete={() => updateStatus('completed')}
            disabled={updating}
            label="Slide to Complete"
          />
        )}

        {/* Camera */}
        {showCamera && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px' }}>
            <GPSCamera issueId={issueId} onPhotoUploaded={() => { fetchPhotos(); setShowCamera(false) }} />
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Photos ({photos.length})
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1' }}>
                  <img src={photo.photo_url} alt="Issue" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                    {photo.photo_type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
