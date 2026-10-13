
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../supabase';

// Uploads into the public league-images bucket, under a folder named after the user's id
async function uploadLeagueImage(userId: string, image: ImagePicker.ImagePickerAsset) {
  const contentType = image.mimeType ?? 'image/jpeg';
  const extension = (contentType.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
  const path = `${userId}/${Date.now()}.${extension}`;
  const body = await fetch(image.uri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage
    .from('league-images')
    .upload(path, body, { contentType });
  if (error) throw error;

  return supabase.storage.from('league-images').getPublicUrl(path).data.publicUrl;
}

export default function CreateLeagueScreen() {
  const [leagueName, setLeagueName] = useState('');
const [leagueImage, setLeagueImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
const [showNameError, setShowNameError] = useState(false);
const [showSuccess, setShowSuccess] = useState(false);
const [createdInviteCode, setCreatedInviteCode] = useState('');
const [createdLeagueId, setCreatedLeagueId] = useState<number | null>(null);
const [confettiFall] = useState(() => new Animated.Value(0));
useEffect(() => {
  if (showSuccess) {
    confettiFall.setValue(0);

    Animated.loop(
      Animated.timing(confettiFall, {
        toValue: 1,
        duration: 3500,
        useNativeDriver: true,
      })
    ).start();
  } else {
    confettiFall.stopAnimation();
  }

  return () => confettiFall.stopAnimation();
}, [showSuccess, confettiFall]);
const [isCreating, setIsCreating] = useState(false);
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};
const createLeague = async () => {
  if (!leagueName.trim()) {
    setShowNameError(true);
    return;
  }

  if (isCreating) return;

  setIsCreating(true);

  try {
    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError || !user) {
      Alert.alert('שגיאה', 'צריך להתחבר לחשבון כדי ליצור ליגה');
      return;
    }

    // Without a picked image the league falls back to the default picture
    const imageUrl = leagueImage ? await uploadLeagueImage(user.id, leagueImage) : null;

    const insertLeague = (code: string) =>
      supabase
        .from('leagues')
        .insert({
          name: leagueName.trim(),
          created_by: user.id,
          invite_code: code,
          image_url: imageUrl,
        })
        .select('id')
        .single();

    // Retry on the rare invite_code collision (unique violation)
    let inviteCode = generateInviteCode();
    let { data, error } = await insertLeague(inviteCode);
    for (let attempt = 0; error?.code === '23505' && attempt < 2; attempt++) {
      inviteCode = generateInviteCode();
      ({ data, error } = await insertLeague(inviteCode));
    }

    if (error?.message.includes('inappropriate_league_name')) {
      Alert.alert('השם לא מתאים', 'שם הליגה הזה לא מתאים. בחר שם אחר.');
      return;
    }
    if (error) throw error;

    setCreatedLeagueId(data?.id ?? null);
    setCreatedInviteCode(inviteCode);
    setShowSuccess(true);
  } catch (error) {
    console.error('Create league error:', error);
    Alert.alert('שגיאה', 'לא הצלחנו ליצור את הליגה. נסה שוב.');
  } finally {
    setIsCreating(false);
  }
};
const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });

  if (!result.canceled) {
    setLeagueImage(result.assets[0]);
  }
};
  return (
    <KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-forward" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.logo}>
          GOAL<Text style={styles.green}>GUESS</Text>
        </Text>

        <Text style={styles.title}>צור ליגה חדשה 🏆</Text>

        <Text style={styles.subtitle}>
          פתח ליגה פרטית והזמן את החברים שלך להתחרות!
        </Text>

        <TouchableOpacity
  style={styles.imageBox}
  onPress={pickImage}
>
          {leagueImage ? (
  <Image
    source={{ uri: leagueImage.uri }}
    style={{
      width: 170,
height: 170,
borderRadius: 85,
    }}
  />
) : (
  <>
   <Ionicons name="camera-outline" size={42} color="#00E676" />
<Text style={styles.imageText}>הוסף תמונה לליגה</Text>
<Text style={styles.imageHint}>בחר תמונה מהגלריה</Text>
  </>
)}
        </TouchableOpacity>

        <Text style={styles.label}>שם הליגה</Text>

        <TextInput
          style={styles.input}
          placeholder="לדוגמה: האלופים של השכונה"
          placeholderTextColor="#777"
          value={leagueName}
          onChangeText={setLeagueName}
          textAlign="right"
          maxLength={30}
        />

        <TouchableOpacity
          style={[styles.createButton, isCreating && { opacity: 0.6 }]}
          onPress={createLeague}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color="#002710" />
          ) : (
            <Ionicons name="add-circle" size={23} color="#002710" />
          )}
          <Text style={styles.createText}>
            {isCreating ? 'יוצר את הליגה...' : 'צור את הליגה שלי'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal
  visible={showNameError}
  transparent
  animationType="fade"
  onRequestClose={() => setShowNameError(false)}
>
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  }}>
    <View style={{
      backgroundColor: '#102017',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#245A3A',
      padding: 28,
      alignItems: 'center',
    }}>
      <Ionicons
        name="alert-circle-outline"
        size={55}
        color="#00E676"
      />

      <Text style={{
        color: '#FFFFFF',
        fontSize: 23,
        fontWeight: '900',
        marginTop: 15,
      }}>
        חסר שם לליגה
      </Text>

      <Text style={{
        color: '#AAB8AF',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 25,
      }}>
        כדי ליצור ליגה חדשה, צריך לבחור לה שם.
      </Text>

      <TouchableOpacity
        onPress={() => setShowNameError(false)}
        style={{
          backgroundColor: '#00E676',
          borderRadius: 14,
          paddingVertical: 14,
          width: '100%',
          alignItems: 'center',
        }}
      >
        <Text style={{
          color: '#002710',
          fontSize: 17,
          fontWeight: '900',
        }}>
          הבנתי
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
<Modal
  visible={showSuccess}
  transparent
  animationType="fade"
  onRequestClose={() => setShowSuccess(false)}
