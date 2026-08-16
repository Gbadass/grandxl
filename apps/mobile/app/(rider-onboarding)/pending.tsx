import { useEffect } from 'react'
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ridersApi } from '@grandxl/api-client'
import { useAuthStore } from '../../src/store/auth.store'
import { COLORS, SPACING, RADIUS, FONT, FONTS } from '../../src/theme'

export default function RiderPendingScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const { data: rider, refetch, isRefetching } = useQuery({
    queryKey: ['riderProfile'],
    queryFn:  () => ridersApi.getProfile().then((r) => r.data.data),
    enabled:  isAuthenticated,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (rider?.isVerified) {
      // Don't auto-redirect — let the rider tap the button so they know they've been approved
    }
  }, [rider?.isVerified])

  const docs      = rider?.documents
  const docsCount = [docs?.idCard, docs?.driverLicense, docs?.vehiclePhoto].filter(Boolean).length
  const docsReady = docsCount === 3
  const verified  = !!rider?.isVerified

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <View style={s.container}>

        <View style={s.progressRow}>
          <View style={[s.progressBar, s.done]} />
          <View style={[s.progressBar, s.done]} />
          <View style={[s.progressBar, s.done]} />
        </View>

        <View style={s.illustrationWrap}>
          <Text style={s.illustrationEmoji}>{verified ? '🎉' : '📬'}</Text>
        </View>

        <Text style={s.title}>{verified ? "You're approved!" : 'Application submitted!'}</Text>
        <Text style={s.body}>
          {verified
            ? "You're all set. Tap below to open your dashboard and start accepting deliveries."
            : <>Our team is reviewing your documents. This usually takes{' '}
                <Text style={s.bold}>24–48 hours</Text>.{'\n\n'}
                You'll be notified once approved and ready to start delivering.</>
          }
        </Text>

        <View style={s.checklist}>
          <CheckItem label="Account created"                          done />
          <CheckItem label="Vehicle info submitted"                   done />
          <CheckItem label={`Documents uploaded (${docsCount}/3)`}   done={docsReady} pending={!docsReady} />
          <CheckItem label="Under review by team"                     done={verified} pending={docsReady && !verified} locked={!docsReady} />
          <CheckItem label="Verified & ready to go"                   done={verified} locked={!verified} />
        </View>

        {/* Verified → go to dashboard */}
        {verified && (
          <TouchableOpacity
            style={s.dashBtn}
            onPress={() => router.replace('/(rider)')}
            activeOpacity={0.85}
          >
            <Text style={s.dashBtnText}>Go to my dashboard →</Text>
          </TouchableOpacity>
        )}

        {/* Incomplete docs → re-upload */}
        {!verified && !docsReady && (
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              ⚠️ You only uploaded {docsCount}/3 documents. Upload all 3 so our team can review your application.
            </Text>
            <TouchableOpacity
              style={s.reuploadBtn}
              onPress={() => router.replace('/(rider-onboarding)/documents')}
              activeOpacity={0.85}
            >
              <Text style={s.reuploadText}>Upload missing documents</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Waiting → manual check */}
        {!verified && docsReady && (
          <>
            <View style={s.tipBox}>
              <Text style={s.tipText}>
                💡 Make sure notifications are enabled so you don't miss the approval alert.
              </Text>
            </View>
            <TouchableOpacity
              style={s.checkBtn}
              onPress={() => refetch()}
              disabled={isRefetching}
              activeOpacity={0.7}
            >
              {isRefetching
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={s.checkBtnText}>Check approval status</Text>
              }
            </TouchableOpacity>
          </>
        )}

      </View>
    </SafeAreaView>
  )
}

function CheckItem({ label, done, pending, locked }: {
  label: string; done?: boolean; pending?: boolean; locked?: boolean
}) {
  const icon  = done ? '✅' : pending ? '⏳' : '⬜'
  const color = done ? COLORS.textPrimary : pending ? COLORS.warning : COLORS.textTertiary

  return (
    <View style={ci.row}>
      <Text style={ci.icon}>{icon}</Text>
      <Text style={[ci.label, { color }]}>{label}</Text>
    </View>
  )
}

const ci = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  icon:  { fontSize: 16, width: 22 },
  label: { fontSize: FONT.md, fontFamily: FONTS.medium },
})

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },

  progressRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xxxl },
  progressBar: { flex: 1, height: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.border },
  done:        { backgroundColor: COLORS.success },

  illustrationWrap:  { alignItems: 'center', marginBottom: SPACING.xxl },
  illustrationEmoji: { fontSize: 72 },

  title: {
    fontSize: FONT.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary,
    marginBottom: SPACING.lg, textAlign: 'center',
  },
  body: {
    fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textSecondary,
    lineHeight: 24, textAlign: 'center', marginBottom: SPACING.xxxl,
  },
  bold: { fontFamily: FONTS.semibold, color: COLORS.textPrimary },

  checklist: { gap: 0, marginBottom: SPACING.xxl },

  dashBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md,
  },
  dashBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: FONT.md },

  warnBox: {
    backgroundColor: '#FEF3C7', borderRadius: RADIUS.md, padding: SPACING.lg,
    marginBottom: SPACING.md, gap: SPACING.md,
  },
  warnText: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: '#92400E', lineHeight: 20 },
  reuploadBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  reuploadText: { color: '#fff', fontFamily: FONTS.semibold, fontSize: FONT.sm },

  tipBox: {
    backgroundColor: COLORS.primaryFade, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  tipText: {
    fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20,
  },
  checkBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', minHeight: 44,
    justifyContent: 'center',
  },
  checkBtnText: { color: COLORS.primary, fontFamily: FONTS.semibold, fontSize: FONT.sm },
})
