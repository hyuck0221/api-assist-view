import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { LogFilters } from '../components/logs/LogFilters'
import { LogTable } from '../components/logs/LogTable'
import { StatsBar } from '../components/stats/StatsBar'
import { useSourceStore } from '../stores/sourceStore'

export function LogsPage() {
  const allSources = useSourceStore(s => s.sources)
  const selectedSourceIds = useSourceStore(s => s.selectedSourceIds)
  const sources = allSources.filter(src => src.enabled)
  const hasActiveSources = sources.some(src => selectedSourceIds.includes(src.id))

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Settings className="w-8 h-8 text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No sources configured
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
            Add a source in Settings to start viewing your API logs.
            You can connect to Supabase, a Spring Boot API, or upload a local file.
          </p>
        </div>
        <NavLink to="/settings" className="btn-primary">
          Go to Settings
        </NavLink>
      </div>
    )
  }

  if (!hasActiveSources) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Select at least one source from the sidebar to view logs.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <StatsBar />
      <LogFilters />
      <LogTable />
    </div>
  )
}
