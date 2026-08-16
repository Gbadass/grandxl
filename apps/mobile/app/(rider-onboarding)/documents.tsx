import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, StatusBar, Image,
} from 'react-native'
import { toast } from '../../src/lib/toast'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { ridersApi, uploadsApi } from '@grandxl/api-client'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

interface DocSlot {
  key: 'idCard' | 'driverLicense' | 'vehiclePhoto'
  label: string
  sub: string
  icon: string
}

const DOCS: DocSlot[] = [
  { key: 'idCard',        label: 'Government ID',     sub: 'NIN, Voters card, or International passport', icon: '🪪' },
  { key: 'driverLicense', label: "Driver's License",  sub: 'Front of your valid driver\'s license',       icon: '📋' },
  { key: 'vehiclePhoto',  label: 'Vehicle Photo',     sub: 'Clear photo of your vehicle',                 icon: '📸' },
]

export default function RiderDocumentsScreen() {
  const router = useRouter()
  const [urls, setUrls]         = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<string | null>(null)

  async function pickAndUpload(key: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      toast.warning('Allow photo access to upload your documents.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setUploading(key)

    try {
      const formData = new FormData()
      formData.append('file', {
        uri:  asset.uri,
        name: asset.fileName ?? `${key}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob)

      const res = await uploadsApi.uploadRiderDocument(formData)
      setUrls((prev) => ({ ...prev, [key]: res.data.data.url }))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: unknown }; message?: string }
      const status   = axiosErr?.response?.status
      const detail   = JSON.stringify(axiosErr?.response?.data ?? axiosErr?.message ?? err)
      console.error('[upload error]', status, detail)
      toast.error(`Upload failed${status ? ` (HTTP ${status})` : ''}`)
    } finally {
      setUploading(null)
    }
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => ridersApi.updateDocuments({
      idCard:        urls.idCard,
      driverLicense: urls.driverLicense,
      vehiclePhoto:  urls.vehiclePhoto,
    }),
    onSuccess: () => router.replace('/(rider-onboarding)/pending'),
    onError:   () => toast.error('Could not submit your documents. Please try again.'),
  })

  const allUploaded = DOCS.every((d) => !!urls[d.key])

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.step}>Step 2 of 3</Text>
          <View style={s.progressRow}>
            <View style={[s.progressBar, s.progressDone]} />
            <View style={[s.progressBar, s.progressActive]} />
            <View style={s.progressBar} />
          </View>
          <Text style={s.title}>Your documents</Text>
          <Text style={s.sub}>Upload clear photos — blurry images will be rejected</Text>
        </View>

        {/* Doc slots */}
        <View style={s.docs}>
          {DOCS.map((doc) => {
            const uploaded    = !!urls[doc.key]
            const isUploading = uploading === doc.key
            return (
              <TouchableOpacity
                key={doc.key}
                style={[s.docCard, uploaded && s.docCardDone]}
                onPress={() => pickAndUpload(doc.key)}
                disabled={isUploading || isPending}
                activeOpacity={0.8}
              >
                <View style={s.docLeft}>
                  {uploaded ? (
                    <Image source={{ uri: urls[doc.key] }} style={s.docThumb} />
                  ) : (
                    <View style={s.docIconWrap}>
                      <Text style={s.docIcon}>{doc.icon}</Text>
                    </View>
                  )}
                  <View style={s.docText}>
                    <Text style={[s.docLabel, uploaded && s.docLabelDone]}>{doc.label}</Text>
                    <Text style={s.docSub}>{uploaded ? 'Uploaded ✓' : doc.sub}</Text>
                  </View>
                </View>
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={[s.docAction, uploaded && s.docActionDone]}>
                    {uploaded ? 'Change' : 'Upload'}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Info */}
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            📋 Your documents are reviewed by our team within 24–48 hours. You'll be notified once verified.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.btn, (!allUploaded || isPending) && s.btnDisabled]}
          onPress={() => submit()}
          disabled={!allUploaded || isPending}
          activeOpacity={0.85}
        >
          {isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{allUploaded ? 'Submit for review' : `${DOCS.filter((d) => urls[d.key]).length}/3 documents uploaded`}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },

  header:       { marginBottom: SPACING.xxxl },
  step:         { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary, marginBottom: SPACING.sm },
  progressRow:  { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xxl },
  progressBar:  { flex: 1, height: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.border },
  progressActive: { backgroundColor: COLORS.primary },
  progressDone:   { backgroundColor: COLORS.success },
  title:        { fontSize: FONT.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  sub:          { fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  docs: { gap: SPACING.md, marginBottom: SPACING.xxl },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.lg, backgroundColor: COLORS.surface, ...SHADOW.sm,
  },
  docCardDone: { borderColor: COLORS.success, backgroundColor: 'rgba(34,197,94,0.06)' },
  docLeft:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  docIconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceHighlight, alignItems: 'center', justifyContent: 'center',
  },
  docThumb:    { width: 44, height: 44, borderRadius: RADIUS.md },
  docIcon:     { fontSize: 22 },
  docText:     { flex: 1, gap: 2 },
  docLabel:    { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  docLabelDone: { color: COLORS.success },
  docSub:      { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  docAction:   { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },
  docActionDone: { color: COLORS.textTertiary },

  infoBox: {
    backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.md,
    padding: SPACING.lg, marginBottom: SPACING.xxl,
  },
  infoText: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20 },

  btn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, alignItems: 'center', minHeight: 52 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontFamily: FONTS.bold, fontSize: FONT.md },
})
