import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import {
  ISRAELI_LEAGUE_LOGO,
  publishedAgo,
  type NewsArticle,
  type NewsTeam,
} from '../utils/news';
import { teamLogoUrl } from '../utils/world-leagues';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const BG = '#040A07';
const CARD = '#0D1510';
const MUTED = '#8FA398';
const PAGE_SIZE = 20;

type LoadState = 'loading' | 'error' | 'ready';

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { favoriteTeams } = useSession();
  // A new array on every render, so effects key on this string instead
  const followedKey = Array.isArray(favoriteTeams) ? favoriteTeams.join(',') : 'all';

  const [teams, setTeams] = useState<NewsTeam[]>([]);
  // null shows every followed team together
  const [pickedTeam, setPickedTeam] = useState<number | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const chipsRef = useRef<ScrollView>(null);
  // Ignores answers to requests made before the filter changed
  const requestId = useRef(0);

  useEffect(() => {
    supabase
      .from('news_teams')
      .select('id, name, image_version')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('Load news teams error:', error);
        else setTeams(data ?? []);
      });
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Chips for the teams the user follows, or every team when following them all
  const chipTeams = useMemo(() => {
    if (followedKey === 'all') return teams;
    const followed = followedKey.split(',').map(Number);
    return teams.filter((t) => followed.includes(t.id));
  }, [teams, followedKey]);

  // The picked team may have just been unfollowed on the edit-teams screen
  const activeTeam =
    pickedTeam !== null &&
    (followedKey === 'all' || followedKey.split(',').map(Number).includes(pickedTeam))
      ? pickedTeam
      : null;

  const fetchPage = useCallback(
    (offset: number) => {
      let query = supabase
        .from('news_articles')
        .select('id, title, image, url, source_name, published_at, team_ids')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (activeTeam !== null) {
        query = query.contains('team_ids', [activeTeam]);
      } else if (followedKey !== 'all') {
        query = query.overlaps('team_ids', followedKey.split(',').map(Number));
      }
      return query;
    },
    [activeTeam, followedKey]
  );

  const load = useCallback(() => {
    const id = ++requestId.current;
    return fetchPage(0).then(({ data, error }) => {
      if (id !== requestId.current) return;

      if (error) {
        console.error('Load news error:', error);
        setLoadState((current) => (current === 'ready' ? current : 'error'));
        return;
      }

      setArticles(data ?? []);
      setHasMore((data ?? []).length === PAGE_SIZE);
      setNow(Date.now());
      setLoadState('ready');
    });
  }, [fetchPage]);

  // Runs again when the filter or the followed teams change; the old list stays until the new one lands
  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loadState !== 'ready') return;
    setLoadingMore(true);
    const id = requestId.current;
    const { data, error } = await fetchPage(articles.length);
    setLoadingMore(false);
    if (id !== requestId.current || error) return;

    setArticles((current) => {
      // The sync job may have added articles since, shifting the pages
      const seen = new Set(current.map((a) => a.id));
      return [...current, ...(data ?? []).filter((a) => !seen.has(a.id))];
    });
    setHasMore((data ?? []).length === PAGE_SIZE);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Keeps "X minutes ago" current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const openArticle = (article: NewsArticle) => {
    openBrowserAsync(article.url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      toolbarColor: BG,
      controlsColor: GREEN,
    });
  };

  // Logos of the teams an article is about, the active filter's team first
  const articleTeams = (article: NewsArticle) =>
    article.team_ids
      .slice()
      .sort((a, b) => (a === activeTeam ? -1 : b === activeTeam ? 1 : 0))
      .map((id) => teamsById.get(id))
      .filter((t): t is NewsTeam => !!t)
      .slice(0, 3);

  const renderMeta = (article: NewsArticle, light = false) => (
    <View style={styles.meta}>
      {articleTeams(article).map((team) => (
        <Image
          key={team.id}
          source={{ uri: teamLogoUrl(team.id, team.image_version) }}
          style={styles.metaLogo}
          contentFit="contain"
        />
      ))}
      <Text style={[styles.metaText, light && styles.metaTextLight]} numberOfLines={1}>
        {article.source_name ? `${article.source_name} · ` : ''}
        {publishedAgo(article.published_at, now)}
      </Text>
    </View>
  );

  const renderArticle = ({ item, index }: { item: NewsArticle; index: number }) => {
    // The newest story leads with a big picture
    if (index === 0 && item.image) {
      return (
        <TouchableOpacity
          style={styles.hero}
          activeOpacity={0.9}
          onPress={() => openArticle(item)}
          accessibilityRole="link"
        >
          <Image source={{ uri: item.image }} style={styles.heroImage} contentFit="cover" transition={200} />
          <View style={styles.heroShade} />
          <View style={styles.heroBody}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>הכי חדש</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={3}>
              {item.title}
            </Text>
            {renderMeta(item, true)}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => openArticle(item)}
        accessibilityRole="link"
      >
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {item.title}
          </Text>
          {renderMeta(item)}
        </View>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cardImage, styles.cardImageEmpty]}>
            <Text style={styles.cardImageBall}>⚽</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderChip = (key: string, label: string, logo: string, isActive: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, isActive && styles.chipSelected]}
      onPress={onPress}
    >
      <Image source={{ uri: logo }} style={styles.chipLogo} contentFit="contain" />
      <Text style={[styles.chipText, isActive && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} hitSlop={10}>
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>חדשות 📰</Text>

        <TouchableOpacity
          onPress={() => router.push('/edit-teams')}
          hitSlop={10}
          accessibilityLabel="בחירת קבוצות"
        >
          <Ionicons name="options-outline" size={24} color={GREEN} />
        </TouchableOpacity>
      </View>

      {/* Following a single team needs no filter */}
      {chipTeams.length > 1 && (
        <ScrollView
          ref={chipsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
          // Chips run right to left, so start scrolled to the right edge
          onContentSizeChange={() => chipsRef.current?.scrollToEnd({ animated: false })}
        >
          {renderChip(
            'all',
            followedKey === 'all' ? 'הכל' : 'הקבוצות שלי',
            ISRAELI_LEAGUE_LOGO,
            activeTeam === null,
            () => setPickedTeam(null)
          )}
          {chipTeams.map((team) =>
            renderChip(
              String(team.id),
              team.name,
              teamLogoUrl(team.id, team.image_version),
              activeTeam === team.id,
              () => setPickedTeam(team.id)
            )
          )}
        </ScrollView>
      )}

      {loadState === 'loading' && (
        <ActivityIndicator size="large" color={GREEN} style={styles.loader} />
      )}

      {loadState === 'error' && (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color="#42624D" />
          <Text style={styles.emptyTitle}>לא הצלחנו לטעון את החדשות</Text>
          <Text style={styles.emptySubtitle}>בדוק את החיבור לאינטרנט ונסה שוב</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      )}

      {loadState === 'ready' && (
        <FlatList
          data={articles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderArticle}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={GREEN}
              colors={[GREEN]}
            />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={GREEN} style={styles.footerLoader} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={52} color="#42624D" />
              <Text style={styles.emptyTitle}>אין כרגע חדשות</Text>
              <Text style={styles.emptySubtitle}>
                {activeTeam !== null
                  ? 'עדיין לא פורסמו כתבות על הקבוצה הזו'
                  : 'עדיין לא פורסמו כתבות על הקבוצות שבחרת'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => router.push('/edit-teams')}>
                <Text style={styles.retryText}>שינוי קבוצות</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
    paddingBottom: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  loader: {
    marginTop: 80,
  },

  chipsScroll: {
    flexGrow: 0,
  },

  chips: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#101814',
    borderWidth: 1,
    borderColor: '#1E2A23',
  },

  chipSelected: {
    backgroundColor: '#0E2117',
    borderColor: GREEN,
  },

  chipLogo: {
    width: 20,
    height: 20,
  },

  chipText: {
    color: '#C9D3CD',
    fontSize: 13,
    fontWeight: '700',
  },

  chipTextSelected: {
    color: GREEN,
  },

  list: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 12,
  },

  hero: {
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD,
  },

  heroImage: {
    ...StyleSheet.absoluteFill,
  },

  heroShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.92))',
  },

  heroBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 8,
  },

  heroBadge: {
    alignSelf: 'flex-end',
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },

  heroBadgeText: {
    color: '#04150B',
    fontSize: 11,
    fontWeight: '900',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 27,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 8,
  },

  card: {
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#18241D',
  },

  cardBody: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 21,
  },

  cardImage: {
    width: 104,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#16211B',
  },

  cardImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardImageBall: {
    fontSize: 28,
  },

  meta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },

  metaLogo: {
    width: 18,
    height: 18,
  },

  metaText: {
    flexShrink: 1,
    color: MUTED,
    fontSize: 12,
    textAlign: 'right',
    marginRight: 2,
  },

  metaTextLight: {
    color: '#D5DED8',
  },

  footerLoader: {
    marginVertical: 16,
  },

  empty: {
    alignItems: 'center',
    marginTop: 70,
    paddingHorizontal: 30,
    gap: 8,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },

  emptySubtitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 10,
    backgroundColor: GREEN,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 26,
  },

  retryText: {
    color: '#04150B',
    fontWeight: '800',
  },
});
