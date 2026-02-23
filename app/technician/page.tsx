'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  MapPin, Camera, LogOut, CheckCircle, PlayCircle,
  Navigation, RefreshCw, Phone, Locate, Map,
  Calendar, Package, User, Home, X,
  ChevronRight, AlertCircle, Menu
} from 'lucide-react'
import type { Issue } from '@/lib/types'
import { useLiveLocation } from '@/hooks/useLiveLocation'

interface IssueWithDistance extends Issue { distance?: number }

const PRIORITY_COLOR: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const STATUS_COLOR: Record<string, string> = { pending: '#f97316', assigned: '#60a5fa', 'in-progress': '#a78bfa', completed: '#4ade80' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export default function TechnicianDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<IssueWithDistance[]>([])
  const [loading, setLoading] = useState(true)
  const [technicianId, setTechnicianId] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<string | null>(null)
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (technicianId) getCurrentLocation() }, [technicianId])
  useEffect(() => { if (technicianId) fetchAndSortIssues() }, [myLocation, technicianId])

  const { stopTracking } = useLiveLocation({ technicianId, enabled: isCheckedIn && !!technicianId, intervalMs: 12000 })

  const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const getCurrentLocation = () => {
    setFetchingLocation(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setFetchingLocation(false) },
      () => setFetchingLocation(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechnicianId(session.user.id)
    const { data: tech } = await supabase.from('technicians').select('*').eq('id', session.user.id).single()
    if (tech) setTechnicianName(tech.name)
    await checkAttendance(session.user.id)
  }

  const fetchAndSortIssues = async () => {
    const { data } = await supabase.from('issues').select('*').eq('assigned_to', technicianId).in('status', ['assigned', 'in-progress'])
    if (data) {
      const withDist = data.map(issue => ({
        ...issue,
        distance: (issue.latitude && issue.longitude && myLocation)
          ? calcDist(myLocation.lat, myLocation.lng, issue.latitude, issue.longitude) : 999999
      }))
      withDist.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999))
      setIssues(withDist)
    }
    setLoading(false)
  }

  const checkAttendance = async (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*').eq('technician_id', id).eq('date', today).is('check_out', null).single()
    setIsCheckedIn(!!data)
    if (data) setCheckInTime(new Date(data.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }

  const handleCheckIn = async () => {
    if (!myLocation) { getCurrentLocation(); alert('Getting location, try again in a moment.'); return }
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('attendance').insert({ technician_id: technicianId, check_in: new Date().toISOString(), latitude: myLocation.lat, longitude: myLocation.lng, date: today })
    if (!error) { setIsCheckedIn(true); setCheckInTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) }
    else alert('Check-in error: ' + error.message)
  }

  const handleCheckOut = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*').eq('technician_id', technicianId).eq('date', today).is('check_out', null).single()
    if (data) {
      const hours = (Date.now() - new Date(data.check_in).getTime()) / 3600000
      await supabase.from('attendance').update({ check_out: new Date().toISOString(), total_hours: hours }).eq('id', data.id)
      await stopTracking(); setIsCheckedIn(false); setCheckInTime(null)
      alert(`Checked out. Hours worked: ${hours.toFixed(2)}`)
    }
  }

  const handleStartIssue = async (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation()
    await supabase.from('issues').update({ status: 'in-progress', started_at: new Date().toISOString() }).eq('id', issueId)
    fetchAndSortIssues()
  }

  const handleNavigate = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation()
    if (issue.latitude && issue.longitude)
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}&travelmode=driving`, '_blank')
    else if (issue.city)
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${issue.location || ''} ${issue.city}`)}`, '_blank')
  }

  const handleNavigateAll = () => {
    if (!myLocation) return
    const wc = issues.filter(i => i.latitude && i.longitude)
    if (!wc.length) return
    const origin = `${myLocation.lat},${myLocation.lng}`
    if (wc.length === 1) { window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${wc[0].latitude},${wc[0].longitude}&travelmode=driving`, '_blank'); return }
    const wps = wc.slice(0, -1).map(i => `${i.latitude},${i.longitude}`).join('|')
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${wc[wc.length-1].latitude},${wc[wc.length-1].longitude}&waypoints=${wps}&travelmode=driving`, '_blank')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #4ade80', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const pending = issues.filter(i => i.status === 'assigned').length
  const inProg = issues.filter(i => i.status === 'in-progress').length
  const firstName = technicianName.split(' ')[0]

  return (
    <div style={{ height: '100dvh', background: '#06060d', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes sbIn{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes ovIn{from{opacity:0}to{opacity:1}}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        ::-webkit-scrollbar{width:0;}
        .icard{background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:16px;cursor:pointer;transition:background 0.15s;}
        .icard:active{background:rgba(255,255,255,0.07);transform:scale(0.99);}
        .abtn{height:40px;border-radius:11px;border:none;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:transform 0.1s;}
        .abtn:active{transform:scale(0.95);}
        .ntab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:8px 0;font-family:inherit;}
        .ntab span.lbl{font-size:10px;font-weight:600;color:rgba(255,255,255,0.3);}
        .ntab.on span.lbl{color:#4ade80;}
        .sbitem{width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:12px;background:none;border:none;color:rgba(255,255,255,0.65);font-size:14px;font-weight:500;cursor:pointer;margin-bottom:2px;font-family:inherit;text-align:left;transition:background 0.15s;}
        .sbitem:hover,.sbitem:active{background:rgba(255,255,255,0.06);}
      `}</style>

      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.65)', animation: 'ovIn 0.2s' }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', background: '#0e0e1a', borderRight: '1px solid rgba(255,255,255,0.07)', zIndex: 99, display: 'flex', flexDirection: 'column', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)', willChange: 'transform' }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/cautio_shield.webp" style={{ width: '30px', height: '30px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.4))' }} alt="" />
            <span style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>cautio</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>{technicianName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isCheckedIn ? '#4ade80' : '#f87171' }} />
            <p style={{ fontSize: '12px', color: isCheckedIn ? '#4ade80' : '#f87171' }}>
              {isCheckedIn ? `Checked In · ${checkInTime}` : 'Not Checked In'}
            </p>
          </div>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
          {[
            { icon: <Home size={17} />, label: 'Home', path: '/technician' },
            { icon: <Map size={17} />, label: 'Route Map', path: '/technician/map' },
            { icon: <Calendar size={17} />, label: 'Attendance', path: '/technician/attendance' },
            { icon: <Package size={17} />, label: 'Inventory', path: '/technician/inventory' },
            { icon: <User size={17} />, label: 'Profile', path: '/technician/profile' },
          ].map(item => (
            <button key={item.path} className="sbitem" onClick={() => { router.push(item.path); setSidebarOpen(false) }}>
              <span style={{ color: '#4ade80', opacity: 0.75, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
              <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.25 }} />
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 12px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.14)', color: '#f87171', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            <LogOut size={17} />Sign Out
          </button>
        </div>
      </div>

      {/* HEADER */}
      <div style={{ background: '#0a0a12', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
          <Menu size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: '700', fontSize: '15px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {greeting()}, {firstName} 👋
          </p>
          {myLocation && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</p>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={getCurrentLocation} disabled={fetchingLocation} style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <Locate size={15} style={{ animation: fetchingLocation ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={fetchAndSortIssues} style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* SCROLL CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        <div style={{ padding: '14px 14px 0' }}>

          {/* Attendance card */}
          <div style={{ borderRadius: '18px', background: isCheckedIn ? 'linear-gradient(135deg,#052e16,#064e3b)' : 'linear-gradient(135deg,#0f172a,#1e3a5f)', border: `1px solid ${isCheckedIn ? 'rgba(74,222,128,0.18)' : 'rgba(96,165,250,0.18)'}`, padding: '18px 18px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
                {isCheckedIn && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />}
                <p style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{isCheckedIn ? 'Checked In' : 'Not Checked In'}</p>
              </div>
              {isCheckedIn && checkInTime && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{checkInTime}</p>}
            </div>
            <button onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '13px', color: '#fff', padding: '11px 18px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {isCheckedIn ? 'Check Out' : 'Check In'}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '9px', marginBottom: '12px' }}>
            {[{ val: issues.length, label: 'Issues', c: '#60a5fa' }, { val: inProg, label: 'Active', c: '#a78bfa' }, { val: pending, label: 'Pending', c: '#eab308' }].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: '28px', fontWeight: '800', color: s.c, lineHeight: 1 }}>{s.val}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Route All */}
          {myLocation && issues.filter(i => i.latitude && i.longitude).length > 0 && (
            <button onClick={handleNavigateAll} style={{ width: '100%', height: '42px', borderRadius: '12px', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.22)', color: '#93c5fd', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: '14px', fontFamily: 'inherit' }}>
              <Navigation size={15} />Route All Tasks
            </button>
          )}

          {/* Issues header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Today's Tasks ({issues.length})</p>
            {issues.filter(i => i.distance && i.distance < 999999).length > 0 && (
              <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', padding: '3px 9px', borderRadius: '20px' }}>Sorted by proximity</span>
            )}
          </div>
        </div>

        {/* Issues list */}
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {issues.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '40px', textAlign: 'center' }}>
              <CheckCircle size={36} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>No tasks assigned</p>
            </div>
          ) : issues.map((issue, idx) => {
            const pc = PRIORITY_COLOR[issue.priority] || '#9ca3af'
            const sc = STATUS_COLOR[issue.status] || '#9ca3af'
            const nearest = idx === 0 && issue.distance !== undefined && issue.distance < 999999
            return (
              <div key={issue.id} className="icard" onClick={() => router.push(`/technician/issues/${issue.id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: nearest ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${nearest ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.09)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: nearest ? '#4ade80' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>#{idx + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: '700', fontSize: '16px', color: '#fff', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.vehicle_no}</p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.client}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '7px', background: `${sc}15`, color: sc, border: `1px solid ${sc}28`, whiteSpace: 'nowrap' }}>{issue.status}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '7px', background: `${pc}15`, color: pc, border: `1px solid ${pc}28`, whiteSpace: 'nowrap' }}>{issue.priority}</span>
                  </div>
                </div>

                {issue.distance !== undefined && issue.distance < 999999 ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: nearest ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${nearest ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '9px', padding: '4px 10px', marginBottom: '10px' }}>
                    <Navigation size={12} color={nearest ? '#4ade80' : 'rgba(255,255,255,0.35)'} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: nearest ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                      {issue.distance < 1 ? `${(issue.distance * 1000).toFixed(0)}m` : `${issue.distance.toFixed(1)}km`} away{nearest ? ' · Nearest' : ''}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                    <AlertCircle size={11} color="rgba(255,255,255,0.18)" />
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>No GPS coordinates</span>
                  </div>
                )}

                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{issue.issue}</p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {(issue.city || issue.location) && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} />{issue.city}{issue.location ? ` · ${issue.location}` : ''}</span>}
                  {issue.poc_name && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={11} />{issue.poc_name}{issue.poc_number ? ` · ${issue.poc_number}` : ''}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="abtn" onClick={e => handleNavigate(e, issue)} style={{ background: 'rgba(37,99,235,0.13)', border: '1px solid rgba(37,99,235,0.22)', color: '#93c5fd' }}><Navigation size={13} />Navigate</button>
                  <button className="abtn" onClick={e => { e.stopPropagation(); router.push(`/technician/issues/${issue.id}`) }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}><Camera size={13} />Details</button>
                  {issue.status === 'assigned' && (
                    <button className="abtn" style={{ gridColumn: '1/-1', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.22)', color: '#fb923c' }} onClick={e => handleStartIssue(e, issue.id)}><PlayCircle size={13} />Start Work</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(8,8,16,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 50, flexShrink: 0 }}>
        {[
          { id: 'home', icon: <Home size={20} />, label: 'Home', action: () => setActiveTab('home') },
          { id: 'issues', icon: <AlertCircle size={20} />, label: 'Issues', action: () => setActiveTab('issues') },
          { id: 'map', icon: <Map size={22} />, label: 'Map', action: () => router.push('/technician/map') },
          { id: 'camera', icon: <Camera size={20} />, label: 'Camera', action: () => { if (issues[0]) router.push(`/technician/issues/${issues[0].id}`) } },
          { id: 'profile', icon: <User size={20} />, label: 'Profile', action: () => router.push('/technician/profile') },
        ].map(tab => (
          <button key={tab.id} className={`ntab ${activeTab === tab.id ? 'on' : ''}`} onClick={tab.action}>
            <span style={{ color: activeTab === tab.id ? '#4ade80' : 'rgba(255,255,255,0.28)' }}>{tab.icon}</span>
            <span className="lbl">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
