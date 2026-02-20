'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme()

  const cycle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <Button variant="outline" size="sm" onClick={cycle} title={`Theme: ${theme}`}>
      {theme === 'light' ? <Sun className="h-4 w-4" /> :
       theme === 'dark' ? <Moon className="h-4 w-4" /> :
       <Monitor className="h-4 w-4" />}
    </Button>
  )
}
