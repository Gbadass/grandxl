import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ridersApi, riderPayoutsApi } from '@grandxl/api-client'
import type { PayoutRequest } from '@grandxl/api-client'
import { toast } from '../../src/lib/toast'
import { confirm } from '../../src/lib/confirm'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusStyle(status: PayoutRequest['status']) {
  switch (status) {
    case 'pending':   return { label: 'Pending review', color: COLORS.warning, bg: 'rgba(245,158,11,0.12)' }
    case 'approved':  return { label: 'Approved · in transit', color: '#2563EB', bg: '#DBEAFE' }
    case 'paid':      return { label: 'Paid',  color: COLORS.success, bg: COLORS.successFade }
    case 'rejected':  return { label: 'Rejected', color: COLORS.error,   bg: COLORS.errorFade }
  }
}

export default function RiderPayoutsScreen() {
  const router = useRouter()
  const qc     = useQueryClient()

  const [bankOpen, setBankOpen]               = useState(false)
  const [withdrawOpen, setWithdrawOpen]       = useState(false)
  const [withdrawAmount, setWithdrawAmount]   = useState('')

  // Bank form state
  const [bankName, setBankName]               = useState('')
  const [accountNumber, setAccountNumber]     = useState('')
  const [accountName, setAccountName]         = useState('')

  const { data: rider } = useQuery({
    queryKey: ['riderProfile'],
    queryFn:  () => ridersApi.getProfile().then((r) => r.data.data),
  })

  const { data: bank } = useQuery({
    queryKey: ['rider', 'bank-account'],
    queryFn:  () => riderPayoutsApi.getBankAccount().then((r) => r.data.data),
  })

  const { data: payoutsData, refetch, isRefetching } = useQuery({
    queryKey: ['rider', 'payouts'],
    queryFn:  () => riderPayoutsApi.list({ limit: 20 }).then((r) => r.data.data),
  })

  const payouts = payoutsData?.items ?? []
  const hasBank = !!(bank?.bankName && bank.accountNumber && bank.accountName)
  const available = rider?.earnings.totalKobo ?? 0

  const saveBankMutation = useMutation({
    mutationFn: () => riderPayoutsApi.updateBankAccount({
      bankName:      bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName:   accountName.trim(),
    }),
    onSuccess: () => {
      toast.success('Bank account saved')
      qc.invalidateQueries({ queryKey: ['rider', 'bank-account'] })
      setBankOpen(false)
    },
    onError: () => toast.error('Could not save bank account'),
  })

  const withdrawMutation = useMutation({
    mutationFn: (amountKobo: number) => riderPayoutsApi.request(amountKobo),
    onSuccess: () => {
      toast.success('Payout requested — we will process it shortly')
      setWithdrawOpen(false)
      setWithdrawAmount('')
      qc.invalidateQueries({ queryKey: ['rider', 'payouts'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Could not request payout'
      void confirm({ title: 'Payout failed', message: msg, mode: 'alert', variant: 'destructive', icon: 'warning' })
    },
  })

  const openBankEdit = () => {
    setBankName(bank?.bankName ?? '')
    setAccountNumber(bank?.accountNumber ?? '')
    setAccountName(bank?.accountName ?? '')
    setBankOpen(true)
  }

  const submitWithdraw = () => {
    const amount = parseInt(withdrawAmount.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(amount) || amount < 100) {
      toast.warning('Minimum payout is ₦100')
      return
    }
    if (amount * 100 > available) {
      toast.warning(`You only have ${formatMoney(available)} available`)
      return
    }
    withdrawMutation.mutate(amount * 100)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Payouts</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
      >
        {/* Available balance */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Available to withdraw</Text>
          <Text style={s.balanceAmount}>{formatMoney(available)}</Text>
          <Pressable
            style={[s.withdrawBtn, !hasBank && { opacity: 0.5 }]}
            onPress={() => {
              if (!hasBank) {
                toast.warning('Add your bank account first')
                openBankEdit()
                return
              }
              setWithdrawOpen(true)
            }}
            disabled={available === 0}
          >
            <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.primary} />
            <Text style={s.withdrawBtnText}>Request withdrawal</Text>
          </Pressable>
        </View>

        {/* Bank account */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bank account</Text>
          {hasBank ? (
            <View style={s.bankCard}>
              <View style={s.bankIconWrap}>
                <Ionicons name="card" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bankName}>{bank?.bankName}</Text>
                <Text style={s.bankAcct}>{bank?.accountNumber}</Text>
                <Text style={s.bankSub}>{bank?.accountName}</Text>
              </View>
              <Pressable onPress={openBankEdit} hitSlop={8}>
                <Text style={s.bankEdit}>Edit</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.bankEmpty} onPress={openBankEdit}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.bankEmptyTitle}>Add a bank account</Text>
                <Text style={s.bankEmptySub}>Where your payouts will land</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* History */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>History</Text>
          {payouts.length === 0 ? (
            <View style={s.emptyHistory}>
              <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
              <Text style={s.emptyText}>No payout requests yet</Text>
            </View>
          ) : payouts.map((p) => {
            const st = statusStyle(p.status)
            return (
              <View key={p._id} style={s.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.historyAmount}>{formatMoney(p.amountKobo)}</Text>
                  <Text style={s.historyMeta}>
                    {new Date(p.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{p.bankName}
                  </Text>
                  {p.decisionNote && <Text style={s.historyNote}>{p.decisionNote}</Text>}
                </View>
                <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Bank account modal */}
      <Modal visible={bankOpen} transparent animationType="slide" onRequestClose={() => setBankOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setBankOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => undefined}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Bank account</Text>
              <Text style={s.modalSub}>We pay out to this account.</Text>

              <Text style={s.modalFieldLabel}>Bank name</Text>
              <TextInput
                style={s.modalInput}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Guaranty Trust Bank"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="words"
              />
              <Text style={s.modalFieldLabel}>Account number</Text>
              <TextInput
                style={s.modalInput}
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
                placeholder="0123456789"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                maxLength={20}
              />
              <Text style={s.modalFieldLabel}>Account name</Text>
              <TextInput
                style={s.modalInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="ADEBAYO OYINKAN"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="characters"
              />

              <Pressable
                style={[s.modalSubmit, (!bankName || !accountNumber || !accountName || saveBankMutation.isPending) && { opacity: 0.4 }]}
                disabled={!bankName || !accountNumber || !accountName || saveBankMutation.isPending}
                onPress={() => saveBankMutation.mutate()}
              >
                {saveBankMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.modalSubmitText}>Save bank account</Text>
                }
              </Pressable>
              <Pressable onPress={() => setBankOpen(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Withdraw modal */}
      <Modal visible={withdrawOpen} transparent animationType="slide" onRequestClose={() => setWithdrawOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setWithdrawOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => undefined}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>Request withdrawal</Text>
              <Text style={s.modalSub}>
                Available: {formatMoney(available)}  ·  Funds usually arrive within 24h
              </Text>

              <View style={s.amountRow}>
                <Text style={s.naira}>₦</Text>
                <TextInput
                  style={s.amountInput}
                  value={withdrawAmount}
                  onChangeText={(t) => setWithdrawAmount(t.replace(/[^0-9]/g, ''))}
                  placeholder="Amount"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={7}
                />
              </View>
              <View style={s.quickRow}>
                <Pressable style={s.quickChip} onPress={() => setWithdrawAmount(String(Math.floor(available / 100 / 2)))}>
                  <Text style={s.quickChipText}>Half</Text>
                </Pressable>
                <Pressable style={s.quickChip} onPress={() => setWithdrawAmount(String(Math.floor(available / 100)))}>
                  <Text style={s.quickChipText}>All</Text>
                </Pressable>
              </View>

              <Pressable
                style={[s.modalSubmit, (!withdrawAmount || withdrawMutation.isPending) && { opacity: 0.4 }]}
                disabled={!withdrawAmount || withdrawMutation.isPending}
                onPress={submitWithdraw}
              >
                {withdrawMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <Text style={s.modalSubmitText}>
                      Request {withdrawAmount ? formatMoney(parseInt(withdrawAmount, 10) * 100) : ''}
                    </Text>
                  )
                }
              </Pressable>
              <Pressable onPress={() => setWithdrawOpen(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>Cancel</Text>
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
    backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  balanceCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg,
    borderRadius: RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', gap: 4, ...SHADOW.md,
  },
  balanceLabel:  { fontSize: FONT.sm, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.75)' },
  balanceAmount: { fontSize: 36, fontFamily: FONTS.bold, color: '#fff', letterSpacing: -1, marginVertical: 4 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 12,
  },
  withdrawBtnText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionTitle: {
    fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginBottom: SPACING.sm,
  },

  bankCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  bankIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  bankName: { fontSize: FONT.md, fontFamily: FONTS.bold,    color: COLORS.textPrimary },
  bankAcct: { fontSize: FONT.sm, fontFamily: FONTS.medium,  color: COLORS.textSecondary, letterSpacing: 0.5 },
  bankSub:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 1 },
  bankEdit: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary, padding: SPACING.xs },

  bankEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryFade, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
  },
  bankEmptyTitle: { fontSize: FONT.md, fontFamily: FONTS.bold,    color: COLORS.primary },
  bankEmptySub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 1 },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  historyAmount: { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  historyMeta:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  historyNote:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2, fontStyle: 'italic' },
  statusPill: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  statusPillText: { fontSize: FONT.xs, fontFamily: FONTS.bold },

  emptyHistory: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  emptyText:    { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: COLORS.border, marginBottom: SPACING.sm,
  },
  modalTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  modalSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.sm },
  modalFieldLabel: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textTertiary, marginTop: SPACING.sm },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: FONT.md, fontFamily: FONTS.medium, color: COLORS.textPrimary,
    marginTop: 4,
  },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, marginTop: SPACING.sm,
  },
  naira:       { fontSize: 22, fontFamily: FONTS.bold, color: COLORS.textSecondary, marginRight: 8 },
  amountInput: { flex: 1, paddingVertical: SPACING.md, fontSize: 24, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  quickChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  quickChipText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },

  modalSubmit: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: SPACING.md, alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.md,
  },
  modalSubmitText: { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },
  modalCancel:     { alignItems: 'center', paddingVertical: SPACING.sm },
  modalCancelText: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
})
