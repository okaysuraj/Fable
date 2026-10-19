/** Restore Firebase identity before showing the native dashboard or authentication screens. */
import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "@/types/chat";
import {
  api,
  ApiError,
  getSessionToken,
  onSessionExpired,
} from "@/services/api";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { BrutalColors, Fonts } from "@/constants/theme";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { LandingView } from "@/components/LandingView";
import { LoginView } from "@/components/LoginView";
import { DashboardView } from "@/components/DashboardView";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<"landing" | "login" | "register">(
    "landing",
  );
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
              setAuthView("login");
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
      await api.logout();
      setSessionError("");
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Server logout could not be confirmed.",
      );
    } finally {
      setCurrentUser(null);
      setAuthView("landing");
    }
  };

  if (sessionError) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <BrutalCard style={styles.loadingCard}>
          <Text accessibilityRole="alert" style={styles.loadingTitle}>
            CONNECTION REQUIRED
          </Text>
          <Text style={styles.loadingSubtitle}>{sessionError}</Text>
          <BrutalButton
            title="TRY AGAIN"
            onPress={() => {
              setLoading(true);
              setSessionError("");
              setSessionAttempt((attempt) => attempt + 1);
            }}
          />
          <BrutalButton
            title="SIGN OUT"
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
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>F</Text>
          </View>
          <Text style={styles.loadingTitle}>LOADING...</Text>
          <Text style={styles.loadingSubtitle}>CHECKING SESSION</Text>
          <ActivityIndicator
            size="small"
            color={BrutalColors.ink}
            style={{ marginTop: 8 }}
          />
        </BrutalCard>
      </SafeAreaView>
    );
  }

  if (currentUser) {
    return (
      <DashboardView
        currentUser={currentUser}
        onLogout={handleLogout}
        onProfileUpdated={setCurrentUser}
      />
    );
  }

  if (authView === "login" || authView === "register") {
    return (
      <LoginView
        initialMode={authView}
        onSuccess={handleAuth}
        onBackToLanding={() => setAuthView("landing")}
      />
    );
  }

  return (
    <LandingView
      onLogin={() => setAuthView("login")}
      onSignUp={() => setAuthView("register")}
    />
  );
}

const styles = StyleSheet.create({
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
  logoBadge: {
    width: 56,
    height: 56,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 32,
    color: BrutalColors.ink,
  },
  loadingTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.5,
    color: BrutalColors.ink,
  },
  loadingSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: "800",
    color: BrutalColors.inkMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
