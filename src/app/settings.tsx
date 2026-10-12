import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../hooks/use-session';
import { confirmSignOut } from '../utils/sign-out';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const BG = '#040A07';
const CARD = 'rgba(12, 22, 16, 0.94)';
const CARD_BORDER = '#1B3626';
const MUTED = '#8FA398';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function countLabel(count: number, one: string, many: string) {
  return count === 1 ? `${one} אחת` : `${count} ${many}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { session, favoriteLeagues, favoriteTeams } = useSession();

  const leaguesValue = favoriteLeagues ? countLabel(favoriteLeagues.length, 'ליגה', 'ליגות') : '';
  const teamsValue =
    favoriteTeams === 'all'
      ? 'כל הקבוצות'
      : favoriteTeams
        ? countLabel(favoriteTeams.length, 'קבוצה', 'קבוצות')
        : '';
  const version = Constants.expoConfig?.version ?? '';

  const open = (href: Href) => () => router.push(href);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="חזרה">
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>הגדרות</Text>
        <View style={styles.topBarSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      >
        <Section title="חשבון">
          <Row icon="person" label="עריכת פרופיל" onPress={open('/edit-profile')} />
          <Row icon="key" label="שינוי סיסמה" onPress={open('/change-password')} />
          <Row icon="mail" label="אימייל" value={session?.user.email ?? ''} last />
        </Section>

        <Section title="תוכן">
          <Row
            icon="globe"
            label="ליגות בטבלאות העולם"
            value={leaguesValue}
            onPress={open('/edit-leagues')}
          />
          <Row
            icon="newspaper"
            label="קבוצות בחדשות"
            value={teamsValue}
            onPress={open('/edit-teams')}
            last
          />
        </Section>

        <Section title="מידע">
          <Row icon="book" label="חוקי המשחק" onPress={open('/rules')} />
          <Row icon="information-circle" label="גרסה" value={version} last />
        </Section>

        <View style={styles.section}>
          <View style={styles.card}>
            <Row icon="log-out-outline" label="התנתקות" onPress={confirmSignOut} danger last />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// Without onPress the row is informational: no chevron, not tappable
function Row({
  icon,
  label,
  value,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IoniconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? '#FF5A5F' : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? color : GREEN} />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
      {!!value && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-back" size={18} color="#C9D4CE" />}
    </TouchableOpacity>
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
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 8,
    marginRight: 4,
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
    backgroundColor: '#13281C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: {
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  value: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '50%',
  },
});
