import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../config/firebase';


GoogleSignin.configure({
  webClientId: '1094826576454-rus44gke6b6f1o6ujunucs8dk0kfurub.apps.googleusercontent.com',
});

export const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });


      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        console.log('Successfully authenticated with Firebase!');
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('Sign-In Error', error.message);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter both your email and password.');
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
      Alert.alert(mode === 'signup' ? 'Sign-Up Error' : 'Sign-In Error', error.message);
    }
    setSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.centerBlock}>
          <View style={styles.logoBox}><Text style={styles.logoText}>IM</Text></View>
          <Text style={styles.mainTitle}>IRONMIND</Text>
          <Text style={styles.tagline}>Train your attention.</Text>
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
            placeholderTextColor="#555555"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#555555"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEmailSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.buttonText}>{mode === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
            <Text style={styles.buttonText}>G  Continue with Google</Text>
          </TouchableOpacity>
          <Text style={styles.footerNote}>Become the master of your screen reflex.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 50, paddingTop: 100 },
  centerBlock: { alignItems: 'center', marginBottom: 40 },
  logoBox: { backgroundColor: '#CCFF00', width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#000000', fontSize: 24, fontWeight: '900' },
  mainTitle: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  tagline: { color: '#666666', fontSize: 15, fontWeight: '500', marginTop: 6 },
  actionBlock: { width: '100%' },

  modeSwitch: { flexDirection: 'row', backgroundColor: '#141414', borderRadius: 14, padding: 4, marginBottom: 16 },
  modeTab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modeTabActive: { backgroundColor: '#CCFF00' },
  modeTabText: { color: '#666666', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  modeTabTextActive: { color: '#000000' },

  input: {
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222222',
  },

  primaryButton: { backgroundColor: '#CCFF00', borderRadius: 20, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 20 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1E1E1E' },
  dividerText: { color: '#444444', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  googleButton: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  footerNote: { color: '#444444', fontSize: 12, textAlign: 'center', fontWeight: '600' }
});
