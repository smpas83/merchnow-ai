import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, apiCall } from '../../../src/auth';

export default function WorkerJobDetail() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [proof, setProof] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'checkin' | 'proof'>('details');
  const [showingCheckin, setShowingCheckin] = useState(false);
  const [showingProof, setShowingProof] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);

  const loadData = async () => {
    if (!jobId) return;
    try {
      const [jRes, tRes, cRes, pRes] = await Promise.all([
        apiCall(`/jobs/${jobId}`),
        apiCall(`/tasks/job/${jobId}`),
        apiCall(`/checkins/job/${jobId}`),
        apiCall(`/proof/job/${jobId}`),
      ]);
      setJob(jRes);
      setTasks(tRes);
      setCheckins(cRes);
      setProof(pRes);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) loadData();
  }, [jobId]);

  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      // Simulate check-in (in real app would use expo-location)
      const result = await apiCall('/checkins/job/' + jobId, {
        method: 'POST',
        body: JSON.stringify({
          latitude: 37.78,
          longitude: -122.41,
          accuracy: 50,
          location_note: 'Store location',
        }),
      });
      setCheckins((prev: any[]) => [{ id: result.id, ...result }, ...prev]);
      setJob((prev: any) => prev ? { ...prev, status: result.status } : null);
      setShowingCheckin(false);
      Alert.alert('Checked In', 'You have successfully checked in at this location.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSubmitProof = async () => {
    setSubmittingProof(true);
    try {
      const result = await apiCall('/proof', {
        method: 'POST',
        body: JSON.stringify({
          job_id: jobId,
          type: 'photo',
          caption: 'Proof of work completed',
        }),
      });
      setProof(prev => [{ id: result.id, ...result }, ...prev]);
      setShowingProof(false);
      Alert.alert('Proof Uploaded', 'Your proof has been submitted for review.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await apiCall(`/tasks/complete/${taskId}`, { method: 'POST' });
      setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, is_completed: true } : t));
      Alert.alert('Task Complete', 'Task has been marked as completed.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSubmitWork = async () => {
    Alert.alert(
      'Submit Work',
      'Are you sure you want to submit this job for review?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: async () => {
          try {
            await apiCall(`/jobs/${jobId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'submitted' }),
            });
            loadData();
            Alert.alert('Submitted', 'Your work has been submitted for review.');
          } catch (e: any) { Alert.alert('Error', e.message); }
        }},
      ]
    );
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>;
  if (!job || !user) return null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}>
        {/* Job Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(job.status) }]}>
              <Text style={styles.statusText}>{job.status.replace('_', ' ')}</Text>
            </View>
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>{job.priority.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobDesc}>{job.description || 'No description'}</Text>

          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📍</Text>
              <View>
                <Text style={styles.metaLabel}>Store</Text>
                <Text style={styles.metaValue}>{job.store_name || 'Unknown'}</Text>
                {job.store_address && <Text style={styles.metaSubtext}>{job.store_address}</Text>}
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>💰</Text>
              <View>
                <Text style={styles.metaLabel}>Pay</Text>
                <Text style={styles.metaValue}>
                  {job.pricing_type === 'fixed' ? `$${job.base_price?.toFixed(2) || '0.00'}` : `$${job.hourly_rate?.toFixed(2) || '0.00'}/hr`}
                </Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱️</Text>
              <View>
                <Text style={styles.metaLabel}>Est. Time</Text>
                <Text style={styles.metaValue}>{job.estimated_duration_minutes || '?'} min</Text>
              </View>
            </View>
          </View>

          {job.instructions && (
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsLabel}>📋 Instructions</Text>
              <Text style={styles.instructionsText}>{job.instructions}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsCard}>
          {job.status === 'assigned' && (
            <TouchableOpacity style={styles.actionButton} onPress={async () => {
              try {
                await apiCall(`/jobs/${jobId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
                loadData();
              } catch (e: any) { Alert.alert('Error', e.message); }
            }}>
              <Text style={styles.actionIcon}>✓</Text>
              <Text style={styles.actionText}>Accept Job</Text>
            </TouchableOpacity>
          )}

          {['accepted', 'en_route'].includes(job.status) && (
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowingCheckin(true)}>
              <Text style={styles.actionIcon}>📍</Text>
              <Text style={styles.actionText}>Check In</Text>
            </TouchableOpacity>
          )}

          {['checked_in', 'in_progress'].includes(job.status) && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleSubmitWork()}>
              <Text style={styles.actionIcon}>📤</Text>
              <Text style={styles.actionText}>Submit Work</Text>
            </TouchableOpacity>
          )}

          {['checked_in', 'in_progress'].includes(job.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={() => setShowingProof(true)}>
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={[styles.actionText, styles.actionTextSecondary]}>Upload Proof</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['details', 'tasks', 'checkin', 'proof'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'details' ? 'Details' : tab === 'tasks' ? `Tasks (${tasks.length})` : tab === 'checkin' ? `Check-in (${checkins.length})` : `Proof (${proof.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scope of Work</Text>
            <Text style={styles.cardText}>{job.scope_of_work || 'Not specified'}</Text>
            <Text style={styles.cardTitle}>Requirements</Text>
            <Text style={styles.cardText}>{job.requirements || 'None specified'}</Text>
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Task Checklist</Text>
            {tasks.length === 0 ? (
              <Text style={styles.emptyText}>No tasks defined for this job.</Text>
            ) : (
              tasks.map((t: any) => (
                <View key={t.id} style={styles.taskItem}>
                  <View style={styles.taskCheckbox}>
                    <TouchableOpacity onPress={() => handleCompleteTask(t.id)}>
                      <View style={[styles.checkbox, t.is_required ? styles.checkboxRequired : null]}>
                        <Text style={styles.checkboxText}>{t.is_required ? '✓' : '○'}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle}>{t.title}</Text>
                    <Text style={styles.taskDesc}>{t.description || 'No description'}</Text>
                    <View style={styles.taskMeta}>
                      {t.category && <Text style={styles.taskCategory}>{t.category}</Text>}
                      {t.proof_type && <Text style={styles.proofType}>Proof: {t.proof_type}</Text>}
                      {t.is_required ? <Text style={styles.requiredTag}>Required</Text> : <Text style={styles.optionalTag}>Optional</Text>}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'checkin' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Check-in History</Text>
            {checkins.length === 0 ? (
              <Text style={styles.emptyText}>No check-ins recorded.</Text>
            ) : (
              checkins.map((c: any) => (
                <View key={c.id} style={styles.checkinItem}>
                  <Text style={styles.checkinIcon}>📍</Text>
                  <View>
                    <Text style={styles.checkinCoords}>Lat: {c.latitude?.toFixed(4)}, Lng: {c.longitude?.toFixed(4)}</Text>
                    <Text style={styles.checkinMeta}>
                      {c.accuracy && `Accuracy: ±${c.accuracy}m`}
                      {c.location_note && ` · ${c.location_note}`}
                      <Text style={styles.checkinTime}> · {new Date(c.created_at).toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'proof' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Proof of Work</Text>
            {proof.length === 0 ? (
              <Text style={styles.emptyText}>No proof uploaded yet.</Text>
            ) : (
              proof.map((p: any) => (
                <View key={p.id} style={styles.proofItem}>
                  <Text style={styles.proofIcon}>{p.type === 'photo' ? '📷' : p.type === 'video' ? '🎬' : '📝'}</Text>
                  <View>
                    <Text style={styles.proofCaption}>{p.caption || 'No caption'}</Text>
                    <Text style={styles.proofMeta}>{p.type} · {new Date(p.uploaded_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Check-in Modal */}
      {showingCheckin && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Check In</Text>
            <Text style={styles.modalText}>
              In a production app, this would use your device's GPS to verify your location at the store.
              For demo purposes, check-in is simulated.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowingCheckin(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleCheckin} disabled={checkingIn}>
                {checkingIn ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalButtonText}>Check In Now</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Proof Modal */}
      {showingProof && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Proof</Text>
            <Text style={styles.modalText}>
              Upload photos or notes as proof of work completed. Multiple photos can be attached.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowingProof(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSubmitProof} disabled={submittingProof}>
                {submittingProof ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalButtonText}>Upload Proof</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  headerCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  priorityBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { color: '#D97706', fontSize: 10, fontWeight: '700' },
  jobTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  jobDesc: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  headerMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metaIcon: { fontSize: 20, marginRight: 8 },
  metaLabel: { fontSize: 10, color: '#6B7280', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  metaSubtext: { fontSize: 12, color: '#6B7280' },
  instructionsCard: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginTop: 4 },
  instructionsLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  instructionsText: { fontSize: 13, color: '#6B7280' },
  actionsCard: { marginHorizontal: 16, marginBottom: 16, gap: 10 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12, gap: 8 },
  actionButtonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  actionTextSecondary: { color: '#374151' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#8B5CF6' },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  cardText: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 20 },
  taskItem: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  taskCheckbox: { marginRight: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  checkboxRequired: { borderColor: '#8B5CF6' },
  checkboxText: { fontSize: 14, color: '#8B5CF6' },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: '#111827' },
  taskDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  taskMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  taskCategory: { fontSize: 11, color: '#3B82F6', backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  proofType: { fontSize: 11, color: '#8B5CF6', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  requiredTag: { fontSize: 11, color: '#EF4444', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  optionalTag: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  checkinItem: { flexDirection: 'row', paddingVertical: 8, gap: 12 },
  checkinIcon: { fontSize: 20 },
  checkinCoords: { fontSize: 13, color: '#111827', fontWeight: '500' },
  checkinMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  checkinTime: { fontWeight: '500' },
  proofItem: { flexDirection: 'row', paddingVertical: 8, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  proofIcon: { fontSize: 24 },
  proofCaption: { fontSize: 13, color: '#111827', fontWeight: '500' },
  proofMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonSecondary: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
