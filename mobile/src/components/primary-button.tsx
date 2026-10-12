import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "@/theme";

type Props = ComponentProps<typeof Pressable> & {
  label: string;
  isLoading?: boolean;
};

export function PrimaryButton({ label, isLoading = false, disabled, style, ...props }: Props) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {isLoading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.blue,
    borderRadius: radius.medium,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
  label: { color: colors.white, fontSize: 16, fontWeight: "700" },
});
