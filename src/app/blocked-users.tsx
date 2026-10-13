import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBlockedUsers, unblockUser } from '../utils/moderation';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const BG = '#040A07';
const CARD = 'rgba(12, 22, 16, 0.94)';
const CARD_BORDER = '#1B3626';
const MUTED = '#8FA398';

type BlockedUser = { user_id: string; username: string | null };

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await getBlockedUsers());
      setFailed(false);
    } catch (error) {
      console.error('Load blocked users error:', error);
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unblock = (user: BlockedUser) => {
    Alert.alert(`לבטל את החסימה של ${user.username ?? 'המשתמש'}?`, 'השם והתמונה שלו יחזרו להופיע בטבלאות.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'בטל חסימה',
        onPress: async () => {
          try {
            await unblockUser(user.user_id);
            setUsers((current) => current?.filter((u) => u.user_id !== user.user_id) ?? null);
          } catch (error) {
            console.error('Unblock error:', error);
            Alert.alert('שגיאה', 'לא הצלחנו לבטל את החסימה. נסה שוב.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="חזרה">
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>משתמשים חסומים</Text>
        <View style={styles.topBarSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        {users === null && !failed && (
          <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
        )}

        {failed && users === null && (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={48} color="#42624D" />
            <Text style={styles.emptyText}>לא הצלחנו לטעון את הרשימה</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {users?.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#42624D" />
            <Text style={styles.emptyText}>לא חסמת אף אחד</Text>
            <Text style={styles.emptyHint}>
              כדי לחסום משתמש, לוחצים על השורה שלו בטבלה
            </Text>
          </View>
        )}

        {!!users?.length && (
          <View style={styles.card}>
            {users.map((user, index) => (
              <View
                key={user.user_id}
                style={[styles.row, index < users.length - 1 && styles.rowBorder]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="ban-outline" size={18} color="#FF5A5F" />
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {user.username ?? 'משתמש'}
                </Text>
                <TouchableOpacity style={styles.unblockButton} onPress={() => unblock(user)}>
                  <Text style={styles.unblockText}>בטל חסימה</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topBarSpace: {
    width: 25,
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  loader: {
    marginTop: 60,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#17271E',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  unblockButton: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unblockText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyHint: {
    color: MUTED,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    color: '#002710',
    fontSize: 14,
    fontWeight: '900',
  },
});
