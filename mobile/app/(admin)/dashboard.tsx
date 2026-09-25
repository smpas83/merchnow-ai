import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, apiCall } from '../../src/auth';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');

  const loadData = async () => {
    try {
      const [oRes, sRes, wRes, jRes] = await Promise.all([
        apiCall('/organizations'),
        apiCall('/stores'),
        apiCall('/workers'),
        apiCall('/jobs'),
      ]);
      setOrganizations(oRes);
      setStores(sRes);
      setWorkers(wRes);
      setJobs(jRes);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (!user || user.role !== 'admin') return null;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: '#10B981', inactive: '#EF4444',
      draft: '#6B7280', completed: '#3B82C6', cancelled: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Panel</Text>
          <Text style={styles.name}>Platform Operations</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'overview' && styles.tabActive]} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'audit' && styles.tabActive]} onPress={() => setActiveTab('audit')}>
          <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>Audit Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'overview' ? [] : []}
        keyExtractor={(_, i) => i.toString()}
        renderItem={() => null}
        ListHeaderComponent={activeTab === 'overview' ? (
          <View style={styles.overview}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{organizations.length}</Text>
                <Text style={styles.statLabel}>Organizations</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stores.length}</Text>
                <Text style={styles.statLabel}>Stores</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{workers.length}</Text>
                <Text style={styles.statLabel}>Workers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{jobs.length}</Text>
                <Text style={styles.statLabel}>Jobs</Text>
              </View>
            </View>

            {/* Organizations */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organizations</Text>
              <View style={styles.listCard}>
                {organizations.map((org: any) => (
                  <View key={org.id} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarText}>{org.name.charAt(0)}</Text>
                      </View>
                      <View>
                        <Text style={styles.listItemName}>{org.name}</Text>
                        <Text style={styles.listItemMeta}>{org.slug} · {org.type}</Text>
                      </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusBadge(org.status) }]}>
                      <Text style={styles.badgeText}>{org.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Stores */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stores</Text>
              <View style={styles.listCard}>
                {stores.map((s: any) => (
                  <View key={s.id} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Text style={styles.listItemName}>{s.name}</Text>
                      <Text style={styles.listItemMeta}>{s.city}, {s.state} {s.zip}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusBadge(s.status) }]}>
                      <Text style={styles.badgeText}>{s.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Workers */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Workers</Text>
              <View style={styles.listCard}>
                {workers.map((w: any) => (
                  <View key={w.id} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <View style={styles.avatarSmall}>
                        <Text style={styles.avatarText}>{w.first_name?.charAt(0) || '?'}{w.last_name?.charAt(0) || ''}</Text>
                      </View>
                      <View>
                        <Text style={styles.listItemName}>{w.first_name} {w.last_name}</Text>
                        <Text style={styles.listItemMeta}>{w.email} · ★{w.avg_rating || 'N/A'} · {w.total_jobs_completed} jobs</Text>
                      </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: w.is_available ? '#10B981' : '#D1D5DB' }]}>
                      <Text style={styles.badgeText}>{w.is_available ? 'Available' : 'Unavailable'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Jobs Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Status Summary</Text>
              <View style={styles.listCard}>
                {(['created', 'scheduled', 'assigned', 'accepted', 'in_progress', 'submitted', 'under_review', 'completed', 'cancelled'] as const).map(status => {
                  const count = jobs.filter((j: any) => j.status === status).length;
                  return count > 0 ? (
                    <View key={status} style={styles.statusRow}>
                      <View style={[styles.statusBadge, { backgroundColor: statusBadge(status) }]}>
                        <Text style={styles.statusBadgeText}>{status.replace('_', ' ')}</Text>
                      </View>
                      <Text style={styles.statusCount}>{count}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.auditView}>
            <Text style={styles.auditTitle}>Audit Log</Text>
            <Text style={styles.auditSubtitle}>Platform audit events</Text>
            {loading ? (
              <ActivityIndicator style={styles.loader} color="#8B5CF6" />
            ) : (
              <View style={styles.auditList}>
                <Text style={styles.emptyText}>Audit log will appear here as events occur.</Text>
              </View>
            )}
          </View>
        )}
        refreshControl={new RefreshControl(onRefresh={loadData})}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  greeting: { fontSize: 14, color: '#6B7280' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  logoutText: { fontSize: 14, color: '#EF4444', fontWeight: '500' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', margin: 16, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  overview: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#8B5CF6' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  listCard: { backgroundColor: '#fff', borderRadius: 10, padding: 8 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  listItemName: { fontSize: 13, fontWeight: '500', color: '#111827' },
  listItemMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  statusCount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  auditView: { flex: 1, padding: 16 },
  auditTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  auditSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  auditList: { flex: 1 },
  loader: { padding: 40 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 40 },
  listContent: { paddingBottom: 40 },
});
