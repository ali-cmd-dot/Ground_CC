export interface Technician {
  id: string
  email: string
  name: string
  phone: string
  role: 'admin' | 'manager' | 'technician'
  photo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Issue {
  id: string
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
  photo_type: 'before' | 'during' | 'after' | 'parts'
  latitude?: number
  longitude?: number
  taken_at: string
  uploaded_at: string
  uploaded_by?: string
}

export interface DigitalSignature {
  id: string
  issue_id: string
  signature_url: string
  client_name?: string
  signed_at: string
  latitude?: number
  longitude?: number
}

export interface Attendance {
  id: string
  technician_id: string
  date: string
  check_in: string
  check_out?: string
  latitude?: number
  longitude?: number
  total_hours?: number
  notes?: string
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  description?: string
  quantity: number
  reorder_level: number
  unit_price: number
  sku?: string
  created_at: string
  updated_at: string
}

export interface TechnicianInventory {
  id: string
  technician_id: string
  item_id: string
  quantity: number
  assigned_at: string
  inventory_items?: InventoryItem
}

export interface PartsUsage {
  id: string
  issue_id: string
  item_id: string
  technician_id: string
  quantity: number
  unit_price?: number
  used_at: string
  inventory_items?: InventoryItem
}

export interface Invoice {
  id: string
  issue_id: string
  invoice_number: string
  client_name: string
  vehicle_no: string
  service_charge: number
  parts_cost: number
  tax_percentage: number
  tax_amount: number
  total_amount: number
  payment_status: 'pending' | 'paid' | 'partial'
  payment_method?: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
  payment_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error' | 'issue_assigned' | 'status_changed' | 'low_stock' | 'payment'
  is_read: boolean
  link?: string
  created_at: string
}

export interface WorkLog {
  id: string
  issue_id: string
  technician_id: string
  action: string
  notes?: string
  latitude?: number
  longitude?: number
  logged_at: string
}

export interface DashboardStats {
  totalIssues: number
  pendingIssues: number
  inProgressIssues: number
  completedIssues: number
  totalRevenue: number
  activeTechnicians: number
  lowStockItems: number
  todayAttendance: number
}
