import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTheme } from '../context/ThemeContext'
import { useFleet } from '../context/FleetContext'
import { ACCENT } from '../theme/colors'

export default function VehicleFormScreen({ route, navigation }) {
  const { theme } = useTheme()
  const { saveVehicle } = useFleet()
  const mode = route.params?.mode || 'add'
  const car = route.params?.car
  const raw = car?._raw || {}

  const [busy, setBusy] = useState(false)
  const [make, setMake] = useState(car?.make || '')
  const [series, setSeries] = useState(car?.series || car?.model || '')
  const [bodyType, setBodyType] = useState(car?.bodyType || 'Sedan')
  const [seats, setSeats] = useState(String(car?.seats || 5))
  const [transmission, setTransmission] = useState(car?.transmission || 'Automatic')
  const [plateNo, setPlateNo] = useState(car?.plateNo || car?.plate || '')
  const [engineNo, setEngineNo] = useState(car?.engineNo || raw.engineNo || '')
  const [chassisNo, setChassisNo] = useState(car?.chassisNo || raw.chassisNo || '')
  const [ownerName, setOwnerName] = useState(car?.ownerName || '')
  const [status, setStatus] = useState(
    car?.status === 'Maintenance' ? 'Under Maintenance' : car?.status || 'Available',
  )
  const [hrs5, setHrs5] = useState(String(car?.rates?.hrs5 ?? raw.rates?.hrs5 ?? ''))
  const [hrs12, setHrs12] = useState(String(car?.rates?.hrs12 ?? raw.rates?.hrs12 ?? ''))
  const [hrs24, setHrs24] = useState(String(car?.rates?.hrs24 ?? raw.rates?.hrs24 ?? ''))
  const [exceedHour, setExceedHour] = useState(
    String(car?.rates?.exceedHour ?? raw.rates?.exceedHour ?? ''),
  )
  const [orcrImage, setOrcrImage] = useState(raw.orcrImage || '')
  const [orImage, setOrImage] = useState(raw.orImage || '')

  const pickDoc = async (which) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    })
    if (res.canceled || !res.assets?.[0]) return
    const asset = res.assets[0]
    const mime = asset.mimeType || 'image/jpeg'
    const dataUrl = asset.base64
      ? `data:${mime};base64,${asset.base64}`
      : asset.uri
    if (which === 'cr') setOrcrImage(dataUrl)
    else setOrImage(dataUrl)
  }

  const save = async () => {
    if (!make.trim() || !series.trim()) {
      Alert.alert('Brand and model are required')
      return
    }
    setBusy(true)
    try {
      await saveVehicle({
        id: car?.id,
        make: make.trim(),
        series: series.trim(),
        bodyType: bodyType.trim(),
        seats: Number(seats) || 5,
        transmission,
        plateNo: plateNo.trim().toUpperCase(),
        engineNo: engineNo.trim().toUpperCase(),
        chassisNo: chassisNo.trim().toUpperCase(),
        ownerName: ownerName.trim(),
        ownershipType: 'company',
        status: status === 'Maintenance' ? 'Under Maintenance' : status,
        orcrImage,
        orImage,
        image: car?.imageUri || raw.image || '',
        rates: {
          hrs5: Number(String(hrs5).replace(/[^\d.]/g, '')) || 0,
          hrs12: Number(String(hrs12).replace(/[^\d.]/g, '')) || 0,
          hrs24: Number(String(hrs24).replace(/[^\d.]/g, '')) || 0,
          exceedHour: Number(String(exceedHour).replace(/[^\d.]/g, '')) || 0,
        },
        reportEntries: car?.reportEntries || raw.reportEntries || [],
      })
      Alert.alert('Saved', 'Vehicle saved to Supabase.')
      navigation.goBack()
    } catch (err) {
      Alert.alert('Save failed', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={[styles.heading, { color: theme.textMain }]}>
        {mode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}
      </Text>

      <Field label="Brand *" value={make} onChangeText={setMake} theme={theme} />
      <Field label="Model / Series *" value={series} onChangeText={setSeries} theme={theme} />
      <Field label="Body type *" value={bodyType} onChangeText={setBodyType} theme={theme} />
      <Field label="Seats *" value={seats} onChangeText={setSeats} theme={theme} keyboardType="number-pad" />
      <Field label="Transmission *" value={transmission} onChangeText={setTransmission} theme={theme} />
      <Field label="Plate No." value={plateNo} onChangeText={setPlateNo} theme={theme} autoCapitalize="characters" />
      <Field label="Engine No." value={engineNo} onChangeText={setEngineNo} theme={theme} autoCapitalize="characters" />
      <Field label="Chassis No." value={chassisNo} onChangeText={setChassisNo} theme={theme} autoCapitalize="characters" />
      <Field label="Owner name" value={ownerName} onChangeText={setOwnerName} theme={theme} />
      <Field
        label="Status (Available / Under Maintenance / Rented)"
        value={status}
        onChangeText={setStatus}
        theme={theme}
      />

      <Text style={[styles.section, { color: theme.textMain }]}>City rates (PHP)</Text>
      <Field label="5 hours *" value={hrs5} onChangeText={setHrs5} theme={theme} keyboardType="decimal-pad" />
      <Field label="12 hours *" value={hrs12} onChangeText={setHrs12} theme={theme} keyboardType="decimal-pad" />
      <Field label="24 hours *" value={hrs24} onChangeText={setHrs24} theme={theme} keyboardType="decimal-pad" />
      <Field label="Exceeding / hour" value={exceedHour} onChangeText={setExceedHour} theme={theme} keyboardType="decimal-pad" />

      <Text style={[styles.section, { color: theme.textMain }]}>OR / CR images</Text>
      <Text style={{ color: theme.textSub, marginBottom: 8, fontSize: 13 }}>
        Upload photos of the documents (PDF OCR can be done on the web desk). Fields can be filled manually.
      </Text>
      <TouchableOpacity
        style={[styles.docBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        onPress={() => pickDoc('cr')}
      >
        <Text style={{ color: theme.textMain, fontWeight: '600' }}>
          {orcrImage ? 'CR attached — tap to replace' : 'Upload CR image'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.docBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        onPress={() => pickDoc('or')}
      >
        <Text style={{ color: theme.textMain, fontWeight: '600' }}>
          {orImage ? 'OR attached — tap to replace' : 'Upload OR image'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.save, { backgroundColor: ACCENT, opacity: busy ? 0.7 : 1 }]}
        onPress={save}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save vehicle</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

function Field({ label, theme, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.textMain, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.textSub}
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          color: theme.textMain,
          borderRadius: 10,
          paddingHorizontal: 14,
          height: 46,
          fontSize: 15,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  docBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  save: {
    marginTop: 20,
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
