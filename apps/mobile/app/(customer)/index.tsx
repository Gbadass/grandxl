import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Pressable,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import Svg, {
  Path, Circle, Rect, Ellipse, Line, Polygon,
  Defs, LinearGradient, RadialGradient, Stop,
  Text as SvgText,
} from 'react-native-svg'
import { restaurantsApi, ordersApi, platformConfigApi, foodCategoriesApi } from '@grandxl/api-client'
import type { Restaurant, Order, FoodCategory } from '@grandxl/types'
import { OrderStatus } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../src/store/auth.store'
import { useCartStore } from '../../src/store/cart.store'
import { useLocationStore } from '../../src/store/location.store'
import { COLORS, SPACING, RADIUS, FONTS } from '../../src/theme'
import '../../src/lib/axios'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Photo pool ───────────────────────────────────────────────────────────────

const FOOD_PHOTOS = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1598514982641-e924c324d23a?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=240&fit=crop&q=80',
]

// ─── Service tile illustrations ───────────────────────────────────────────────
// Custom SVGs — bg rect + text label stripped. Tile bg color comes from tileBox.

function FoodIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="24 14 100 116">
      <Defs>
        <RadialGradient id="fd-bunt" gradientUnits="userSpaceOnUse" cx="52" cy="28" r="72">
          <Stop offset="0%" stopColor="#fce080" />
          <Stop offset="38%" stopColor="#e8921a" />
          <Stop offset="100%" stopColor="#7a4606" />
        </RadialGradient>
        <RadialGradient id="fd-bunb" cx="35%" cy="22%">
          <Stop offset="0%" stopColor="#dea018" />
          <Stop offset="100%" stopColor="#7a4606" />
        </RadialGradient>
        <LinearGradient id="fd-patty" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7b4828" />
          <Stop offset="100%" stopColor="#361606" />
        </LinearGradient>
        <RadialGradient id="fd-tom" cx="30%" cy="25%">
          <Stop offset="0%" stopColor="#ff8080" />
          <Stop offset="100%" stopColor="#9e1c1c" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="74" cy="114" rx="45" ry="13" fill="url(#fd-bunb)" />
      <Ellipse cx="52" cy="108" rx="16" ry="5" fill="white" opacity={0.13} />
      <Rect x="27" y="94" width="94" height="18" rx="7" fill="url(#fd-patty)" />
      <Line x1="42" y1="95" x2="42" y2="111" stroke="#1a0800" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
      <Line x1="60" y1="95" x2="60" y2="111" stroke="#1a0800" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
      <Line x1="78" y1="95" x2="78" y2="111" stroke="#1a0800" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
      <Line x1="96" y1="95" x2="96" y2="111" stroke="#1a0800" strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
      <Rect x="29" y="95" width="90" height="5" rx="3" fill="white" opacity={0.07} />
      <Path d="M25 95 L29 84 L119 84 L123 95Z" fill="#f5c430" />
      <Path d="M40 84 Q38 77 40 72 Q42 77 40 84Z" fill="#f5c430" />
      <Path d="M68 84 Q66 76 68 70 Q70 76 68 84Z" fill="#f5c430" />
      <Path d="M96 84 Q94 77 96 72 Q98 77 96 84Z" fill="#f5c430" />
      <Path d="M25 84 Q35 73 46 79 Q54 69 64 76 Q72 67 81 74 Q90 67 101 75 Q110 69 123 78 L123 84 L25 84Z" fill="#3dbb6a" />
      <Path d="M25 82 Q35 76 46 79" stroke="#28a058" strokeWidth={1.2} fill="none" opacity={0.5} />
      <Path d="M64 76 Q72 70 81 74" stroke="#28a058" strokeWidth={1.2} fill="none" opacity={0.5} />
      <Ellipse cx="46" cy="80" rx="12" ry="6" fill="url(#fd-tom)" />
      <Ellipse cx="74" cy="76" rx="12" ry="6" fill="url(#fd-tom)" />
      <Ellipse cx="102" cy="80" rx="12" ry="6" fill="url(#fd-tom)" />
      <Ellipse cx="42" cy="77" rx="4.5" ry="2.5" fill="white" opacity={0.3} />
      <Ellipse cx="70" cy="73" rx="4.5" ry="2.5" fill="white" opacity={0.3} />
      <Ellipse cx="98" cy="77" rx="4.5" ry="2.5" fill="white" opacity={0.3} />
      <Path d="M27 70 Q27 18 74 16 Q121 18 121 70Z" fill="url(#fd-bunt)" />
      <Ellipse cx="52" cy="34" rx="18" ry="13" fill="white" opacity={0.2} transform="rotate(-15 52 34)" />
      <Ellipse cx="47" cy="28" rx="10" ry="7" fill="white" opacity={0.22} />
      <Ellipse cx="50" cy="29" rx="6.5" ry="3" fill="#b87008" transform="rotate(-22 50 29)" />
      <Ellipse cx="74" cy="22" rx="6.5" ry="3" fill="#b87008" />
      <Ellipse cx="98" cy="29" rx="6.5" ry="3" fill="#b87008" transform="rotate(22 98 29)" />
      <Ellipse cx="63" cy="41" rx="5.5" ry="2.5" fill="#b87008" transform="rotate(-10 63 41)" />
      <Ellipse cx="86" cy="39" rx="5.5" ry="2.5" fill="#b87008" transform="rotate(10 86 39)" />
    </Svg>
  )
}

function InstaIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="18 24 112 98">
      <Defs>
        <LinearGradient id="im-basket" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#c8922a" />
          <Stop offset="100%" stopColor="#8a5a10" />
        </LinearGradient>
        <LinearGradient id="im-milk" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#f0f4f8" />
          <Stop offset="100%" stopColor="#d0d8e4" />
        </LinearGradient>
        <LinearGradient id="im-bread" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#e8b870" />
          <Stop offset="100%" stopColor="#a87030" />
        </LinearGradient>
        <LinearGradient id="im-juice" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#60c848" />
          <Stop offset="100%" stopColor="#288018" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="74" cy="118" rx="50" ry="8" fill="black" opacity={0.35} />
      <Path d="M22 78 L28 112 Q28 116 32 116 L116 116 Q120 116 120 112 L126 78Z" fill="url(#im-basket)" />
      <Line x1="24" y1="89" x2="124" y2="89" stroke="#7a4a08" strokeWidth={1.8} opacity={0.6} />
      <Line x1="25" y1="100" x2="123" y2="100" stroke="#7a4a08" strokeWidth={1.8} opacity={0.6} />
      <Line x1="26" y1="110" x2="122" y2="110" stroke="#7a4a08" strokeWidth={1.8} opacity={0.6} />
      <Line x1="38" y1="78" x2="35" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Line x1="52" y1="78" x2="50" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Line x1="66" y1="78" x2="65" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Line x1="80" y1="78" x2="80" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Line x1="94" y1="78" x2="95" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Line x1="108" y1="78" x2="110" y2="116" stroke="#7a4a08" strokeWidth={1.5} opacity={0.5} />
      <Rect x="20" y="74" width="108" height="8" rx="4" fill="#d8a030" />
      <Rect x="20" y="74" width="108" height="4" rx="3" fill="#e8b840" opacity={0.7} />
      <Path d="M40 74 Q38 48 54 38 Q66 30 74 30 Q82 30 94 38 Q110 48 108 74" fill="none" stroke="#c8922a" strokeWidth={7} strokeLinecap="round" />
      <Path d="M40 74 Q38 48 54 38 Q66 30 74 30 Q82 30 94 38 Q110 48 108 74" fill="none" stroke="#e8b840" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <Rect x="30" y="44" width="26" height="36" rx="3" fill="url(#im-milk)" />
      <Polygon points="30,44 43,34 56,44" fill="#e0e8f4" />
      <Polygon points="30,44 43,34 56,44" fill="none" stroke="#c0c8d4" strokeWidth={1} />
      <Rect x="30" y="58" width="26" height="10" fill="#e83030" opacity={0.85} />
      <Rect x="33" y="70" width="20" height="6" rx="2" fill="#c0c8d4" opacity={0.5} />
      <Rect x="33" y="46" width="6" height="28" rx="2" fill="white" opacity={0.25} />
      <Rect x="58" y="46" width="32" height="34" rx="6" fill="url(#im-bread)" />
      <Ellipse cx="74" cy="46" rx="16" ry="8" fill="#d8a858" />
      <Line x1="66" y1="50" x2="66" y2="78" stroke="#a87030" strokeWidth={1.5} opacity={0.5} />
      <Line x1="74" y1="50" x2="74" y2="80" stroke="#a87030" strokeWidth={1.5} opacity={0.5} />
      <Line x1="82" y1="50" x2="82" y2="78" stroke="#a87030" strokeWidth={1.5} opacity={0.5} />
      <Ellipse cx="67" cy="52" rx="5" ry="8" fill="white" opacity={0.15} />
      <Ellipse cx="68" cy="44" rx="3" ry="1.5" fill="#c89040" transform="rotate(-20 68 44)" />
      <Ellipse cx="74" cy="41" rx="3" ry="1.5" fill="#c89040" />
      <Ellipse cx="80" cy="44" rx="3" ry="1.5" fill="#c89040" transform="rotate(20 80 44)" />
      <Rect x="92" y="50" width="24" height="32" rx="4" fill="url(#im-juice)" />
      <Rect x="98" y="38" width="12" height="14" rx="3" fill="#50b838" />
      <Rect x="97" y="36" width="14" height="6" rx="3" fill="#e0c020" />
      <Rect x="94" y="58" width="20" height="14" rx="2" fill="white" opacity={0.25} />
      <Rect x="95" y="52" width="5" height="26" rx="2" fill="white" opacity={0.2} />
      <Line x1="92" y1="72" x2="116" y2="72" stroke="#60d848" strokeWidth={1.5} opacity={0.4} />
    </Svg>
  )
}

function DineIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox="18 12 112 116">
      <Defs>
        <RadialGradient id="do-dome" cx="32%" cy="24%" r="72%">
          <Stop offset="0%" stopColor="#f4f8fc" />
          <Stop offset="40%" stopColor="#c0d0e0" />
          <Stop offset="100%" stopColor="#607080" />
        </RadialGradient>
        <LinearGradient id="do-plate" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#dce8f4" />
          <Stop offset="100%" stopColor="#a0b4c8" />
        </LinearGradient>
        <RadialGradient id="do-knob" cx="30%" cy="25%">
          <Stop offset="0%" stopColor="#eaf2fc" />
          <Stop offset="100%" stopColor="#6a8090" />
        </RadialGradient>
        <LinearGradient id="do-table" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7b5030" />
          <Stop offset="100%" stopColor="#3a2010" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="74" cy="116" rx="60" ry="11" fill="url(#do-table)" />
      <Ellipse cx="74" cy="114" rx="60" ry="11" fill="#7b5030" />
      <Ellipse cx="52" cy="111" rx="22" ry="5" fill="white" opacity={0.06} />
      <Ellipse cx="74" cy="110" rx="52" ry="10" fill="url(#do-plate)" />
      <Ellipse cx="74" cy="108" rx="52" ry="10" fill="url(#do-plate)" />
      <Ellipse cx="74" cy="107" rx="48" ry="8" fill="#eef4fc" />
      <Path d="M26 98 Q26 28 74 24 Q122 28 122 98Z" fill="url(#do-dome)" />
      <Path d="M34 82 Q38 50 58 34" fill="none" stroke="white" strokeWidth={6} strokeLinecap="round" opacity={0.32} />
      <Path d="M42 92 Q45 70 56 54" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" opacity={0.18} />
      <Path d="M54 97 Q56 82 62 70" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.12} />
      <Ellipse cx="74" cy="98" rx="48" ry="7" fill="#b0c0d0" />
      <Ellipse cx="74" cy="96" rx="48" ry="7" fill="#ccdaec" />
      <Ellipse cx="74" cy="23" rx="15" ry="6" fill="#b0bec8" />
      <Ellipse cx="74" cy="21" rx="15" ry="6" fill="url(#do-knob)" />
      <Ellipse cx="74" cy="16" rx="9" ry="5.5" fill="#a0b0bc" />
      <Ellipse cx="74" cy="14" rx="9" ry="5.5" fill="url(#do-knob)" />
      <Ellipse cx="70" cy="12" rx="4" ry="3" fill="white" opacity={0.35} />
      <Path d="M120 44 L121.3 47.6 L125 48 L121.3 48.4 L120 52 L118.7 48.4 L115 48 L118.7 47.6Z" fill="#f4d030" opacity={0.95} />
      <Path d="M23 58 L24.2 61.2 L27.5 61.5 L24.2 61.8 L23 65 L21.8 61.8 L18.5 61.5 L21.8 61.2Z" fill="#f4d030" opacity={0.75} />
    </Svg>
  )
}

