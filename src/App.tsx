import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { LogsPage } from './pages/LogsPage'
import { ApiDocsPage } from './pages/ApiDocsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useThemeStore } from './stores/themeStore'
import { useEffect } from 'react'

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/logs" replace />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="api-docs" element={<ApiDocsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
