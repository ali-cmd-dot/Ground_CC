import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // Get user role from technicians table
    const { data: technician } = await supabase
      .from('technicians')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (technician?.role === 'admin' || technician?.role === 'manager') {
      redirect('/admin')
    } else {
      redirect('/technician')
    }
  } else {
    redirect('/login')
  }
}
