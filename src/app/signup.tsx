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
import { supabase } from '../supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      alert('יש למלא אימייל וסיסמה');
      return;
    }

    if (password !== confirmPassword) {
      alert('הסיסמאות לא תואמות');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    // With email confirmation on there is no session yet; the root layout
    // moves signed-in users to the username screen on its own
    if (!data.session) {
      router.replace({
        pathname: '/verify',
        params: { email: email.trim() },
      });
    }
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.logoArea}>
          <Text style={styles.ball}>⚽</Text>

          <Text style={styles.logo}>
            Goal<Text style={styles.green}>Guess</Text>
          </Text>

          <Text style={styles.tagline}>PREDICT  •  PLAY  •  WIN</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join GoalGuess and start predicting
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9a9a9a"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9a9a9a"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#9a9a9a"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleSignup}
          >
            <Text style={styles.signupButtonText}>Create Account  →</Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>

            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },

  container: {
    flex: 1,
    paddingHorizontal: 25,
  },

  backButton: {
    position: 'absolute',
    top: 55,
    left: 25,
    zIndex: 10,
  },

  backText: {
    color: '#ffffff',
    fontSize: 48,
  },

  logoArea: {
    alignItems: 'center',
    marginTop: 65,
  },

  ball: {
    fontSize: 48,
  },

  logo: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
  },

  green: {
    color: '#39ff66',
  },

  tagline: {
    color: '#bdbdbd',
    fontSize: 11,
    letterSpacing: 4,
    marginTop: 6,
  },

  form: {
    marginTop: 'auto',
    marginBottom: 55,
    marginHorizontal: 10,
  },

  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },

  subtitle: {
    color: '#b5b5b5',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
  },

  input: {
    height: 56,
    backgroundColor: 'rgba(8, 20, 17, 0.88)',
    borderWidth: 1,
    borderColor: '#46504d',
    borderRadius: 18,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 20,
    textAlign: 'right',
    marginBottom: 12,
  },

  signupButton: {
    height: 62,
    backgroundColor: '#39ff66',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  signupButtonText: {
    color: '#061109',
    fontSize: 19,
    fontWeight: '800',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },

  loginText: {
    color: '#c3c3c3',
    fontSize: 15,
  },

  loginLink: {
    color: '#39ff66',
    fontSize: 15,
    fontWeight: '800',
  },
});