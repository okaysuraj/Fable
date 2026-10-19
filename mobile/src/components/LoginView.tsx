/** Native email forms support verification and recovery without exposing protected content. */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrutalColors, Fonts } from "@/constants/theme";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalCard } from "./brutal/BrutalCard";
import { BrutalInput } from "./brutal/BrutalInput";
import { api, authError } from "@/services/api";
import { User } from "@/types/chat";

interface LoginViewProps {
  onSuccess: (user: User) => void;
  onBackToLanding: () => void;
  initialMode?: "login" | "register";
}

export const LoginView: React.FC<LoginViewProps> = ({
  onSuccess,
  onBackToLanding,
  initialMode = "login",
}) => {
  const [mode, setMode] = useState<"login" | "register" | "reset">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);

  const handleSubmit = async () => {
    if (loading) return;
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "reset") {
        if (!email.trim()) throw new Error("Enter your email address.");
        await api.resetPassword(email.trim());
        setNotice(
          "If an account exists for this email, a password reset link will arrive in your inbox. Check your spam folder too.",
        );
      } else if (mode === "register") {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        if (!email.trim() || !password.trim()) {
          setError("Email and password required");
          setLoading(false);
          return;
        }
        await api.register(email.trim(), password, name.trim());
        setNotice(
          "Verification email sent. Open the link in your inbox, then return here to sign in.",
        );
        setVerificationPending(true);
        setResendAfter(Date.now() + 60_000);
        setMode("login");
        setPassword("");
      } else {
        if (!email.trim() || !password.trim()) {
          setError("Email and password required");
          setLoading(false);
          return;
        }
        const res = await api.login(email.trim(), password);
        onSuccess(res.user);
      }
    } catch (err: unknown) {
      if (err instanceof Error && /verify your email/i.test(err.message))
        setVerificationPending(true);
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;
    setError("");
    if (Date.now() < resendAfter) {
      setError(
        "Please wait a minute before requesting another verification email.",
      );
      return;
    }
    if (!email.trim() || !password) {
      setError(
        "Enter your email and password to resend the verification link.",
      );
      return;
    }
    setLoading(true);
    try {
      await api.resendVerification(email.trim(), password);
      setResendAfter(Date.now() + 60_000);
      setNotice(
        "A new verification link has been sent. Check your inbox and spam folder.",
      );
    } catch (err) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BrutalColors.bgPaper}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back and Brand Header */}
        <View style={styles.header}>
          <Pressable onPress={onBackToLanding} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← BACK</Text>
          </Pressable>

          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>F</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>FABLE</Text>
              <Text style={styles.logoSubtitle}>
                {mode === "login"
                  ? "WELCOME BACK"
                  : mode === "reset"
                    ? "RESET YOUR PASSWORD"
                    : "JOIN THE STUDIO"}
              </Text>
            </View>
          </View>
        </View>

        {/* Auth Card */}
        <BrutalCard style={styles.authCard}>
          {/* Mode Tabs */}
          <View style={styles.tabsContainer}>
            <Pressable
              disabled={loading}
              onPress={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
              style={[
                styles.tab,
                mode === "login" ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "login"
                    ? styles.tabTextActive
                    : styles.tabTextInactive,
                ]}
              >
                LOG IN
              </Text>
            </Pressable>

            <Pressable
              disabled={loading}
              onPress={() => {
                setMode("register");
                setError("");
                setNotice("");
              }}
              style={[
                styles.tab,
                { borderLeftWidth: 3, borderLeftColor: BrutalColors.border },
                mode === "register" ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "register"
                    ? styles.tabTextActive
                    : styles.tabTextInactive,
                ]}
              >
                SIGN UP
              </Text>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {mode === "register" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>YOUR NAME</Text>
                <BrutalInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  accessibilityLabel="Your name"
                  autoComplete="name"
                  maxLength={80}
                  editable={!loading}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <BrutalInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@studio.com"
                accessibilityLabel="Email"
                autoComplete="email"
                maxLength={254}
                editable={!loading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {mode !== "reset" && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <BrutalInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  accessibilityLabel="Password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  maxLength={128}
                  editable={!loading}
                  autoCapitalize="none"
                />
              </View>
            )}

            {notice ? (
              <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                {notice}
              </Text>
            ) : null}
            {mode === "register" ? (
              <Text style={styles.noticeText}>
                Verify your email before signing in. Use at least 12 characters
                for your password.
              </Text>
            ) : null}

            {/* Error Banner */}
            {error ? (
              <View style={styles.errorBox}>
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={styles.errorText}
                >
                  ✕ {error}
                </Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <BrutalButton
              title={
                loading
                  ? "WORKING..."
                  : mode === "reset"
                    ? "SEND RESET LINK"
                    : mode === "login"
                      ? "ENTER THE STUDIO →"
                      : "CREATE ACCOUNT →"
              }
              onPress={handleSubmit}
              variant="yellow"
              size="lg"
              disabled={loading}
              style={styles.submitBtn}
            />

            {mode === "login" && (
              <BrutalButton
                title="FORGOT PASSWORD?"
                onPress={() => {
                  setMode("reset");
                  setError("");
                  setNotice("");
                  setPassword("");
                }}
                disabled={loading}
                variant="outline"
              />
            )}
            {mode === "login" && verificationPending && (
              <BrutalButton
                title="RESEND VERIFICATION EMAIL"
                onPress={handleResend}
                disabled={loading}
                variant="outline"
              />
            )}
          </View>
        </BrutalCard>

        <Text style={styles.tagline}>YOUR WORKSPACE, CONNECTED</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrutalColors.bgPaper,
  },
  scrollContent: {
    padding: 20,
    justifyContent: "center",
    minHeight: "100%",
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCard,
  },
  backBtnText: {
    fontFamily: Fonts?.mono,
    fontWeight: "800",
    fontSize: 11,
    color: BrutalColors.ink,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 48,
    height: 48,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 28,
    color: BrutalColors.ink,
  },
  logoTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 26,
    letterSpacing: -0.5,
    color: BrutalColors.ink,
  },
  logoSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: "800",
    color: BrutalColors.inkMuted,
    letterSpacing: 1,
  },
  authCard: {
    padding: 0,
    overflow: "hidden",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: BrutalColors.ink,
  },
  tabInactive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabTextInactive: {
    color: BrutalColors.ink,
  },
  form: {
    padding: 20,
    gap: 16,
  },
  noticeText: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 21,
    color: BrutalColors.inkSecondary,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts?.sans,
    fontWeight: "800",
    fontSize: 11,
    color: BrutalColors.inkSecondary,
    letterSpacing: 0.8,
  },
  errorBox: {
    backgroundColor: "#FFE0E9",
    borderWidth: 2.5,
    borderColor: BrutalColors.accentPink,
    borderRadius: 4,
    padding: 10,
  },
  errorText: {
    fontFamily: Fonts?.sans,
    fontWeight: "800",
    fontSize: 13,
    color: BrutalColors.accentPink,
  },
  submitBtn: {
    width: "100%",
    marginTop: 4,
  },
  tagline: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: "700",
    color: BrutalColors.inkMuted,
    textAlign: "center",
    marginTop: 24,
    letterSpacing: 0.8,
  },
});
