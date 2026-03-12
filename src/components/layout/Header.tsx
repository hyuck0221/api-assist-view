import { Menu, Moon, Sun, Activity } from 'lucide-react'
import { useThemeStore } from '../../stores/themeStore'
import { useI18nStore } from '../../i18n/useT'
import type { Locale } from '../../i18n/translations'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useThemeStore()
  const { locale, setLocale } = useI18nStore()

  const nextLocale: Locale = locale === 'en' ? 'ko' : 'en'

  return (
    <header className="flex items-center h-14 px-4 gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="btn-ghost p-2"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
        <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span>API Assist View</span>
      </div>

      <div className="flex-1" />

      {/* Language toggle */}
      <button
        onClick={() => setLocale(nextLocale)}
        className="btn-ghost px-2.5 py-1.5 text-xs font-semibold tracking-wide"
        title={nextLocale === 'ko' ? '한국어로 전환' : 'Switch to English'}
      >
        {locale === 'en' ? '한국어' : 'EN'}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-ghost p-2"
        aria-label="Toggle theme"
      >
        {theme === 'dark'
          ? <Sun className="w-5 h-5" />
          : <Moon className="w-5 h-5" />
        }
      </button>
    </header>
  )
}
