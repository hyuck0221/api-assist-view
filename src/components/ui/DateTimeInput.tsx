import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import clsx from 'clsx'

interface DateTimeInputProps {
  value: string        // ISO or ''
  onChange: (value: string | undefined) => void
  placeholder?: string
}

export function DateTimeInput({ value, onChange, placeholder = 'Pick date & time' }: DateTimeInputProps) {
  const [open, setOpen] = useState(false)
  const [timeStr, setTimeStr] = useState('00:00')
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current value
  const selectedDate: Date | undefined = value
    ? (() => {
        const d = new Date(value)
        return isValid(d) ? d : undefined
      })()
    : undefined

  // Sync timeStr when value changes externally
  useEffect(() => {
    if (selectedDate) {
      setTimeStr(format(selectedDate, 'HH:mm'))
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleDaySelect(day: Date | undefined) {
    if (!day) return
    const [hh = '00', mm = '00'] = timeStr.split(':')
    day.setHours(Number(hh), Number(mm), 0, 0)
    onChange(day.toISOString())
  }

  function handleTimeChange(t: string) {
    setTimeStr(t)
    if (selectedDate) {
      const [hh = '00', mm = '00'] = t.split(':')
      const next = new Date(selectedDate)
      next.setHours(Number(hh), Number(mm), 0, 0)
      onChange(next.toISOString())
    }
  }

  function handleManualInput(raw: string) {
    if (!raw) { onChange(undefined); return }
    // accept "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm"
    const normalized = raw.replace(' ', 'T')
    const d = parse(normalized, "yyyy-MM-dd'T'HH:mm", new Date())
    if (isValid(d)) {
      onChange(d.toISOString())
      setTimeStr(format(d, 'HH:mm'))
    }
  }

  const displayValue = selectedDate ? format(selectedDate, 'yyyy-MM-dd HH:mm') : ''

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div className="relative">
        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          className="input pl-9 pr-8"
          placeholder={placeholder}
          value={displayValue}
          onClick={() => setOpen(true)}
          onChange={e => handleManualInput(e.target.value)}
          readOnly
        />
        {selectedDate && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(undefined); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Calendar popover */}
      {open && (
        <div className={clsx(
          'absolute z-50 mt-1 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
          'bg-white dark:bg-gray-900 p-3 min-w-[280px]',
          'animate-in fade-in slide-in-from-top-1 duration-150'
        )}>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            weekStartsOn={1}
            classNames={{
              root: 'text-sm',
              month_caption: 'flex items-center justify-between px-2 mb-2',
              caption_label: 'font-semibold text-gray-800 dark:text-gray-200 text-sm',
              nav: 'flex items-center gap-1',
              button_previous: clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'text-gray-500 dark:text-gray-400',
                'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              ),
              button_next: clsx(
                'w-7 h-7 rounded-lg flex items-center justify-center',
                'text-gray-500 dark:text-gray-400',
                'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              ),
              month_grid: 'w-full border-collapse',
              weekdays: '',
              weekday: 'text-center text-xs font-medium text-gray-400 dark:text-gray-500 pb-1 w-9',
              week: '',
              day: 'text-center p-0',
              day_button: clsx(
                'w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-sm transition-colors',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-300'
              ),
              selected: '[&>button]:!bg-brand-600 [&>button]:!text-white [&>button]:hover:!bg-brand-700',
              today: '[&>button]:font-bold [&>button]:text-brand-600 dark:[&>button]:text-brand-400',
              outside: '[&>button]:text-gray-300 dark:[&>button]:text-gray-600',
              disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
            }}
          />

          {/* Time picker */}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">Time</span>
            <input
              type="time"
              value={timeStr}
              onChange={e => handleTimeChange(e.target.value)}
              className={clsx(
                'flex-1 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700',
                'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
                'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
                '[&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:dark:invert'
              )}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
