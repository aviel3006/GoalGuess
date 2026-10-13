import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';

import {
  blockUser,
  reportLeague,
  reportUser,
  unblockUser,
  type ReportReason,
} from '../utils/moderation';

const GREEN = '#00E676';
const DANGER = '#FF5A5F';

export type ModerationTarget =
  | { kind: 'player'; userId: string; name: string; isBlocked: boolean }
  | { kind: 'league'; leagueId: number; name: string };

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Report / block menu for another player's leaderboard row, or report for a league.
// Mount it with a key per target, so it opens on the right step.
export function ModerationSheet({
  target,
  onClose,
  onChanged,
}: {
  target: ModerationTarget;
  onClose: () => void;
  // Called after a block or unblock, to reload the table
  onChanged?: () => void;
}) {
  const [step, setStep] = useState<'menu' | 'report'>(target.kind === 'league' ? 'report' : 'menu');
  const [isBusy, setIsBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      console.error('Moderation error:', error);
      Alert.alert('שגיאה', 'משהו השתבש. נסה שוב.');
    } finally {
      setIsBusy(false);
    }
  };

  const block = (userId: string, name: string) =>
    run(async () => {
      await blockUser(userId);
      onChanged?.();
      onClose();
      Alert.alert('המשתמש נחסם', `לא תראה יותר את השם והתמונה של ${name}. אפשר לבטל בהגדרות.`);
    });

  const confirmBlock = () => {
    if (target.kind !== 'player') return;
    Alert.alert(
      `לחסום את ${target.name}?`,
      'השם והתמונה שלו לא יוצגו לך בטבלאות.',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'חסום', style: 'destructive', onPress: () => block(target.userId, target.name) },
      ]
    );
  };

  const unblock = () =>
    run(async () => {
      if (target.kind !== 'player') return;
      await unblockUser(target.userId);
      onChanged?.();
      onClose();
    });

  const report = (reason: ReportReason) =>
    run(async () => {
      if (target.kind === 'player') await reportUser(target.userId, reason);
      else await reportLeague(target.leagueId, reason);
      onClose();

      const message = 'נבדוק את הדיווח תוך 24 שעות ונסיר תוכן שמפר את תנאי השימוש.';
      if (target.kind === 'player' && !target.isBlocked) {
        Alert.alert('תודה על הדיווח', message, [
          { text: 'סגור', style: 'cancel' },
          {
            text: 'חסום גם',
            style: 'destructive',
            onPress: () => block(target.userId, target.name),
          },
        ]);
      } else {
        Alert.alert('תודה על הדיווח', message);
      }
    });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops taps on the card from closing it */}
        <Pressable style={styles.card}>
          <Text style={styles.title} numberOfLines={1}>
            {target.name}
          </Text>

          {step === 'menu' && target.kind === 'player' && (
            <>
              <Option icon="flag-outline" label="דיווח על המשתמש" onPress={() => setStep('report')} />
              {target.isBlocked ? (
                <Option icon="lock-open-outline" label="ביטול החסימה" onPress={unblock} />
              ) : (
                <Option icon="ban-outline" label="חסימת המשתמש" onPress={confirmBlock} danger />
              )}
            </>
          )}

          {step === 'report' && (
            <>
              <Text style={styles.subtitle}>
                {target.kind === 'league' ? 'מה הבעיה בליגה?' : 'מה הבעיה?'}
              </Text>
              <Option
                icon="text-outline"
                label={target.kind === 'league' ? 'שם ליגה פוגעני' : 'שם משתמש פוגעני'}
                onPress={() => report('name')}
              />
              <Option icon="image-outline" label="תמונה פוגענית" onPress={() => report('picture')} />
              <Option icon="ellipsis-horizontal" label="סיבה אחרת" onPress={() => report('other')} />
            </>
          )}

          {isBusy ? (
            <ActivityIndicator color={GREEN} style={styles.busy} />
          ) : (
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>ביטול</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Option({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? DANGER : '#FFFFFF';
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={danger ? DANGER : GREEN} />
      <Text style={[styles.optionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  card: {
    backgroundColor: '#102017',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#245A3A',
    padding: 22,
    alignItems: 'stretch',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },
  subtitle: {
    color: '#AAB8AE',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0B1810',
    borderWidth: 1,
    borderColor: '#1B3626',
    marginBottom: 10,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cancel: {
    color: '#8FA99A',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  busy: {
    marginTop: 8,
  },
});
