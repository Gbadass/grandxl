import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { walletApi } from '@grandxl/api-client'
import type { WalletTransaction } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { toast } from '../../../src/lib/toast'
import { confirm } from '../../../src/lib/confirm'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../src/theme'

const QUICK_TOPUP_NAIRA = [1000, 2500, 5000, 10_000, 20_000]

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TxRow({ item }: { item: WalletTransaction }) {
  const isCredit = item.type === 'credit'
  const icon: IoniconsName = isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'
  const color = isCredit ? COLORS.success : COLORS.error

  return (
    <View style={s.txRow}>
      <View style={[s.txIcon, { backgroundColor: isCredit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={s.txBody}>
        <Text style={s.txDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={s.txTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      <View style={s.txRight}>
        <Text style={[s.txAmount, { color }]}>
          {isCredit ? '+' : '-'}{formatMoney(item.amount, 'NGN')}
        </Text>
        <Text style={s.txBalance}>Bal: {formatMoney(item.balanceAfter, 'NGN')}</Text>
      </View>
    </View>
  )
}

export default function WalletScreen() {
  const router = useRouter()
  const qc     = useQueryClient()

  const [topUpOpen, setTopUpOpen]       = useState(false)
  const [topUpInput, setTopUpInput]     = useState<string>('')

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.getBalance(),
  })

  const { data: txData, isLoading: txLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => walletApi.getTransactions({ limit: 30, page: 1 }),
  })

  const wallet = walletData?.data?.data
  const transactions = (txData?.data?.data as { data?: WalletTransaction[] } | undefined)?.data ?? []

  const topUpMutation = useMutation({
    mutationFn: async (amountNaira: number) => {
      const amountKobo = amountNaira * 100
      const idempotencyKey =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `topup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const res = await walletApi.topUp({ amountKobo }, idempotencyKey)
      return res.data.data
    },
    onSuccess: async (data) => {
      setTopUpOpen(false)
      setTopUpInput('')
      // Open Paystack hosted page. After completion the webhook credits the wallet
      // asynchronously — we'll show a hint and refetch shortly after return.
      await Linking.openURL(data.authorizationUrl)
      toast.info('Complete payment in browser — your wallet will update once confirmed.')
      // Optimistic refetch after a short delay; webhook usually fires within seconds.
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['wallet'] })
      }, 15_000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? (err as Error).message ?? 'Could not start top-up'
      void confirm({ title: 'Top-up failed', message: msg, mode: 'alert', variant: 'destructive', icon: 'warning' })
    },
  })

  const submitTopUp = () => {
    const amount = parseInt(topUpInput.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(amount) || amount < 100) {
      toast.warning('Minimum top-up is ₦100')
      return
    }
    if (amount > 500_000) {
      toast.warning('Maximum top-up is ₦500,000')
      return
    }
    topUpMutation.mutate(amount)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Wallet</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <TxRow item={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListHeaderComponent={
          <>
            {/* Balance card */}
            <View style={s.balanceCard}>
              <View style={s.balanceIcon}>
                <Ionicons name="wallet" size={28} color="#fff" />
              </View>
              <Text style={s.balanceLabel}>Available balance</Text>
              {walletLoading ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
              ) : (
                <Text style={s.balanceAmount}>{formatMoney(wallet?.balance ?? 0, 'NGN')}</Text>
              )}

              {/* Top up */}
              <Pressable style={s.topUpBtn} onPress={() => setTopUpOpen(true)}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                <Text style={s.topUpText}>Top up wallet</Text>
              </Pressable>
            </View>

            {/* Quick stats */}
            <View style={s.quickStats}>
              <View style={s.quickStat}>
                <Text style={s.quickStatValue}>
                  {transactions.filter((t) => t.type === 'credit').length}
                </Text>
                <Text style={s.quickStatLabel}>Credits</Text>
              </View>
              <View style={s.quickStatDivider} />
              <View style={s.quickStat}>
                <Text style={s.quickStatValue}>
                  {transactions.filter((t) => t.type === 'debit').length}
                </Text>
                <Text style={s.quickStatLabel}>Payments</Text>
              </View>
              <View style={s.quickStatDivider} />
              <View style={s.quickStat}>
                <Text style={s.quickStatValue}>{transactions.length}</Text>
                <Text style={s.quickStatLabel}>Transactions</Text>
              </View>
            </View>

            <Text style={s.txHeader}>Transaction history</Text>
          </>
        }
        ListEmptyComponent={
          txLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={32} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>No transactions yet</Text>
              <Text style={s.emptySub}>Your wallet history will appear here</Text>
            </View>
          )
        }
      />

      {/* Top-up modal */}
      <Modal
        visible={topUpOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTopUpOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setTopUpOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => undefined}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Top up your wallet</Text>
              <Text style={s.modalSub}>Pay with Paystack — credit lands instantly on confirmation</Text>

              <View style={s.modalChips}>
                {QUICK_TOPUP_NAIRA.map((amount) => {
                  const isActive = topUpInput === String(amount)
                  return (
                    <Pressable
                      key={amount}
                      style={[s.modalChip, isActive && s.modalChipActive]}
                      onPress={() => setTopUpInput(String(amount))}
                    >
                      <Text style={[s.modalChipText, isActive && s.modalChipTextActive]}>
                        ₦{amount.toLocaleString('en-NG')}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <View style={s.modalInputRow}>
                <Text style={s.modalNairaSign}>₦</Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="Amount"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  value={topUpInput}
                  onChangeText={(t) => setTopUpInput(t.replace(/[^0-9]/g, ''))}
                  maxLength={6}
                  autoFocus
                />
              </View>

              <Pressable
                style={[
                  s.modalSubmitBtn,
                  (!topUpInput || topUpMutation.isPending) && s.modalSubmitBtnDisabled,
                ]}
                onPress={submitTopUp}
                disabled={!topUpInput || topUpMutation.isPending}
              >
                {topUpMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={s.modalSubmitBtnInner}>
                      <Ionicons name="card-outline" size={18} color="#fff" />
                      <Text style={s.modalSubmitBtnText}>
                        Pay with Paystack {topUpInput ? `· ₦${parseInt(topUpInput, 10).toLocaleString('en-NG')}` : ''}
                      </Text>
                    </View>
                  )
                }
              </Pressable>

              <Pressable style={s.modalCancelBtn} onPress={() => setTopUpOpen(false)}>
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.surfaceHighlight },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  listContent: { paddingBottom: 40 },

  balanceCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: 4,
    ...SHADOW.md,
  },
  balanceIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  balanceLabel:  { fontSize: FONT.sm, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },
  balanceAmount: { fontSize: 36, fontFamily: FONTS.bold, color: '#fff', letterSpacing: -1, marginVertical: 4 },

  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 10,
    marginTop: 12,
  },
  topUpText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOW.sm,
  },
  quickStat:        { flex: 1, alignItems: 'center' },
  quickStatDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  quickStatValue:   { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  quickStatLabel:   { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  txHeader: {
    fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.7,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl, marginBottom: SPACING.sm,
  },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  txBody:   { flex: 1 },
  txDesc:   { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  txTime:   { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },
  txRight:  { alignItems: 'flex-end' },
  txAmount: { fontSize: FONT.sm, fontFamily: FONTS.bold },
  txBalance:{ fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.lg + 40 + SPACING.md },

  center: { padding: SPACING.xxxl, alignItems: 'center' },
  empty:  { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  emptySub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  // Top-up modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop:    SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold,    color: COLORS.textPrimary,   textAlign: 'center' },
  modalSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },

  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   10,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  modalChipActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  modalChipText:       { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  modalChipTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },

  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalNairaSign: { fontSize: 20, fontFamily: FONTS.bold,    color: COLORS.textSecondary, marginRight: 8 },
  modalInput:     { flex: 1, paddingVertical: SPACING.md, fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  modalSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  modalSubmitBtnDisabled: { opacity: 0.4 },
  modalSubmitBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  modalSubmitBtnText:     { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },

  modalCancelBtn:     { alignItems: 'center', paddingVertical: SPACING.sm },
  modalCancelBtnText: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
