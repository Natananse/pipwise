import * as Application from 'expo-application';
import Constants from 'expo-constants';
import React from 'react';
import { Platform, View } from 'react-native';
import { formatBuildIdentity } from '../lib/buildIdentity';
import { Label } from './design';

/** A visible UI revision plus the installed binary's own version, when available. */
export function BuildIdentity() {
  const identity = formatBuildIdentity({
    platform: Platform.OS,
    executionEnvironment: Constants.executionEnvironment,
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
  });
  return <View style={{ gap: 4 }}>
    <Label bold size={15}>{identity.marker}</Label>
    <Label muted size={12}>{identity.details}</Label>
  </View>;
}
