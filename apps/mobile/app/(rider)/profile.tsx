import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, StatusBar, Linking,
} from 'react-native'
import { confirm } from '../../src/lib/confirm'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { Ionicons } from '@expo/vector-icons'
import { ridersApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH, SECURE_KEY_LAST_MODE } from '../../src/lib/axios'
import { Skeleton } from '../../src/components/atoms/Skeleton'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  )
}

export default function RiderProfileScreen() {
  const router   = useRouter()
  const qc       = useQueryClient()
  const { user, clearAuth } = useAuthStore()

  const { data: rider, isLoading: riderLoading } = useQuery({
    queryKey:  ['riderProfile'],
    queryFn:   () => ridersApi.getProfile().then((r) => r.data.data),
    staleTime: 30_000,
  })

  const { data: metrics } = useQuery({
    queryKey:  ['riderMetrics'],
    queryFn:   () => ridersApi.getMetrics(30).then((r) => r.data.data),
    enabled:   !!rider,
    staleTime: 5 * 60_000,
  })

  const isCustomer = user?.roles?.includes(UserRole.CUSTOMER) ?? false

  async function switchToCustomer() {
    await SecureStore.setItemAsync(SECURE_KEY_LAST_MODE, 'customer')
    router.replace('/(customer)/' as never)
  }

  async function handleSignOut() {
    const ok = await confirm({
      title:         'Sign out?',
      message:       'You\'ll need to sign in again to start receiving jobs.',
      confirmLabel:  'Sign out',
      variant:       'destructive',
      icon:          'warning',
    })
    if (!ok) return
    await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS)
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH)
    await SecureStore.deleteItemAsync(SECURE_KEY_LAST_MODE)
    qc.clear()
    clearAuth()
    router.replace('/login' as never)
  }

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase() || '?'

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {riderLoading ? (
          <>
            {/* Avatar skeleton */}
            <View style={[s.avatarSection, { gap: SPACING.sm }]}>
              <Skeleton width={80} height={80} borderRadius={40} />
              <Skeleton width={140} height={14} borderRadius={7} />
              <Skeleton width={180} height={11} borderRadius={5} />
              <Skeleton width={110} height={24} borderRadius={999} />
            </View>

            {/* Stats skeleton */}
            <View style={[s.statsRow, { overflow: 'hidden' }]}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.statBox, { flexDirection: 'row', alignItems: 'center', gap: 0 }]}>
                  <View style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                    <Skeleton width={52} height={14} borderRadius={6} />
                    <Skeleton width={40} height={9} borderRadius={4} />
                  </View>
                  {i < 2 && <View style={s.statDivider} />}
                </View>
              ))}
            </View>

            {/* Card skeletons */}
            {[88, 140].map((h, i) => (
              <View key={i} style={[s.card, { height: h, gap: SPACING.md }]}>
                <Skeleton width={80} height={12} borderRadius={5} />
                <Skeleton width="100%" height={1} borderRadius={0} style={{ backgroundColor: COLORS.border }} />
                <Skeleton width="60%" height={10} borderRadius={5} />
                <Skeleton width="40%" height={10} borderRadius={5} />
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Avatar + name */}
            <View style={s.avatarSection}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
              <Text style={s.email}>{user?.email}</Text>
              <View style={[s.badge, rider?.isVerified ? s.badgeVerified : s.badgePending]}>
                <Text style={[s.badgeText, rider?.isVerified ? s.badgeTextVerified : s.badgeTextPending]}>
                  {rider?.isVerified ? '✓ Verified Rider' : '⏳ Pending Verification'}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{rider?.totalDeliveries ?? 0}</Text>
                <Text style={s.statLbl}>Deliveries</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>{(rider?.rating ?? 0).toFixed(1)} ★</Text>
                <Text style={s.statLbl}>Rating</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>
                  ₦{((rider?.earnings?.totalKobo ?? 0) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={s.statLbl}>Earned</Text>
              </View>
            </View>

            {/* Performance (last 30 days) */}
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>Performance</Text>
                <Text style={s.cardHint}>Last 30 days</Text>
              </View>
              <View style={s.metricRow}>
                <View style={s.metricBox}>
                  <Text style={s.metricVal}>
                    {metrics ? `${Math.round(metrics.onTimeRate * 100)}%` : '—'}
                  </Text>
                  <Text style={s.metricLbl}>On time</Text>
                </View>
                <View style={s.metricBox}>
                  <Text style={s.metricVal}>
                    {metrics ? `${Math.round(metrics.cancellationRate * 100)}%` : '—'}
                  </Text>
                  <Text style={s.metricLbl}>Cancelled</Text>
                </View>
                <View style={s.metricBox}>
                  <Text style={s.metricVal}>
                    {metrics ? `${metrics.avgDeliveryMinutes}m` : '—'}
                  </Text>
                  <Text style={s.metricLbl}>Avg time</Text>
                </View>
              </View>
            </View>

            {/* Vehicle info */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Vehicle</Text>
              <InfoRow label="Type"  value={rider?.vehicleType ?? '—'} />
              <InfoRow label="Plate" value={rider?.vehiclePlate ?? 'Not provided'} />
            </View>

            {/* Documents status */}
            <View style={s.card}>
              <Text style={s.cardTitle}>KYC Documents</Text>
              {[
                { label: 'Government ID',    uploaded: !!rider?.documents?.idCard },
                { label: "Driver's License", uploaded: !!rider?.documents?.driverLicense },
                { label: 'Vehicle Photo',    uploaded: !!rider?.documents?.vehiclePhoto },
              ].map((doc) => (
                <View key={doc.label} style={s.docRow}>
                  <Text style={s.infoLabel}>{doc.label}</Text>
                  <Text style={[s.docStatus, doc.uploaded ? s.docOk : s.docMissing]}>
                    {doc.uploaded ? '✓ Uploaded' : '✗ Missing'}
                  </Text>
                </View>
              ))}
              {!rider?.isVerified && (
                <TouchableOpacity
                  style={s.reuploadBtn}
                  onPress={() => router.push('/(rider-onboarding)/documents' as never)}
                  activeOpacity={0.85}
                >
                  <Text style={s.reuploadText}>Upload / replace documents</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Switch to Customer mode — only for users with both roles */}
        {isCustomer && (
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => { void switchToCustomer() }}
            activeOpacity={0.85}
          >
            <Ionicons name="swap-horizontal" size={16} color={COLORS.primary} />
            <Text style={s.switchText}>Switch to Customer</Text>
          </TouchableOpacity>
        )}

        {/* Support */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Need help?</Text>
          <TouchableOpacity
            style={s.supportRow}
            onPress={() => Linking.openURL('tel:+2348000000000')}
            activeOpacity={0.8}
          >
            <View style={[s.supportIconWrap, { backgroundColor: COLORS.primaryFade }]}>
              <Ionicons name="call-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.supportLabel}>Call support</Text>
              <Text style={s.supportSub}>9am–9pm daily</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.supportRow}
            onPress={() => Linking.openURL('https://wa.me/2348000000000')}
            activeOpacity={0.8}
          >
            <View style={[s.supportIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.supportLabel}>WhatsApp us</Text>
              <Text style={s.supportSub}>Fastest response</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.supportRow, { borderBottomWidth: 0 }]}
            onPress={() => Linking.openURL('mailto:support@grandxl.com')}
            activeOpacity={0.8}
          >
            <View style={[s.supportIconWrap, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="mail-outline" size={18} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.supportLabel}>Email support</Text>
              <Text style={s.supportSub}>support@grandxl.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1, backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  scroll: { paddingBottom: SPACING.xxxl },

  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontFamily: FONTS.bold, color: '#fff' },
  name:       { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  email:      { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  badge:      { borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, marginTop: SPACING.xs },
  badgeVerified:     { backgroundColor: 'rgba(34,197,94,0.12)' },
  badgePending:      { backgroundColor: 'rgba(245,158,11,0.12)' },
  badgeText:         { fontSize: FONT.xs, fontFamily: FONTS.semibold },
  badgeTextVerified: { color: COLORS.success },
  badgeTextPending:  { color: COLORS.warning },

  statsRow: {
    flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: SPACING.lg },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  statNum:     { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statLbl:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },

  card: {
    marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, ...SHADOW.sm,
  },
  cardTitle: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  cardHint:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  metricBox: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  metricLbl: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  supportRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  supportIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  supportLabel: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  supportSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular,  color: COLORS.textTertiary, marginTop: 2 },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm,
               borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary, textTransform: 'capitalize' },

  docRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  docStatus:    { fontSize: FONT.sm, fontFamily: FONTS.semibold },
  docOk:        { color: COLORS.success },
  docMissing:   { color: COLORS.error },
  reuploadBtn:  { marginTop: SPACING.md, backgroundColor: COLORS.primaryFade, borderRadius: RADIUS.md,
                  paddingVertical: SPACING.md, alignItems: 'center' },
  reuploadText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  signOutBtn: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.error, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  signOutText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.error },

  switchBtn: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.primaryFade,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs,
  },
  switchText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.primary },
})
