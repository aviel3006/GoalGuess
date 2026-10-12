import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { COUNTRIES, countryName, flagEmoji, type Country } from '../utils/countries';

export { ScreenErrorBoundary as ErrorBoundary } from '../components/screen-error';

const GREEN = '#00E676';
const BG = '#040A07';
const CARD = '#0F1712';
const CARD_BORDER = '#1B2620';
const MUTED = '#8FA398';

const AVATAR_BUCKET = 'avatars';
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MAX = 30;

// What the avatar will be after saving: unchanged, a newly picked image, or removed
type AvatarChange =
  | { kind: 'keep' }
  | { kind: 'new'; image: ImagePicker.ImagePickerAsset }
  | { kind: 'remove' };

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

// Uploads into the public avatars bucket, under a folder named after the user's id.
// Every upload gets a new file name so cached copies of the old picture never show.
async function uploadAvatar(userId: string, image: ImagePicker.ImagePickerAsset) {
  const contentType = image.mimeType ?? 'image/jpeg';
  const extension = (contentType.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const path = `${userId}/${Date.now()}.${extension}`;
  const body = await fetch(image.uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType });
  if (error) throw error;

  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

// The storage path of an avatar we uploaded, or null for any other URL
function avatarPath(url: string | null) {
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const index = url?.indexOf(marker) ?? -1;
  return url && index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const user = session?.user;
  const meta = user?.user_metadata ?? {};

  const initialUsername: string = meta.username ?? '';
  const initialDisplayName: string = meta.display_name ?? '';
  const initialCountry: string | null = typeof meta.country === 'string' ? meta.country : null;
  const currentAvatarUrl: string | null = meta.avatar_url ?? null;

  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [avatar, setAvatar] = useState<AvatarChange>({ kind: 'keep' });
  const [showCountries, setShowCountries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const cleanUsername = cleanName(username);
  const usernameError =
    cleanUsername.length < USERNAME_MIN ? `שם המשתמש חייב להכיל לפחות ${USERNAME_MIN} תווים` : null;

  const hasChanges =
    cleanUsername !== initialUsername ||
    cleanName(displayName) !== initialDisplayName ||
    country !== initialCountry ||
    avatar.kind !== 'keep';

  const previewUri =
    avatar.kind === 'new' ? avatar.image.uri : avatar.kind === 'remove' ? null : currentAvatarUrl;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      shape: 'oval',
      quality: 0.6,
    });

    if (!result.canceled) {
      setAvatar({ kind: 'new', image: result.assets[0] });
    }
  };

  const changeAvatar = () => {
    if (!previewUri) {
      pickImage();
      return;
    }

    Alert.alert('תמונת פרופיל', undefined, [
      { text: 'בחר תמונה מהגלריה', onPress: pickImage },
      {
        text: 'הסר תמונה',
        style: 'destructive',
        // Undo a picked-but-unsaved image back to "no picture" if there wasn't one before
        onPress: () => setAvatar(currentAvatarUrl ? { kind: 'remove' } : { kind: 'keep' }),
      },
      { text: 'ביטול', style: 'cancel' },
    ]);
  };

  const goBack = () => {
    if (!hasChanges || isSaving) {
      router.back();
      return;
    }

    Alert.alert('לצאת בלי לשמור?', 'השינויים שעשית לא יישמרו', [
      { text: 'המשך לערוך', style: 'cancel' },
      { text: 'צא', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (!user || !hasChanges || usernameError || isSaving) return;

    setIsSaving(true);
    try {
      let avatarUrl = currentAvatarUrl;
      if (avatar.kind === 'new') avatarUrl = await uploadAvatar(user.id, avatar.image);
      if (avatar.kind === 'remove') avatarUrl = null;

      // Read by the profile screen; the leaderboards show the username
      const { error } = await supabase.auth.updateUser({
        data: {
          username: cleanUsername,
          display_name: cleanName(displayName) || null,
          country,
          avatar_url: avatarUrl,
        },
      });
      if (error) throw error;

      // Best effort: an old file left behind only costs storage
      const oldPath = avatarUrl !== currentAvatarUrl ? avatarPath(currentAvatarUrl) : null;
      if (oldPath) {
        supabase.storage
          .from(AVATAR_BUCKET)
          .remove([oldPath])
          .then(({ error: removeError }) => {
            if (removeError) console.warn('Remove old avatar error:', removeError);
          });
      }

      router.back();
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את הפרופיל. נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = hasChanges && !usernameError && !isSaving;
  const flag = country ? flagEmoji(country) : null;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} hitSlop={10} accessibilityLabel="חזרה">
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>עריכת פרופיל</Text>

        <View style={styles.topBarSpace} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarRing}
              onPress={changeAvatar}
              activeOpacity={0.85}
              accessibilityLabel="שינוי תמונת פרופיל"
            >
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.avatar} transition={150} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={64} color="#5E8A6F" />
                </View>
              )}

              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color="#03210F" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={changeAvatar} hitSlop={8}>
              <Text style={styles.changePhotoText}>
                {previewUri ? 'שינוי תמונה' : 'הוספת תמונה'}
              </Text>
            </TouchableOpacity>
          </View>

          <Field
            label="שם משתמש"
            hint="השם שמופיע בטבלאות הדירוג"
            error={usernameError}
          >
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="שם משתמש"
              placeholderTextColor="#5C6B63"
              maxLength={USERNAME_MAX}
              autoCapitalize="none"
              autoCorrect={false}
              textAlign="right"
            />
          </Field>

          <Field label="שם מלא" hint="לא חובה · מוצג בפרופיל שלך">
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="השם שלך"
              placeholderTextColor="#5C6B63"
              maxLength={DISPLAY_NAME_MAX}
              textAlign="right"
            />
          </Field>

          <Field label="מדינה">
            <TouchableOpacity
              style={[styles.input, styles.selectRow]}
              onPress={() => setShowCountries(true)}
              activeOpacity={0.8}
            >
              {flag && <Text style={styles.selectFlag}>{flag}</Text>}
              <Text style={[styles.selectText, !country && styles.selectPlaceholder]}>
                {country ? countryName(country) : 'בחר מדינה'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={MUTED} />
            </TouchableOpacity>
          </Field>

          <Field label="אימייל" hint="לא ניתן לשנות את האימייל">
            <View style={[styles.input, styles.readOnly]}>
              <Text style={styles.readOnlyText} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
              <Ionicons name="lock-closed" size={15} color="#5C6B63" />
            </View>
          </Field>
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
              שמור שינויים
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <CountryPicker
        visible={showCountries}
        selected={country}
        onClose={() => setShowCountries(false)}
        onSelect={(code) => {
          setCountry(code);
          setShowCountries(false);
        }}
      />
    </View>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        hint && <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

function CountryPicker({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: string | null;
  onClose: () => void;
  onSelect: (code: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const renderItem = ({ item }: { item: Country }) => {
    const isSelected = item.code === selected;
    return (
      <TouchableOpacity
        style={[styles.countryRow, isSelected && styles.countryRowSelected]}
        onPress={() => onSelect(item.code)}
        activeOpacity={0.8}
      >
        <Text style={styles.countryFlag}>{flagEmoji(item.code)}</Text>
        <Text style={styles.countryName}>{item.name}</Text>
        {isSelected && <Ionicons name="checkmark-circle" size={22} color={GREEN} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={() => setQuery('')}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>בחר מדינה</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="סגירה">
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={MUTED} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש"
              placeholderTextColor="#5C6B63"
              textAlign="right"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              selected && !query ? (
                <TouchableOpacity style={styles.countryRow} onPress={() => onSelect(null)}>
                  <Ionicons name="remove-circle-outline" size={22} color="#FF5A5F" />
                  <Text style={[styles.countryName, styles.clearCountry]}>ללא מדינה</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.noResults}>לא נמצאו מדינות</Text>}
          />
        </View>
      </View>
    </Modal>
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
    paddingTop: 12,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: GREEN,
    padding: 3,
    boxShadow: '0 0 18px rgba(0, 230, 118, 0.45)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 61,
  },
  avatarPlaceholder: {
    backgroundColor: '#13281C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GREEN,
    borderWidth: 3,
    borderColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 12,
  },

  // Fields
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
  input: {
    minHeight: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  error: {
    color: '#FF5A5F',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 6,
  },
  selectRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  selectFlag: {
    fontSize: 22,
  },
  selectText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'right',
  },
  selectPlaceholder: {
    color: '#5C6B63',
  },
  readOnly: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A100C',
  },
  readOnlyText: {
    flex: 1,
    color: '#7D8F84',
    fontSize: 15,
    textAlign: 'right',
  },

  // Footer
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

  // Country picker
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalSheet: {
    maxHeight: '80%',
    backgroundColor: '#0B130E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    height: 46,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  countryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  countryRowSelected: {
    backgroundColor: '#0E2117',
  },
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  clearCountry: {
    color: '#FF5A5F',
  },
  noResults: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
