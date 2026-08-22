import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import common from './locales/en/common.json'
import auth from './locales/en/auth.json'
import restaurants from './locales/en/restaurants.json'
import menu from './locales/en/menu.json'
import cart from './locales/en/cart.json'
import orders from './locales/en/orders.json'
import profile from './locales/en/profile.json'
import notifications from './locales/en/notifications.json'
import search from './locales/en/search.json'
import checkout from './locales/en/checkout.json'
import addresses from './locales/en/addresses.json'
import payment from './locales/en/payment.json'
import chat from './locales/en/chat.json'

import yoCommon from './locales/yo/common.json'
import igCommon from './locales/ig/common.json'
import haCommon from './locales/ha/common.json'

void i18n.use(initReactI18next).init({
  lng: localStorage.getItem('gxl-language') ?? 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, auth, restaurants, menu, cart, orders, profile, notifications, search, checkout, addresses, payment, chat },
    yo: { common: yoCommon },
    ig: { common: igCommon },
    ha: { common: haCommon },
  },
  interpolation: { escapeValue: false },
})

export default i18n
