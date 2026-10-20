/** A small compression confirms contact; release returns directly to the resting state. */
import { useState, type Ref } from "react";
import { Pressable, type PressableProps, type View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({
  ref,
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  feedbackScale = 0.97,
  ...props
}: PressableProps & { ref?: Ref<View>; feedbackScale?: number }) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      style={[
        typeof style === "function" ? style({ pressed, hovered }) : style,
        motion,
      ]}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        scale.set(
          withTiming(feedbackScale, {
            duration: 90,
            reduceMotion: ReduceMotion.System,
          }),
        );
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(
          withSpring(1, {
            stiffness: 420,
            damping: 30,
            mass: 0.7,
            overshootClamping: true,
            reduceMotion: ReduceMotion.System,
          }),
        );
        onPressOut?.(event);
      }}
    />
  );
}