function CateringIllustration() {
  // Drinks SVG used for catering slot
  return (
    <Svg width="100%" height="100%" viewBox="26 12 96 114">
      <Defs>
        <LinearGradient id="dr-juice" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#e08808" stopOpacity={0.92} />
          <Stop offset="100%" stopColor="#f4b830" stopOpacity={0.88} />
        </LinearGradient>
        <RadialGradient id="dr-ice" cx="25%" cy="20%">
          <Stop offset="0%" stopColor="#e8f6ff" />
          <Stop offset="100%" stopColor="#90c0e0" />
        </RadialGradient>
        <RadialGradient id="dr-lemon" cx="28%" cy="24%">
          <Stop offset="0%" stopColor="#fffaaa" />
          <Stop offset="100%" stopColor="#d0a008" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="74" cy="117" rx="32" ry="7" fill="black" opacity={0.35} />
      <Path d="M44 30 L54 112 L94 112 L104 30Z" fill="url(#dr-juice)" />
      <Rect x="52" y="42" width="24" height="22" rx="6" fill="url(#dr-ice)" opacity={0.88} transform="rotate(-8 64 53)" />
      <Rect x="75" y="46" width="22" height="20" rx="6" fill="url(#dr-ice)" opacity={0.78} transform="rotate(7 86 56)" />
      <Rect x="58" y="68" width="20" height="18" rx="5" fill="url(#dr-ice)" opacity={0.62} transform="rotate(-4 68 77)" />
      <Rect x="53" y="43" width="9" height="7" rx="3" fill="white" opacity={0.55} transform="rotate(-8 57 46)" />
      <Rect x="76" y="47" width="8" height="6" rx="3" fill="white" opacity={0.5} transform="rotate(7 80 50)" />
      <Circle cx="62" cy="96" r="4" fill="white" opacity={0.38} />
      <Circle cx="78" cy="104" r="3" fill="white" opacity={0.3} />
      <Circle cx="90" cy="90" r="3.5" fill="white" opacity={0.32} />
      <Circle cx="68" cy="108" r="2.5" fill="white" opacity={0.25} />
      <Path d="M44 30 L54 112 L94 112 L104 30Z" fill="none" stroke="#80c0e8" strokeWidth={3} strokeLinejoin="round" opacity={0.7} />
      <Ellipse cx="74" cy="30" rx="30" ry="6" fill="none" stroke="#80c0e8" strokeWidth={3} opacity={0.7} />
      <Path d="M47 46 L52 102" stroke="white" strokeWidth={5} strokeLinecap="round" opacity={0.17} />
      <Path d="M50 36 L53 72" stroke="white" strokeWidth={3} strokeLinecap="round" opacity={0.12} />
      <Circle cx="40" cy="56" r="2.5" fill="white" opacity={0.22} />
      <Circle cx="38" cy="72" r="2" fill="white" opacity={0.18} />
      <Circle cx="41" cy="87" r="2.5" fill="white" opacity={0.2} />
      <Circle cx="110" cy="62" r="2" fill="white" opacity={0.18} />
      <Circle cx="111" cy="78" r="2.5" fill="white" opacity={0.16} />
      <Rect x="96" y="14" width="7" height="82" rx="3.5" fill="#e74c3c" />
      <Rect x="97" y="14" width="2.5" height="82" rx="1.25" fill="#ff7060" opacity={0.5} />
      <Circle cx="44" cy="38" r="15" fill="url(#dr-lemon)" />
      <Circle cx="44" cy="38" r="11" fill="#f8e050" opacity={0.5} />
      <Line x1="44" y1="24" x2="44" y2="52" stroke="#c8a008" strokeWidth={1.5} opacity={0.6} />
      <Line x1="30" y1="38" x2="58" y2="38" stroke="#c8a008" strokeWidth={1.5} opacity={0.6} />
      <Line x1="34" y1="28" x2="54" y2="48" stroke="#c8a008" strokeWidth={1.5} opacity={0.6} />
      <Line x1="34" y1="48" x2="54" y2="28" stroke="#c8a008" strokeWidth={1.5} opacity={0.6} />
      <Circle cx="44" cy="38" r="4.5" fill="#fef0a0" />
      <Ellipse cx="38" cy="32" rx="5.5" ry="4" fill="white" opacity={0.28} />
    </Svg>
  )
}

// ─── Service data ─────────────────────────────────────────────────────────────

const SERVICES = [
  { id: 'food',      label: 'FOOD',      Illustration: FoodIllustration,     badge: null },
  { id: 'instamart', label: 'Instamart', Illustration: InstaIllustration,    badge: null },
  { id: 'dineout',   label: 'Dine Out',  Illustration: DineIllustration,     badge: null },
  { id: 'drinks',    label: 'Drinks',    Illustration: CateringIllustration, badge: null },
]

// ─── Deal banner SVGs (viewBox 240×185) ──────────────────────────────────────

const BANNER_W = 138
const BANNER_H = Math.round(BANNER_W * 185 / 240) // 106

function BannerGrandRush() {
  return (
    <Svg width={BANNER_W} height={BANNER_H} viewBox="0 0 240 185">
      <Rect width="240" height="185" rx={18} fill="#1A2558" />
      <Path d="M22,18 L23.4,21.4 L27,22 L23.4,22.6 L22,26 L20.6,22.6 L17,22 L20.6,21.4Z" fill="#FF6B00" opacity={0.6} />
      <Path d="M110,14 L111,16.8 L114,17 L111,17.2 L110,20 L109,17.2 L106,17 L109,16.8Z" fill="#FF6B00" opacity={0.4} />
      <Path d="M205,140 L206.4,143.4 L210,144 L206.4,144.6 L205,148 L203.6,144.6 L200,144 L203.6,143.4Z" fill="#FF6B00" opacity={0.5} />
      <Path d="M20,155 L21,157.5 L23.5,158 L21,158.5 L20,161 L19,158.5 L16.5,158 L19,157.5Z" fill="#FF6B00" opacity={0.35} />
      <SvgText x={20} y={38} fontFamily="Poppins_400Regular" fontSize={12} fill="white" opacity={0.75}>GrandXL Delivers Fast</SvgText>
      <SvgText x={20} y={78} fontFamily="Poppins_900Black" fontSize={36} fill="white">GRAND</SvgText>
      <SvgText x={20} y={116} fontFamily="Poppins_900Black" fontSize={36} fill="white">RUSH</SvgText>
      <Path d="M148,82 L135,105 L147,105 L132,128 L162,98 L149,98 L162,82Z" fill="#FF6B00" />
      <Rect x={20} y={130} width={118} height={24} rx={12} fill="#FF6B00" opacity={0.2} />
      <SvgText x={79} y={146} fontFamily="Poppins_700Bold" fontSize={11} fill="#FF8C3A" textAnchor="middle">DELIVERED IN 30 MINS</SvgText>
      <Path d="M205,28 L183,88 L200,88 L176,165 L232,72 L210,72 L228,28Z" fill="#FF6B00" opacity={0.15} />
    </Svg>
  )
}

