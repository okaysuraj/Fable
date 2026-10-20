/** Native authentication opens immediately and keeps verification/recovery in the same flow. */
import React, { useRef, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TextInput, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import { useBrutalStyles, useBrutalTheme, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { BrutalButton } from "./brutal/BrutalButton";
import { AppIcon, type AppIconName } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";
import { api, authError } from "@/services/api";
import type { User } from "@/types/chat";
import { devAuthEnabled } from "@/services/developmentAuth";
import { FableBrand } from "./FableBrand";
import { firebaseConfigured } from "@/services/firebaseConfig";
import { googleSignInUnavailableReason } from "@/services/googleSignIn";

interface LoginViewProps {
  onSuccess: (user: User) => void;
  initialMode?: "login" | "register";
}

function AuthField({ label, icon, secret = false, ...props }: TextInputProps & {
  label: string; icon: AppIconName; secret?: boolean;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && { borderColor: colors.primary }]}>
        <AppIcon name={icon} size={20} color={focused ? colors.primary : colors.inkMuted} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          autoCorrect={false}
          secureTextEntry={secret && !visible}
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        />
        {secret && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            accessibilityState={{ selected: visible }}
            onPress={() => setVisible(!visible)}
            style={styles.eyeButton}
          >
            <AppIcon name={visible ? "eyeOff" : "eye"} size={21} color={colors.inkMuted} />
          </MotionPressable>
        )}
      </View>
    </View>
  );
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, initialMode = "login" }) => {
  const styles = useBrutalStyles(createStyles);
  const colors = useBrutalTheme();
  const [mode, setMode] = useState<"login" | "register" | "reset">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);


  const handleSubmit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
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
        if (password !== confirmation)
          throw new Error("Your passwords don't match.");
        await api.register(email.trim(), password, name.trim());
        setNotice(
          "Verification email sent. Open the link in your inbox, then return here to sign in.",
        );
        setVerificationPending(true);
        setResendAfter(Date.now() + 60_000);
        setMode("login");
        setPassword("");
        setConfirmation("");
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
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (inFlight.current) return;
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
    inFlight.current = true;
    try {
      await api.resendVerification(email.trim(), password);
      setResendAfter(Date.now() + 60_000);
      setNotice(
        "A new verification link has been sent. Check your inbox and spam folder.",
      );
    } catch (err) {
      setError(authError(err));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setGoogleLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await api.loginWithGoogle();
      if (result) onSuccess(result.user);
    } catch (failure) {
      setError(authError(failure));
    } finally {
      inFlight.current = false;
      setLoading(false);
      setGoogleLoading(false);
    }
  };


  const changeMode = (next: "login" | "register" | "reset") => {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmation("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={styles.header}>
            <Image source={require("../../assets/brand/icon.png")} style={styles.appMark} accessible={false} />
            <FableBrand />
            <Text accessibilityRole="header" style={styles.title}>
              {mode === "reset" ? "Let's get you back in." : mode === "register" ? "A little closer starts here." : "Welcome to your people."}
            </Text>
            <Text style={styles.subtitle}>
              {devAuthEnabled ? "Open your local account and pick up the conversation."
                : mode === "reset" ? "We'll email you a link to reset your password."
                : mode === "register" ? "Create an account to start your next conversation."
                : "Sign in to pick up where you left off."}
            </Text>
          </View>

          <View style={styles.form}>
            {devAuthEnabled ? (
              <BrutalButton title={loading ? "Opening chats…" : "Continue in development"} size="lg"
                disabled={loading} icon={<AppIcon name="chats" color={colors.onPrimary} size={21} />}
                onPress={() => {
                  if (inFlight.current) return;
                  inFlight.current = true;
                  setLoading(true);
                  setError("");
                  void api.startDevelopment().then((result) => onSuccess(result.user))
                    .catch((failure: unknown) => setError(authError(failure)))
                    .finally(() => { inFlight.current = false; setLoading(false); });
                }} />
            ) : (
              <>
                {!firebaseConfigured && (
                  <View style={styles.noticeBox}>
                    <AppIcon name="info" size={20} />
                    <Text accessibilityRole="alert" style={styles.noticeText}>Sign-in is not configured for this build yet.</Text>
                  </View>
                )}
                {mode !== "reset" && (
                  <>
                    <BrutalButton title={googleLoading ? "Connecting to Google…" : "Continue with Google"}
                      variant="outline" size="lg" onPress={handleGoogle}
                      disabled={loading || Boolean(googleSignInUnavailableReason)}
                      icon={<AppIcon name="google" color={colors.ink} size={21} />} />
                    {googleSignInUnavailableReason && firebaseConfigured ? (
                      <Text style={styles.helper}>{googleSignInUnavailableReason}</Text>
                    ) : null}
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} /><Text style={styles.dividerText}>or sign in with email</Text><View style={styles.dividerLine} />
                    </View>
                  </>
                )}

                {mode === "register" && (
                  <AuthField label="Your name" icon="profile" value={name} onChangeText={setName}
                    placeholder="Your name" autoComplete="name" maxLength={80} editable={!loading} autoCapitalize="words" />
                )}
                <AuthField label="Email" icon="mail" value={email} onChangeText={setEmail}
                  placeholder="you@example.com" autoComplete="email" keyboardType="email-address"
                  textContentType="emailAddress" maxLength={254} editable={!loading} autoCapitalize="none" />
                {mode !== "reset" && (
                  <AuthField label="Password" icon="lock" secret value={password} onChangeText={setPassword}
                    placeholder={mode === "register" ? "At least 12 characters" : "Your password"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    textContentType={mode === "register" ? "newPassword" : "password"}
                    maxLength={128} editable={!loading} autoCapitalize="none"
                    returnKeyType={mode === "login" ? "go" : "next"}
                    onSubmitEditing={mode === "login" ? () => void handleSubmit() : undefined} />
                )}
                {mode === "register" && (
                  <AuthField label="Confirm password" icon="lock" secret value={confirmation}
                    onChangeText={setConfirmation} placeholder="Repeat your password" autoComplete="new-password"
                    textContentType="newPassword" maxLength={128} editable={!loading} autoCapitalize="none" />
                )}
                {mode === "login" && (
                  <MotionPressable accessibilityRole="button" disabled={loading} onPress={() => changeMode("reset")} style={styles.forgot}>
                    <Text style={styles.link}>Forgot password?</Text>
                  </MotionPressable>
                )}
                {mode === "register" && (
                  <Text style={styles.helper}>Use at least 12 characters. We’ll send a link to verify your email before you sign in.</Text>
                )}
                {notice ? (
                  <View style={styles.noticeBox}>
                    <AppIcon name="check" size={21} />
                    <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text>
                  </View>
                ) : null}
                {error ? (
                  <View style={styles.errorBox}>
                    <AppIcon name="alert" size={21} color={colors.dangerButton} />
                    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                <BrutalButton
                  title={loading ? "One moment…" : mode === "reset" ? "Send reset link" : mode === "login" ? "Sign in" : "Create account"}
                  size="lg" onPress={handleSubmit} disabled={loading || !firebaseConfigured} style={styles.submit}
                  icon={loading ? undefined : <AppIcon name={mode === "reset" ? "mail" : "forward"} size={20} color={colors.onPrimary} />} />
                {mode === "login" && verificationPending && (
                  <BrutalButton title="Resend verification email" onPress={handleResend} disabled={loading} variant="outline"
                    icon={<AppIcon name="mail" size={19} color={colors.inkSecondary} />} />
                )}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>{mode === "login" ? "New to Fable?" : mode === "register" ? "Already have an account?" : "Remember your password?"}</Text>
                  <MotionPressable accessibilityRole="button" disabled={loading}
                    onPress={() => changeMode(mode === "login" ? "register" : "login")} style={styles.footerLink}>
                    <Text style={styles.link}>{mode === "login" ? "Create account" : "Sign in"}</Text>
                  </MotionPressable>
                </View>
              </>
            )}
            {devAuthEnabled && error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          </View>
          <Text style={styles.tagline}>Good conversations belong here.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: BrutalPalette) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bgPaper },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 28, paddingTop: 40, paddingBottom: 28, maxWidth: 460, width: "100%", alignSelf: "center" },
  header: { alignItems: "flex-start", marginBottom: 32 },
  appMark: { width: 58, height: 58, borderRadius: 17, marginBottom: 18 },
  title: { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -1.1, color: colors.ink, marginTop: 24 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, color: colors.inkMuted, marginTop: 10, maxWidth: 340 },
  form: { gap: 17 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: Fonts.medium, fontSize: 13, color: colors.inkSecondary },
  field: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingLeft: 16, paddingRight: 4, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.bgCardAlt },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 14, paddingRight: 12, color: colors.ink, fontFamily: Fonts.sans, fontSize: 16 },
  eyeButton: { width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  forgot: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center", paddingHorizontal: 4, marginTop: -8, marginBottom: -8 },
  link: { fontFamily: Fonts.medium, fontSize: 14, color: colors.primary },
  divider: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 6 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontFamily: Fonts.sans, fontSize: 12, color: colors.inkMuted },
  helper: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, color: colors.inkMuted },
  noticeBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, backgroundColor: colors.selection, borderRadius: 14 },
  noticeText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21, color: colors.inkSecondary },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, backgroundColor: colors.dangerSurface, borderRadius: 14 },
  errorText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21, color: colors.dangerButton },
  submit: { minHeight: 54, marginTop: 3 },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 },
  footerText: { fontFamily: Fonts.sans, fontSize: 14, color: colors.inkMuted },
  footerLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  tagline: { fontFamily: Fonts.sans, fontSize: 12, color: colors.inkFaint, textAlign: "center", paddingTop: 26 },
});
