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

import { authRedirectUrl } from '../hooks/use-session';
import { supabase } from '../supabase';
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
const handleLogin = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    // Signed up but never confirmed: send a fresh link and show the check-your-email screen
    if (error.code === 'email_not_confirmed') {
      await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authRedirectUrl },
      });
      router.push({ pathname: '/verify', params: { email: email.trim() } });
      return;
    }
    alert(error.message);
    return;
  }

  // The root layout redirects into the app once the session is set
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
        <View style={styles.logoArea}>
          <Text style={styles.ball}>⚽</Text>

          <Text style={styles.logo}>
            Goal<Text style={styles.logoGreen}>Guess</Text>
          </Text>

          <Text style={styles.tagline}>PREDICT  •  PLAY  •  WIN</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Log in to continue your journey
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

          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: '/forgot-password', params: { email: email.trim() } })
            }
          >
            <Text style={styles.forgot}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Log In  →</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.googleButton}>
            <Text style={styles.googleText}>G</Text>
            <Text style={styles.socialText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>{"Don't have an account? "}</Text>

            <TouchableOpacity onPress={() => router.push('/signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
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

  logoArea: {
    alignItems: 'center',
    marginTop: 65,
  },

  ball: {
    fontSize: 48,
    marginBottom: 2,
  },

  logo: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
  },

  logoGreen: {
    color: '#39ff66',
  },

  tagline: {
    color: '#bdbdbd',
    fontSize: 11,
    letterSpacing: 4,
    marginTop: 6,
  },

  form: {marginHorizontal: 10,
    marginTop: 'auto',
    marginBottom: 45,
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
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 25,
  },

  input: {textAlign: 'right',
    height: 62,
    backgroundColor: 'rgba(8, 20, 17, 0.88)',
    borderWidth: 1,
    borderColor: '#46504d',
    borderRadius: 18,
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  forgot: {
    color: '#39ff66',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 25,
  },

  loginButton: {
    height: 62,
    backgroundColor: '#39ff66',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginButtonText: {
    color: '#061109',
    fontSize: 19,
    fontWeight: '800',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#66706d',
  },

  dividerText: {
    color: '#bdbdbd',
    marginHorizontal: 14,
    fontSize: 13,
  },

  googleButton: {
    height: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#46504d',
    backgroundColor: 'rgba(8, 20, 17, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
  },

  googleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },

  socialText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },

  signupText: {
    color: '#c3c3c3',
    fontSize: 15,
  },

  signupLink: {
    color: '#39ff66',
    fontSize: 15,
    fontWeight: '800',
  },
});