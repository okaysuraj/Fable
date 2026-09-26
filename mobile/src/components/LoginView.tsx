import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { BrutalButton } from './brutal/BrutalButton';
import { BrutalCard } from './brutal/BrutalCard';
import { BrutalInput } from './brutal/BrutalInput';
import { api } from '@/services/api';
import { User } from '@/types';

interface LoginViewProps {
  onSuccess: (user: User, token: string) => void;
  onBackToLanding: () => void;
  initialMode?: 'login' | 'register';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onSuccess,
  onBackToLanding,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        if (!email.trim() || !password.trim()) {
          setError('Email and password required');
          setLoading(false);
          return;
        }
        const res = await api.register(email.trim(), password, name.trim());
        onSuccess(res.user, res.token);
      } else {
        if (!email.trim() || !password.trim()) {
          setError('Email and password required');
          setLoading(false);
          return;
        }
        const res = await api.login(email.trim(), password);
        onSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('suraj@fable.studio');
    setPassword('password123');
    setError('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrutalColors.bgPaper} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE STUDIO'}
              </Text>
            </View>
          </View>
        </View>

        {/* Auth Card */}
        <BrutalCard style={styles.authCard}>
          {/* Mode Tabs */}
          <View style={styles.tabsContainer}>
            <Pressable
              onPress={() => {
                setMode('login');
                setError('');
              }}
              style={[
                styles.tab,
                mode === 'login' ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'login' ? styles.tabTextActive : styles.tabTextInactive,
                ]}
              >
                LOG IN
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode('register');
                setError('');
              }}
              style={[
                styles.tab,
                { borderLeftWidth: 3, borderLeftColor: BrutalColors.border },
                mode === 'register' ? styles.tabActive : styles.tabInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === 'register' ? styles.tabTextActive : styles.tabTextInactive,
                ]}
              >
                SIGN UP
              </Text>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {mode === 'register' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>YOUR NAME</Text>
                <BrutalInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Suraj"
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
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <BrutalInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>✕ {error}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <BrutalButton
              title={
                loading
                  ? 'WORKING...'
                  : mode === 'login'
                  ? 'ENTER THE STUDIO →'
                  : 'CREATE ACCOUNT →'
              }
              onPress={handleSubmit}
              variant="yellow"
              size="lg"
              disabled={loading}
              style={styles.submitBtn}
            />

            {/* Demo Helper Button */}
            {mode === 'login' && (
              <Pressable onPress={handleFillDemo} style={styles.demoBox}>
                <Text style={styles.demoText}>DEMO: suraj@fable.studio / password123</Text>
                <Text style={styles.demoFillHint}>(TAP TO QUICK-FILL)</Text>
              </Pressable>
            )}
          </View>
        </BrutalCard>

        <Text style={styles.tagline}>
          ENCRYPTED · END-TO-END · BUILT DIFFERENT
        </Text>
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
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    alignSelf: 'flex-start',
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
    fontWeight: '800',
    fontSize: 11,
    color: BrutalColors.ink,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 48,
    height: 48,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 28,
    color: BrutalColors.ink,
  },
  logoTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: -0.5,
    color: BrutalColors.ink,
  },
  logoSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
    letterSpacing: 1,
  },
  authCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: BrutalColors.ink,
  },
  tabInactive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: BrutalColors.ink,
  },
  form: {
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 11,
    color: BrutalColors.inkSecondary,
    letterSpacing: 0.8,
  },
  errorBox: {
    backgroundColor: '#FFE0E9',
    borderWidth: 2.5,
    borderColor: BrutalColors.accentPink,
    borderRadius: 4,
    padding: 10,
  },
  errorText: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 13,
    color: BrutalColors.accentPink,
  },
  submitBtn: {
    width: '100%',
    marginTop: 4,
  },
  demoBox: {
    borderTopWidth: 2,
    borderTopColor: BrutalColors.inkFaint,
    borderStyle: 'dashed',
    paddingTop: 12,
    alignItems: 'center',
    gap: 4,
  },
  demoText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    color: BrutalColors.inkSecondary,
    textAlign: 'center',
  },
  demoFillHint: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.accentBlue,
  },
  tagline: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 0.8,
  },
});
