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

import { useSession } from '../hooks/use-session';
import { supabase } from '../supabase';

// Shown by the root layout after the user opens a password reset link
export default function ResetPasswordScreen() {
  const { finishRecovery } = useSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const savePassword = async () => {
    if (password.length < 6) {
      alert('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    if (password !== confirmPassword) {
      alert('הסיסמאות לא תואמות');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      alert('לא הצלחנו לעדכן את הסיסמה. נסה שוב.');
      return;
    }

    alert('הסיסמה עודכנה בהצלחה!');
    finishRecovery();
  };

  const cancel = async () => {
    await supabase.auth.signOut();
    finishRecovery();
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
                Goal<Text style={styles.green}>Guess</Text>
              </Text>

              <Text style={styles.title}>Choose a new password</Text>

              <Text style={styles.subtitle}>
                Use at least 6 characters
              </Text>

              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor="#9a9a9a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor="#9a9a9a"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.button}
                onPress={savePassword}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#061109" />
                ) : (
                  <Text style={styles.buttonText}>Save Password  →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={cancel} disabled={isSaving}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
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
    fontSize: 28,
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

  cancel: {
    color: '#b5b5b5',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 22,
  },
});