function BannerFirstChop() {
  return (
    <Svg width={BANNER_W} height={BANNER_H} viewBox="0 0 240 185">
      <Rect width="240" height="185" rx={18} fill="#1A2558" />
      <Path d="M215,22 L216.4,25.4 L220,26 L216.4,26.6 L215,30 L213.6,26.6 L210,26 L213.6,25.4Z" fill="#FF6B00" opacity={0.6} />
      <Path d="M25,100 L26,102.5 L28.5,103 L26,103.5 L25,106 L24,103.5 L21.5,103 L24,102.5Z" fill="#FF6B00" opacity={0.45} />
      <Path d="M120,168 L121,170.5 L123.5,171 L121,171.5 L120,174 L119,171.5 L116.5,171 L119,170.5Z" fill="#FF6B00" opacity={0.4} />
      <SvgText x={20} y={38} fontFamily="Poppins_400Regular" fontSize={12} fill="white" opacity={0.75}>New to GrandXL?</SvgText>
      <SvgText x={20} y={78} fontFamily="Poppins_900Black" fontSize={36} fill="white">FIRST</SvgText>
      <SvgText x={20} y={116} fontFamily="Poppins_900Black" fontSize={36} fill="white">CHOP</SvgText>
      <Rect x={20} y={130} width={100} height={24} rx={12} fill="#FF6B00" opacity={0.2} />
      <SvgText x={70} y={146} fontFamily="Poppins_700Bold" fontSize={11} fill="#FF8C3A" textAnchor="middle">FIRST CHOP FREE</SvgText>
      <Circle cx={188} cy={95} r={46} fill="#FF6B00" opacity={0.1} />
      <Circle cx={188} cy={95} r={38} fill="#FF6B00" opacity={0.12} />
      <SvgText x={188} y={83} fontFamily="Poppins_900Black" fontSize={32} fill="#FF6B00" textAnchor="middle">50</SvgText>
      <SvgText x={188} y={112} fontFamily="Poppins_900Black" fontSize={22} fill="#FF6B00" textAnchor="middle">%OFF</SvgText>
      <Line x1={158} y1={48} x2={158} y2={66} stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      <Line x1={163} y1={48} x2={163} y2={58} stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      <Line x1={168} y1={48} x2={168} y2={66} stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
      <Path d="M158 58 Q163 64 168 58" fill="none" stroke="#FF6B00" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
    </Svg>
  )
}

function BannerZeroFees() {
  return (
    <Svg width={BANNER_W} height={BANNER_H} viewBox="0 0 240 185">
      <Rect width="240" height="185" rx={18} fill="#1A2558" />
      <Path d="M22,22 L23.4,25.4 L27,26 L23.4,26.6 L22,30 L20.6,26.6 L17,26 L20.6,25.4Z" fill="#FF6B00" opacity={0.6} />
      <Path d="M210,155 L211.4,158.4 L215,159 L211.4,159.6 L210,163 L208.6,159.6 L205,159 L208.6,158.4Z" fill="#FF6B00" opacity={0.45} />
      <Path d="M118,16 L119,18.5 L121.5,19 L119,19.5 L118,22 L117,19.5 L114.5,19 L117,18.5Z" fill="#FF6B00" opacity={0.35} />
      <SvgText x={20} y={38} fontFamily="Poppins_400Regular" fontSize={12} fill="white" opacity={0.75}>Spend ₦5,000 or more</SvgText>
      <SvgText x={20} y={78} fontFamily="Poppins_900Black" fontSize={36} fill="white">FREE</SvgText>
      <SvgText x={20} y={116} fontFamily="Poppins_900Black" fontSize={28} fill="white">DELIVERY</SvgText>
      <Rect x={20} y={130} width={110} height={24} rx={12} fill="#FF6B00" opacity={0.2} />
      <SvgText x={75} y={146} fontFamily="Poppins_700Bold" fontSize={11} fill="#FF8C3A" textAnchor="middle">DELIVERY ON US</SvgText>
      <Rect x={162} y={60} width={58} height={52} rx={8} fill="#FF6B00" opacity={0.15} />
      <Rect x={162} y={60} width={58} height={52} rx={8} fill="none" stroke="#FF6B00" strokeWidth={2} opacity={0.6} />
      <Path d="M176 60 Q176 50 191 50 Q206 50 206 60" fill="none" stroke="#FF6B00" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      <SvgText x={191} y={93} fontFamily="Poppins_900Black" fontSize={18} fill="#FF6B00" textAnchor="middle" opacity={0.9}>GX</SvgText>
      <Line x1={155} y1={125} x2={215} y2={125} stroke="#FF6B00" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
      <Line x1={160} y1={133} x2={210} y2={133} stroke="#FF6B00" strokeWidth={1.5} strokeLinecap="round" opacity={0.2} />
      <Circle cx={172} cy={122} r={8} fill="#1A2558" stroke="#FF6B00" strokeWidth={2} opacity={0.7} />
      <Circle cx={210} cy={122} r={8} fill="#1A2558" stroke="#FF6B00" strokeWidth={2} opacity={0.7} />
      <Circle cx={172} cy={122} r={3} fill="#FF6B00" opacity={0.5} />
      <Circle cx={210} cy={122} r={3} fill="#FF6B00" opacity={0.5} />
    </Svg>
  )
}

function BannerNaijaPicks() {
  return (
    <Svg width={BANNER_W} height={BANNER_H} viewBox="0 0 240 185">
      <Rect width="240" height="185" rx={18} fill="#1A2558" />
      <Rect x={0} y={0} width={8} height={185} rx={4} fill="#FF6B00" opacity={0.5} />
      <Rect x={232} y={0} width={8} height={185} rx={4} fill="#FF6B00" opacity={0.5} />
      <Path d="M30,22 L31.4,25.4 L35,26 L31.4,26.6 L30,30 L28.6,26.6 L25,26 L28.6,25.4Z" fill="#FF6B00" opacity={0.6} />
      <Path d="M210,25 L211.4,28.4 L215,29 L211.4,29.6 L210,33 L208.6,29.6 L205,29 L208.6,28.4Z" fill="#FF6B00" opacity={0.5} />
      <Path d="M22,155 L23,157.5 L25.5,158 L23,158.5 L22,161 L21,158.5 L18.5,158 L21,157.5Z" fill="#FF6B00" opacity={0.5} />
      <Path d="M210,155 L211,157.5 L213.5,158 L211,158.5 L210,161 L209,158.5 L206.5,158 L209,157.5Z" fill="#FF6B00" opacity={0.5} />
      <SvgText x={20} y={38} fontFamily="Poppins_400Regular" fontSize={12} fill="white" opacity={0.75}>GrandXL Curated</SvgText>
      <SvgText x={20} y={78} fontFamily="Poppins_900Black" fontSize={36} fill="white">NAIJA</SvgText>
      <SvgText x={20} y={116} fontFamily="Poppins_900Black" fontSize={36} fill="#FF6B00">PICKS</SvgText>
      <Rect x={20} y={130} width={108} height={24} rx={12} fill="#FF6B00" opacity={0.18} />
      <SvgText x={74} y={146} fontFamily="Poppins_700Bold" fontSize={11} fill="#FF8C3A" textAnchor="middle">NAIJA FAVOURITES</SvgText>
      <Ellipse cx={190} cy={108} rx={34} ry={28} fill="#FF6B00" opacity={0.15} />
      <Ellipse cx={190} cy={108} rx={34} ry={28} fill="none" stroke="#FF6B00" strokeWidth={2} opacity={0.6} />
      <Ellipse cx={190} cy={82} rx={36} ry={8} fill="#1A2558" />
      <Ellipse cx={190} cy={82} rx={36} ry={8} fill="none" stroke="#FF6B00" strokeWidth={2.5} opacity={0.7} />
      <Path d="M154 88 Q144 88 144 95 Q144 102 154 102" fill="none" stroke="#FF6B00" strokeWidth={3} strokeLinecap="round" opacity={0.65} />
      <Path d="M226 88 Q236 88 236 95 Q236 102 226 102" fill="none" stroke="#FF6B00" strokeWidth={3} strokeLinecap="round" opacity={0.65} />
      <Path d="M178 75 Q175 68 178 61" fill="none" stroke="#FF8C3A" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      <Path d="M190 72 Q187 65 190 58" fill="none" stroke="#FF8C3A" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      <Path d="M202 75 Q199 68 202 61" fill="none" stroke="#FF8C3A" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      <Circle cx={178} cy={100} r={3} fill="#FF8C3A" opacity={0.55} />
      <Circle cx={190} cy={95} r={3} fill="#FF8C3A" opacity={0.55} />
      <Circle cx={202} cy={100} r={3} fill="#FF8C3A" opacity={0.55} />
      <Circle cx={184} cy={108} r={3} fill="#FF8C3A" opacity={0.45} />
      <Circle cx={196} cy={108} r={3} fill="#FF8C3A" opacity={0.45} />
      <Circle cx={190} cy={116} r={3} fill="#FF8C3A" opacity={0.4} />
    </Svg>
  )
}

