import { StyleSheet, Text } from 'react-native';

import { openPrivacyPolicy, openTerms } from '../utils/site';

// Shown wherever an account can be created (email signup, Google, Apple)
export function TermsNotice() {
  return (
    <Text style={styles.text}>
      בהמשך אתה מסכים ל
      <Text style={styles.link} onPress={openTerms}>
        תנאי השימוש
      </Text>
      {' '}ול
      <Text style={styles.link} onPress={openPrivacyPolicy}>
        מדיניות הפרטיות
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#a9a9a9',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  link: {
    color: '#39ff66',
    fontWeight: '700',
  },
});
