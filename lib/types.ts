export interface Technician {
  id: string
  email: string
  name: string
  phone: string
  role: 'admin' | 'manager' | 'technician'
  photo_url?: string
  created_at: string
  updated_at: string
}

export interface Issue {
  id: string
  
  // Excel columns
  availability_date?: string
  client: string
  vehicle_no: string
  last_online?: string
  poc_name?: string
  poc_number?: string
  city?: string
  location?: string
  latitude?: number
  longitude?: number
  issue: string
  availability?: string
  last_rectification_status?: string
  last_rectification_date?: string
  delay?: string
  days?: number
  
  // System fields
  assigned_to?: string
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

export interface IssuePhoto {
  id: string
  issue_id: string
  photo_url: string
  photo_type: 'before' | 'during' | 'after'
  latitude: number
  longitude: number
  taken_at: string
  uploaded_at: string
}

export interface Attendance {
  id: string
  technician_id: string
  check_in: string
  check_out?: string
  latitude: number
  longitude: number
  total_hours?: number
  date: string
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  reorder_level: number
  unit_price: number
  description?: string
}

export interface PartsUsage {
  id: string
  issue_id: string
  item_id: string
  quantity: number
  used_at: string
}

export interface Invoice {
  id: string
  issue_id: string
  invoice_number: string
  service_charge: number
  parts_cost: number
  tax_amount: number
  total_amount: number
  payment_status: 'pending' | 'paid' | 'partial'
  payment_method?: string
  created_at: string
}
