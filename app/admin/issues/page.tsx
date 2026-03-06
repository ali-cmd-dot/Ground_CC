'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Trash2, Search, CheckSquare, Square, AlertTriangle } from 'lucide-react'

export default function IssuesListPage() {
  const router = useRouter()
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    fetchIssues()
  }, [statusFilter])

  const fetchIssues = async () => {
    setLoading(true)
    let query = supabase
      .from('issues')
      .select('*, technicians:assigned_to(name)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    setIssues(data || [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  const filteredIssues = issues.filter(issue => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      issue.vehicle_no?.toLowerCase().includes(s) ||
      issue.client?.toLowerCase().includes(s) ||
      issue.city?.toLowerCase().includes(s) ||
      issue.issue?.toLowerCase().includes(s)
    )
  })

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIssues.map(i => i.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} issue(s)? This cannot be undone.`)) return

    setDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const { error } = await supabase
        .from('issues')
        .delete()
        .in('id', ids)

      if (error) throw error

      setIssues(prev => prev.filter(i => !selectedIds.has(i.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch (err: any) {
      alert('Delete failed: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-red-400 bg-red-500/10'
      case 'high': return 'text-orange-400 bg-orange-500/10'
      case 'medium': return 'text-yellow-400 bg-yellow-500/10'
      case 'low': return 'text-green-400 bg-green-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'text-red-400'
      case 'assigned': return 'text-orange-400'
      case 'in-progress': return 'text-blue-400'
      case 'completed': return 'text-green-400'
      case 'cancelled': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-[#080810]">
      <header className="bg-[#0a0a12] border-b border-white/8 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.back()} className="text-gray-400 hover:text-white h-9 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-white">All Issues</h1>
            <span className="text-xs text-gray-500">({filteredIssues.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <Button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-3 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setSelectMode(!selectMode)
                setSelectedIds(new Set())
              }}
              className={`text-xs h-8 px-3 ${selectMode ? 'border-blue-500 text-blue-400' : 'border-white/10 text-gray-400'}`}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vehicle, client, city..."
              className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-8 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-8 px-2 text-xs border border-white/10 rounded-lg text-white"
            style={{ background: '#1a1a2e', colorScheme: 'dark' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Select all bar */}
        {selectMode && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-3">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white">
              {selectedIds.size === filteredIssues.length && filteredIssues.length > 0
                ? <CheckSquare className="h-4 w-4 text-blue-400" />
                : <Square className="h-4 w-4" />}
              Select All ({filteredIssues.length})
            </button>
            {selectedIds.size > 0 && (
              <span className="text-xs text-blue-400">{selectedIds.size} selected</span>
            )}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/30" />
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No issues found</div>
        ) : (
          <div className="space-y-2">
            {filteredIssues.map(issue => (
              <div
                key={issue.id}
                className={`bg-[#0d0d16] border rounded-xl p-3 flex items-start gap-3 transition-all ${
                  selectMode ? 'cursor-pointer' : ''
                } ${
                  selectedIds.has(issue.id)
                    ? 'border-blue-500/50 bg-blue-500/5'
                    : 'border-white/8 hover:border-white/15'
                }`}
                onClick={() => {
                  if (selectMode) toggleSelect(issue.id)
                  else router.push(`/admin/issues/${issue.id}`)
                }}
              >
                {/* Checkbox */}
                {selectMode && (
                  <div className="mt-0.5 flex-shrink-0">
                    {selectedIds.has(issue.id)
                      ? <CheckSquare className="h-4 w-4 text-blue-400" />
                      : <Square className="h-4 w-4 text-gray-600" />}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-white text-sm">{issue.vehicle_no}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getPriorityColor(issue.priority)}`}>
                      {issue.priority}
                    </span>
                    <span className={`text-[10px] font-medium ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">{issue.client}</p>
                  <p className="text-xs text-gray-500">{issue.city}{issue.location ? ` · ${issue.location}` : ''}</p>
                  {issue.issue && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{issue.issue}</p>
                  )}
                  {issue.technicians && (
                    <p className="text-xs text-blue-400 mt-1">👷 {issue.technicians.name}</p>
                  )}
                </div>

                {/* Days badge */}
                {issue.days && (
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-xs font-bold ${issue.days > 30 ? 'text-red-400' : issue.days > 15 ? 'text-orange-400' : 'text-gray-400'}`}>
                      {issue.days}d
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bulk delete warning banner */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-red-500/30 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-white">{selectedIds.size} issue{selectedIds.size > 1 ? 's' : ''} selected</span>
          <Button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white text-sm h-8 px-4"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </Button>
        </div>
      )}
    </div>
  )
}
