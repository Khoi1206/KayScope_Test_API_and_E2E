'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/i18n/locale-action'
import type { Locale } from '@/i18n/request'

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  vi: 'VI',
}

const ALL_LOCALES: Locale[] = ['en', 'vi']

export function LocaleSwitcher() {
  const locale = useLocale() as Locale
  const t = useTranslations('nav')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSwitch(next: Locale) {
    if (next === locale) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded px-1 py-0.5" title={t('language')}>
      {ALL_LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => handleSwitch(l)}
          disabled={isPending}
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${
            l === locale
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
