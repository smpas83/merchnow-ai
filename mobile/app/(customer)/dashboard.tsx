import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, apiCall } from '../../_layout';

export default function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [jRes, oRes, sRes] = await Promise.all([
        apiCall('/jobs'),
        apiCall('/organizations'),
        apiCall('/stores'),
      ]);
      setJobs(jRes);
      setOrganizations(oRes);
      setStores(sRes);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      created: '#6B7280', scheduled: '#3B82F6', assigned: '#8B5CF6',
      accepted: '#8B5CF6', en_route: '#F59E0B', checked_in: '#F59E0B',
      in_progress: '#F59E0B', submitted: '#10B981', under_review: '#10B981',
      completed: '#10B981', cancelled: '#EF4444', no_show: '#EF4444',
      rework_required: '#F59E0B', disputed: '#EF4444',
    };
    return map[s] || '#6B7280';
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user.first_name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} refreshControl={new RefreshControl(onRefresh={loadData})}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{jobs.length}</Text>
            <Text style={styles.statLabel}>Total Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{jobs.filter((j: any) => j.status === 'completed').length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{jobs.filter((j: any) => ['in_progress', 'checked_in', 'en_route'].includes(j.status)).length}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/jobs')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#8B5CF6" />
          ) : jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No jobs yet</Text>
              <Text style={styles.emptySubtext}>Create your first job to get started</Text>
            </View>
          ) : (
            <FlatList
              data={jobs.slice(0, 5)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.jobCard} onPress={() => router.push(`/(customer)/job/${item.id}`)}>
                  <View style={styles.jobCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                    </View>
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                  <Text style={styles.jobTitle}>{item.title}</Text>
                  <Text style={styles.jobDesc}>{item.description || 'No description'}</Text>
                  <View style={styles.jobMeta}>
                    <Text style={styles.metaText}>📍 {item.store_name || 'Unknown store'}</Text>
                    <Text style={styles.metaText}>💰 ${item.base_price?.toFixed(2) || (item.hourly_rate ? `$${item.hourly_rate}/hr` : '?')}</Text>
                  </View>
                  {item.assigned_worker_id && (
                    <View style={styles.assignedTag}>
                      <Text style={styles.assignedText}>Assigned</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.jobList}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Organizations</Text>
          </View>
          <FlatList
            data={organizations}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.orgList}
            renderItem={({ item }) => (
              <View style={styles.orgCard}>
                <View style={styles.orgAvatar}>
                  <Text style={styles.orgAvatarText}>{item.name.charAt(0)}</Text>
                </View>
                <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.orgType}>{item.type}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  greeting: { fontSize: 14, color: '#6B7280' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  logoutText: { fontSize: 14, color: '#EF4444', fontWeight: '500' },
  scroll: { flex: 1 },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#8B5CF6' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  seeAll: { fontSize: 14, color: '#8B5CF6', fontWeight: '500' },
  loader: { padding: 40 },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 12 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  emptySubtext: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  jobList: { gap: 10 },
  jobCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  jobCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  priorityText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  jobDesc: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  jobMeta: { flexDirection: 'row', gap: 16 },
  metaText: { fontSize: 12, color: '#374151' },
  assignedTag: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  assignedText: { fontSize: 11, color: '#3B82F6', fontWeight: '600' },
  orgList: { gap: 12, paddingRight: 8 },
  orgCard: { width: 120, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  orgAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  orgAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  orgName: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 2 },
  orgType: { fontSize: 11, color: '#6B7280' },
});
