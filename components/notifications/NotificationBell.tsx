'use client'

import { useEffect, useState, useRef } from 'react'
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, AlertCircle, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Notification } from '@/lib/types'

const typeIcon = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  issue_assigned: <CheckCircle className="h-4 w-4 text-blue-500" />,
  status_changed: <Info className="h-4 w-4 text-purple-500" />,
  low_stock: <Package className="h-4 w-4 text-orange-500" />,
  payment: <CheckCircle className="h-4 w-4 text-green-500" />
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    // Realtime subscription
    const channel = supabase.channel('notifications_channel')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => fetchNotifications())
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [userId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
  }

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="outline" size="sm" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <CheckCheck className="h-3 w-3" />Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group ${!n.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                <div className="mt-0.5 flex-shrink-0">{typeIcon[n.type] || typeIcon.info}</div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                  markRead(n.id)
                  if (n.link) { window.location.href = n.link }
                }}>
                  <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => deleteNotification(n.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 flex-shrink-0 transition-opacity">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to create notifications (use server-side or in API routes)
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: Notification['type'] = 'info',
  link?: string
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId, title, message, type, link
  })
  if (error) console.error('Notification error:', error)
}
