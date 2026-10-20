/** Continuous drawer gestures and the content surface share one UI-thread position. */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import {
  useBrutalStyles,
  useBrutalTheme,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import type { User } from "@/types/chat";
import { UserAvatar } from "./ui/UserAvatar";
import { AppIcon, type AppIconName } from "./ui/AppIcon";
import { MotionPressable as Pressable } from "./ui/MotionPressable";

const getPanelWidth = (width: number) =>
  Math.max(
    1,
    Math.min(288, Math.max(240, Math.round(width * 0.74)), width - 72),
  );

export function NavigationMenuButton({ onPress }: { onPress: () => void }) {
  const styles = useBrutalStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      accessibilityState={{ expanded: false }}
      onPress={onPress}
      style={styles.menuButton}
    >
      <AppIcon name="menu" size={27} />
    </Pressable>
  );
}

export interface NavigationDrawerHandle {
  open: () => void;
  close: () => void;
}
interface Props {
  ref: Ref<NavigationDrawerHandle>;
  children: ReactNode;
  open: boolean;
  enabled: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  canCreateChat: boolean;
  canOpenSettings: boolean;
  onCreateGroup: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export function NavigationDrawer({ ref: drawerRef, ...props }: Props) {
  const styles = useBrutalStyles(createStyles);
  const colors = useBrutalTheme();
  const { width } = useWindowDimensions();
  const panelWidth = getPanelWidth(width);
  const { onOpenChange } = props;
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(props.open ? 0 : 1);
  const dragging = useSharedValue(false);
  const dragStart = useSharedValue(1);
  const dismissing = useSharedValue(false);
  const closeButton = useRef<View>(null);
  const spring = useMemo(
    () => ({
      stiffness: 420,
      damping: 36,
      mass: 0.8,
      overshootClamping: true,
      energyThreshold: 0.00001,
      reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System,
    }),
    [reducedMotion],
  );
  // Only the release settles with a spring. Movement under the finger is direct and reversible.
  const settle = useCallback(
    (target: number, velocity = 0) => {
      "worklet";
      progress.set(
        withSpring(target, { ...spring, velocity }, (finished) => {
          if (finished) scheduleOnRN(onOpenChange, target === 0);
        }),
      );
    },
    [onOpenChange, progress, spring],
  );
  const dismiss = useCallback(
    (action?: () => void) => {
      if (dismissing.get()) return;
      dismissing.set(true);
      dragging.set(false);
      const finish = () => {
        onOpenChange(false);
        dismissing.set(false);
        action?.();
      };
      progress.set(
        withSpring(1, spring, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      );
    },
    [dismissing, dragging, onOpenChange, progress, spring],
  );
  const close = useCallback(() => dismiss(), [dismiss]);
  useImperativeHandle(drawerRef, () => ({
    open: () => {
      if (dismissing.get()) return;
      Keyboard.dismiss();
      onOpenChange(true);
      settle(0);
    },
    close,
  }));
  useEffect(() => {
    if (!props.open) return;
    const frame = requestAnimationFrame(() => {
      const handle = findNodeHandle(closeButton.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => cancelAnimationFrame(frame);
  }, [props.open]);
  const beginDrag = useCallback(() => {
    Keyboard.dismiss();
    onOpenChange(true);
  }, [onOpenChange]);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(props.enabled)
        .maxPointers(1)
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onTouchesDown((event, manager) => {
          if (
            dismissing.get() ||
            (progress.get() >= 0.999 &&
              (event.allTouches[0]?.absoluteX ?? 0) < width - 28)
          )
            manager.fail();
        })
        .onStart((event) => {
          cancelAnimation(progress);
          dragStart.set(progress.get());
          dragging.set(true);
          progress.set(
            Math.max(
              0,
              Math.min(1, dragStart.get() + event.translationX / panelWidth),
            ),
          );
          scheduleOnRN(beginDrag);
        })
        .onUpdate((event) => {
          if (dragging.get())
            progress.set(
              Math.max(
                0,
                Math.min(1, dragStart.get() + event.translationX / panelWidth),
              ),
            );
        })
        .onEnd((event) => {
          dragging.set(false);
          const velocity = event.velocityX / panelWidth;
          const projected = progress.get() + velocity * 0.16;
          const target =
            event.velocityX < -600
              ? 0
              : event.velocityX > 600
                ? 1
                : projected < 0.5
                  ? 0
                  : 1;
          settle(target, velocity);
        })
        .onFinalize((_event, successful) => {
          if (!successful && dragging.get()) {
            dragging.set(false);
            settle(dragStart.get() < 0.5 ? 0 : 1);
          }
        }),
    [
      beginDrag,
      dismissing,
      dragging,
      dragStart,
      panelWidth,
      progress,
      props.enabled,
      settle,
      width,
    ],
  );
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -panelWidth * (1 - progress.get()) }],
    borderTopRightRadius: (1 - progress.get()) * 18,
    borderBottomRightRadius: (1 - progress.get()) * 18,
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * panelWidth }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: (1 - progress.get()) * 0.12,
  }));
  const row = (
    label: string,
    icon: AppIconName,
    action: () => void,
    selected = false,
    disabled = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => dismiss(action)}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selectedRow,
        pressed && styles.pressedRow,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.rowIcon}>
        <AppIcon name={icon} size={22} />
      </View>
      <Text style={[styles.rowText, selected && styles.selectedText]}>
        {label}
      </Text>
      <AppIcon name="forward" color={colors.inkFaint} size={16} />
    </Pressable>
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.canvas}>
        <Animated.View
          style={[styles.contentStage, contentStyle]}
          pointerEvents={props.open ? "none" : "auto"}
          accessibilityElementsHidden={props.open}
          importantForAccessibility={
            props.open ? "no-hide-descendants" : "auto"
          }
        >
          {props.children}
        </Animated.View>
        <View
          style={styles.overlay}
          pointerEvents={props.open ? "auto" : "none"}
          accessibilityElementsHidden={!props.open}
          importantForAccessibility={
            props.open ? "auto" : "no-hide-descendants"
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
            style={StyleSheet.absoluteFill}
            onPress={close}
          />
          <Animated.View
            accessibilityViewIsModal={props.open}
            onAccessibilityEscape={close}
            style={[styles.panel, { width: panelWidth }, panelStyle]}
          >
            <SafeAreaView
              style={styles.safeArea}
              edges={["top", "right", "bottom"]}
            >
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>
                  Fable
                </Text>
                <Pressable
                  ref={closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close navigation menu"
                  onPress={close}
                  style={styles.menuButton}
                >
                  <AppIcon name="close" size={25} />
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={styles.content}
                bounces={false}
              >
                <View style={styles.section}>
                  {row(
                    "New Group",
                    "groups",
                    props.onCreateGroup,
                    false,
                    !props.canCreateChat,
                  )}
                  {row("Your Profile", "profile", props.onOpenProfile)}
                  {row(
                    "Settings",
                    "settings",
                    props.onOpenSettings,
                    false,
                    !props.canOpenSettings,
                  )}
                </View>
                <View style={styles.account}>
                  <UserAvatar user={props.currentUser} self size={44} />
                  <View style={styles.profileBody}>
                    <Text style={styles.name} numberOfLines={1}>
                      {props.currentUser.name}
                    </Text>
                    <Text style={styles.caption} numberOfLines={1}>
                      {props.currentUser.handle}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    canvas: { flex: 1, overflow: "hidden", backgroundColor: colors.bgSidebar },
    contentStage: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: colors.bgPaper,
    },
    overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    scrim: { backgroundColor: "#000000" },
    panel: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.bgSidebar,
      borderTopLeftRadius: 24,
      borderBottomLeftRadius: 24,
      overflow: "hidden",
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    safeArea: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 22,
      paddingRight: 8,
      paddingTop: 8,
      paddingBottom: 10,
    },
    title: { color: colors.ink, fontFamily: Fonts.sans, fontSize: 26 },
    menuButton: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    content: { paddingHorizontal: 12, paddingBottom: 24 },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      marginTop: 30,
    },
    profile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      marginBottom: 20,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
    },
    profileBody: { flex: 1, minWidth: 0 },
    name: { fontFamily: Fonts.medium, fontSize: 17, color: colors.ink },
    caption: {
      fontFamily: Fonts.sans,
      color: colors.primary,
      fontSize: 13,
      marginTop: 4,
    },
    section: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingBottom: 12,
      marginBottom: 12,
    },
    sectionLabel: {
      color: colors.inkMuted,
      fontFamily: Fonts.medium,
      fontSize: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    row: {
      minHeight: 50,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowText: {
      flex: 1,
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: colors.ink,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutIcon: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    selectedRow: { backgroundColor: colors.selection },
    selectedText: { color: colors.selectionInk },
    pressedRow: { backgroundColor: colors.bgCardAlt },
    disabled: { opacity: 0.45 },
    logout: {
      fontFamily: Fonts.sans,
      color: colors.dangerButton,
      fontSize: 16,
    },
  });
