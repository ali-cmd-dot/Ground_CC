'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'

export default function ImportPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.trim())
    
    const data = lines.slice(1, 6).map(line => {
      const values = line.split(',')
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim() || ''
      })
      return obj
    })
    
    setPreview(data)
  }

  const handleImport = async () => {
    if (!file) return
    
    setUploading(true)
    let successCount = 0
    let failedCount = 0

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      const issues = lines.slice(1).map(line => {
        const values = line.split(',')
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || ''
        })
        
        // Map Excel columns to database columns
        return {
          availability_date: row['Availability Date'] || null,
          client: row['Client'] || row['client'] || 'Unknown',
          vehicle_no: row['Vehicle no'] || row['vehicle_no'] || 'Unknown',
          last_online: row['Last Online'] || null,
          poc_name: row['POC Name'] || row['poc_name'] || null,
          poc_number: row['POC Number'] || row['poc_number'] || null,
          city: row['City'] || row['city'] || null,
          location: row['Location'] || row['location'] || null,
          issue: row['Issue'] || row['issue'] || 'Device offline issue',
          availability: row['Availability'] || row['availability'] || null,
          last_rectification_status: row['Last Rectification Status'] || null,
          last_rectification_date: row['Last Rectification Date'] || null,
          delay: row['Delay'] || row['delay'] || null,
          days: row['Days'] ? parseInt(row['Days']) : null,
          status: 'pending',
          priority: 'medium'
        }
      }).filter(issue => issue.client !== 'Unknown' && issue.vehicle_no !== 'Unknown')

      // Insert in batches of 50
      for (let i = 0; i < issues.length; i += 50) {
        const batch = issues.slice(i, i + 50)
        try {
          const { error } = await supabase.from('issues').insert(batch)
          if (error) {
            failedCount += batch.length
          } else {
            successCount += batch.length
          }
        } catch {
          failedCount += batch.length
        }
      }

      setResult({ success: successCount, failed: failedCount })
      
      if (failedCount === 0) {
        setTimeout(() => router.push('/admin'), 2000)
      }
    } catch (error: any) {
      alert('Error importing: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    const template = `Availability Date,Client,Vehicle no,Last Online,POC Name,POC Number,City,Location,Issue,Availability,Last Rectification Status,Last Rectification Date,Delay,Days
Sun 15 Feb 2026,Baba Travels,MH231FC9072,08/02/2026,RAVI,94394 20471,Nagpur,,Device offline issue,,,,,
Sun 15 Feb 2026,Mohi Travels,MH01JT_13249,Vehicle has not come online till now,,9326655505,Pune,Nigale,First Ignition Off,9:00am to 5:00pm,,,,
Sun 15 Feb 2026,Ram Tours and Travels,MH13B54572,23/01/2026,,9975929008,Pune,Sangamwadi,Device offline issue,9 am to 7:00pm,,,,`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'issues_template.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Import Issues from CSV/Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Download Template */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2">📥 Step 1: Download Template</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download the CSV template with correct column headers matching your Excel sheet
              </p>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </div>

            {/* Upload File */}
            <div>
              <h3 className="font-semibold mb-3">📤 Step 2: Upload Your CSV File</h3>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="text-sm font-medium">
                    Click to upload or drag and drop
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    CSV file (Excel ko "Save As CSV" karke save karo)
                  </span>
                </Label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file && (
                  <p className="mt-4 text-sm font-medium text-green-600">
                    ✓ Selected: {file.name}
                  </p>
                )}
              </div>
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">👀 Preview (First 5 rows)</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Client</th>
                        <th className="px-3 py-2 text-left font-medium">Vehicle</th>
                        <th className="px-3 py-2 text-left font-medium">City</th>
                        <th className="px-3 py-2 text-left font-medium">Issue</th>
                        <th className="px-3 py-2 text-left font-medium">POC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{row['Client'] || row['client']}</td>
                          <td className="px-3 py-2">{row['Vehicle no'] || row['vehicle_no']}</td>
                          <td className="px-3 py-2">{row['City'] || row['city']}</td>
                          <td className="px-3 py-2">{row['Issue'] || row['issue']}</td>
                          <td className="px-3 py-2">{row['POC Name'] || row['poc_name']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`border rounded-lg p-4 ${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.failed === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <h3 className="font-semibold">Import Complete!</h3>
                </div>
                <p className="text-sm">
                  ✓ Successfully imported: <strong>{result.success}</strong> issues
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-red-600">
                    ✗ Failed: <strong>{result.failed}</strong> issues
                  </p>
                )}
                {result.failed === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Redirecting to dashboard...
                  </p>
                )}
              </div>
            )}

            {/* Import Button */}
            {file && !result && (
              <Button
                onClick={handleImport}
                disabled={uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Upload className="h-5 w-5 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Import {preview.length} Issues
                  </>
                )}
              </Button>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm">
              <h3 className="font-semibold mb-2">📝 Instructions:</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Excel file ko CSV format mein save karo (File → Save As → CSV)</li>
                <li>Column names exactly template ke jaise hone chahiye</li>
                <li><strong>Client</strong> aur <strong>Vehicle no</strong> mandatory hain</li>
                <li>Import ke baad issues "Pending" status mein aayenge</li>
                <li>Admin dashboard se manually assign kar sakte ho</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