>
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  }}>
    <View style={{
      backgroundColor: '#102017',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#24A53A',
      padding: 28,
      alignItems: 'center',
    }}>
      <View
  pointerEvents="none"
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  }}
>
  {Array.from({ length: 30 }, (_, i) => {
    const colors = ['#00E676', '#FFFFFF', '#FFD700', '#24A53A'];

    return (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          left: `${(i * 37) % 95}%`,
          top: -20 - (i % 5) * 35,
          width: 6 + (i % 3) * 2,
          height: 10,
          borderRadius: 2,
          backgroundColor: colors[i % colors.length],
          opacity: 0.9,
          transform: [
            {
              translateY: confettiFall.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 650 + (i % 4) * 80],
              }),
            },
            {
              rotate: confettiFall.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${360 + i * 25}deg`],
              }),
            },
          ],
        }}
      />
    );
  })}
</View>
      <Text style={{ fontSize: 75 }}>🏆</Text>

      <Text style={{
        color: '#FFFFFF',
        fontSize: 25,
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 15,
      }}>
        הליגה נוצרה בהצלחה!
      </Text>

      <Text style={{
        color: '#AAB8AE',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 25,
      }}>
        🎉 הליגה שלך מוכנה! עכשיו אפשר להזמין חברים ולהתחיל להתחרות.
      </Text>

      <Text style={{ color: '#AAB8AE', fontSize: 13 }}>קוד ההזמנה</Text>
      <TouchableOpacity
        onPress={() =>
          Share.share({
            message: `הצטרפו לליגה "${leagueName.trim()}" ב-GoalGuess עם הקוד: ${createdInviteCode}`,
          })
        }
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 8,
          marginBottom: 22,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#24A53A',
          backgroundColor: '#0B1810',
        }}
      >
        <Text style={{ color: '#00E676', fontSize: 24, fontWeight: '900', letterSpacing: 4 }}>
          {createdInviteCode}
        </Text>
        <Ionicons name="share-social" size={20} color="#00E676" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
  setShowSuccess(false);
  if (createdLeagueId !== null) {
    router.replace({ pathname: '/league/[id]', params: { id: String(createdLeagueId) } });
  } else {
    router.replace({ pathname: '/leaderboard', params: { tab: 'friends' } });
  }
}}
        style={{
          backgroundColor: '#00E676',
          borderRadius: 14,
          paddingVertical: 15,
          width: '100%',
          alignItems: 'center',
        }}
      >
        <Text style={{
          color: '#002710',
          fontSize: 18,
          fontWeight: '900',
        }}>
          אישור
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030907',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 65,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    right: 22,
    top: 65,
    zIndex: 2,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 48,
  },
  green: {
    color: '#00E676',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#A5B3A9',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 36,
  },
  imageBox: {
    width: 170,
height: 170,
borderRadius: 85,
alignSelf: 'center',
overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#267444',
    backgroundColor: '#0D2014',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  imageText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  imageHint: {
    color: '#81988A',
    fontSize: 12,
    marginTop: 7,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#112017',
    borderWidth: 1,
    borderColor: '#2D5339',
    borderRadius: 14,
    padding: 17,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 30,
  },
  createButton: {
    backgroundColor: '#00E676',
    borderRadius: 15,
    paddingVertical: 19,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createText: {
    color: '#002710',
    fontSize: 18,
    fontWeight: '900',
  },
});
