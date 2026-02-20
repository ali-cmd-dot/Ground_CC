'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package, AlertTriangle, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  reorder_level: number
  unit_price: number
  sku?: string
}

export default function TechnicianInventoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .gt('quantity', 0)
      .order('name')

    if (data) setItems(data)
    setLoading(false)
  }

  const filtered = items.filter(i =>
    !searchTerm ||
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/technician')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <h1 className="text-xl font-bold">Available Inventory</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search parts..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No items found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const isLow = item.quantity <= item.reorder_level
              return (
                <Card key={item.id} className={isLow ? 'border-orange-300' : ''}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          {isLow && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.category}{item.sku && ` • ${item.sku}`}</p>
                        <p className="text-sm text-green-600 font-medium mt-1">₹{item.unit_price.toLocaleString('en-IN')} per unit</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${isLow ? 'text-orange-500' : 'text-green-600'}`}>{item.quantity}</span>
                        <p className="text-xs text-muted-foreground">in stock</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
