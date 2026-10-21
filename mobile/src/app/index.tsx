/** Restore the configured identity before showing the native dashboard or authentication screens. */
import { useState, useEffect, useCallback } from "react";
import { Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "@/types/chat";
import {
  api,
  ApiError,
  getSessionToken,
  onSessionExpired,
} from "@/services/api";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { Fonts } from "@/constants/theme";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { LoginView } from "@/components/LoginView";
import { DashboardView } from "@/components/DashboardView";
import { FableBrand } from "@/components/FableBrand";
import {
  useBrutalStyles,
  useBrutalTheme,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { ScreenTransition } from "@/components/ui/ScreenTransition";
import { AppIcon } from "@/components/ui/AppIcon";
import { unregisterNotifications } from "@/services/notifications";

export default function App() {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [sessionAttempt, setSessionAttempt] = useState(0);

  // Check for existing session on mount
  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    const check = async () => {
      try {
        const token = await getSessionToken();
        if (mounted)
          unsubscribe = onSessionExpired(() => {
            if (mounted) {
              setCurrentUser(null);
            }
          });
        if (!token) return;
        const result = await api.fetchMe();
        if (mounted) setCurrentUser(result.user);
      } catch (error) {
        if (mounted && !(error instanceof ApiError && error.status === 401)) {
          setSessionError(
            error instanceof Error
              ? error.message
              : "Unable to verify your session.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void check();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [sessionAttempt]);

  const handleAuth = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const handleLogout = async () => {
    try {
      try {
        await unregisterNotifications();
      } finally {
        await api.logout();
      }
      setSessionError("");
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Server logout could not be confirmed.",
      );
    } finally {
      setCurrentUser(null);
    }
  };

  if (sessionError) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <BrutalCard style={styles.loadingCard}>
          <AppIcon name="refresh" size={30} />
          <Text accessibilityRole="alert" style={styles.loadingTitle}>
            Connection required
          </Text>
          <Text style={styles.loadingSubtitle}>{sessionError}</Text>
          <BrutalButton
            title="Try again"
            onPress={() => {
              setLoading(true);
              setSessionError("");
              setSessionAttempt((attempt) => attempt + 1);
            }}
          />
          <BrutalButton
            title="Sign out"
            variant="outline"
            onPress={() => {
              void handleLogout();
            }}
          />
        </BrutalCard>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <BrutalCard style={styles.loadingCard}>
          <FableBrand />
          <Text style={styles.loadingSubtitle}>Opening your chats…</Text>
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={{ marginTop: 8 }}
          />
        </BrutalCard>
      </SafeAreaView>
    );
  }

  if (currentUser) {
    return (
      <ScreenTransition key={currentUser.id}>
        <DashboardView
          currentUser={currentUser}
          onLogout={handleLogout}
          onProfileUpdated={setCurrentUser}
        />
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition key="sign-in">
      <LoginView onSuccess={handleAuth} />
    </ScreenTransition>
  );
}

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    loadingArea: {
      flex: 1,
      backgroundColor: BrutalColors.bgPaper,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingCard: {
      padding: 32,
      alignItems: "center",
      gap: 8,
    },
    loadingTitle: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 18,
      letterSpacing: 0.1,
      color: BrutalColors.ink,
    },
    loadingSubtitle: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      fontWeight: "400",
      color: BrutalColors.inkMuted,
      letterSpacing: 0.1,
      textTransform: "none",
    },
  });
