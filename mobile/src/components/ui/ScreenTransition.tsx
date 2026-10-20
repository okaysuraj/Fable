/** One brief arrival identifies a new screen without delaying controls or repeating on data refresh. */
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, FadeInDown, ReduceMotion } from "react-native-reanimated";

export function ScreenTransition({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      style={styles.screen}
      entering={FadeInDown.duration(200).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
