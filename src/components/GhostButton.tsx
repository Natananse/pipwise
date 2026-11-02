import React from 'react';
import { ActionButtonProps, PillButton } from './PrimaryButton';

export function GhostButton(props: ActionButtonProps & { intent?: 'neutral' | 'negative' }) {
  return <PillButton {...props} variant="ghost" />;
}
