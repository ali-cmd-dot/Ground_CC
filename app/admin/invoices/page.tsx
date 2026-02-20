'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, FileText, Search, X, CheckCircle, Clock, IndianRupee, Download } from 'lucide-react'
import type { Invoice } from '@/lib/types'

interface IssueOption {
  id: string
  vehicle_no: string
  client: string
  city?: string
  status: string
  issue: string
  priority: string
  created_at: string
  updated_at: string
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<(Invoice & { issues?: any })[]>([])
  const [issues, setIssues] = useState<IssueOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [formData, setFormData] = useState({
    issue_id: '',
    client_name: '',
    vehicle_no: '',
    service_charge: 0,
    parts_cost: 0,
    tax_percentage: 18,
    payment_method: 'cash' as 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other',
    notes: ''
  })

  useEffect(() => { checkAuth(); fetchData() }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchData = async () => {
    const { data: invData } = await supabase
      .from('invoices').select('*, issues(vehicle_no, client, city)')
      .order('created_at', { ascending: false })
    const { data: issueData } = await supabase
      .from('issues').select('id, vehicle_no, client, city, status')
      .in('status', ['in-progress', 'completed'])
    if (invData) setInvoices(invData)
    if (issueData) setIssues(issueData)
    setLoading(false)
  }

  const handleIssueSelect = (issueId: string) => {
    const issue = issues.find(i => i.id === issueId)
    if (issue) {
      setFormData(prev => ({
        ...prev, issue_id: issueId,
        client_name: issue.client,
        vehicle_no: issue.vehicle_no
      }))
    }
  }

  const taxAmount = (formData.service_charge + formData.parts_cost) * formData.tax_percentage / 100
  const totalAmount = formData.service_charge + formData.parts_cost + taxAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: numData } = await supabase.rpc('generate_invoice_number')
      const { error } = await supabase.from('invoices').insert({
        ...formData,
        invoice_number: numData || `INV-${Date.now()}`,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: 'pending'
      })
      if (error) throw error
      alert('Invoice created!')
      setShowForm(false)
      setFormData({ issue_id: '', client_name: '', vehicle_no: '', service_charge: 0, parts_cost: 0, tax_percentage: 18, payment_method: 'cash', notes: '' })
      fetchData()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    const { error } = await supabase.from('invoices').update({
      payment_status: 'paid', payment_date: new Date().toISOString()
    }).eq('id', id)
    if (!error) fetchData()
  }

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = !searchTerm ||
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = statusFilter === 'all' || inv.payment_status === statusFilter
    return matchSearch && matchStatus
  })

  const totalRevenue = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + i.total_amount, 0)
  const pendingRevenue = invoices.filter(i => i.payment_status === 'pending').reduce((s, i) => s + i.total_amount, 0)

  const handlePrintInvoice = (invoice: Invoice & { issues?: any }) => {
    const printContent = `
      <html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #2563eb; }
        .row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; }
        .paid { background: #dcfce7; color: #16a34a; }
        .pending { background: #fef3c7; color: #d97706; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f3f4f6; }
      </style></head>
      <body>
        <div class="header">
          <h1>CAUTIO</h1>
          <p>Field Service Invoice</p>
        </div>
        <div class="row"><span><strong>Invoice No:</strong> ${invoice.invoice_number}</span><span><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString('en-IN')}</span></div>
        <div class="row"><span><strong>Client:</strong> ${invoice.client_name}</span><span><strong>Vehicle:</strong> ${invoice.vehicle_no}</span></div>
        <hr/>
        <table>
          <tr><th>Description</th><th>Amount</th></tr>
          <tr><td>Service Charge</td><td>₹${invoice.service_charge.toLocaleString('en-IN')}</td></tr>
          <tr><td>Parts Cost</td><td>₹${invoice.parts_cost.toLocaleString('en-IN')}</td></tr>
          <tr><td>GST (${invoice.tax_percentage}%)</td><td>₹${invoice.tax_amount.toLocaleString('en-IN')}</td></tr>
          <tr style="font-weight:bold"><td>TOTAL</td><td>₹${invoice.total_amount.toLocaleString('en-IN')}</td></tr>
        </table>
        <div class="row">
          <span><strong>Payment Status:</strong> <span class="badge ${invoice.payment_status}">${invoice.payment_status.toUpperCase()}</span></span>
          ${invoice.payment_method ? `<span><strong>Method:</strong> ${invoice.payment_method.toUpperCase()}</span>` : ''}
        </div>
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      </body></html>
    `
    const win = window.open('', '_blank')
    if (win) { win.document.write(printContent); win.document.close(); win.print() }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/admin')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <h1 className="text-xl font-bold">Invoices & Billing</h1>
          </div>
          <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <IndianRupee className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Collected</p>
                  <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                  <p className="text-2xl font-bold text-yellow-600">₹{pendingRevenue.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Invoice Form */}
        {showForm && (
          <Card>
            <CardHeader><CardTitle>Create New Invoice</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Select Issue</Label>
                    <select value={formData.issue_id} onChange={e => handleIssueSelect(e.target.value)}
                      className="w-full h-10 px-3 border rounded-md bg-background" required>
                      <option value="">-- Select Issue --</option>
                      {issues.map(issue => (
                        <option key={issue.id} value={issue.id}>{issue.vehicle_no} - {issue.client}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Client Name</Label>
                    <Input value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Vehicle No</Label>
                    <Input value={formData.vehicle_no} onChange={e => setFormData({ ...formData, vehicle_no: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Service Charge (₹)</Label>
                    <Input type="number" min="0" value={formData.service_charge}
                      onChange={e => setFormData({ ...formData, service_charge: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Parts Cost (₹)</Label>
                    <Input type="number" min="0" value={formData.parts_cost}
                      onChange={e => setFormData({ ...formData, parts_cost: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>GST %</Label>
                    <Input type="number" min="0" max="100" value={formData.tax_percentage}
                      onChange={e => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Payment Method</Label>
                    <select value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value as any })}
                      className="w-full h-10 px-3 border rounded-md bg-background">
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" />
                  </div>
                </div>

                {/* Amount Preview */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Service Charge</span><span>₹{formData.service_charge.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Parts Cost</span><span>₹{formData.parts_cost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>GST ({formData.tax_percentage}%)</span><span>₹{taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span><span className="text-green-600">₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice, client, vehicle..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4" /></button>}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 border rounded-md bg-background">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No invoices found</p>
            </CardContent></Card>
          ) : filteredInvoices.map(invoice => (
            <Card key={invoice.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg">{invoice.invoice_number}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{invoice.payment_status.toUpperCase()}</span>
                    </div>
                    <p className="text-sm font-medium">{invoice.client_name} • {invoice.vehicle_no}</p>
                    <p className="text-xs text-muted-foreground">{new Date(invoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {invoice.payment_method && (
                      <p className="text-xs text-muted-foreground capitalize">Payment: {invoice.payment_method}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-2xl font-bold text-green-600">₹{invoice.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-muted-foreground">Service: ₹{invoice.service_charge} | Parts: ₹{invoice.parts_cost} | GST: ₹{invoice.tax_amount.toFixed(0)}</p>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(invoice)}>
                        <Download className="h-4 w-4 mr-1" />Print
                      </Button>
                      {invoice.payment_status !== 'paid' && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleMarkPaid(invoice.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
