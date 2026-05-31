import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';


GoogleSignin.configure({
  webClientId: '1094826576454-rus44gke6b6f1o6ujunucs8dk0kfurub.apps.googleusercontent.com',
});

export const LoginScreen: React.FC = () => {
  
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

  return (
    <View style={styles.container}>
      <View style={styles.centerBlock}>
        <View style={styles.logoBox}><Text style={styles.logoText}>IM</Text></View>
        <Text style={styles.mainTitle}>IRONMIND</Text>
        <Text style={styles.tagline}>Train your attention.</Text>
      </View>

      <View style={styles.actionBlock}>
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.buttonText}>G  Continue with Google</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>Become the master of your screen reflex.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808', paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 50 },
  centerBlock: { alignItems: 'center', marginTop: 180 },
  logoBox: { backgroundColor: '#CCFF00', width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#000000', fontSize: 24, fontWeight: '900' },
  mainTitle: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  tagline: { color: '#666666', fontSize: 15, fontWeight: '500', marginTop: 6 },
  actionBlock: { width: '100%' },
  googleButton: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  footerNote: { color: '#444444', fontSize: 12, textAlign: 'center', fontWeight: '600' }
});