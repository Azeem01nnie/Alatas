import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react-native';
import ScreenLayout, { ScreenHeader } from '../components/ScreenLayout';
import { useTheme } from '../context/ThemeContext';
import { useFleet } from '../context/FleetContext';
import { getReportsForVehicle, summarizeVehicleReports } from '../utils/vehicleMapper';
import { ACCENT } from '../theme/colors';

const TYPE_FILTERS = ['All', 'Expense', 'Repair', 'Issue'];

function formatPeso(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function typeBadgeColor(type) {
  if (type === 'Repair') return { bg: '#fee2e2', text: '#dc2626' };
  if (type === 'Expense') return { bg: '#dbeafe', text: '#2563eb' };
  if (type === 'Issue') return { bg: '#fef3c7', text: '#d97706' };
  return { bg: '#f1f5f9', text: '#475569' };
}

function ReportRow({ row, theme }) {
  const [imageOpen, setImageOpen] = useState(false);
  const attachment = row.attachment;
  const isImage = typeof attachment === 'string' && attachment.startsWith('data:image');
  const colors = typeBadgeColor(row.type);

  return (
    <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.reportHead}>
        <Text style={[styles.reportDate, { color: theme.textSub }]}>{formatDate(row.date)}</Text>
        <View style={[styles.typeBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.typeBadgeText, { color: colors.text }]}>{row.type || 'Entry'}</Text>
        </View>
      </View>

      <Text style={[styles.reportTitle, { color: theme.textMain }]}>{row.description || '—'}</Text>

      <View style={styles.metaRow}>
        <View style={[styles.categoryPill, { backgroundColor: theme.bg }]}>
          <Text style={[styles.categoryPillText, { color: theme.textMain }]}>{row.category || '—'}</Text>
        </View>
        <Text style={[styles.statusText, { color: theme.textSub }]}>{row.status || '—'}</Text>
      </View>

      {row.amount != null && row.amount !== '' ? (
        <Text style={[styles.amountText, { color: theme.textMain }]}>{formatPeso(row.amount)}</Text>
      ) : null}

      {row.recordedBy ? (
        <Text style={[styles.recordedBy, { color: theme.textSub }]}>Recorded by {row.recordedBy}</Text>
      ) : null}

      {isImage ? (
        <>
          <TouchableOpacity
            style={[styles.imageToggle, { borderColor: theme.border }]}
            onPress={() => setImageOpen((open) => !open)}
          >
            <Text style={[styles.imageToggleText, { color: theme.textMain }]}>
              {imageOpen ? 'Hide attachment' : 'View attachment'}
            </Text>
            {imageOpen ? (
              <ChevronUp color={theme.textSub} size={16} />
            ) : (
              <ChevronDown color={theme.textSub} size={16} />
            )}
          </TouchableOpacity>
          {imageOpen ? (
            <Image source={{ uri: attachment }} style={styles.reportImage} resizeMode="cover" />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default function VehicleReportsScreen({ route }) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { vehicleReportEntries, loading, refreshVehicleReports, vehicles } = useFleet();
  const car = route.params?.car;
  const [typeFilter, setTypeFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const allReports = useMemo(
    () => getReportsForVehicle(vehicleReportEntries, car, vehicles),
    [vehicleReportEntries, car, vehicles],
  );

  const summary = useMemo(() => summarizeVehicleReports(allReports), [allReports]);

  const reports = useMemo(() => {
    if (typeFilter === 'All') return allReports;
    return allReports.filter((row) => row.type === typeFilter);
  }, [allReports, typeFilter]);

  const filteredTotal = useMemo(
    () => reports.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [reports],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshVehicleReports();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScreenLayout
      scroll
      contentContainerStyle={styles.container}
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        ),
      }}
      header={
        <ScreenHeader
          title="Vehicle Reports"
          subtitle={car ? `${car.make} ${car.series || car.model} · ${car.plate}` : undefined}
          left={
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <ChevronLeft color={theme.textMain} size={28} />
            </TouchableOpacity>
          }
        />
      }
    >
      <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.summaryLabel, { color: theme.textSub }]}>Total entries</Text>
        <Text style={[styles.summaryValue, { color: theme.textMain }]}>{summary.count}</Text>
        <Text style={[styles.summarySub, { color: theme.textSub }]}>
          Combined amount: {formatPeso(summary.totalAmount)}
        </Text>

        {summary.count > 0 ? (
          <View style={styles.breakdownRow}>
            {Object.entries(summary.byType).map(([type, count]) => {
              const colors = typeBadgeColor(type);
              return (
                <View key={type} style={[styles.breakdownChip, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.breakdownChipText, { color: colors.text }]}>
                    {type}: {count}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {Object.keys(summary.byCategory).length > 0 ? (
          <View style={styles.categoryBreakdown}>
            <Text style={[styles.breakdownTitle, { color: theme.textSub }]}>By category</Text>
            <Text style={[styles.categoryList, { color: theme.textMain }]}>
              {Object.entries(summary.byCategory)
                .map(([category, count]) => `${category} (${count})`)
                .join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((label) => {
          const active = typeFilter === label;
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? ACCENT : theme.bg,
                  borderColor: active ? ACCENT : theme.border,
                },
              ]}
              onPress={() => setTypeFilter(label)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? '#ffffff' : theme.textSub },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {typeFilter !== 'All' ? (
        <Text style={[styles.filterMeta, { color: theme.textSub }]}>
          Showing {reports.length} {typeFilter.toLowerCase()} entries · {formatPeso(filteredTotal)}
        </Text>
      ) : null}

      {loading && !refreshing ? (
        <Text style={[styles.emptyText, { color: theme.textSub }]}>Loading reports…</Text>
      ) : reports.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.textMain }]}>No reports yet</Text>
          <Text style={[styles.emptyText, { color: theme.textSub }]}>
            Expenses, repairs, labor, and issue entries from the desktop Vehicle Reports tab appear here after cloud sync. Pull down to refresh.
          </Text>
        </View>
      ) : (
        reports.map((row) => <ReportRow key={row.id} row={row} theme={theme} />)
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    gap: 6,
  },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 32, fontWeight: '800' },
  summarySub: { fontSize: 14 },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  breakdownChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  breakdownChipText: { fontSize: 12, fontWeight: '700' },
  categoryBreakdown: { marginTop: 8, gap: 4 },
  breakdownTitle: { fontSize: 12, fontWeight: '600' },
  categoryList: { fontSize: 13, lineHeight: 20 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  filterMeta: { fontSize: 13, marginBottom: 12 },
  reportCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  reportHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportDate: { fontSize: 12, fontWeight: '600' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  reportTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryPillText: { fontSize: 12, fontWeight: '600' },
  statusText: { fontSize: 12, fontWeight: '500' },
  amountText: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  recordedBy: { fontSize: 12, marginTop: 6 },
  imageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  imageToggleText: { fontSize: 13, fontWeight: '600' },
  reportImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 10,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20 },
});
