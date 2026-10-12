import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
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

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [linkSent, setLinkSent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const sendLink = async () => {
    if (!email.trim()) {
      alert('יש להזין אימייל');
      return;
    }

    setIsBusy(true);
    // The link opens the app signed in, and the root layout shows the reset-password screen
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl,
    });
    setIsBusy(false);

    if (error) {
      alert('לא הצלחנו לשלוח קישור. נסה שוב מאוחר יותר.');
      return;
    }

    setLinkSent(true);
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

            <View style={styles.content}>
              <Text style={styles.ball}>⚽</Text>

              <Text style={styles.logo}>
                Goal<Text style={styles.green}>Guess</Text>
              </Text>

              <Text style={styles.title}>Reset password</Text>

              {!linkSent ? (
                <>
                  <Text style={styles.subtitle}>
                    {"Enter your email and we'll send you a reset link"}
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

                  <TouchableOpacity
                    style={styles.button}
                    onPress={sendLink}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#061109" />
                    ) : (
                      <Text style={styles.buttonText}>Send Link  →</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>We sent a reset link to</Text>

                  <Text style={styles.email}>{email.trim()}</Text>

                  <Text style={styles.instructions}>
                    פתח את המייל בטלפון הזה ולחץ על הקישור.{'\n'}
                    האפליקציה תיפתח ותוכל לבחור סיסמה חדשה.
                  </Text>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => router.replace('/login')}
                  >
                    <Text style={styles.buttonText}>Back to Log In  →</Text>
                  </TouchableOpacity>

                  <Text style={styles.helpText}>
                    {"Didn't receive the email?"}
                  </Text>

                  <TouchableOpacity onPress={sendLink} disabled={isBusy}>
                    <Text style={styles.resend}>Resend Link</Text>
                  </TouchableOpacity>
                </>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },

  container: {
    flex: 1,
    paddingHorizontal: 30,
  },

  backButton: {
    position: 'absolute',
    top: 55,
    left: 0,
    zIndex: 10,
  },

  backText: {
    color: '#fff',
    fontSize: 48,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  ball: {
    fontSize: 50,
    marginBottom: 5,
  },

  logo: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    marginBottom: 45,
  },

  green: {
    color: '#39ff66',
  },

  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },

  subtitle: {
    color: '#b5b5b5',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 25,
  },

  email: {
    color: '#39ff66',
    fontSize: 15,
    fontWeight: '700',
    marginTop: -20,
    marginBottom: 25,
  },

  instructions: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },

  input: {
    width: '100%',
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

  button: {
    width: '100%',
    height: 60,
    backgroundColor: '#39ff66',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },

  buttonText: {
    color: '#061109',
    fontSize: 19,
    fontWeight: '800',
  },

  helpText: {
    color: '#b5b5b5',
    fontSize: 14,
    marginTop: 25,
  },

  resend: {
    color: '#39ff66',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 5,
  },
});
