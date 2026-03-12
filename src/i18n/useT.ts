import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translations, type Locale } from './translations'

// ─── Store ────────────────────────────────────────────────────────────────────

interface I18nStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'api-assist-view-locale' }
  )
)

// ─── Hook ─────────────────────────────────────────────────────────────────────

type TranslationMap = typeof translations['en']
type TranslationKey = keyof TranslationMap
type TranslationValue<K extends TranslationKey> = TranslationMap[K]

/**
 * Returns a typed translate function for the current locale.
 *
 * Usage:
 *   const t = useT()
 *   t('common.cancel')                    // → 'Cancel' | '취소'
 *   t('table.results', 1, 25, '1,234')   // function keys get called with args
 */
export function useT() {
  const locale = useI18nStore(s => s.locale)
  const dict = translations[locale]

  function t<K extends TranslationKey>(
    key: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: TranslationValue<K> extends (...a: any[]) => any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? Parameters<Extract<TranslationValue<K>, (...a: any[]) => any>>
      : []
  ): string {
    const val = dict[key]
    if (typeof val === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (val as (...a: any[]) => string)(...args)
    }
    return val as string
  }

  return t
}
