import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { toast } from '../../../src/lib/toast'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { usersApi, uploadsApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../src/store/auth.store'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../src/theme'

export default function EditProfileScreen() {
  const router = useRouter()
  const qc     = useQueryClient()
  const { user, updateUser } = useAuthStore()

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getProfile(),
  })
  const profile = profileData?.data?.data ?? user

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [avatar,    setAvatar]    = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? '')
      setLastName(profile.lastName   ?? '')
      setEmail(profile.email         ?? '')
      setAvatar(profile.avatar       ?? null)
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: () => usersApi.updateProfile({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim() || undefined,
      avatar:    avatar ?? undefined,
    }),
    onSuccess: (res) => {
      const updated = res.data.data
      if (updated) updateUser(updated)
      qc.invalidateQueries({ queryKey: ['profile'] })
      router.back()
    },
    onError: () => toast.error('Could not update profile. Please try again.'),
  })

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        toast.warning('Photo access needed — enable it in Settings > GrandXL.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]) return

      setUploading(true)
      const asset = result.assets[0]
      const fd = new FormData()
      fd.append('file', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' } as never)
      const res = await uploadsApi.uploadImage(fd)
      setAvatar(res.data.data?.url ?? null)
    } catch (err) {
      console.error('[pickAvatar]', err)
      toast.error('Could not open photo library. Check photo access in Settings.')
    } finally {
      setUploading(false)
    }
  }

  const initial = (firstName[0] ?? lastName[0] ?? user?.firstName?.[0] ?? '?').toUpperCase()
  const hasChanges =
    firstName.trim() !== (profile?.firstName ?? '') ||
    lastName.trim()  !== (profile?.lastName  ?? '') ||
    email.trim()     !== (profile?.email     ?? '') ||
    avatar           !== (profile?.avatar    ?? null)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <Pressable
          onPress={() => updateMutation.mutate()}
          disabled={!hasChanges || updateMutation.isPending}
          style={[s.saveBtn, (!hasChanges || updateMutation.isPending) && s.saveBtnDisabled]}
          hitSlop={8}
        >
          {updateMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Avatar picker */}
        <View style={s.avatarSection}>
          <Pressable onPress={pickAvatar} style={s.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={s.avatarOverlay}>
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={18} color="#fff" />
              }
            </View>
          </Pressable>
          <Text style={s.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Fields */}
        <View style={s.card}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>First name</Text>
            <TextInput
              style={s.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="words"
            />
          </View>
          <View style={s.divider} />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Last name</Text>
            <TextInput
              style={s.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="words"
            />
          </View>
          <View style={s.divider} />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Email address</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Phone — read-only */}
        <View style={s.card}>
          <View style={s.field}>
            <View style={s.fieldLabelRow}>
              <Text style={s.fieldLabel}>Phone number</Text>
              <View style={s.readOnlyBadge}>
                <Text style={s.readOnlyText}>Cannot be changed</Text>
              </View>
            </View>
            <Text style={s.readOnlyValue}>{profile?.phone ?? '—'}</Text>
          </View>
        </View>

        <Text style={s.hint}>Your phone number is your login — contact support to change it.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.surfaceHighlight },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },

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
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: '#fff' },

  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarWrap: { width: 90, height: 90, borderRadius: 45, overflow: 'hidden', marginBottom: SPACING.sm },
  avatarImg:  { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontFamily: FONTS.bold, color: COLORS.primary },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  card: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.xl,
    overflow: 'hidden', marginBottom: SPACING.md, ...SHADOW.sm,
  },
  field:       { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldLabel:  { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md },

  readOnlyBadge: {
    backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  readOnlyText:  { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  readOnlyValue: { fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textSecondary, paddingVertical: 4 },

  hint: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', paddingHorizontal: SPACING.lg },
})
