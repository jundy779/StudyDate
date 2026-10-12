import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setIsOffline(state.isConnected === false || state.isInternetReachable === false);
      }),
    [],
  );

  if (!isOffline) return null;

  return (
    <View accessibilityLiveRegion="polite" style={styles.banner}>
      <Text style={styles.text}>Kamu sedang offline. Beberapa fitur akan menunggu koneksi.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FFF3CD",
    borderBottomColor: "#F4D58D",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  text: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
