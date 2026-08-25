import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { buildRentalReviewDetails } from '../utils/rentalReview';

function DetailRow({ label, value, theme }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textSub }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.textMain }]}>{value}</Text>
    </View>
  );
}

function PhotoBlock({ title, uri, theme }) {
  if (!uri) return null;
  return (
    <View style={styles.photoBlock}>
      <Text style={[styles.sectionHeading, { color: theme.textMain }]}>{title}</Text>
      <Image source={{ uri }} style={styles.gridImage} resizeMode="cover" />
    </View>
  );
}

export default function RentalReviewContent({ rental, theme }) {
  const details = buildRentalReviewDetails(rental);
  if (!details) return null;

  const photoTakerName = details.carPhotosAddedBy || null;
  const submittedBy = details.submittedBy || null;

  return (
    <>
      <Text style={[styles.sectionHeading, { color: theme.textMain }]}>Rental information</Text>
      <View style={[styles.infoCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <DetailRow label="Transaction ID" value={details.transactionId} theme={theme} />
        <DetailRow label="Full name" value={details.fullName} theme={theme} />
        <DetailRow label="Address" value={details.address} theme={theme} />
        <DetailRow label="Contact number" value={details.contactNo} theme={theme} />
        <DetailRow label="Vehicle make" value={details.vehicleMake} theme={theme} />
        <DetailRow label="Plate number" value={details.plateNo} theme={theme} />
        <DetailRow label="Rental from" value={details.periodFrom} theme={theme} />
        <DetailRow label="Rental to" value={details.periodTo} theme={theme} />
        {submittedBy ? (
          <DetailRow label="Account (proof)" value={submittedBy} theme={theme} />
        ) : null}
      </View>

      <PhotoBlock title="Holding license" uri={details.holdingLicenseUri} theme={theme} />
      <PhotoBlock title="Customer photo" uri={details.customerPhotoUri} theme={theme} />

      {details.carPhotos.length > 0 ? (
        <View style={styles.photoBlock}>
          <Text style={[styles.sectionHeading, { color: theme.textMain }]}>Vehicle photos</Text>
          <Text style={[styles.photoTaker, { color: theme.textSub }]}>
            Taken by {photoTakerName || submittedBy || 'Unknown account'}
          </Text>
          {details.carPhotos.map((item) => (
            <View key={item.key} style={styles.carPhotoItem}>
              <Text style={[styles.carPhotoLabel, { color: theme.textSub }]}>{item.title}</Text>
              <Image source={{ uri: item.uri }} style={styles.gridImage} resizeMode="cover" />
            </View>
          ))}
        </View>
      ) : details.vehicleImageUri ? (
        <PhotoBlock title="Vehicle photo" uri={details.vehicleImageUri} theme={theme} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 15, lineHeight: 21 },
  photoBlock: { marginBottom: 16 },
  photoTaker: { fontSize: 13, fontWeight: '600', marginBottom: 12, marginTop: -4 },
  carPhotoItem: { marginBottom: 12 },
  carPhotoLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  gridImage: { width: '100%', height: 180, borderRadius: 12 },
});
