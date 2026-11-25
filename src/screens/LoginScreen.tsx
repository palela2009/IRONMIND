import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette } from '../theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../config/firebase';

GoogleSignin.configure({
  webClientId: '1094826576454-rus44gke6b6f1o6ujunucs8dk0kfurub.apps.googleusercontent.com',
});

const friendlyAuthError = (error: any): string => {
  const code = String(error?.code ?? '');
  if (code === 'auth/invalid-email') return 'That email address does not look valid.';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Incorrect email or password. Try again or reset your password.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try logging in instead.';
  if (code === 'auth/weak-password') return 'Choose a stronger password (at least 6 characters).';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a minute and try again.';
  if (code === 'auth/network-request-failed') return 'No internet connection. Check your network and try again.';
  return error?.message || 'Something went wrong. Please try again.';
};

export const LoginScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    if (googleBusy || submitting) return;
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      const idToken = response.data?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      }
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED || error?.code === statusCodes.IN_PROGRESS) return;
      appAlert('Google Sign-In Error', friendlyAuthError(error));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password) {
      appAlert('Missing info', 'Enter both your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error: any) {
      appAlert(mode === 'signup' ? 'Could not create account' : 'Could not log in', friendlyAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      appAlert('Enter your email first', 'Type your account email in the field above, then tap Forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmed);
      appAlert('Reset link sent', `Check ${trimmed} for a password reset link.`);
    } catch (error: any) {
      appAlert('Could not send reset email', friendlyAuthError(error));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.centerBlock}>
          <Image source={require('../../assets/icon.png')} style={styles.logoBox} />
          <Text style={styles.mainTitle}>IRONMIND</Text>
          <Text style={styles.tagline}>Train your attention. Beat the feed.</Text>
        </View>

        <View style={styles.actionBlock}>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
              onPress={() => setMode('signin')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>LOG IN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
              onPress={() => setMode('signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>SIGN UP</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={palette.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'signin' && (
            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} activeOpacity={0.8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEmailSubmit}
            disabled={submitting || googleBusy}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={palette.accentContrast} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={googleBusy || submitting}
            activeOpacity={0.85}
          >
            {googleBusy ? (
              <ActivityIndicator color={palette.accentContrast} />
            ) : (
              <Text style={styles.buttonText}>G  Continue with Google</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.footerNote}>Become the master of your screen reflex.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 48, paddingTop: 92 },
  centerBlock: { alignItems: 'center', marginBottom: 36 },
  logoBox: { width: 76, height: 76, borderRadius: 20, marginBottom: 16 },
  mainTitle: { color: c.textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: 1.2 },
  tagline: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 6 },
  actionBlock: { width: '100%' },

  modeSwitch: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  modeTab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modeTabActive: { backgroundColor: c.accent },
  modeTabText: { color: c.textSecondary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  modeTabTextActive: { color: c.accentContrast },

  input: {
    backgroundColor: c.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 4, marginBottom: 10 },
  forgotText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },

  primaryButton: { backgroundColor: c.accent, borderRadius: 18, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 20 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.surfaceRaised },
  dividerText: { color: c.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  googleButton: { backgroundColor: c.textPrimary, borderRadius: 18, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  buttonText: { color: c.accentContrast, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  footerNote: { color: c.textTertiary, fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
