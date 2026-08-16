import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  StatusBar,
  Linking,
} from 'react-native'
import { confirm } from '../../../src/lib/confirm'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import * as SecureStore from 'expo-secure-store'
import { usersApi, walletApi, ordersApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { useThemeStore, type ThemePreference } from '../../../src/store/theme.store'
import { SECURE_KEY_LAST_MODE } from '../../../src/lib/axios'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../src/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

// ─── Guest wall ────────────────────────────────────────────────────────────────

function GuestWall() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={s.guestScroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.guestHero}>
          <View style={s.guestLogoRing}>
            <View style={s.guestLogoInner}>
              <Ionicons name="storefront" size={30} color={COLORS.primary} />
            </View>
          </View>
          <Text style={s.guestAppName}>GrandXL</Text>
          <Text style={s.guestTagline}>Food delivery, reimagined</Text>
        </View>

        {/* Card */}
        <View style={s.guestCard}>
          <Text style={s.guestCardTitle}>Sign in to your account</Text>
          <Text style={s.guestCardSub}>Get the most out of GrandXL</Text>

          {/* Benefits */}
          {[
            { icon: 'receipt-outline' as IoniconsName,  label: 'Track and reorder from your history' },
            { icon: 'location-outline' as IoniconsName, label: 'Save addresses for faster checkout'   },
            { icon: 'pricetag-outline' as IoniconsName, label: 'Unlock exclusive deals & coupons'     },
            { icon: 'wallet-outline' as IoniconsName,   label: 'Earn wallet credits on every order'   },
          ].map((b) => (
            <View key={b.label} style={s.guestBenefit}>
              <View style={s.guestBenefitIcon}>
                <Ionicons name={b.icon} size={15} color={COLORS.primary} />
              </View>
              <Text style={s.guestBenefitText}>{b.label}</Text>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            </View>
          ))}

          <Pressable style={s.guestCTA} onPress={() => router.push('/(auth)/login' as never)}>
            <Text style={s.guestCTAText}>Sign In</Text>
          </Pressable>

          <Pressable style={s.guestSecondary} onPress={() => router.push('/(auth)/register' as never)}>
            <Text style={s.guestSecondaryText}>Create an account</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Menu row ──────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  sublabel,
  badge,
  onPress,
  destructive,
  last,
}: {
  icon: IoniconsName
  label: string
  sublabel?: string
  badge?: string | number
  onPress: () => void
  destructive?: boolean
  last?: boolean
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [s.menuRow, pressed && s.menuRowPressed]}
        onPress={onPress}
      >
        <View style={[s.menuIconWrap, destructive && s.menuIconWrapDestructive]}>
          <Ionicons name={icon} size={17} color={destructive ? COLORS.error : COLORS.primary} />
        </View>

        <View style={s.menuRowBody}>
          <Text style={[s.menuRowLabel, destructive && s.menuRowLabelDestructive]}>{label}</Text>
          {sublabel ? <Text style={s.menuRowSub}>{sublabel}</Text> : null}
        </View>

        {badge != null && (
          <View style={s.menuBadge}>
            <Text style={s.menuBadgeText}>{badge}</Text>
          </View>
        )}

        {!destructive && (
          <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} />
        )}
      </Pressable>
      {!last && <View style={s.menuDivider} />}
    </>
  )
}

// ─── Stat tile ──────────────────────────────────────────────────────────────────

function StatTile({ icon, value, label }: { icon: IoniconsName; value: string; label: string }) {
  return (
    <View style={s.statTile}>
      <Ionicons name={icon} size={18} color={COLORS.primary} style={{ marginBottom: 6 }} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Section card ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      {title && <Text style={s.sectionTitle}>{title}</Text>}
      <View style={s.sectionCard}>{children}</View>
    </View>
  )
}

const THEME_CHOICES: { value: ThemePreference; label: string; icon: IoniconsName }[] = [
  { value: 'light',  label: 'Light',  icon: 'sunny-outline'   },
  { value: 'dark',   label: 'Dark',   icon: 'moon-outline'    },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
]

