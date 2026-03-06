'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

  const downloadTemplate = () => {
    const headers = ['Client', 'Vehicle no', 'POC Name', 'POC Number', 'City', 'Location', 'Issue', 'Availability']
    const sampleRow = ['Pune City Bus', 'MH14KX4225', 'Ravi Shankar', '9902099969', 'Pune', 'Shivajinagar', 'Vehicle Not Online', 'All Day']
    const csv = [headers, sampleRow].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cautio-import-template.csv'
    a.click()
  }

  const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }

    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0]).map(h => h.trim())
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line)
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = values[i] || '' })
      return obj
    })

    return { headers, rows }
  }

  const getField = (row: Record<string, string>, ...keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== '') return row[key]
      const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim())
      if (found && row[found] !== '') return row[found]
    }
    return ''
  }

  const parseRowToIssue = (row: Record<string, string>) => {
    return {
      client:       getField(row, 'Client', 'client') || 'Unknown',
      vehicle_no:   (getField(row, 'Vehicle no', 'Vehicle No', 'VehicleNo', 'vehicle_no') || 'UNKNOWN').toUpperCase(),
      poc_name:     getField(row, 'POC Name', 'poc name', 'POCName') || null,
      poc_number:   getField(row, 'POC Number', 'poc number', 'POCNumber') || null,
      city:         getField(row, 'City', 'city') || null,
      location:     getField(row, 'Location', 'location') || null,
      issue:        getField(row, 'Issue', 'issue') || 'No description',
      availability: getField(row, 'Availability', 'availability') || null,
      status:       'pending',
      priority:     'medium',
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const { headers, rows } = parseCSV(text)

      if (rows.length === 0) {
        alert('CSV file empty ya invalid hai')
        return
      }

      const hasVehicle = headers.some(h => h.toLowerCase().includes('vehicle'))
      const hasClient  = headers.some(h => h.toLowerCase().includes('client'))

      if (!hasVehicle || !hasClient) {
        alert(`Zaruri columns nahi mile.\n\nMile headers: ${headers.join(', ')}\n\n"Client" aur "Vehicle no" hone chahiye.`)
        return
      }

      setPreview(rows)
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = async () => {
    if (preview.length === 0) { alert('No data to import'); return }

    setImporting(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const row of preview) {
        try {
          const issueData = parseRowToIssue(row)
          if (issueData.vehicle_no === 'UNKNOWN' && issueData.client === 'Unknown') {
            failCount++
            continue
          }
          const { error } = await supabase.from('issues').insert(issueData)
          if (error) { console.error('Insert error:', error); failCount++ }
          else successCount++
        } catch (err) {
          console.error('Row error:', err)
          failCount++
        }
      }

      setResult({ success: successCount, failed: failCount })
      if (successCount > 0) setTimeout(() => router.push('/admin'), 2000)
    } catch (error: any) {
      alert('Import error: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Import Issues from CSV</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Step 1: Download Template (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-1">Please ensure that all required 8 columns are completed before submission.:</p>
            <p className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 mb-3 font-mono">
              Client · Vehicle no · POC Name · POC Number · City · Location · Issue · Availability
            </p>
            <Button onClick={downloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />Download Template
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              Step 2: Upload CSV File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="mb-1 font-medium">CSV file upload karo</p>
              <p className="text-sm text-muted-foreground mb-4">
                Excel → File → Save As → CSV format
              </p>
              {file && (
                <p className="text-sm text-green-600 mb-3">✓ {file.name}</p>
              )}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        {preview.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>📋 Preview — {preview.length} rows</CardTitle>
                {!result && (
                  <Button onClick={handleImport} disabled={importing}>
                    {importing ? 'Importing...' : `Import ${preview.length} Issues`}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800 text-xs">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Vehicle No</th>
                      <th className="text-left p-2">Client</th>
                      <th className="text-left p-2">City</th>
                      <th className="text-left p-2">Location</th>
                      <th className="text-left p-2">POC Name</th>
                      <th className="text-left p-2">POC Number</th>
                      <th className="text-left p-2">Issue</th>
                      <th className="text-left p-2">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const p = parseRowToIssue(row)
                      return (
                        <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-mono font-medium">{p.vehicle_no}</td>
                          <td className="p-2">{p.client}</td>
                          <td className="p-2">{p.city}</td>
                          <td className="p-2">{p.location}</td>
                          <td className="p-2">{p.poc_name}</td>
                          <td className="p-2">{p.poc_number}</td>
                          <td className="p-2 max-w-[160px] truncate text-xs">{p.issue}</td>
                          <td className="p-2 text-xs">{p.availability}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className={result.failed > 0 ? 'border-yellow-500' : 'border-green-500'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {result.failed > 0
                  ? <AlertCircle className="h-8 w-8 text-yellow-500" />
                  : <CheckCircle className="h-8 w-8 text-green-500" />}
                <div>
                  <h3 className="font-semibold text-lg">Import Complete!</h3>
                  <p className="text-sm">✓ Imported: <span className="text-green-600 font-bold">{result.success}</span> issues</p>
                  {result.failed > 0 && (
                    <p className="text-sm">✗ Failed: <span className="text-red-600 font-bold">{result.failed}</span> rows</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Dashboard pe ja raha hai...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
