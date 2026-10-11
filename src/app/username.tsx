import { router } from 'expo-router';
import { useState } from 'react';
import {
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');

  const continueToApp = () => {
    if (username.trim().length < 3) {
      alert('שם המשתמש חייב להכיל לפחות 3 תווים');
      return;
    }

    // בהמשך נשמור את השם ב-Supabase
    router.replace('/');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/login-background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.container}>
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
        <View style={styles.content}>
          <Text style={styles.ball}>⚽</Text>

          <Text style={styles.logo}>
            GOAL<Text style={styles.logoGreen}>GUESS</Text>
          </Text>

          <Text style={styles.title}>Choose your nickname</Text>

          <Text style={styles.subtitle}>
            This name will appear on the leaderboard
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nickname"
            placeholderTextColor="#777"
            value={username}
            onChangeText={setUsername}
            maxLength={20}
            autoCapitalize="none"
            textAlign="center"
          />

          <TouchableOpacity
            style={styles.continueButton}
            onPress={continueToApp}
          >
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            You can use 3–20 characters
          </Text>
        </View>
          </ScrollView>
  </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },

  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  ball: {
    fontSize: 46,
    textAlign: 'center',
    marginBottom: 8,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 45,
  },

  logoGreen: {
    color: '#00E676',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    color: '#BDBDBD',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    height: 56,
    backgroundColor: '#101410',
    borderWidth: 1,
    borderColor: '#343A34',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  continueButton: {
    height: 56,
    backgroundColor: '#00E676',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  continueText: {
    color: '#07120A',
    fontSize: 17,
    fontWeight: '800',
  },

  hint: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
});