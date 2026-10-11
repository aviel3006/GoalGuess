import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ImageBackground,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../supabase';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');

  const verifyCode = async () => {
    if (code.length !== 6) {
      alert('יש להזין קוד בן 6 ספרות');
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    });

    if (error) {
      alert('קוד האימות שגוי או שפג תוקפו');
      return;
    }

    alert('האימייל אומת בהצלחה!');
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
            Enter the 6-digit code we sent to
          </Text>

          <Text style={styles.email}>{email}</Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(text) =>
              setCode(text.replace(/[^0-9]/g, '').slice(0, 6))
            }
            keyboardType="number-pad"
            maxLength={6}
            placeholder="• • • • • •"
            placeholderTextColor="#777"
            textAlign="center"
          />

          <TouchableOpacity
            style={styles.verifyButton}
            onPress={verifyCode}
          >
            <Text style={styles.verifyText}>Verify  →</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Didn't receive the code?
          </Text>

          <TouchableOpacity>
            <Text style={styles.resend}>Resend Code</Text>
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

  codeInput: {
    width: '100%',
    height: 75,
    backgroundColor: 'rgba(8, 20, 17, 0.9)',
    borderWidth: 1,
    borderColor: '#46504d',
    borderRadius: 18,
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 12,
    marginTop: 35,
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