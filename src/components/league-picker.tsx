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
import { leagueLogoUrl, type WorldLeague } from '../utils/world-leagues';

const GREEN = '#00E676';
const BG = '#040A07';

type LeagueOption = Pick<WorldLeague, 'id' | 'name' | 'country' | 'image_version'>;

// Used by the choose-leagues route (once after signing in, before the home screen)
// and the edit-leagues route (opened from the world tables screen).
export function LeaguePicker({ isEditing }: { isEditing: boolean }) {
  const insets = useSafeAreaInsets();
  const { favoriteLeagues } = useSession();

  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<number[]>(() => favoriteLeagues ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    supabase
      .from('world_leagues')
      .select('id, name, country, image_version')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          console.error('Load world leagues error:', error);
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setLeagues(data ?? []);
      });
  }, []);

  useEffect(load, [load]);

  const retry = () => {
    setLoadFailed(false);
    load();
  };

  const toggle = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const allSelected = leagues.length > 0 && selected.length === leagues.length;

  const save = async () => {
    if (selected.length === 0 || isSaving) return;

    setIsSaving(true);
    // Kept in the list's order so the categories on the tables screen follow it
    const ids = leagues.map((l) => l.id).filter((id) => selected.includes(id));
    const { error } = await supabase.auth.updateUser({ data: { favorite_leagues: ids } });
    setIsSaving(false);

    if (error) {
      alert('לא הצלחנו לשמור את הבחירה. נסה שוב.');
      return;
    }

    // When onboarding, the root layout sees the saved leagues and opens the app
    if (isEditing) router.back();
  };

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
        <Text style={styles.title}>אילו ליגות מעניינות אותך?</Text>
        <Text style={styles.subtitle}>
          בחרו את הליגות שתרצו לעקוב אחרי הטבלאות שלהן. אפשר לשנות בכל רגע.
        </Text>

        {leagues.length > 0 && (
          <TouchableOpacity
            style={styles.selectAll}
            onPress={() => setSelected(allSelected ? [] : leagues.map((l) => l.id))}
          >
            <Text style={styles.selectAllText}>{allSelected ? 'נקה הכל' : 'בחר הכל'}</Text>
          </TouchableOpacity>
        )}

        {loadFailed && (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={48} color="#42624D" />
            <Text style={styles.emptyText}>לא הצלחנו לטעון את הליגות</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryText}>נסה שוב</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadFailed && leagues.length === 0 && (
          <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
        )}

        <View style={styles.grid}>
          {leagues.map((league) => {
            const isSelected = selected.includes(league.id);
            return (
              <TouchableOpacity
                key={league.id}
                style={[styles.tile, isSelected && styles.tileSelected]}
                onPress={() => toggle(league.id)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={league.name}
              >
                {isSelected && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#04150B" />
                  </View>
                )}
                <Image
                  source={{ uri: leagueLogoUrl(league.id, league.image_version) }}
                  style={styles.tileLogo}
                  contentFit="contain"
                  transition={150}
                />
                <Text style={styles.tileName} numberOfLines={1}>
                  {league.name}
                </Text>
                <Text style={styles.tileCountry} numberOfLines={1}>
                  {league.country}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveButton, selected.length === 0 && styles.saveButtonDisabled]}
          onPress={save}
          disabled={selected.length === 0 || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#04150B" />
          ) : (
            <Text style={[styles.saveText, selected.length === 0 && styles.saveTextDisabled]}>
              {selected.length === 0
                ? 'בחרו לפחות ליגה אחת'
                : isEditing
                  ? `שמור (${selected.length})`
                  : `המשך (${selected.length})`}
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

  selectAll: {
    alignSelf: 'flex-end',
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2A3A30',
  },

  selectAllText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },

  loader: {
    marginTop: 60,
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
    aspectRatio: 0.82,
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
    width: 52,
    height: 52,
    marginBottom: 10,
  },

  tileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  tileCountry: {
    color: '#7D8F84',
    fontSize: 11,
    marginTop: 2,
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
