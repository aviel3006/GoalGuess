import { router, useLocalSearchParams } from 'expo-router';
import {
    ImageBackground,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { authRedirectUrl } from '../hooks/use-session';
import { supabase } from '../supabase';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();

  // Opening the link on this phone signs the user in; the root layout then shows the username screen
  const resendLink = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authRedirectUrl },
    });

    if (error) {
      alert('לא הצלחנו לשלוח קישור חדש. נסה שוב מאוחר יותר.');
      return;
    }

    alert('שלחנו קישור חדש לאימייל שלך');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/login-background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.container}>
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

          <Text style={styles.title}>Verify your email</Text>

          <Text style={styles.subtitle}>
            We sent a confirmation link to
          </Text>

          <Text style={styles.email}>{email}</Text>

          <Text style={styles.instructions}>
            שלחנו לך מייל עם קישור לאימות.{'\n'}
            פתח את המייל בטלפון הזה ולחץ על הקישור, והאפליקציה תיפתח ותחבר אותך אוטומטית.
          </Text>

          <TouchableOpacity
            style={styles.verifyButton}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.verifyText}>Back to Log In  →</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            {"Didn't receive the email?"}
          </Text>

          <TouchableOpacity onPress={resendLink}>
            <Text style={styles.resend}>Resend Link</Text>
          </TouchableOpacity>
        </View>
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
    left: 25,
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
  },

  email: {
    color: '#39ff66',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 5,
  },

  instructions: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 30,
  },

  verifyButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#39ff66',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },

  verifyText: {
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