// ─── Cuisine circles ──────────────────────────────────────────────────────────


const DEAL_SEGMENTS = [
  { id: 'all',   label: 'ALL' },
  { id: 'min1k', label: 'FREE DELIVERY' },
  { id: '10min', label: 'FAST DELIVERY' },
]

const ACTIVE_ORDER_STATUSES = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
])

const ACTIVE_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]:   'Waiting for restaurant',
  [OrderStatus.CONFIRMED]: 'Order confirmed',
  [OrderStatus.PREPARING]: 'Being prepared',
  [OrderStatus.READY]:     'Ready for pickup',
  [OrderStatus.PICKED_UP]: 'On the way',
}

// ─── Horizontal restaurant card ────────────────────────────────────────────────
// Swiggy-style: compact dark deal badge at bottom-left, NOT a full-width strip.

function HorizontalRestaurantCard({
  restaurant,
  index,
  onPress,
}: {
  restaurant: Restaurant
  index: number
  onPress: () => void
}) {
  const [saved, setSaved] = useState(false)
  const photoUri = restaurant.coverImage ?? FOOD_PHOTOS[index % FOOD_PHOTOS.length]
  const isFree = restaurant.deliveryFeeFixed === 0

  return (
    <Pressable onPress={onPress} style={styles.hCard}>
      <View style={styles.hCardImageWrap}>
        <Image source={{ uri: photoUri }} style={styles.hCardImage} resizeMode="cover" />

        {isFree && (
          <View style={styles.hDealBadge}>
            <Text style={styles.hDealText}>FREE DELIVERY</Text>
          </View>
        )}

        <Pressable onPress={() => setSaved((v) => !v)} style={styles.hHeartBtn} hitSlop={8}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={13} color={saved ? '#EF4444' : '#fff'} />
        </Pressable>

        {!restaurant.isOpen && (
          <View style={styles.hClosedOverlay}>
            <Text style={styles.hClosedText}>Closed</Text>
          </View>
        )}
      </View>

      <View style={styles.hCardInfo}>
        <Text style={styles.hCardName} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.hCardMeta}>
          <View style={styles.hRating}>
            <Ionicons name="star" size={8} color="#fff" />
            <Text style={styles.hRatingText}>{restaurant.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.hMetaDot}>·</Text>
          <Text style={styles.hMetaTime}>{restaurant.estimatedDeliveryTime} mins</Text>
          <Text style={styles.hMetaDot}>·</Text>
          <Text style={styles.hCardCuisine} numberOfLines={1}>
            {restaurant.cuisine[0]}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

// ─── Full-width vertical restaurant card ──────────────────────────────────────

function CardGradient() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
      <Defs>
        <LinearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.35" stopColor="#111114" stopOpacity="0" />
          <Stop offset="0.78" stopColor="#111114" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#111114" stopOpacity="0.88" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardGrad)" />
    </Svg>
  )
}

function RestaurantCard({
  restaurant,
  index,
  onPress,
}: {
  restaurant: Restaurant
  index: number
  onPress: () => void
}) {
  const [saved, setSaved] = useState(false)
  const photoUri = restaurant.coverImage ?? FOOD_PHOTOS[index % FOOD_PHOTOS.length]
  const freeDelivery = restaurant.deliveryFeeFixed === 0
  const offerLabel = freeDelivery ? 'FREE DELIVERY' : '40% OFF'
  const offerSub   = freeDelivery ? null : 'UPTO ₦800'

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Image with bottom fade */}
      <View style={styles.cardImageWrap}>
        <Image source={{ uri: photoUri }} style={styles.cardImage} resizeMode="cover" />
        <CardGradient />

        {/* Save button */}
        <Pressable
          onPress={() => setSaved((v) => !v)}
          style={styles.cardHeartBtn}
          hitSlop={10}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={17}
            color={saved ? '#EF4444' : '#fff'}
          />
        </Pressable>

        {/* Closed overlay */}
        {!restaurant.isOpen && (
          <View style={styles.closedOverlay}>
            <View style={styles.closedPill}>
              <Text style={styles.closedText}>Closed Now</Text>
            </View>
          </View>
        )}

        {/* Offer badge — bottom-left, orange pill */}
        <View style={styles.cardOfferBadge}>
          <Text style={styles.cardOfferTop}>{offerLabel}</Text>
          {offerSub && <Text style={styles.cardOfferBot}>{offerSub}</Text>}
        </View>
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        {/* Name + rating */}
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={9} color="#fff" />
            <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
            {restaurant.ratingCount > 0 && (
              <Text style={styles.ratingCountText}>({restaurant.ratingCount > 999 ? `${Math.floor(restaurant.ratingCount / 1000)}k` : restaurant.ratingCount})</Text>
            )}
          </View>
        </View>

        {/* Cuisine tags */}
        <Text style={styles.cardCuisine} numberOfLines={1}>
          {restaurant.cuisine.slice(0, 3).join('  ·  ')}
        </Text>

        {/* Divider */}
        <View style={styles.cardBodyDivider} />

        {/* Meta row */}
        <View style={styles.cardMeta}>
          <View style={styles.cardMetaItem}>
            <Ionicons name="time-outline" size={11} color={COLORS.textTertiary} />
            <Text style={styles.metaText}>{restaurant.estimatedDeliveryTime} mins</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.cardMetaItem}>
            <Ionicons name="receipt-outline" size={11} color={COLORS.textTertiary} />
            <Text style={styles.metaText}>
              Min {formatMoney(restaurant.minOrderAmount, restaurant.currency)}
            </Text>
          </View>
          {freeDelivery && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.freeDeliveryChip}>
                <Text style={styles.freeDeliveryText}>Free delivery</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Pressable>
  )
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/* explicit 180px — mirrors cardImage height */}
      <View style={{ width: '100%', height: 180, backgroundColor: COLORS.surfaceHighlight }} />
      <View style={{ padding: SPACING.md, gap: 8 }}>
        <View style={{ height: 14, width: '55%', backgroundColor: COLORS.surfaceHighlight, borderRadius: 7 }} />
        <View style={{ height: 12, width: '35%', backgroundColor: COLORS.surfaceHighlight, borderRadius: 6 }} />
        <View style={{ height: 11, width: '70%', backgroundColor: COLORS.surfaceHighlight, borderRadius: 6 }} />
      </View>
    </View>
  )
}

