/** Native public introduction presents the app's actual collaboration features. */
import React from "react";
import { View, Text, ScrollView, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrutalColors as colors, Fonts } from "@/constants/theme";
import { BrutalButton } from "./brutal/BrutalButton";
import { FableBrand } from "./FableBrand";
import { devAuthEnabled } from "@/services/developmentAuth";

interface LandingViewProps {
  onLogin: () => void;
  onSignUp: () => void;
}
const features = [
  {
    symbol: "#",
    title: "Chat to focus",
    copy: "Organize projects in public or private chats, with membership you control.",
  },
  {
    symbol: "⌕",
    title: "Nothing gets lost",
    copy: "Search past conversations and pin the messages worth coming back to.",
  },
  {
    symbol: "○",
    title: "Your group, connected",
    copy: "Invite people, manage roles, and keep separate projects in their own groups.",
  },
];
export const LandingView: React.FC<LandingViewProps> = ({
  onLogin,
  onSignUp,
}) => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.bgPaper} />
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.navigation}>
        <FableBrand />
        <BrutalButton
          title={devAuthEnabled ? "Open Fable" : "Log in"}
          variant="outline"
          size="sm"
          onPress={onLogin}
        />
      </View>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.headline}>
          Your group.{"\n"}In good company.
        </Text>
        <Text style={styles.copy}>
          Big ideas, small updates, and everything in between. Give your group a
          place to talk, share, and move work forward.
        </Text>
        <BrutalButton
          title={devAuthEnabled ? "Open your group" : "Create your group"}
          onPress={devAuthEnabled ? onLogin : onSignUp}
          size="lg"
        />
      </View>
      <View style={styles.board}>
        <Text style={styles.boardCaption}>A place for every idea.</Text>
        <View style={styles.conversation}>
          <View style={styles.symbol}>
            <Text style={styles.symbolText}>···</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.boardTitle}>Start a conversation.</Text>
            <Text style={styles.boardCopy}>
              Bring your people into the chat.
            </Text>
          </View>
        </View>
        <View style={styles.boardFeatures}>
          <View style={styles.boardFeature}>
            <Text style={styles.boardFeatureText}>Find your people</Text>
          </View>
          <View style={[styles.boardFeature, { backgroundColor: "#D9F5EF" }]}>
            <Text style={[styles.boardFeatureText, { color: "#22594E" }]}>
              Keep the good ideas
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.details}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Built around the conversation.
        </Text>
        {features.map((feature) => (
          <View key={feature.title} style={styles.feature}>
            <View style={styles.featureSymbol}>
              <Text style={styles.featureGlyph}>{feature.symbol}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureCopy}>{feature.copy}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <FableBrand />
        <Text style={styles.footerCopy}>A shared space for your group.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>
);
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bgPaper },
  content: {
    padding: 24,
    paddingBottom: 36,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  hero: { paddingTop: 46, paddingBottom: 32, gap: 24 },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 43,
    lineHeight: 51,
    letterSpacing: -2,
    color: colors.ink,
  },
  copy: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 28,
    color: colors.inkSecondary,
  },
  board: {
    backgroundColor: "#0067DD",
    borderRadius: 24,
    borderBottomLeftRadius: 7,
    padding: 22,
    gap: 22,
  },
  boardCaption: { fontFamily: Fonts.medium, fontSize: 14, color: "#E8EDFF" },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F4F6FF",
    padding: 20,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
  },
  symbol: {
    width: 42,
    height: 48,
    backgroundColor: "#EAD8FF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  symbolText: { fontFamily: Fonts.semibold, fontSize: 26, color: "#24304B" },
  boardTitle: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 27,
    color: "#24304B",
  },
  boardCopy: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 20,
    color: "#50617D",
    marginTop: 6,
  },
  boardFeatures: { flexDirection: "row", gap: 12 },
  boardFeature: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#0059C1",
    justifyContent: "center",
  },
  boardFeatureText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 21,
    color: "#FFFFFF",
  },
  details: { paddingTop: 42, gap: 26 },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 27,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingTop: 22,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  featureSymbol: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  featureGlyph: {
    fontFamily: Fonts.semibold,
    fontSize: 24,
    color: colors.primary,
  },
  featureTitle: { fontFamily: Fonts.semibold, fontSize: 16, color: colors.ink },
  featureCopy: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 24,
    color: colors.inkMuted,
    marginTop: 8,
  },
  footer: {
    paddingTop: 28,
    marginTop: 36,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  footerCopy: { fontFamily: Fonts.sans, fontSize: 12, color: colors.inkMuted },
});
