import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { User } from '@/types';
import { api } from '@/services/api';
import { BrutalColors, Fonts } from '@/constants/theme';
import { BrutalCard } from '@/components/brutal/BrutalCard';
import { LandingView } from '@/components/LandingView';
import { LoginView } from '@/components/LoginView';
import { DashboardView } from '@/components/DashboardView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'landing' | 'login' | 'register'>('landing');
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    api
      .fetchMe()
      .then((res) => {
        setCurrentUser(res.user);
      })
      .catch(() => {
        // Not authenticated
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = (user: User, token: string) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setAuthView('landing');
  };

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
    return <DashboardView currentUser={currentUser} onLogout={handleLogout} />;
  }

  if (authView === 'login' || authView === 'register') {
    return (
      <LoginView
        initialMode={authView}
        onSuccess={handleAuth}
        onBackToLanding={() => setAuthView('landing')}
      />
    );
  }

  return (
    <LandingView
      onLogin={() => setAuthView('login')}
      onSignUp={() => setAuthView('register')}
    />
  );
}

const styles = StyleSheet.create({
  loadingArea: {
    flex: 1,
    backgroundColor: BrutalColors.bgPaper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 56,
    height: 56,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 32,
    color: BrutalColors.ink,
  },
  loadingTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
    color: BrutalColors.ink,
  },
  loadingSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