function SkeletonHCard() {
  return (
    <View style={styles.hCard}>
      <View style={{ height: 110, backgroundColor: COLORS.surfaceHighlight }} />
      <View style={{ padding: 10, gap: 6 }}>
        <View style={{ height: 11, width: 88, backgroundColor: COLORS.surfaceHighlight, borderRadius: 4 }} />
        <View style={{ height: 9, width: 64, backgroundColor: COLORS.surfaceHighlight, borderRadius: 4 }} />
      </View>
    </View>
  )
}

function SkeletonCuisine() {
  return (
    <View style={{ alignItems: 'center', gap: 7, width: 76 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.surfaceHighlight }} />
      <View style={{ height: 10, width: 44, backgroundColor: COLORS.surfaceHighlight, borderRadius: 5 }} />
    </View>
  )
}

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router    = useRouter()
  const { user }  = useAuthStore()
  const { displayAddress, city, coordinates, setLocation } = useLocationStore()
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const [activeService, setActiveService] = useState<string>('food')
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)
  const [dealFilter, setDealFilter] = useState<string>(DEAL_SEGMENTS[0].id)
  const [refreshing, setRefreshing] = useState(false)

  // Request location permission and populate the location store on mount
  useEffect(() => {
    async function initLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      let pos: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      } catch {
        // GPS unavailable (location services off, or hardware timeout) — app works without it
        return
      }
      const { latitude, longitude } = pos.coords

      try {
        const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${key}`
        )
        const data = await res.json() as {
          status: string
          results: Array<{
            formatted_address: string
            address_components: Array<{ long_name: string; types: string[] }>
          }>
        }
        if (data.status === 'OK' && data.results.length) {
          const parts    = data.results[0].address_components
          const get      = (type: string) => parts.find((c) => c.types.includes(type))?.long_name ?? ''
          const cityName = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2') || 'Your location'
          const area     = get('sublocality') || get('neighborhood') || get('route') || ''
          const display  = area ? `${area}, ${cityName}` : cityName
          setLocation({ lat: latitude, lng: longitude }, cityName, display, 'gps')
        } else {
          setLocation({ lat: latitude, lng: longitude }, 'Your location', 'Location detected', 'gps')
        }
      } catch {
        setLocation({ lat: latitude, lng: longitude }, 'Your location', 'Location detected', 'gps')
      }
    }

    if (!coordinates) {
      initLocation()
    }
  }, [])

  // Platform config — drives which service tiles are enabled
  const { data: configData } = useQuery({
    queryKey: ['platform', 'config'],
    queryFn: () => platformConfigApi.get(),
    staleTime: 0,
    refetchInterval: 30_000,
  })
  const enabledServices = configData?.data?.data?.enabledServices

  // Food categories — source of truth is the backend enum + seeder
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['food-categories'],
    queryFn: () => foodCategoriesApi.getAll(),
    staleTime: 10 * 60 * 1000,
  })
  const rawCategories = categoriesData?.data?.data
  const apiCategories: FoodCategory[] = Array.isArray(rawCategories) ? rawCategories : []
  const CUISINES = [
    { id: null, label: 'All', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&h=120&fit=crop&q=75' },
    ...apiCategories.map((c) => ({ id: c.slug, label: c.name, image: c.image ?? FOOD_PHOTOS[0] })),
  ]

  // Best offers — no location filter, always shows top restaurants globally
  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['restaurants', 'best-offers'],
    queryFn: () => restaurantsApi.getAll({ limit: 8, page: 1 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

  // Nearby restaurants — location + cuisine filter
  // Poll every 30s so isOpen toggles (owner closing/opening) propagate without a manual refresh.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['restaurants', 'nearby', selectedCuisine, coordinates?.lat, coordinates?.lng],
    queryFn: () =>
      restaurantsApi.getAll({
        cuisine: selectedCuisine ?? undefined,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchOnReconnect: true,
  })

  // Active order + order history for "Order again"
  const { data: recentOrdersData } = useQuery({
    queryKey: ['orders', 'home-recent'],
    queryFn: () => ordersApi.getHistory({ limit: 20, page: 1 }),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const recentOrders = (recentOrdersData?.data?.data?.data ?? []) as Order[]
  const activeOrder = recentOrders.find((o) => ACTIVE_ORDER_STATUSES.has(o.status)) ?? null

  const deliveredOrders = recentOrders.filter((o) => o.status === OrderStatus.DELIVERED)
  const reorderIds = [...new Set(deliveredOrders.map((o) => o.restaurantId))].slice(0, 4)

  const reorderResults = useQueries({
    queries: reorderIds.map((id) => ({
      queryKey: ['restaurant', id],
      queryFn: () => restaurantsApi.getById(id),
      staleTime: 5 * 60_000,
    })),
  })

  const reorderRestaurants = reorderResults
    .filter((q) => !!q.data?.data?.data)
    .map((q) => q.data!.data!.data as Restaurant)

  const restaurants = (data?.data?.data?.data ?? []) as Restaurant[]
  const allDealRestaurants = (offersData?.data?.data?.data ?? []) as Restaurant[]

  const dealRestaurants = dealFilter === '10min'
    ? allDealRestaurants.filter((r) => r.estimatedDeliveryTime <= 25)
    : dealFilter === 'min1k'
    ? allDealRestaurants.filter((r) => r.deliveryFeeFixed === 0)
    : allDealRestaurants

  async function onRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* ── Active order floating banner ─────────────────────── */}
      {activeOrder && (
        <Pressable
          style={styles.activeOrderBanner}
          onPress={() => router.push(`/(customer)/orders/${activeOrder._id}` as never)}
        >
          <View style={styles.activeOrderLeft}>
            <View style={styles.activeOrderPulse}>
              <View style={styles.activeOrderDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeOrderNumber} numberOfLines={1}>
                {activeOrder.orderNumber}
              </Text>
              <Text style={styles.activeOrderStatus} numberOfLines={1}>
                {ACTIVE_STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
              </Text>
            </View>
          </View>
          <View style={styles.activeOrderTrackBtn}>
            <Text style={styles.activeOrderTrackText}>Track</Text>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </View>
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Location picker */}
          <Pressable
            style={styles.locationBtn}
            onPress={() => router.push('/(customer)/profile/addresses' as never)}
          >
            <View style={styles.locationIconWrap}>
              <Ionicons name="navigate" size={13} color={COLORS.primary} />
            </View>
            <View style={styles.locationText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={styles.locationCity} numberOfLines={1}>
                  {city ?? 'Set location'}
                </Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.primary} />
              </View>
              <Text style={styles.locationSub} numberOfLines={1}>
                {displayAddress ?? 'Tap to set your delivery address'}
              </Text>
            </View>
          </Pressable>

          {/* Right: notification bell + cart */}
          <View style={styles.headerRight}>
            <Pressable
              style={styles.notifBtn}
              hitSlop={8}
              onPress={() => router.push('/(customer)/notifications' as never)}
            >
              <Ionicons
                name={activeOrder ? 'notifications' : 'notifications-outline'}
                size={20}
                color={activeOrder ? COLORS.primary : COLORS.textPrimary}
              />
              {activeOrder && <View style={styles.notifDot} />}
            </Pressable>

            <Pressable
              onPress={() => router.push('/(customer)/cart' as never)}
              style={[styles.cartBtn, cartCount > 0 && styles.cartBtnActive]}
              hitSlop={8}
            >
              <Ionicons
                name={cartCount > 0 ? 'cart' : 'cart-outline'}
                size={21}
                color={cartCount > 0 ? COLORS.primary : COLORS.textPrimary}
              />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Service tiles ─────────────────────────────────────── */}
        <View style={styles.tilesRow}>
          {SERVICES.map((s) => {
            const { Illustration } = s
            const isSoon = s.id !== 'food' && !(enabledServices as Record<string, boolean> | undefined)?.[s.id]
            const isActive = activeService === s.id && !isSoon
            return (
              <Pressable
                key={s.id}
                style={styles.tile}
                onPress={() => { if (!isSoon) setActiveService(s.id) }}
              >
                <View style={[styles.tileBox, isActive && styles.tileBoxActive, isSoon && styles.tileBoxSoon]}>
                  {/* Illustration in an absolute fill so SVG 100%/100% has a real parent size */}
                  <View style={[StyleSheet.absoluteFillObject, { padding: 14, opacity: isSoon ? 0.3 : 1 }]}>
                    <Illustration />
                  </View>
                  {s.badge != null && !isSoon && (
                    <View style={styles.tileBadge}>
                      <Text style={styles.tileBadgeText}>{s.badge}</Text>
                    </View>
                  )}
                  {isSoon && (
                    <View style={styles.tileSoonCenter}>
                      <Ionicons name="lock-closed" size={10} color="#1A2558" />
                      <Text style={styles.tileSoonLabel}>Soon</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tileLabel, isActive && styles.tileLabelActive, isSoon && styles.tileLabelSoon]} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* ── Search ───────────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/(customer)/search')}
          style={styles.searchBar}
        >
          <Ionicons name="search-outline" size={17} color={COLORS.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search for 'Jollof Rice'</Text>
          <View style={styles.micBtn}>
            <Ionicons name="mic" size={14} color={COLORS.primary} />
          </View>
        </Pressable>

        {/* ── Banner ────────────────────────────────────────────── */}
        <Pressable style={styles.banner}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=220&h=260&fit=crop&q=80' }}
            style={styles.bannerImgLeft}
            resizeMode="cover"
          />
          <View style={styles.bannerCenter}>
            <Text style={styles.bannerTitle}>Chop Well, Pay Less</Text>
            <Text style={styles.bannerSub}>Free delivery on your first GrandXL order</Text>
            <View style={styles.bannerCTA}>
              <Text style={styles.bannerCTAText}>GET STARTED</Text>
            </View>
          </View>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=220&h=260&fit=crop&q=80' }}
            style={styles.bannerImgRight}
            resizeMode="cover"
          />
        </Pressable>

        {/* ── Deal cards ────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dealsRow}
        >
          <Pressable style={{ marginRight: SPACING.sm }}><BannerGrandRush /></Pressable>
          <Pressable style={{ marginRight: SPACING.sm }}><BannerFirstChop /></Pressable>
          <Pressable style={{ marginRight: SPACING.sm }}><BannerZeroFees /></Pressable>
          <Pressable><BannerNaijaPicks /></Pressable>
        </ScrollView>

        {/* ── Segmented filter ──────────────────────────────────── */}
        <View style={styles.segmentWrap}>
          {DEAL_SEGMENTS.map((seg) => {
            const active = dealFilter === seg.id
            return (
              <Pressable
                key={seg.id}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setDealFilter(seg.id)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {seg.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* ── Best offers — horizontal restaurant cards ─────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Best offers for you</Text>
          <Pressable><Text style={styles.seeAll}>See all</Text></Pressable>
        </View>
        {offersLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hCardsRow}>
            {[1, 2, 3].map((i) => <SkeletonHCard key={i} />)}
          </ScrollView>
        ) : dealRestaurants.length === 0 ? (
          <View style={styles.hEmptyState}>
            <Ionicons name="storefront-outline" size={22} color={COLORS.textTertiary} />
            <Text style={styles.hEmptyText}>No restaurants match this filter</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hCardsRow}>
            {dealRestaurants.map((r, idx) => (
              <HorizontalRestaurantCard
                key={r._id as string}
                restaurant={r}
                index={idx}
                onPress={() => router.push(`/restaurant/${r._id}` as never)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── What's on your mind ───────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>What's on your mind?</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cuisineRow}
        >
          {categoriesLoading
            ? [1, 2, 3, 4, 5].map((i) => <SkeletonCuisine key={i} />)
            : CUISINES.map((c) => {
            const active = selectedCuisine === c.id
            return (
              <Pressable
                key={String(c.id)}
                onPress={() => setSelectedCuisine(c.id)}
                style={styles.cuisineItem}
              >
                {/* Outer ring — orange when active, surfaceHighlight when not */}
                <View style={[styles.cuisineRing, active && styles.cuisineRingActive]}>
                  <View style={styles.cuisineCircle}>
                    <Image source={{ uri: c.image }} style={styles.cuisineImage} resizeMode="cover" />
                    {/* Bottom gradient so label text is readable if overlaid */}
                    {active && (
                      <View style={styles.cuisineActiveSheen} />
                    )}
                  </View>
                </View>
                <Text style={[styles.cuisineLabel, active && styles.cuisineLabelActive]} numberOfLines={1}>
                  {c.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* ── Order again ───────────────────────────────────────── */}
        {reorderRestaurants.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Order again</Text>
              <Pressable onPress={() => router.push('/(customer)/orders' as never)}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reorderRow}
            >
              {reorderRestaurants.map((r, idx) => (
                <Pressable
                  key={r._id as string}
                  style={styles.reorderCard}
                  onPress={() => router.push(`/restaurant/${r._id}` as never)}
                >
                  <Image
                    source={{ uri: r.coverImage ?? FOOD_PHOTOS[idx % FOOD_PHOTOS.length] }}
                    style={styles.reorderImage}
                    resizeMode="cover"
                  />
                  <View style={styles.reorderBody}>
                    <Text style={styles.reorderName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.reorderCuisine} numberOfLines={1}>
                      {r.cuisine.slice(0, 2).join(' · ')}
                    </Text>
                    <View style={styles.reorderCTA}>
                      <Text style={styles.reorderCTAText}>Reorder</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.divider} />


        {/* ── All restaurants ───────────────────────────────────── */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCuisine
              ? `${selectedCuisine[0].toUpperCase()}${selectedCuisine.slice(1)} near you`
              : 'Restaurants near you'}
          </Text>
          <Text style={styles.listCount}>{data?.data?.data?.meta?.total ?? 0} places</Text>
        </View>

        <View style={styles.restaurantList}>
          {isLoading
            ? [1, 2, 3].map((i) => <SkeletonCard key={i} />)
            : restaurants.length === 0
            ? (
              <View style={styles.empty}>
                <Ionicons name="storefront-outline" size={40} color={COLORS.textTertiary} />
                <Text style={styles.emptyTitle}>No restaurants yet</Text>
                <Text style={styles.emptySub}>We're growing fast — check back soon.</Text>
              </View>
            )
            : restaurants.map((r, idx) => (
              <RestaurantCard
                key={r._id as string}
                restaurant={r}
                index={idx}
                onPress={() => router.push(`/restaurant/${r._id}` as never)}
              />
            ))}
        </View>

        <View style={{ height: SPACING.xxxl + 8 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  locationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: SPACING.sm,
  },
  locationText: {
    flex: 1,
    overflow: 'hidden',
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCity: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  locationSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  cartBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  cartBtnActive: {
    backgroundColor: COLORS.primaryFade,
    borderColor: COLORS.primary + '40',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: FONTS.bold,
  },

  // ── Service tiles
  tilesRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
  },
  tile: {
    width: 72,
    alignItems: 'center',
    gap: 7,
  },
  // Square tile — bg color set here, illustration renders on top
  tileBox: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF0E8',
    borderWidth: 1.5,
    borderColor: '#1A2558',
  },
  // Active tile overrides: white bg + orange border + shadow
  tileBoxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  tileBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: FONTS.bold,
  },
  // Coming-soon tile variant — muted border, no active shadow
  tileBoxSoon: {
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  // Centered "Soon" badge — lock icon + label, no heavy overlay
  tileSoonCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tileSoonLabel: {
    fontSize: 8,
    fontFamily: FONTS.bold,
    color: '#1A2558',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  tileLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.extrabold,
  },
  tileLabelSoon: {
    opacity: 0.4,
  },

  // ── Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
    paddingRight: 6,
    paddingVertical: 10,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Banner
  banner: {
    marginBottom: SPACING.lg,
    height: 122,
    backgroundColor: '#FEF0E8',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bannerImgLeft:  { width: 90, height: '100%' },
  bannerImgRight: { width: 90, height: '100%' },
  bannerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    gap: 3,
  },
  bannerTitle: {
    fontSize: 13,
    fontFamily: FONTS.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  bannerSub: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  bannerCTA: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  bannerCTAText: {
    fontSize: 10,
    fontFamily: FONTS.extrabold,
    color: '#fff',
    letterSpacing: 0.4,
  },

  // ── Deal banners
  dealsRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },

  // ── Segment filter
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.primaryFade,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.2,
  },
  segmentTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // ── Horizontal restaurant cards
  // Width 130px = ~3 cards visible (16 + 130 + 8 + 130 + 8 + 130 = 422 > 390 → 2.8 visible)
  hCardsRow: {
    paddingHorizontal: SPACING.lg,
    gap: 12,
    paddingBottom: SPACING.lg,
  },
  hEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.md,
  },
  hEmptyText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontFamily: FONTS.regular,
  },
  hCard: {
    width: 148,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hCardImageWrap: {
    height: 110,
    position: 'relative',
  },
  hCardImage: {
    width: '100%',
    height: '100%',
  },
  hHeartBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hClosedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hClosedText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 12 },
  hDealBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  hDealText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.3,
  },
  hCardInfo: {
    padding: 10,
    gap: 5,
  },
  hCardName: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  hCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
  },
  hRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.success,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  hRatingText:  { color: '#fff', fontSize: 9, fontFamily: FONTS.bold },
  hMetaDot:     { color: COLORS.textTertiary, fontSize: 10 },
  hMetaTime:    { fontSize: 10, color: COLORS.textSecondary, fontFamily: FONTS.regular },
  hCardCuisine: { fontSize: 10, color: COLORS.textTertiary, fontFamily: FONTS.regular, flexShrink: 1 },

  // ── Section headers
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },

  // ── What's on your mind — cuisine circles
  cuisineRow: {
    paddingHorizontal: SPACING.lg,
    gap: 16,
    paddingBottom: SPACING.lg,
  },
  cuisineItem: { alignItems: 'center', gap: 7, width: 76 },
  // Outer ring: gives active state the orange glow ring
  cuisineRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 2.5,
    borderWidth: 2.5,
    borderColor: COLORS.surfaceHighlight,
  },
  cuisineRingActive: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  cuisineCircle: {
    flex: 1,
    borderRadius: 35,
    overflow: 'hidden',
  },
  cuisineImage: { width: '100%', height: '100%' },
  cuisineActiveSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249,115,22,0.18)',
  },
  cuisineLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  cuisineLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },

  // ── Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  // ── All restaurants (vertical)
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  listCount: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: FONTS.medium,
    letterSpacing: 0.2,
  },
  restaurantList: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },

  // Card shell — no border, shadow instead for premium feel
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },

  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 180 },

  // Heart button — top right, frosted circle
  cardHeartBtn: {
    position: 'absolute',
    top: 12, right: 12,
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(17,17,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedPill: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  closedText: {
    color: '#fff',
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // Orange offer badge — bottom-left corner of image
  cardOfferBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  cardOfferTop: {
    color: '#fff',
    fontSize: 11,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.3,
    lineHeight: 15,
  },
  cardOfferBot: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 9,
    fontFamily: FONTS.semibold,
    lineHeight: 12,
  },

  // Card body
  cardBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 0,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginRight: SPACING.sm,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: FONTS.extrabold,
    letterSpacing: 0.1,
  },
  cardCuisine: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
    marginBottom: 10,
  },

  // Thin divider between cuisine and meta
  cardBodyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textTertiary,
  },
  // Thin vertical bar between meta items
  metaDivider: {
    width: 1,
    height: 10,
    backgroundColor: COLORS.border,
  },
  freeDeliveryChip: {
    backgroundColor: COLORS.successFade,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  freeDeliveryText: {
    color: COLORS.success,
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 0.2,
  },

  dot: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textTertiary,
    opacity: 0.4,
  },

  // ── Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  emptySub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Rating count
  ratingCountText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontFamily: FONTS.medium,
    letterSpacing: 0.1,
  },

  // ── Order again
  reorderRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  reorderCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reorderImage: {
    width: '100%',
    height: 84,
  },
  reorderBody: {
    padding: SPACING.sm,
    gap: 4,
  },
  reorderName: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  reorderCuisine: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  reorderCTA: {
    marginTop: 4,
    backgroundColor: COLORS.primaryFade,
    borderRadius: RADIUS.full,
    paddingVertical: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  reorderCTAText: {
    color: COLORS.primary,
    fontSize: 11,
    fontFamily: FONTS.bold,
    letterSpacing: 0.2,
  },

  // ── Active order banner (floating, below header)
  activeOrderBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1F4B',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  activeOrderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    minWidth: 0,
  },
  activeOrderPulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeOrderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  activeOrderNumber: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: '#fff',
    letterSpacing: -0.2,
  },
  activeOrderStatus: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.62)',
    marginTop: 1,
  },
  activeOrderTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  activeOrderTrackText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
  },
})
