import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { AchievementId, AchievementTier } from '../hooks/use-profile';

type McIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Shared by the profile badges and the unlock celebration
export const ACHIEVEMENT_ICONS: Record<AchievementId, McIconName> = {
  'first-prediction': 'soccer',
  'first-correct': 'check-decagram',
  'join-league': 'account-group',
  'first-exact': 'bullseye',
  'streak-3': 'fire',
  'points-50': 'star',
  'predictions-50': 'clipboard-check',
  'streak-5': 'fire',
  'points-100': 'chart-bar',
  'exact-10': 'target',
  'round-20': 'lightning-bolt',
  'streak-10': 'fire',
  'points-250': 'chart-line',
  'exact-25': 'target-account',
  'league-champion': 'trophy',
  'global-top-10': 'earth',
  'exact-expert': 'crosshairs-gps',
  'points-500': 'crown',
  'perfect-round': 'diamond-stone',
  'global-first': 'medal',
};

// Difficulty colors, checked with the dataviz palette validator on the badge background.
// Blue and purple are close for some colorblind users, so every badge also names its tier.
export const TIER_STYLE: Record<AchievementTier, { label: string; color: string }> = {
  easy: { label: 'קל', color: '#8E9A94' },
  medium: { label: 'בינוני', color: '#16A34A' },
  hard: { label: 'קשה', color: '#1E56E0' },
  epic: { label: 'קשה מאוד', color: '#B95CF0' },
  legendary: { label: 'אגדי', color: '#D97706' },
};
