import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function RulesScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>⚽ איך זה עובד?</Text>

        <Text style={styles.subtitle}>
          מנחשים תוצאות, צוברים נקודות ומטפסים בדירוג! 🏆
        </Text>
        <View style={{ width: '100%', marginTop: 32, gap: 12 }}>
  <Text style={{
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 6,
  }}>
    ⚽ איך משחקים?
  </Text>

  {[
    {
      number: '01',
      emoji: '📅',
      title: 'בוחרים משחקים',
      description: 'בוחרים משחק מתוך רשימת המשחקים הקרובים.',
    },
    {
      number: '02',
      emoji: '🎯',
      title: 'מנחשים תוצאה',
      description: 'מנחשים את התוצאה המדויקת לפני תחילת המשחק.',
    },
    {
      number: '03',
      emoji: '🏆',
      title: 'צוברים נקודות',
      description: 'אחרי סיום המשחק מקבלים נקודות לפי הניחוש.',
    },
    {
      number: '04',
      emoji: '📈',
      title: 'מטפסים בדירוג',
      description: 'מתחרים בדירוג העולמי ובליגות עם חברים.',
    },
  ].map((step) => (
    <View
      key={step.number}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: '#0B211A',
        borderColor: '#176B45',
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 30 }}>{step.emoji}</Text>

      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{
          color: '#58F49A',
          fontSize: 17,
          fontWeight: '800',
          textAlign: 'right',
        }}>
          {step.title}
        </Text>
        <Text style={{
          color: '#B8D4C5',
          fontSize: 13,
          marginTop: 5,
          textAlign: 'right',
        }}>
          {step.description}
        </Text>
      </View>

      <Text style={{
        color: '#58F49A',
        fontSize: 21,
        fontWeight: '900',
      }}>
        {step.number}
      </Text>
    </View>
  ))}
</View>
        <View style={styles.pointsSection}>
  <Text style={styles.sectionTitle}>🏆 שיטת הניקוד</Text>

  <View style={[styles.pointsCard, styles.exactCard]}>
    <Text style={styles.pointsEmoji}>🎯</Text>
    <View style={styles.pointsInfo}>
      <Text style={styles.pointsTitle}>תוצאה מדויקת</Text>
      <Text style={styles.pointsDescription}>
        ניחשת את התוצאה בדיוק? כל הכבוד!
      </Text>
    </View>
    <Text style={[styles.pointsNumber, { color: '#4ADE80' }]}>+5</Text>
  </View>

  <View style={[styles.pointsCard, styles.winnerCard]}>
    <Text style={styles.pointsEmoji}>⚽</Text>
    <View style={styles.pointsInfo}>
      <Text style={styles.pointsTitle}>מנצחת או תיקו נכונים</Text>
      <Text style={styles.pointsDescription}>
        צדקת בתוצאה הכללית, אבל לא במספר השערים
      </Text>
    </View>
    <Text style={[styles.pointsNumber, { color: '#60A5FA' }]}>+3</Text>
  </View>

  <View style={[styles.pointsCard, styles.wrongCard]}>
    <Text style={styles.pointsEmoji}>❌</Text>
    <View style={styles.pointsInfo}>
      <Text style={styles.pointsTitle}>ניחוש שגוי</Text>
      <Text style={styles.pointsDescription}>
        לא נורא! במשחק הבא תצליח יותר
      </Text>
    </View>
    <Text style={[styles.pointsNumber, { color: '#FB7185' }]}>0</Text>
  </View>
</View>
<View style={{
  width: '100%',
  marginTop: 28,
  padding: 16,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: '#176B45',
  backgroundColor: '#081C16',
  gap: 12,
}}>
  <Text style={{
    color: '#58F49A',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  }}>
    💡 דגשים חשובים
  </Text>

  {[
    {
      emoji: '🔒',
      title: 'נעילת ניחושים',
      description: 'ברגע שהמשחק מתחיל, הניחוש ננעל ולא ניתן לשנות אותו.',
    },
    {
      emoji: '⏰',
      title: 'שינוי ניחוש',
      description: 'אפשר לשנות את הניחוש עד תחילת המשחק.',
    },
    {
      emoji: '🏁',
      title: 'עדכון נקודות',
      description: 'הנקודות מתעדכנות לאחר סיום המשחק.',
    },
    {
      emoji: '🌍',
      title: 'דירוגים וליגות',
      description: 'הנקודות נספרות גם בדירוג העולמי וגם בליגות החברים.',
    },
  ].map((item) => (
    <View
      key={item.title}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: '#10251F',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#25473A',
        padding: 14,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 29 }}>{item.emoji}</Text>

      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '800',
          textAlign: 'right',
        }}>
          {item.title}
        </Text>

        <Text style={{
          color: '#B8D4C5',
          fontSize: 13,
          lineHeight: 21,
          marginTop: 5,
          textAlign: 'right',
        }}>
          {item.description}
        </Text>
      </View>
    </View>
  ))}
</View>
<View
  style={{
    width: '100%',
    marginTop: 24,
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#29D86D',
    backgroundColor: '#073820',
    alignItems: 'center',
  }}
>
  <Text style={{ fontSize: 48 }}>🏆</Text>

  <Text
    style={{
      color: '#FFFFFF',
      fontSize: 23,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 10,
    }}
  >
    צוברים נקודות, מטפסים בדירוג!
  </Text>

  <Text
    style={{
      color: '#67F5A0',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    }}
  >
    👑 מי יהיה אלוף הניחושים?
  </Text>

  <Text style={{ fontSize: 23, marginTop: 14 }}>
    ⚽ ✨ 🥇 ✨ ⚽
  </Text>
</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07110D',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 65,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#B8D4C5',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 24,
  },
    pointsSection: {
    width: '100%',
    marginTop: 35,
    gap: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 8,
  },
  pointsCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    minHeight: 100,
  },
  exactCard: {
    backgroundColor: '#0B2B1C',
    borderColor: '#218B50',
  },
  winnerCard: {
    backgroundColor: '#10243B',
    borderColor: '#2563EB',
  },
  wrongCard: {
    backgroundColor: '#35151E',
    borderColor: '#DC354F',
  },
  pointsEmoji: {
    fontSize: 29,
    marginLeft: 12,
  },
  pointsInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pointsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  pointsDescription: {
    color: '#B5C2BB',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'right',
  },
  pointsNumber: {
    fontSize: 30,
    fontWeight: '900',
    marginRight: 12,
  },
});