import { useEffect, useState } from 'react'

function resolveInitialTheme() {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored === 'dark' || (!stored && prefersDark)
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(resolveInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => {
    setDark((prev) => !prev)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {dark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2V4.5" />
            <path d="M12 19.5V22" />
            <path d="M4.93 4.93 6.7 6.7" />
            <path d="M17.3 17.3 19.07 19.07" />
            <path d="M2 12H4.5" />
            <path d="M19.5 12H22" />
            <path d="M4.93 19.07 6.7 17.3" />
            <path d="M17.3 6.7 19.07 4.93" />
          </svg>
        )}
      </span>
      <span className="text-sm font-medium text-fg">
        {dark ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}
