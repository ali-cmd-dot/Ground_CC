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
    const csv = `Availability Date,Client,Vehicle no,Last Online,POC Name,POC Number,City,Location,Issue,Availability,Last Rectification Status,Last Rectification Date,Delay,Days
2024-01-15,ABC Corp,KA01AB1234,2024-01-14 10:30,John Doe,9876543210,Bengaluru,Koramangala,Engine not starting,Mon-Fri 9-6,Pending,2024-01-10,5,5`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template.csv'
    a.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      
      if (lines.length < 2) {
        alert('CSV file is empty or invalid')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim())
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const obj: any = {}
        headers.forEach((h, i) => { obj[h] = values[i] || '' })
        return obj
      })

      setPreview(rows) // Show ALL rows, not just 5
      setResult(null)
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = async () => {
    if (preview.length === 0) {
      alert('No data to import')
      return
    }

    setImporting(true)
    let successCount = 0
    let failCount = 0

    try {
      // Process ALL rows
      for (const row of preview) {
        try {
          // Skip empty rows
          if (!row['Vehicle no'] || !row['Client']) {
            failCount++
            continue
          }

          const issueData = {
            availability_date: row['Availability Date'] || null,
            client: row['Client'] || 'Unknown',
            vehicle_no: row['Vehicle no'] || 'Unknown',
            last_online: row['Last Online'] || null,
            poc_name: row['POC Name'] || null,
            poc_number: row['POC Number'] || null,
            city: row['City'] || null,
            location: row['Location'] || null,
            issue: row['Issue'] || 'No description',
            availability: row['Availability'] || null,
            last_rectification_status: row['Last Rectification Status'] || null,
            last_rectification_date: row['Last Rectification Date'] || null,
            delay: row['Delay'] || null,
            days: row['Days'] ? parseInt(row['Days']) : null,
            status: 'pending',
            priority: 'medium'
          }

          const { error } = await supabase.from('issues').insert(issueData)
          
          if (error) {
            console.error('Insert error:', error)
            failCount++
          } else {
            successCount++
          }
        } catch (err) {
          console.error('Row error:', err)
          failCount++
        }
      }

      setResult({ success: successCount, failed: failCount })
      
      if (successCount > 0) {
        setTimeout(() => router.push('/admin'), 2000)
      }
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

        {/* Step 1: Download Template */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Step 1: Download CSV Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Download the template file and fill it with your data
            </p>
            <Button onClick={downloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              Step 2: Upload Your CSV File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="mb-2">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mb-4">
                CSV file (Excel ko "Save As CSV" karke save karo)
              </p>
              {file && (
                <p className="text-sm text-green-600 mb-3">
                  ✓ Selected: {file.name}
                </p>
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

        {/* Preview - Show ALL rows */}
        {preview.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  📋 Preview - {preview.length} rows total
                </CardTitle>
                {!result && (
                  <Button onClick={handleImport} disabled={importing}>
                    {importing ? 'Importing...' : `Import All ${preview.length} Issues`}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Vehicle No</th>
                      <th className="text-left p-2">Client</th>
                      <th className="text-left p-2">City</th>
                      <th className="text-left p-2">Issue</th>
                      <th className="text-left p-2">POC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">{row['Vehicle no']}</td>
                        <td className="p-2">{row['Client']}</td>
                        <td className="p-2">{row['City']}</td>
                        <td className="p-2 text-xs">{row['Issue']?.substring(0, 40)}...</td>
                        <td className="p-2 text-xs">{row['POC Name']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <Card className={result.failed > 0 ? 'border-yellow-500' : 'border-green-500'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {result.failed > 0 ? (
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">Import Complete!</h3>
                  <p className="text-sm">
                    ✓ Successfully imported: <span className="text-green-600 font-bold">{result.success}</span> issues
                  </p>
                  {result.failed > 0 && (
                    <p className="text-sm">
                      ✗ Failed: <span className="text-red-600 font-bold">{result.failed}</span> issues (empty rows skipped)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Redirecting to dashboard...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
