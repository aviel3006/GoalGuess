import { router } from 'expo-router';

import { useEffect, useState } from 'react';
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
export default function HomeScreen() {
 const [matches, setMatches] = useState<any[]>([]);
 useEffect(() => {
  const loadMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_time', { ascending: true });

    if (error) {
      console.log('Error loading matches:', error.message);
      return;
    }

    setMatches(data ?? []);
  };

  loadMatches();
}, []);
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
        <View style={styles.bannerArea}>
          <Image
            source={require('../../../assets/images/goalguess-banner-new.png')}
            style={styles.banner}
            resizeMode="cover"
          />
        </View>

        {/* CURRENT ROUND */}
        <View style={styles.roundCard}>
          <View style={styles.roundTop}>
            <Text style={styles.roundNumber}>מחזור 7</Text>
            <Text style={styles.openText}>פתוח לניחושים</Text>
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
          <TouchableOpacity style={styles.menuCard}>
            <Text style={styles.menuIcon}>📰</Text>
            <Text style={styles.menuTitle}>חדשות</Text>
            <Text style={styles.menuSub}>כל מה שחם</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCard}>
            <Text style={styles.menuIcon}>🏆</Text>
            <Text style={styles.menuTitle}>טבלה</Text>
            <Text style={styles.menuSub}>דירוג שחקנים</Text>
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