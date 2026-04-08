'use client'

import { useTheme } from '@/src/app/components/theme-provider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button type="button" onClick={toggleTheme} className="lf-btn-ghost">
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
  )
}
