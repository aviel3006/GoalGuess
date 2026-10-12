import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../hooks/use-session';
import { supabase } from '../supabase';
import { ISRAELI_LEAGUE_LOGO, type NewsTeam } from '../utils/news';
import { teamLogoUrl } from '../utils/world-leagues';

const GREEN = '#00E676';
const BG = '#040A07';

// Used by the choose-teams route (once during onboarding, after the leagues)
// and the edit-teams route (opened from the news screen).
export function TeamPicker({ isEditing }: { isEditing: boolean }) {
  const insets = useSafeAreaInsets();
  const { favoriteTeams } = useSession();

  const [teams, setTeams] = useState<NewsTeam[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<number[]>(() =>
    Array.isArray(favoriteTeams) ? favoriteTeams : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    supabase
      .from('news_teams')
      .select('id, name, image_version')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Load news teams error:', error);
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setTeams(data ?? []);
        // Following every team: show them all as picked
        if (favoriteTeams === 'all') setSelected((data ?? []).map((t) => t.id));
      });
  }, [favoriteTeams]);

  useEffect(load, [load]);

  const toggle = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const allSelected = teams.length > 0 && teams.every((t) => selected.includes(t.id));
  const pickedCount = teams.filter((t) => selected.includes(t.id)).length;

  const save = async () => {
    if (pickedCount === 0 || isSaving) return;

    setIsSaving(true);
    // "all" also covers general league news and teams promoted in later seasons
    const value = allSelected ? 'all' : teams.map((t) => t.id).filter((id) => selected.includes(id));
    const { error } = await supabase.auth.updateUser({ data: { favorite_teams: value } });
    setIsSaving(false);

    if (error) {
      alert('לא הצלחנו לשמור את הבחירה. נסה שוב.');
      return;
    }

    // When onboarding, the root layout sees the saved teams and opens the app
    if (isEditing) router.back();
  };

  const verb = isEditing ? 'שמור' : 'המשך';
  const saveLabel =
    pickedCount === 0
      ? 'בחרו לפחות קבוצה אחת'
      : allSelected
        ? `${verb} · כל הקבוצות`
        : `${verb} (${pickedCount})`;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {isEditing ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarSpace} />
        )}

        <Text style={styles.logo}>
          GOAL<Text style={styles.logoGreen}>GUESS</Text>
        </Text>

        <View style={styles.topBarSpace} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>על אילו קבוצות תרצו לקרוא?</Text>
        <Text style={styles.subtitle}>
          בחרו קבוצות מליגת העל ונציג לכם חדשות רק עליהן. אפשר לשנות בכל רגע ממסך החדשות.
        </Text>

        {loadFailed && (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={48} color="#42624D" />
            <Text style={styles.emptyText}>לא הצלחנו לטעון את הקבוצות</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadFailed && teams.length === 0 && (
          <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
        )}

        {teams.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.allCard, allSelected && styles.allCardSelected]}
              onPress={() => setSelected(allSelected ? [] : teams.map((t) => t.id))}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
              accessibilityLabel="כל הקבוצות"
            >
              <Image source={{ uri: ISRAELI_LEAGUE_LOGO }} style={styles.allLogo} contentFit="contain" />
              <View style={styles.allText}>
                <Text style={styles.allTitle}>כל הקבוצות</Text>
                <Text style={styles.allSubtitle}>כל החדשות מליגת העל</Text>
              </View>
              <View style={[styles.radio, allSelected && styles.radioSelected]}>
                {allSelected && <Ionicons name="checkmark" size={16} color="#04150B" />}
              </View>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>או בחרו קבוצות</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        <View style={styles.grid}>
          {teams.map((team) => {
            const isSelected = selected.includes(team.id);
            return (
              <TouchableOpacity
                key={team.id}
                style={[styles.tile, isSelected && styles.tileSelected]}
                onPress={() => toggle(team.id)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={team.name}
              >
                {isSelected && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#04150B" />
                  </View>
                )}
                <Image
                  source={{ uri: teamLogoUrl(team.id, team.image_version) }}
                  style={styles.tileLogo}
                  contentFit="contain"
                  transition={150}
                />
                <Text style={styles.tileName} numberOfLines={2}>
                  {team.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveButton, pickedCount === 0 && styles.saveButtonDisabled]}
          onPress={save}
          disabled={pickedCount === 0 || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#04150B" />
          ) : (
            <Text style={[styles.saveText, pickedCount === 0 && styles.saveTextDisabled]}>
              {saveLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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

  logo: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  logoGreen: {
    color: GREEN,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'right',
  },

  subtitle: {
    color: '#9AA9A0',
    fontSize: 14,
    textAlign: 'right',
    marginTop: 6,
    lineHeight: 20,
  },

  loader: {
    marginTop: 60,
  },

  allCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1B2620',
    backgroundColor: '#0F1712',
  },

  allCardSelected: {
    borderColor: GREEN,
    backgroundColor: '#0E2117',
  },

  allLogo: {
    width: 44,
    height: 44,
  },

  allText: {
    flex: 1,
  },

  allTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },

  allSubtitle: {
    color: '#7D8F84',
    fontSize: 12,
    marginTop: 3,
    textAlign: 'right',
  },

  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#2A3A30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },

  dividerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    marginBottom: 4,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E2A23',
  },

  dividerText: {
    color: '#7D8F84',
    fontSize: 12,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 12,
  },

  tile: {
    width: '31.5%',
    aspectRatio: 0.86,
    backgroundColor: '#0F1712',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1B2620',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  tileSelected: {
    borderColor: GREEN,
    backgroundColor: '#0E2117',
  },

  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tileLogo: {
    width: 50,
    height: 50,
    marginBottom: 10,
  },

  tileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  empty: {
    alignItems: 'center',
    marginTop: 50,
    gap: 10,
  },

  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  retryButton: {
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 26,
  },

  retryText: {
    color: '#04150B',
    fontWeight: '800',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(4, 10, 7, 0.94)',
  },

  saveButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    backgroundColor: '#24342B',
  },

  saveText: {
    color: '#04150B',
    fontSize: 17,
    fontWeight: '900',
  },

  saveTextDisabled: {
    color: '#7D8F84',
  },
});