function ThemeRow() {
  const { preference, setPreference } = useThemeStore()
  return (
    <View style={s.themeRow}>
      <View style={s.themeRowHead}>
        <View style={s.themeIconWrap}>
          <Ionicons name="contrast-outline" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.themeLabel}>Theme</Text>
          <Text style={s.themeSub}>Match system, or pick a side</Text>
        </View>
      </View>
      <View style={s.themeChoices}>
        {THEME_CHOICES.map((choice) => {
          const isActive = preference === choice.value
          return (
            <Pressable
              key={choice.value}
              style={[s.themeChoice, isActive && s.themeChoiceActive]}
              onPress={() => setPreference(choice.value)}
            >
              <Ionicons
                name={choice.icon}
                size={14}
                color={isActive ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[s.themeChoiceText, isActive && s.themeChoiceTextActive]}>
                {choice.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter()
  const { user, clearAuth, isAuthenticated } = useAuthStore()

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getProfile(),
    enabled: isAuthenticated,
  })

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getBalance(),
    enabled: isAuthenticated,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'count'],
    queryFn: () => ordersApi.getHistory({ limit: 1, page: 1 }),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return <GuestWall />

  const profile      = profileData?.data?.data ?? user
  const wallet       = walletData?.data?.data
  const totalOrders  = (ordersData?.data?.data as { meta?: { total?: number } } | undefined)?.meta?.total ?? 0
  const addressCount = profile?.addresses?.length ?? 0
  const balance      = wallet?.balance ?? 0

  const firstName = profile?.firstName ?? ''
  const lastName  = profile?.lastName  ?? ''
  const fullName  = firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Your Account'
  const initial   = (firstName[0] ?? lastName[0] ?? '?').toUpperCase()
  const phone     = profile?.phone ?? '—'
  const email     = profile?.email ?? ''

  const isRider = profile?.roles?.includes(UserRole.RIDER) ?? user?.roles?.includes(UserRole.RIDER) ?? false

  const switchToRider = async () => {
    await SecureStore.setItemAsync(SECURE_KEY_LAST_MODE, 'rider')
    router.replace('/(rider)/' as never)
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title:         'Log out?',
      message:       'You\'ll need to sign in again to place orders.',
      confirmLabel:  'Log out',
      variant:       'destructive',
      icon:          'warning',
    })
    if (!ok) return
    clearAuth()
    router.replace('/login' as never)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero header ── */}
        <View style={s.hero}>
          {/* Avatar */}
          <View style={s.avatarRing}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarInitialWrap}>
                <Text style={s.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Pressable style={s.avatarEdit} hitSlop={6} onPress={() => router.push('/(customer)/profile/edit' as never)}>
              <Ionicons name="camera" size={12} color="#fff" />
            </Pressable>
          </View>

          <Text style={s.heroName}>{fullName}</Text>
          <Text style={s.heroPhone}>{phone}</Text>

          {/* Member badge */}
          <View style={s.memberBadge}>
            <Ionicons name="shield-checkmark" size={11} color={COLORS.primary} />
            <Text style={s.memberBadgeText}>Verified Member</Text>
          </View>
        </View>

        {/* ── Stats strip ── */}
        <View style={s.statsRow}>
          <StatTile
            icon="receipt-outline"
            value={String(totalOrders)}
            label="Orders"
          />
          <View style={s.statsDivider} />
          <StatTile
            icon="wallet-outline"
            value={formatMoney(balance, 'NGN')}
            label="Wallet"
          />
          <View style={s.statsDivider} />
          <StatTile
            icon="location-outline"
            value={String(addressCount)}
            label="Addresses"
          />
        </View>

        {/* ── Driver mode (only for users with the RIDER role) ── */}
        {isRider && (
          <Section title="Driver mode">
            <MenuRow
              icon="bicycle-outline"
              label="Switch to Driver"
              sublabel="Go online and pick up deliveries"
              onPress={() => { void switchToRider() }}
              last
            />
          </Section>
        )}

        {/* ── Account ── */}
        <Section title="Account">
          <MenuRow
            icon="person-outline"
            label="Personal info"
            sublabel={email || fullName}
            onPress={() => router.push('/(customer)/profile/edit' as never)}
          />
          <MenuRow
            icon="call-outline"
            label="Phone number"
            sublabel={phone}
            onPress={() => router.push('/(customer)/profile/edit' as never)}
            last
          />
        </Section>

        {/* ── Delivery & Wallet ── */}
        <Section title="Delivery & Wallet">
          <MenuRow
            icon="location-outline"
            label="Saved addresses"
            sublabel={addressCount > 0 ? `${addressCount} address${addressCount !== 1 ? 'es' : ''} saved` : 'No addresses yet'}
            badge={addressCount > 0 ? addressCount : undefined}
            onPress={() => router.push('/(customer)/profile/addresses' as never)}
          />
          <MenuRow
            icon="wallet-outline"
            label="Wallet & Credits"
            sublabel={`Balance: ${formatMoney(balance, 'NGN')}`}
            onPress={() => router.push('/(customer)/profile/wallet' as never)}
            last
          />
        </Section>

        {/* ── Activity ── */}
        <Section title="Activity">
          <MenuRow
            icon="receipt-outline"
            label="Order history"
            sublabel={totalOrders > 0 ? `${totalOrders} order${totalOrders !== 1 ? 's' : ''} placed` : 'No orders yet'}
            onPress={() => router.push('/(customer)/orders?ref=profile' as never)}
          />
          <MenuRow
            icon="star-outline"
            label="My reviews"
            sublabel="Rate your past orders"
            onPress={() => router.push('/(customer)/orders?ref=profile' as never)}
            last
          />
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          <ThemeRow />
        </Section>

        {/* ── Support ── */}
        <Section title="Support">
          <MenuRow
            icon="help-circle-outline"
            label="Help & FAQ"
            sublabel="Get answers fast"
            onPress={() => Linking.openURL('https://grandxl.com/help')}
          />
          <MenuRow
            icon="logo-whatsapp"
            label="Contact us"
            sublabel="Chat with us on WhatsApp"
            onPress={() => Linking.openURL('https://wa.me/2348000000000')}
          />
          <MenuRow
            icon="document-text-outline"
            label="Terms & Privacy"
            onPress={() => Linking.openURL('https://grandxl.com/terms')}
            last
          />
        </Section>

        {/* ── Logout ── */}
        <Section>
          <MenuRow
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            destructive
            last
          />
        </Section>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>GrandXL · v1.0.0</Text>
          <Text style={s.footerSub}>Made with ❤️ in Nigeria</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.primary },
  scroll: { paddingBottom: 40, backgroundColor: COLORS.surfaceHighlight },

  // ── Guest ────────────────────────────────────────────────────────
  guestScroll: {
    flexGrow: 1,
    backgroundColor: COLORS.bg,
    paddingBottom: 40,
  },
  guestHero: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    paddingBottom: 48,
    gap: 6,
  },
  guestLogoRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  guestLogoInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  guestAppName:   { fontSize: FONT.xl, fontFamily: FONTS.bold, color: '#fff' },
  guestTagline:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },

  guestCard: {
    margin: SPACING.lg,
    marginTop: -20,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOW.md,
    gap: 4,
  },
  guestCardTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: 2 },
  guestCardSub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginBottom: SPACING.lg },

  guestBenefit: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  guestBenefitIcon: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  guestBenefitText: { flex: 1, fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textPrimary },

  guestCTA: {
    height: 50, borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  guestCTAText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },

  guestSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: SPACING.md, paddingVertical: SPACING.sm,
  },
  guestSecondaryText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  // ── Hero ─────────────────────────────────────────────────────────
  hero: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: 48,
    gap: 4,
  },
  avatarRing: {
    width: 88, height: 88,
    borderRadius: 44,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 44 },
  avatarInitialWrap: {
    width: '100%', height: '100%', borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontFamily: FONTS.bold, color: '#fff' },
  avatarEdit: {
    position: 'absolute', bottom: 2, right: 2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primaryDark,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  heroName:  { fontSize: FONT.xl, fontFamily: FONTS.bold, color: '#fff' },
  heroPhone: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },

  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 6,
  },
  memberBadgeText: { fontSize: 11, fontFamily: FONTS.semibold, color: '#fff' },

  // ── Stats ────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    marginHorizontal: SPACING.lg,
    marginTop: -20,
    borderRadius: RADIUS.xl,
    ...SHADOW.md,
    paddingVertical: SPACING.lg,
  },
  statTile: { flex: 1, alignItems: 'center' },
  statsDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  statValue: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  // ── Section ──────────────────────────────────────────────────────
  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  sectionTitle: {
    fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: SPACING.sm,
  },
  sectionCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.sm,
  },

  // ── Menu row ────────────────────────────────────────────────────
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    gap: SPACING.md,
  },
  menuRowPressed: { backgroundColor: COLORS.surfaceHighlight },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuIconWrapDestructive: { backgroundColor: COLORS.errorFade },
  menuRowBody: { flex: 1 },
  menuRowLabel: { fontSize: FONT.md, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  menuRowLabelDestructive: { color: COLORS.error },
  menuRowSub:   { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 1 },

  menuBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  menuBadgeText: { fontSize: 10, fontFamily: FONTS.bold, color: '#fff' },

  menuDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },

  // ── Theme picker ────────────────────────────────────────────────
  themeRow:     { padding: SPACING.md, gap: SPACING.md },
  themeRowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  themeIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  themeLabel:    { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  themeSub:      { fontSize: 12,      fontFamily: FONTS.regular,  color: COLORS.textTertiary, marginTop: 1 },
  themeChoices:  { flexDirection: 'row', gap: SPACING.sm },
  themeChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  themeChoiceActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  themeChoiceText:       { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  themeChoiceTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },

  // ── Footer ──────────────────────────────────────────────────────
  footer: { alignItems: 'center', gap: 4, marginTop: SPACING.xl },
  footerText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  footerSub:  { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary },
})
