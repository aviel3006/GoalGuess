import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '../hooks/use-session';
import { supabase } from '../supabase';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const BG = '#040A07';
const CARD = '#0F1712';
const CARD_BORDER = '#1B2620';
const MUTED = '#8FA398';
const PASSWORD_MIN = 6;

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const email = session?.user.email ?? '';

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = current.length > 0 && password.length > 0 && confirm.length > 0 && !isSaving;

  const save = async () => {
    if (!canSave) return;

    if (password.length < PASSWORD_MIN) {
      setError(`הסיסמה החדשה חייבת להכיל לפחות ${PASSWORD_MIN} תווים`);
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות החדשות לא תואמות');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      // Supabase doesn't ask for the old password, so check it by signing in with it
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        setError(
          signInError.code === 'invalid_credentials'
            ? 'הסיסמה הנוכחית שגויה'
            : 'לא הצלחנו לאמת את הסיסמה הנוכחית. נסה שוב.'
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (updateError.code === 'same_password') {
          setError('הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית');
        } else if (updateError.code === 'weak_password') {
          setError('הסיסמה חלשה מדי. נסה סיסמה ארוכה יותר עם אותיות ומספרים.');
        } else {
          setError(`לא הצלחנו לעדכן את הסיסמה: ${updateError.message}`);
        }
        return;
      }

      Alert.alert('הסיסמה עודכנה', 'מעכשיו מתחברים עם הסיסמה החדשה', [
        { text: 'אישור', onPress: () => router.back() },
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="חזרה">
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>שינוי סיסמה</Text>
        <View style={styles.topBarSpace} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          keyboardShouldPersistTaps="handled"
        >
          <PasswordField
            label="סיסמה נוכחית"
            value={current}
            onChangeText={setCurrent}
            autoComplete="current-password"
          />
          <PasswordField
            label="סיסמה חדשה"
            hint={`לפחות ${PASSWORD_MIN} תווים`}
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="אימות סיסמה חדשה"
            value={confirm}
            onChangeText={setConfirm}
            autoComplete="new-password"
          />

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#FF5A5F" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.forgot}
            onPress={() =>
              Alert.alert(
                'שכחת את הסיסמה?',
                'התנתק ובחר "שכחתי סיסמה" במסך ההתחברות כדי לקבל קישור לאיפוס במייל.'
              )
            }
          >
            <Text style={styles.forgotText}>שכחתי את הסיסמה הנוכחית</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={save}
          disabled={!canSave}
        >
          {isSaving ? (
            <ActivityIndicator color="#04150B" />
          ) : (
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
              עדכן סיסמה
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PasswordField({
  label,
  hint,
  value,
  onChangeText,
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="right"
          placeholderTextColor="#5C6B63"
        />
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityLabel={visible ? 'הסתר סיסמה' : 'הצג סיסמה'}
        >
          <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={MUTED} />
        </TouchableOpacity>
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topBarSpace: {
    width: 25,
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  field: {
    marginTop: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 90, 95, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 95, 0.35)',
  },
  errorText: {
    flex: 1,
    color: '#FFB3B5',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  forgot: {
    alignSelf: 'center',
    marginTop: 22,
    padding: 6,
  },
  forgotText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(4, 10, 7, 0.96)',
  },
  saveButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#1B2620',
  },
  saveText: {
    color: '#04150B',
    fontSize: 17,
    fontWeight: '900',
  },
  saveTextDisabled: {
    color: '#6A7A70',
  },
});
