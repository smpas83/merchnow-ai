import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, apiCall } from '../../src/auth';

export default function WorkerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<any>(null);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  const [ refreshed, setRefreshed ] = useState(false);
  const loadData = async () => {
    try {
      const [jRes, aRes, availRes] = await Promise.all([
        apiCall('/jobs'),
        apiCall('/dispatch/available-jobs'),
        apiCall('/dispatch/worker-availability'),
      ]);
      setJobs(jRes);
      setAvailableJobs(aRes);
      setAvailability(availRes);
    } catch (e: any) {
      if (e.message !== 'Only workers can view available jobs') {
        // May be unauthorized - that's ok
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAccept = async (jobId: string) => {
    setAcceptingJobId(jobId);
    try {
      const assignments = await apiCall('/assignments');
      const pendingAssign = assignments.find((a: any) => a.job_id === jobId && a.status === 'pending');
      if (pendingAssign) {
        await apiCall(`/assignments/${pendingAssign.id}/accept`, { method: 'POST' });
        Alert.alert('Job Accepted', 'You have accepted this job. Navigate to the store to begin.');
        loadData().finally(() => setRefreshed(false));
      } else {
        Alert.alert('Not Available', 'This job is not assigned to you.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAcceptingJobId(null);
    }
  };

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
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user.first_name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}>
        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <View style={styles.availRow}>
            <View>
              <Text style={styles.availTitle}>Your Availability</Text>
              <Text style={styles.availStatus}>
                {availability?.isAvailable ? 'You are currently available for work' : 'You are currently unavailable'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.availToggle, availability?.isAvailable ? styles.availToggleOn : styles.availToggleOff]}
              onPress={async () => {
                try {
                  if (availability?.isAvailable) {
                    await apiCall('/dispatch/worker-availability', { method: 'DELETE' });
                  } else {
                    await apiCall('/dispatch/worker-availability', { method: 'POST' });
                  }
                  loadData().finally(() => setRefreshed(false));
                } catch (e: any) { Alert.alert('Error', e.message); }
              }}
            >
              <View style={[styles.availToggleInner, availability?.isAvailable ? styles.availToggleInnerOn : styles.availToggleInnerOff]} />
            </TouchableOpacity>
          </View>
          {availability && (
            <View style={styles.availStats}>
              <Text style={styles.availStat}>💰 ${availability.hourlyRate}/hr</Text>
              <Text style={styles.availStat}>📊 {availability.totalJobsCompleted} jobs done</Text>
              <Text style={styles.availStat}>⭐ {availability.avgRating?.toFixed(1) || 'N/A'} rating</Text>
            </View>
          )}
        </View>

        {/* My Assigned Jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Assigned Jobs</Text>
          {loading ? (
            <ActivityIndicator style={styles.loader} color="#8B5CF6" />
          ) : jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No jobs assigned</Text>
              <Text style={styles.emptySubtext}>Make yourself available to receive job offers</Text>
            </View>
          ) : (
            <FlatList
              data={jobs.filter((j: any) => j.assigned_worker_id === user?.id || j.status !== 'created')}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.jobCard} onPress={() => router.push(`/(worker)/job/${item.id}`)}>
                  <View style={styles.jobCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                    </View>
                    {item.priority === 'high' || item.priority === 'urgent' && (
                      <Text style={styles.urgentBadge}>{item.priority.toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles.jobTitle}>{item.title}</Text>
                  <Text style={styles.jobDesc}>{item.description || 'No description'}</Text>
                  <View style={styles.jobMeta}>
                    <Text style={styles.metaText}>📍 {item.store_name || 'Unknown'}</Text>
                    <Text style={styles.metaText}>💰 ${item.base_price?.toFixed(2) || (item.hourly_rate ? `$${item.hourly_rate}/hr` : '?')}</Text>
                  </View>
                  {item.status === 'assigned' && (
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAccept(item.id)}
                      disabled={acceptingJobId === item.id}
                    >
                      {acceptingJobId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept Job</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.jobList}
            />
          )}
        </View>

        {/* Available Jobs */}
        {availableJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Jobs</Text>
            <FlatList
              data={availableJobs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.jobCard} onPress={() => router.push(`/(worker)/job/${item.id}`)}>
                  <View style={styles.jobCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                    </View>
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                  <Text style={styles.jobTitle}>{item.title}</Text>
                  <Text style={styles.jobDesc}>{item.description || 'No description'}</Text>
                  <View style={styles.jobMeta}>
                    <Text style={styles.metaText}>🏢 {item.organization_name || 'Unknown'}</Text>
                    <Text style={styles.metaText}>📍 {item.store_name || 'Unknown'}</Text>
                    <Text style={styles.metaText}>💰 ${item.base_price?.toFixed(2) || '?'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item.id)}
                    disabled={acceptingJobId === item.id}
                  >
                    {acceptingJobId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept Job</Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.jobList}
            />
          </View>
        )}
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
  availabilityCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  availTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  availStatus: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  availToggle: { width: 52, height: 28, borderRadius: 14 },
  availToggleOn: { backgroundColor: '#10B981' },
  availToggleOff: { backgroundColor: '#D1D5DB' },
  availToggleInner: { position: 'absolute', top: 2, left: 2, width: 24, height: 24, borderRadius: 12 },
  availToggleInnerOn: { backgroundColor: '#fff', transform: [{ translateX: 24 }] },
  availToggleInnerOff: { backgroundColor: '#fff' },
  availStats: { flexDirection: 'row', gap: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  availStat: { fontSize: 12, color: '#374151' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
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
  priorityText: { fontSize: 11, color: '#6B7280' },
  urgentBadge: { fontSize: 10, color: '#EF4444', fontWeight: '700' },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  jobDesc: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  jobMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#374151' },
  acceptButton: { marginTop: 12, backgroundColor: '#8B5CF6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  acceptButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
