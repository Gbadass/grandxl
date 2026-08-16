import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import { en } from './locales/en'

// Bootstrap i18next on module load. Later locales (Yoruba, Hausa, Igbo) plug
// in below `resources` — see README for the migration checklist.
//
// Detection:
//   1. If user picked a locale in-app, use that (via useI18nStore setLocale).
//   2. Else fall back to the device locale from expo-localization.
//   3. Else 'en'.
//
// We don't wire a manual language picker UI yet — this is the foundation only.

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: Localization.getLocales()[0]?.languageCode ?? 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    compatibilityJSON: 'v4',
  })

export { i18n }
export { useTranslation as useT } from 'react-i18next'
