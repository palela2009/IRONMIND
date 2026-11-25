import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useAppIcon } from '../hooks/useAppIcons';
import { colorForApp, textColorForApp, abbrForApp } from '../constants/apps';

interface Props {
  app: string;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

export const AppIcon: React.FC<Props> = ({ app, style, textStyle }) => {
  const icon = useAppIcon(app);
  const flat = StyleSheet.flatten(style) ?? {};

  if (icon) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: flat.width, height: flat.height, borderRadius: flat.borderRadius }}
      />
    );
  }

  return (
    <View style={[style, { backgroundColor: colorForApp(app) }]}>
      <Text style={[textStyle, { color: textColorForApp(app) }]}>{abbrForApp(app)}</Text>
    </View>
  );
};
