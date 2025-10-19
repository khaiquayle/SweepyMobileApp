import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

type Classification = {
  label: string;
  confidence: number; // 0-1
  recyclability: 'Recyclable' | 'Not Recyclable' | 'Check Locally';
};

export default function Index() {
  const [recording, setRecording] = useState<null | Audio.Recording>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'classifying'>('idle');
  const [showResultModal, setShowResultModal] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const isRecordingRef = useRef(false);
  const sweepSoundRef = useRef<Audio.Sound | null>(null);

  // --- ANIMATIONS ---
  // Spin + pulse animation
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  // Sparkle animation
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // Effect for spin + pulse
  useEffect(() => {
    if (phase === 'playing') {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      rotation.stopAnimation();
      rotation.setValue(0);
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [phase, rotation, pulse]);

  // Effect for sparkles
  useEffect(() => {
    if (phase === 'playing') {
      Animated.loop(
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 1500, // 1.5 second loop
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      sparkleAnim.stopAnimation();
      sparkleAnim.setValue(0);
    }
  }, [phase, sparkleAnim]);
  // --- END ANIMATIONS ---

  const playSweepSound = async () => {
    if (isPlaying) {
      Alert.alert('Sound is already playing!');
      return;
    }

    try {
      setIsPlaying(true);
      setPhase('playing');
      
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/audiocheck.net_sweep_10Hz_22000Hz_-3dBFS_1s.wav')
      );
      
      await sound.playAsync();
      
      // Wait for sound to finish
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setPhase('classifying');
          sound.unloadAsync();
          // Simulate classification step
          setTimeout(() => {
            const materials = ['Cardboard', 'Glass', 'Aluminum', 'Plastic'];
            const label = materials[Math.floor(Math.random() * materials.length)];
            const confidence = Math.max(0.6, Math.random());
            setClassification({ label, confidence, recyclability: 'Recyclable' });
            setShowResultModal(true);
            setPhase('idle');
          }, 1200);
        }
      });
      
    } catch (error) {
      Alert.alert('Error playing sound:', String(error));
      setIsPlaying(false);
      setPhase('idle');
    }
  };

  const startRecordingWithSound = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission to access microphone is required!");
        return;
      }

      // Load sweep sound first
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/audiocheck.net_sweep_10Hz_22000Hz_-3dBFS_1s.wav'),
        { shouldPlay: false, volume: 1.0 }
      );

      // Set audio mode for recording with maximum playback volume
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // DoNotMix - full volume, no ducking
        interruptionModeAndroid: 1, // DoNotMix - full volume, no ducking
      });

      sweepSoundRef.current = sound;

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      isRecordingRef.current = true;

      // Play the sweep sound at maximum volume
      await sound.setVolumeAsync(1.0);
      await sound.playAsync();

      Alert.alert("Recording with sweep sound...");

      // Auto-stop recording when sweep ends
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setTimeout(() => {
          if (isRecordingRef.current && recording) {
            stopRecording();
          }
          sound.unloadAsync();
        }, status.durationMillis + 500);
      }

      // Cleanup when sound finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });

    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Failed to start recording", err instanceof Error ? err.message : String(err));
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording || !isRecordingRef.current) return;

      // Stop and unload the sweep sound if it's still playing
      if (sweepSoundRef.current) {
        try {
          await sweepSoundRef.current.stopAsync();
          await sweepSoundRef.current.unloadAsync();
          sweepSoundRef.current = null;
        } catch (soundErr) {
          console.error("Error stopping sweep sound:", soundErr);
        }
      }

      isRecordingRef.current = false;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      Alert.alert("Recording complete!", "Processing your scan...");
      
      // Simulate processing time and show result (legacy path)
      setTimeout(() => {
        const materials = ['Plastic', 'Glass', 'Metal', 'Paper'];
        const randomMaterial = materials[Math.floor(Math.random() * materials.length)];
        setClassification({ label: randomMaterial, confidence: 0.9, recyclability: 'Recyclable' });
        setShowResultModal(true);
      }, 2000);

    } catch (err) {
      console.error("Failed to stop recording", err);
      Alert.alert("Failed to stop recording");
    }
  };

  // --- RENDER ---

  // Create staggered opacity values for 3 sparkles
  const sparkle1Opacity = sparkleAnim.interpolate({
    inputRange: [0, 0.2, 0.4],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const sparkle2Opacity = sparkleAnim.interpolate({
    inputRange: [0.3, 0.5, 0.7],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const sparkle3Opacity = sparkleAnim.interpolate({
    inputRange: [0.6, 0.8, 1.0],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={styles.brandHeader}>
        <View style={styles.brandIcon}><Ionicons name="leaf" size={18} color="#16a34a" /></View>
        <Text style={styles.brandTitle}>Sweepy</Text>
      </View>
      <Text style={styles.subtitle}>Smart Recycling Classification</Text>

      <View style={styles.heroWrapper}>
        <Animated.View
          style={[
            styles.heroCircle,
            {
              transform: [
                { scale: pulse },
                { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            // --- NEW GRADIENT: Bright cyan to a rich teal/blue-green ---
            colors={['#6ee7b7', '#16a34a']} 
            style={styles.gradientFill}
          >
            {phase === 'playing' ? (
              <Ionicons name="musical-notes" size={68} color="#ffffff" />
            ) : (
              <Svg width={90} height={54} viewBox="0 0 90 54">
                <Path d="M5 20c10-12 20 12 30 0s20 12 30 0 20 12 20 0" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round"/>
                <Path d="M5 36c10-12 20 12 30 0s20 12 30 0 20 12 20 0" stroke="#dcfce7" strokeWidth={6} fill="none" strokeLinecap="round"/>
              </Svg>
            )}

            {/* --- ADDED SPARKLES (only visible when phase === 'playing') --- */}
            {phase === 'playing' && (
              <>
                <Animated.View style={[styles.sparkle, styles.sparkle1, { opacity: sparkle1Opacity }]}>
                  <Ionicons name="sparkles" size={24} color="#f0f9ff" />
                </Animated.View>
                <Animated.View style={[styles.sparkle, styles.sparkle2, { opacity: sparkle2Opacity }]}>
                  <Ionicons name="sparkles" size={20} color="#f0f9ff" />
                </Animated.View>
                <Animated.View style={[styles.sparkle, styles.sparkle3, { opacity: sparkle3Opacity }]}>
                  <Ionicons name="sparkles" size={22} color="#f0f9ff" />
                </Animated.View>
              </>
            )}
            {/* --- END SPARKLES --- */}

          </LinearGradient>
        </Animated.View>

        <Text style={styles.stateTitle}>
          {phase === 'playing' && 'Playing Sound Sweep...'}
          {phase === 'classifying' && 'Classifying...'}
          {phase === 'idle' && 'Ready to Scan'}
        </Text>
        <Text style={styles.stateSubtitle}>
          {phase === 'idle' && 'Point your device at an item and tap to classify'}
          {phase === 'playing' && 'Analyzing reflected frequencies'}
          {phase === 'classifying' && 'Processing material data'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={playSweepSound}
        disabled={isPlaying}
        activeOpacity={0.9}
        
      >
        <Ionicons name="sparkles" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={styles.ctaText}>Play Sound & Classify</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />
      <View style={styles.quickRow}>
        <View style={styles.quickCard}><Ionicons name="volume-high" size={22} color="#0ea5a4" /><Text style={styles.quickText} numberOfLines={2}>Sound Sweep</Text></View>
        <View style={styles.quickCard}><Ionicons name="sparkles" size={22} color="#22c55e" /><Text style={styles.quickText} numberOfLines={2}>ML Classifying</Text></View>
        <View style={styles.quickCard}><Ionicons name="leaf" size={22} color="#16a34a" /><Text style={styles.quickText} numberOfLines={1}>Recycle Info</Text></View>
      </View>

      <Modal visible={showResultModal} transparent animationType="fade" onRequestClose={() => setShowResultModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.resultModal}>
            <View style={styles.resultHeader}>
              <View style={styles.resultIcon}><Ionicons name="checkmark-circle" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitleText}>{classification?.label ?? 'Material'}</Text>
                <Text style={styles.resultSubtitleText}>Detected Material</Text>
              </View>
              <TouchableOpacity onPress={() => setShowResultModal(false)}><Ionicons name="close" size={22} color="#ffffff" /></TouchableOpacity>
            </View>

            <View style={styles.confidenceBarWrapper}>
              <View style={[styles.confidenceBarFill, { width: `${Math.round((classification?.confidence ?? 0.9) * 100)}%` }]} />
              <Text style={styles.confidenceLabel}>{Math.round((classification?.confidence ?? 0.9) * 100)}%</Text>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.infoHeader}><Ionicons name="leaf" size={18} color="#16a34a" /><Text style={styles.infoTitle}>Recyclability</Text></View>
              <Text style={styles.infoBody}>This item can be recycled! ♻️</Text>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.infoHeader}><Ionicons name="location" size={18} color="#0ea5a4" /><Text style={styles.infoTitle}>Where to Recycle</Text></View>
              <View style={styles.badgeRow}>
                <Text style={styles.badge}>Curbside Recycling</Text>
                <Text style={styles.badge}>Recycling Centers</Text>
                <Text style={styles.badge}>Drop-off Locations</Text>
              </View>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.infoHeader}><Ionicons name="information-circle" size={18} color="#f59e0b" /><Text style={styles.infoTitle}>Additional Information</Text></View>
              <Text style={styles.infoBody}>Cardboard is one of the most recycled materials and can be recycled 5-7 times before fibers become too short.</Text>
            </View>

            <TouchableOpacity style={styles.secondaryCta} onPress={() => setShowResultModal(false)}>
              <Text style={styles.secondaryCtaText}>Scan Another Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 64,
  },
  brandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EAF8EE', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  brandTitle: { fontSize: 22, fontWeight: '700', color: '#10b981' },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 28,
    color: '#6b7280',
    textAlign: 'center',
  },
  heroWrapper: { alignItems: 'center', marginBottom: 12, marginTop: 40 },
  heroCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden', 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
  },
  gradientFill: { 
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: { marginTop: 24, fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  stateSubtitle: { marginTop: 8, fontSize: 16, color: '#6b7280', textAlign: 'center' },

  ctaButton: {
    marginTop: 40,
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: .8,
    shadowRadius: 3.84,
  },
  ctaText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  quickRow: { marginTop: 36, flexDirection: 'row', justifyContent: 'space-between' },
  quickCard: { flex: 1, backgroundColor: '#F4FBF6', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, marginHorizontal: 4, alignItems: 'center', minHeight: 72, justifyContent: 'center' },
  quickText: { marginTop: 6, color: '#6b7280', fontSize: 12, fontWeight: '700', textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  resultModal: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden' },
  resultHeader: { backgroundColor: '#16a34a', padding: 16, flexDirection: 'row', alignItems: 'center' },
  resultIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  resultTitleText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  resultSubtitleText: { color: '#dcfce7', fontSize: 12, marginTop: 2 },
  confidenceBarWrapper: { margin: 16, height: 10, backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden', position: 'relative' },
  confidenceBarFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#16a34a' },
  confidenceLabel: { position: 'absolute', right: 8, top: -22, fontSize: 12, color: '#6b7280' },
  infoBlock: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginHorizontal: 14, marginBottom: 12 },
  infoHeader: { flexDirection: 'row', alignItems: 'center' },
  infoTitle: { marginLeft: 6, fontSize: 14, fontWeight: '700', color: '#111827' },
  infoBody: { marginTop: 8, color: '#4b5563', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  badge: { backgroundColor: '#EAF8EE', color: '#14532d', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 8, marginBottom: 8, fontSize: 12, fontWeight: '700' },
  secondaryCta: { margin: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center' },
  secondaryCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // --- NEW SPARKLE STYLES ---
  sparkle: {
    position: 'absolute',
  },
  sparkle1: {
    top: 30,
    left: 40,
  },
  sparkle2: {
    top: 90,
    right: 30,
  },
  sparkle3: {
    bottom: 40,
    left: 60,
  },
});