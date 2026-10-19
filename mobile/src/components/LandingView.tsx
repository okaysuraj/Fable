/** Public native introduction and entry into email/password authentication. */
import React from "react";
import { View, Text, ScrollView, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrutalColors, Fonts } from "@/constants/theme";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalCard } from "./brutal/BrutalCard";
import { BrutalTag } from "./brutal/BrutalTag";

interface LandingViewProps {
  onLogin: () => void;
  onSignUp: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onLogin,
  onSignUp,
}) => {
  const features = [
    {
      title: "TEXT CHANNELS",
      desc: "Organized rooms for every topic. Share messages and reactions with your team.",
      accent: BrutalColors.accentYellow,
      icon: "#",
    },
    {
      title: "PRIVATE ROOMS",
      desc: "Choose who can join the conversation, and manage membership in one place.",
      accent: BrutalColors.accentPink,
      icon: "◉",
    },
    {
      title: "MESSAGE HISTORY",
      desc: "Find earlier conversations with full-history search, and pin messages you need again.",
      accent: BrutalColors.accentBlue,
      icon: "▶",
    },
    {
      title: "SHARED WORKSPACES",
      desc: "Invite your team, manage roles, and keep separate projects in their own spaces.",
      accent: BrutalColors.accentGreen,
      icon: "~",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BrutalColors.bgPaper}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ NAV BAR ═══ */}
        <View style={styles.navBar}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>F</Text>
            </View>
            <Text style={styles.logoText}>FABLE</Text>
          </View>

          <View style={styles.navActions}>
            <BrutalButton
              title="LOG IN"
              onPress={onLogin}
              variant="outline"
              size="sm"
            />
            <BrutalButton
              title="SIGN UP"
              onPress={onSignUp}
              variant="yellow"
              size="sm"
            />
          </View>
        </View>

        {/* ═══ HERO SECTION ═══ */}
        <View style={styles.heroSection}>
          <BrutalTag
            label="NOW IN BETA"
            color={BrutalColors.accentYellow}
            dotColor={BrutalColors.accentGreen}
            style={styles.heroTag}
          />

          <View style={styles.headlineContainer}>
            <Text style={styles.headline}>TALK</Text>
            <Text style={[styles.headline, { color: BrutalColors.accentPink }]}>
              BOLD.
            </Text>
            <Text style={styles.headline}>BUILD</Text>
            <Text style={[styles.headline, { color: BrutalColors.accentBlue }]}>
              LOUD.
            </Text>
          </View>

          <Text style={styles.subhead}>
            A shared workspace for creative studios. Keep conversations
            organized and build together.
          </Text>

          <View style={styles.ctaRow}>
            <BrutalButton
              title="GET STARTED →"
              onPress={onSignUp}
              variant="yellow"
              size="lg"
              style={styles.ctaPrimary}
            />
            <BrutalButton
              title="I HAVE AN ACCOUNT"
              onPress={onLogin}
              variant="outline"
              size="lg"
              style={styles.ctaSecondary}
            />
          </View>
        </View>

        {/* ═══ FEATURE CARDS ═══ */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionHeader}>STUDIO ARSENAL</Text>
          {features.map((item) => (
            <BrutalCard key={item.title} style={styles.featureCard}>
              <View style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIconBadge,
                    { backgroundColor: item.accent },
                  ]}
                >
                  <Text style={styles.featureIconText}>{item.icon}</Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            </BrutalCard>
          ))}
        </View>

        {/* ═══ FOOTER STRIP ═══ */}
        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <View style={styles.footerLogoBadge}>
              <Text style={styles.footerLogoText}>F</Text>
            </View>
            <Text style={styles.footerBrandText}>FABLE STUDIO © 2026</Text>
          </View>
          <Text style={styles.footerMetaText}>
            CONVERSATIONS FOR CREATIVE TEAMS
          </Text>
        </View>
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
    paddingBottom: 24,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
    backgroundColor: BrutalColors.bgCard,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadge: {
    width: 38,
    height: 38,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 22,
    color: BrutalColors.ink,
  },
  logoText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: -0.5,
    color: BrutalColors.ink,
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 36,
  },
  heroTag: {
    marginBottom: 16,
  },
  headlineContainer: {
    marginBottom: 16,
  },
  headline: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -1.5,
    color: BrutalColors.ink,
  },
  subhead: {
    fontFamily: Fonts?.sans,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    color: BrutalColors.inkSecondary,
    marginBottom: 24,
  },
  ctaRow: {
    gap: 12,
    marginBottom: 28,
  },
  ctaPrimary: {
    width: "100%",
  },
  ctaSecondary: {
    width: "100%",
  },
  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarStack: {
    flexDirection: "row",
  },
  proofAvatar: {
    width: 32,
    height: 32,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  proofAvatarText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: "800",
    color: BrutalColors.ink,
  },
  proofText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: "700",
    color: BrutalColors.inkMuted,
    letterSpacing: 0.5,
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  sectionHeader: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 0.5,
    color: BrutalColors.ink,
    marginBottom: 4,
  },
  featureCard: {
    padding: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconBadge: {
    width: 44,
    height: 44,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconText: {
    fontFamily: Fonts?.mono,
    fontWeight: "900",
    fontSize: 20,
    color: BrutalColors.ink,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
    color: BrutalColors.ink,
    marginBottom: 4,
  },
  featureDesc: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: BrutalColors.inkSecondary,
  },
  footer: {
    backgroundColor: BrutalColors.ink,
    borderTopWidth: 3,
    borderTopColor: BrutalColors.border,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLogoBadge: {
    width: 26,
    height: 26,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLogoText: {
    fontFamily: Fonts?.sans,
    fontWeight: "900",
    fontSize: 14,
    color: BrutalColors.ink,
  },
  footerBrandText: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.7)",
  },
  footerMetaText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 0.8,
  },
});
