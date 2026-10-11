import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

type Game = {
  id: number;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
    homeScore?: number;
  awayScore?: number;
};

export default function PredictionsScreen() {
    const [games, setGames] = useState<Game[]>([]);

    const [scores, setScores] = useState<
  Record<number, { home: number; away: number }>
>({});
const [showSaveMessage, setShowSaveMessage] = useState(false);
const [selectedRound, setSelectedRound] = useState(7);
  const changeScore = (
    gameId: number,
    side: 'home' | 'away',
    amount: number
  ) => {
    setScores((current) => {
      const score = current[gameId] || {
        home: 0,
        away: 0,
      };

      return {
        ...current,
        [gameId]: {
          ...score,
          [side]: Math.max(0, score[side] + amount),
        },
      };
    });
  };

 const savePredictions = async () => {
  try {
    await AsyncStorage.setItem(`predictions_${selectedRound}`, JSON.stringify(scores));
    setShowSaveMessage(true);
setTimeout(() => setShowSaveMessage(false), 2000);
  } catch (error) {
    alert('הייתה בעיה בשמירת הניחושים');
  }
}; 
useEffect(() => {
  const loadPredictions = async () => {
    try {
     const saved = await AsyncStorage.getItem(`predictions_${selectedRound}`);

      if (saved) {
        setScores(JSON.parse(saved));
        } else {
  setScores({});
      }
    } catch (error) {
      console.log('בעיה בטעינת הניחושים:', error);
    }
  };

  loadPredictions();
}, [selectedRound]);
useEffect(() => {
  console.log('KEY LOADED:', !!process.env.EXPO_PUBLIC_FOOTBALL_API_KEY);const loadGames = async () => {
    try {
      const response = await fetch(
        'https://v3.football.api-sports.io/fixtures?league=383&season=2024',
        {
          headers: {
            'x-apisports-key':
              process.env.EXPO_PUBLIC_FOOTBALL_API_KEY || '',
          },
        }
      );

      const data = await response.json();

      console.log('API RESPONSE:', data);
    } catch (error) {
      console.log('API ERROR:', error);
    }
  };

  loadGames();
}, []);
useEffect(() => {
  if (selectedRound === 7) {
    setGames([
      {
        id: 701,
        home: 'מכבי חיפה',
        away: 'מכבי תל אביב',
        homeLogo: '',
        awayLogo: '',
        date: '12.10',
        time: '20:00',
      },
      {
        id: 702,
        home: 'הפועל באר שבע',
        away: 'בית"ר ירושלים',
        homeLogo: '',
        awayLogo: '',
        date: '12.10',
        time: '20:30',
      },
      {
        id: 703,
        home: 'הפועל תל אביב',
        away: 'מכבי נתניה',
        homeLogo: '',
        awayLogo: '',
        date: '13.10',
        time: '20:15',
      },
    ]);
    } else if (selectedRound === 6) {
    setGames([
      {
        id: 601,
        home: 'בית"ר ירושלים',
        away: 'מכבי חיפה',
        homeLogo: '',
        awayLogo: '',
        date: '05.10',
        time: '20:00',
homeScore: 2,
awayScore: 1,

      },
      {
        id: 602,
        home: 'מכבי תל אביב',
        away: 'הפועל תל אביב',
        homeLogo: '',
        awayLogo: '',
        date: '05.10',
        time: '20:30',
      },
      {
        id: 603,
        home: 'מכבי נתניה',
        away: 'הפועל באר שבע',
        homeLogo: '',
        awayLogo: '',
        date: '06.10',
        time: '20:15',
      },
    ]);
  } else {
  setGames([]);
}
}, [selectedRound]);
  return (
    <SafeAreaView style={styles.screen}>
      {showSaveMessage && (
  <View style={styles.saveToast}>
    <Text style={styles.saveToastCheck}>✓</Text>
    <Text style={styles.saveToastText}>השינויים נשמרו בהצלחה!</Text>
  </View>
)}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>ניחושים</Text>

          <View style={styles.headerSpace} />
        </View>

        <ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.roundTabs}
>
  {[7, 6, 5, 4, 3, 2, 1].map((round) => (
    <TouchableOpacity
      key={round}
      style={selectedRound === round ? styles.activeRound : styles.round}
      onPress={() => setSelectedRound(round)}
    >
      <Text
        style={
          selectedRound === round
            ? styles.activeRoundText
            : styles.roundText
        }
      >
        מחזור {round}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

        <Text style={styles.dateTitle}>
  {selectedRound === 7 ? '12.10 - 14.10' : selectedRound === 6 ? '05.10 - 06.10' : ''}
</Text>
{selectedRound === 7 && (
        <Text style={styles.instructions}>
          בחרו תוצאה לכל משחק ולחצו שמור ניחושים
        </Text>
        )}
{games.length === 0 && (
  <Text style={styles.instructions}>
    אין משחקים במחזור הזה כרגע
  </Text>
)}
        {games.map((game) => {
          const score = scores[game.id] || {
            home: 0,
            away: 0,
          };

          return (
            <View key={game.id} style={styles.gameCard}>
              <Text style={styles.gameDate}>
                {game.date} | {game.time}
              </Text>

              <View style={styles.matchRow}>
                <View style={styles.team}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.ball}>⚽</Text>
                  </View>

                  <Text style={styles.teamName}>
                    {game.home}
                  </Text>
                </View>

                {selectedRound < 7 &&
game.homeScore !== undefined &&
game.awayScore !== undefined ? (
  <View style={styles.scoreSection}>
    <Text style={styles.score}>{game.homeScore}</Text>
    <Text style={styles.colon}>:</Text>
    <Text style={styles.score}>{game.awayScore}</Text>
  </View>
) : (
  <View style={styles.scoreSection}>
    <View style={styles.scoreBox}>
      <TouchableOpacity
        style={styles.scoreButton}
        onPress={() => changeScore(game.id, 'home', 1)}
      >
        <Text style={styles.plus}>+</Text>
      </TouchableOpacity>

      <Text style={styles.score}>{score.home}</Text>

      <TouchableOpacity
        style={styles.scoreButton}
        onPress={() => changeScore(game.id, 'home', -1)}
      >
        <Text style={styles.minus}>−</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.colon}>:</Text>

    <View style={styles.scoreBox}>
      <TouchableOpacity
        style={styles.scoreButton}
        onPress={() => changeScore(game.id, 'away', 1)}
      >
        <Text style={styles.plus}>+</Text>
      </TouchableOpacity>

      <Text style={styles.score}>{score.away}</Text>

      <TouchableOpacity
        style={styles.scoreButton}
        onPress={() => changeScore(game.id, 'away', -1)}
      >
        <Text style={styles.minus}>−</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

                <View style={styles.team}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.ball}>⚽</Text>
                  </View>

                  <Text style={styles.teamName}>
                    {game.away}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
{selectedRound === 7 && (
        <TouchableOpacity style={styles.saveButton} onPress={savePredictions}>
          <Text style={styles.saveText}>
            שמור ניחושים
          </Text>
        </TouchableOpacity>
)}
        <Text style={styles.bottomText}>
          ניתן לשנות את הניחושים עד תחילת המשחק
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
  },
saveToast: {
  position: 'absolute',
  top: 60,
  left: 18,
  right: 18,
  backgroundColor: '#101512',
  borderWidth: 1.5,
  borderColor: '#00E676',
  borderRadius: 16,
  paddingVertical: 16,
  paddingHorizontal: 18,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  zIndex: 999,
  elevation: 10,
},

saveToastCheck: {
  color: '#00E676',
  fontSize: 24,
  fontWeight: '900',
},

saveToastText: {
  color: 'white',
  fontSize: 16,
  fontWeight: '800',
},
  content: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  backButton: {
    width: 45,
    height: 45,
    justifyContent: 'center',
  },

  backText: {
    color: 'white',
    fontSize: 40,
  },

  headerSpace: {
    width: 45,
  },

  title: {
    color: 'white',
    fontSize: 30,
    fontWeight: '900',
  },

  roundTabs: {
    flexDirection: 'row',
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 5,
  },

  activeRound: {
    width: 115,
    backgroundColor: 'limegreen',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
  },

  activeRoundText: {
    color: 'white',
    fontWeight: '900',
  },

  round: {
    width: 115,
    paddingVertical: 11,
    alignItems: 'center',
  },

  roundText: {
    color: 'white',
    fontWeight: '700',
  },

  dateTitle: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '800',
    marginTop: 20,
  },

  instructions: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 10,
  },

  gameCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 16,
    marginTop: 13,
    borderWidth: 1,
    borderColor: '#303030',
  },

  gameDate: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 15,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  team: {
    flex: 1,
    alignItems: 'center',
  },

  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ball: {
    fontSize: 25,
  },

  teamName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },

  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  scoreBox: {
    width: 48,
    backgroundColor: '#292929',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 5,
  },
scoreButton: {
  width: '100%',
  minHeight: 36,
  alignItems: 'center',
  justifyContent: 'center',
},
  plus: {
    color: 'gray',
    fontSize: 18,
    fontWeight: '800',
  },

  score: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
    marginVertical: 2,
  },

  minus: {
    color: 'gray',
    fontSize: 18,
    fontWeight: '800',
  },

  colon: {
    color: 'white',
    fontSize: 23,
    fontWeight: '900',
  },

  saveButton: {
    backgroundColor: 'limegreen',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 22,
  },

  saveText: {
    color: 'black',
    fontSize: 18,
    fontWeight: '900',
  },

  bottomText: {
    color: 'gray',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});