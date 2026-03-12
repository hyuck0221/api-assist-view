import { NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { List, Settings, BookOpen, ChevronRight, ChevronLeft, CheckSquare, Square, Circle, CheckCircle2 } from 'lucide-react'
import { useSourceStore } from '../../stores/sourceStore'
import { useT } from '../../i18n/useT'
import clsx from 'clsx'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const t = useT()
  const location = useLocation()
  const sources = useSourceStore(s => s.sources)
  const selectedSourceIds = useSourceStore(s => s.selectedSourceIds)
  const { toggleSelectedSource, setSelectedSourceIds, selectAllSources, deselectAllSources } = useSourceStore()

  const isApiDocsPage = location.pathname === '/api-docs'
  const isLogsPage = location.pathname === '/logs'
  const isSingleSelect = isApiDocsPage || isLogsPage

  const enabledSources = sources.filter(s => {
    if (!s.enabled) return false
    if (isApiDocsPage) return s.type === 'api-docs'
    return s.type !== 'api-docs'
  })

  // Auto-select first source if none selected (for single-select pages)
  useEffect(() => {
    if (isSingleSelect && enabledSources.length > 0) {
      const hasSelected = enabledSources.some(s => selectedSourceIds.includes(s.id))
      if (!hasSelected) {
        if (isApiDocsPage) {
          const otherTypeIds = selectedSourceIds.filter(sid => {
            const s = sources.find(src => src.id === sid)
            return s && s.type !== 'api-docs'
          })
          setSelectedSourceIds([...otherTypeIds, enabledSources[0]!.id])
        } else {
          setSelectedSourceIds([enabledSources[0]!.id])
        }
      }
    }
  }, [isSingleSelect, isApiDocsPage, enabledSources, selectedSourceIds, setSelectedSourceIds, sources])

  const allSelected = enabledSources.length > 0 && enabledSources.every(s => selectedSourceIds.includes(s.id))


  const NAV_ITEMS = [
    { to: '/logs', label: t('sidebar.logs'), icon: List },
    { to: '/api-docs', label: t('sidebar.apiDocs'), icon: BookOpen },
    { to: '/settings', label: t('sidebar.settings'), icon: Settings },
  ]

  const handleSourceClick = (id: string) => {
    if (isApiDocsPage) {
      // Single select for API docs: keep other types, but only one api-docs source
      const otherTypeIds = selectedSourceIds.filter(sid => {
        const s = sources.find(src => src.id === sid)
        return s && s.type !== 'api-docs'
      })
      setSelectedSourceIds([...otherTypeIds, id])
    } else if (isLogsPage) {
      // Single select for Logs
      setSelectedSourceIds([id])
    } else {
      toggleSelectedSource(id)
    }
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900',
        'transition-all duration-200 flex-shrink-0',
        open ? 'w-56' : 'w-14'
      )}
    >
      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-2 mt-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors overflow-hidden',
              isActive
                ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 dark:border-gray-800 my-2" />

      {/* Sources section */}
      {open && (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
              {t('sidebar.sources')}
            </span>
            {enabledSources.length > 0 && !isSingleSelect && (
              <button
                onClick={allSelected ? deselectAllSources : selectAllSources}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                {allSelected ? t('sidebar.deselectAll') : t('sidebar.selectAll')}
              </button>
            )}
          </div>

          {enabledSources.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">
              {t('sidebar.noSources')}{' '}
              <NavLink to="/settings" className="text-brand-600 dark:text-brand-400 hover:underline">
                {t('sidebar.addOne')}
              </NavLink>
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {enabledSources.map(source => {
                const isSelected = selectedSourceIds.includes(source.id)
                return (
                  <button
                    key={source.id}
                    onClick={() => handleSourceClick(source.id)}
                    className={clsx(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm w-full text-left',
                      'transition-colors',
                      isSelected
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                      {source.name}
                    </span>
                    {isSingleSelect ? (
                      isSelected
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      isSelected
                        ? <CheckSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
                        : <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-2">
        <button
          onClick={onToggle}
          className="btn-ghost w-full justify-center p-2"
          aria-label="Toggle sidebar"
        >
          {open
            ? <ChevronLeft className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </button>
      </div>
    </aside>
  )
}
