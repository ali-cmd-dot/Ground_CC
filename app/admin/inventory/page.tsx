'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, Plus, Package, AlertTriangle, Search, X,
  Edit2, Trash2, Save, TrendingDown
} from 'lucide-react'
import type { InventoryItem } from '@/lib/types'

const CATEGORIES = ['Hardware', 'Accessories', 'Connectivity', 'Electrical', 'Tools', 'Other']

const emptyForm = {
  name: '', category: 'Hardware', description: '',
  quantity: 0, reorder_level: 5, unit_price: 0, sku: ''
}

export default function InventoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filtered, setFiltered] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showLowStock, setShowLowStock] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => { checkAuth(); fetchItems() }, [])

  useEffect(() => {
    let f = items
    if (searchTerm) f = f.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
    if (categoryFilter !== 'all') f = f.filter(i => i.category === categoryFilter)
    if (showLowStock) f = f.filter(i => i.quantity <= i.reorder_level)
    setFiltered(f)
  }, [items, searchTerm, categoryFilter, showLowStock])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchItems = async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name')
    if (data) setItems(data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('inventory_items').update(formData).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('inventory_items').insert(formData)
        if (error) throw error
      }
      setFormData(emptyForm)
      setShowForm(false)
      setEditingId(null)
      fetchItems()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setFormData({
      name: item.name, category: item.category,
      description: item.description || '',
      quantity: item.quantity, reorder_level: item.reorder_level,
      unit_price: item.unit_price, sku: item.sku || ''
    })
    setEditingId(item.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('inventory_items').delete().eq('id', id)
    if (error) alert('Error: ' + error.message)
    else fetchItems()
  }

  const handleAdjustStock = async (id: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change)
    const { error } = await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', id)
    if (!error) fetchItems()
  }

  const lowStockCount = items.filter(i => i.quantity <= i.reorder_level).length
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
            <h1 className="text-xl font-bold">Inventory Management</h1>
          </div>
          <Button onClick={() => { setFormData(emptyForm); setEditingId(null); setShowForm(!showForm) }}>
            <Plus className="h-4 w-4 mr-2" />Add Item
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-3xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-3xl font-bold text-red-500">{lowStockCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Stock Value</p>
              <p className="text-2xl font-bold text-green-600">₹{totalValue.toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-3xl font-bold">{new Set(items.map(i => i.category)).size}</p>
            </CardContent>
          </Card>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Item' : 'Add New Item'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Item Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Dashcam Unit" required />
                </div>
                <div>
                  <Label>Category *</Label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md bg-background" required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="DC-STD-001" />
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input type="number" min="0" value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} required />
                </div>
                <div>
                  <Label>Reorder Level *</Label>
                  <Input type="number" min="0" value={formData.reorder_level}
                    onChange={e => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })} required />
                </div>
                <div>
                  <Label>Unit Price (₹) *</Label>
                  <Input type="number" min="0" step="0.01" value={formData.unit_price}
                    onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <Label>Description</Label>
                  <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />
                </div>
                <div className="md:col-span-2 lg:col-span-3 flex gap-3">
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : editingId ? 'Update' : 'Add Item'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items or SKU..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></button>}
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="h-10 px-3 border rounded-md bg-background">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button variant={showLowStock ? 'default' : 'outline'} onClick={() => setShowLowStock(!showLowStock)}>
                <AlertTriangle className="h-4 w-4 mr-2" />Low Stock {lowStockCount > 0 && `(${lowStockCount})`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Items ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4">Item</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4">SKU</th>
                      <th className="pb-3 pr-4 text-center">Stock</th>
                      <th className="pb-3 pr-4 text-center">Reorder</th>
                      <th className="pb-3 pr-4 text-right">Unit Price</th>
                      <th className="pb-3 pr-4 text-right">Total Value</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(item => {
                      const isLow = item.quantity <= item.reorder_level
                      return (
                        <tr key={item.id} className={isLow ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {isLow && <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />}
                              <div>
                                <p className="font-medium">{item.name}</p>
                                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">{item.category}</span>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{item.sku || '-'}</td>
                          <td className="py-3 pr-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleAdjustStock(item.id, item.quantity, -1)}
                                className="w-6 h-6 rounded border hover:bg-gray-100 dark:hover:bg-gray-700 text-lg font-bold leading-none flex items-center justify-center">-</button>
                              <span className={`font-bold text-base w-8 text-center ${isLow ? 'text-red-600' : 'text-green-600'}`}>{item.quantity}</span>
                              <button onClick={() => handleAdjustStock(item.id, item.quantity, 1)}
                                className="w-6 h-6 rounded border hover:bg-gray-100 dark:hover:bg-gray-700 text-lg font-bold leading-none flex items-center justify-center">+</button>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-center text-muted-foreground">{item.reorder_level}</td>
                          <td className="py-3 pr-4 text-right">₹{item.unit_price.toLocaleString('en-IN')}</td>
                          <td className="py-3 pr-4 text-right">₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}</td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                                onClick={() => handleDelete(item.id, item.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
