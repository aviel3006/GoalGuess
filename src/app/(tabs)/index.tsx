import { router, useFocusEffect } from 'expo-router';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../supabase';
import { getCurrentRound } from '../../utils/round-deadline';
// The "איך זה עובד?" button is drawn inside the banner image, so we overlay a
// transparent touch area on it. Coordinates are in the source image's pixels.
const BANNER_IMAGE = { width: 1844, height: 853 };
const HOW_IT_WORKS_BUTTON = { x: 185, y: 545, width: 480, height: 125 };

// Maps the button's image rect to on-screen coordinates for resizeMode="cover".
function howItWorksRect({ width, height }: { width: number; height: number }) {
  const scale = Math.max(
    width / BANNER_IMAGE.width,
    height / BANNER_IMAGE.height
  );
  const offsetX = (width - BANNER_IMAGE.width * scale) / 2;
  const offsetY = (height - BANNER_IMAGE.height * scale) / 2;
  return {
    left: offsetX + HOW_IT_WORKS_BUTTON.x * scale,
    top: offsetY + HOW_IT_WORKS_BUTTON.y * scale,
    width: HOW_IT_WORKS_BUTTON.width * scale,
    height: HOW_IT_WORKS_BUTTON.height * scale,
  };
}

export default function HomeScreen() {
 const [matches, setMatches] = useState<any[]>([]);
 const [bannerSize, setBannerSize] = useState<{
   width: number;
   height: number;
 } | null>(null);
 const [now, setNow] = useState(() => Date.now());

 useFocusEffect(
  useCallback(() => {
    const loadMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('round, kickoff_time, status')
        .order('kickoff_time', { ascending: true });

      if (error) {
        console.log('Error loading matches:', error.message);
        return;
      }

      setMatches(data ?? []);
      setNow(Date.now());
    };

    loadMatches();
  }, [])
 );

 const currentRound = useMemo(() => getCurrentRound(matches, now), [matches, now]);

 // Flip to "closed" exactly when the round's deadline passes
 useEffect(() => {
  if (!currentRound?.isOpen) return;
  const timer = setTimeout(
    () => setNow(Date.now()),
    // Capped because setTimeout fires immediately on delays over ~24 days
    Math.min(Math.max(currentRound.deadline - Date.now(), 0) + 1000, 60 * 60 * 1000)
  );
  return () => clearTimeout(timer);
 }, [currentRound]);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            Goal<Text style={styles.green}>Guess</Text>
          </Text>
          <Text style={styles.subtitle}>מנחשים. צוברים. מנצחים.</Text>
        </View>

        {/* BANNER */}
        <View
          style={styles.bannerArea}
          onLayout={(e) => setBannerSize(e.nativeEvent.layout)}
        >
          <Image
            source={require('../../../assets/images/goalguess-banner-new.png')}
            style={styles.banner}
            resizeMode="cover"
          />
          {bannerSize && (
            <TouchableOpacity
              style={[styles.howItWorks, howItWorksRect(bannerSize)]}
              onPress={() => router.push('/rules')}
              accessibilityRole="button"
              accessibilityLabel="איך זה עובד?"
            />
          )}
        </View>

        {/* CURRENT ROUND */}
        <View style={styles.roundCard}>
          <View style={styles.roundTop}>
            <Text style={styles.roundNumber}>
              {currentRound ? `מחזור ${currentRound.round}` : ''}
            </Text>
            {currentRound && (
              <Text style={currentRound.isOpen ? styles.openText : styles.closedText}>
                {currentRound.isOpen ? 'פתוח לניחושים' : 'הניחושים סגורים'}
              </Text>
            )}
          </View>

          <Text style={styles.roundTitle}>המחזור הקרוב</Text>
          <Text style={styles.roundDescription}>
            נחש את תוצאות המשחקים וצבור נקודות
          </Text>

          <TouchableOpacity
            style={styles.mainButton}
            onPress={() => router.push('/predictions')}
          >
            <Text style={styles.mainButtonText}>לניחושים ⚽</Text>
          </TouchableOpacity>
        </View>

        {/* MENU */}
        <View style={styles.menuRow}>
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/news')}
          >
            <Text style={styles.menuIcon}>📰</Text>
            <Text style={styles.menuTitle}>חדשות</Text>
            <Text style={styles.menuSub}>על הקבוצות שלך</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/world-tables')}
          >
            <Text style={styles.menuIcon}>🌍</Text>
            <Text style={styles.menuTitle}>טבלאות מהעולם</Text>
            <Text style={styles.menuSub}>הליגות הבכירות</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/predictions')}
          >
            <Text style={styles.menuIcon}>⚽</Text>
            <Text style={styles.menuTitle}>ניחושים</Text>
            <Text style={styles.menuSub}>המשחקים שלי</Text>
          </TouchableOpacity>
        </View>

        {/* MY STATS */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>הביצועים שלי</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>נקודות</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>-</Text>
              <Text style={styles.statLabel}>דירוג</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.stat}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>ניחושים נכונים</Text>
            </View>
          </View>
        </View>

        {/* PRIZE */}
        <View style={styles.prizeCard}>
          <Text style={styles.prizeIcon}>🏆</Text>

          <View style={styles.prizeTextArea}>
            <Text style={styles.prizeTitle}>הפרס החודשי</Text>
            <Text style={styles.prizeText}>
              צבור כמה שיותר נקודות וטפס לפסגת הטבלה
            </Text>
          </View>
        </View>
      </ScrollView>
      


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 50,
  },

  header: {
    alignItems: 'center',
    paddingTop: 25,
    paddingBottom: 12,
  },

  logo: {
    color: 'white',
    fontSize: 38,
    fontWeight: '900',
  },

  green: {
    color: 'limegreen',
  },

  subtitle: {
    color: 'lightgray',
    fontSize: 14,
    marginTop: 4,
  },

  bannerArea: {
    width: '110%',
alignSelf: 'center',
    marginTop: 4,
    marginBottom: 18,
    backgroundColor: 'black',
    borderRadius: 18,
    overflow: 'hidden',
  },

  banner: {
    width: '100%',
    height: 145,
  },

  howItWorks: {
    position: 'absolute',
    borderRadius: 999,
  },

  roundCard: {
    backgroundColor: '#151515',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#303030',
  },

  roundTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  roundNumber: {
    color: 'lightgray',
    fontSize: 13,
  },

  openText: {
    color: 'limegreen',
    fontSize: 13,
    fontWeight: '800',
  },

  closedText: {
    color: '#ff4d4d',
    fontSize: 13,
    fontWeight: '800',
  },

  roundTitle: {
    color: 'white',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 18,
  },

  roundDescription: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'right',
    marginTop: 7,
    marginBottom: 18,
  },

  mainButton: {
    backgroundColor: '#00E676',
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainButtonText: {
    color: '#061108',
    fontSize: 17,
    fontWeight: '900',
  },

  menuRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  menuCard: {
    flex: 1,
    minHeight: 120,
    backgroundColor: '#151515',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  menuIcon: {
    fontSize: 25,
    marginBottom: 7,
  },

  menuTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  menuSub: {
    color: '#777777',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  sectionCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#292929',
    padding: 18,
    marginTop: 14,
  },

  sectionTitle: {
    color: 'white',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 18,
  },

  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  stat: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    color: '#00E676',
    fontSize: 24,
    fontWeight: '900',
  },

  statLabel: {
    color: '#999999',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  divider: {
    width: 1,
    height: 38,
    backgroundColor: '#333333',
  },

  prizeCard: {
    backgroundColor: '#101A12',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E542A',
    padding: 18,
    marginTop: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },

  prizeIcon: {
    fontSize: 38,
    marginLeft: 15,
  },

  prizeTextArea: {
    flex: 1,
  },

  prizeTitle: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },

  prizeText: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'right',
  },
});