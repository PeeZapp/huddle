import React from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

interface ScreenProps {
  children: React.ReactNode;
  style?: object;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export default function Screen({ children, style, edges = ["top"] }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const padding: Record<string, number> = {};
  if (edges.includes("top")) padding.paddingTop = insets.top;
  if (edges.includes("bottom")) padding.paddingBottom = insets.bottom;
  if (edges.includes("left")) padding.paddingLeft = insets.left;
  if (edges.includes("right")) padding.paddingRight = insets.right;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, padding, style]}>
      {children}
    </View>
  );
}
