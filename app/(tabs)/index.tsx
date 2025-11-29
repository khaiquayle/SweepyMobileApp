import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import AudioRecord from 'react-native-audio-record';
import { classifyMaterial, initializeClassifier } from '@/lib/materialClassifier';

type Classification = {
  label: string;
  confidence: number; // 0-1
  recyclability: 'Recyclable' | 'Not Recyclable' | 'Check Locally';
};

// Recyclability info for each material
const RECYCLABILITY_INFO: Record<string, { recyclability: Classification['recyclability']; info: string; locations: string[] }> = {
  'Metal': {
    recyclability: 'Recyclable',
    info: 'Metal cans and containers are highly recyclable. Rinse before recycling. Aluminum can be recycled indefinitely without losing quality.',
    locations: ['Curbside Recycling', 'Scrap Metal Centers', 'Recycling Drop-off'],
  },
  'Plastic': {
    recyclability: 'Check Locally',
    info: 'Plastic recyclability varies by type (check the number inside the recycling symbol). Most curbside programs accept #1 and #2 plastics.',
    locations: ['Curbside (types 1-2)', 'Special Collection', 'Grocery Store Drop-off'],
  },
  'Paper': {
    recyclability: 'Recyclable',
    info: 'Paper and cardboard are easily recyclable. Keep dry and clean. Paper can be recycled 5-7 times before fibers become too short.',
    locations: ['Curbside Recycling', 'Paper Recycling Bins', 'Cardboard Drop-off'],
  },
  'Organic Material': {
    recyclability: 'Not Recyclable',
    info: 'Organic materials should be composted, not recycled. They can contaminate recycling streams but make excellent compost!',
    locations: ['Home Composting', 'Municipal Compost', 'Community Gardens'],
  },
  'Glass': {
    recyclability: 'Recyclable',
    info: 'Glass is 100% recyclable and can be recycled endlessly. Separate by color if required. Remove lids before recycling.',
    locations: ['Curbside Recycling', 'Bottle Return', 'Glass Drop-off'],
  },
};

export default function Index() {
  const [isRecording, setIsRecording] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading_model' | 'ambient' | 'playing' | 'classifying'>('idle');
  const [showResultModal, setShowResultModal] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [classifierReady, setClassifierReady] = useState(false);
  
  const isRecordingRef = useRef(false);
  const sweepSoundRef = useRef<Audio.Sound | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- ANIMATIONS ---
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  // Initialize AudioRecord for uncompressed WAV recording (but NOT the classifier - that's lazy)
  useEffect(() => {
    const options = {
      sampleRate: 44100,        // High quality sample rate
      channels: 1,              // Mono (1 channel)
      bitsPerSample: 16,        // 16-bit PCM
      audioSource: 1,           // Android: MIC (no echo cancellation) - was 6 (VOICE_RECOGNITION) which filters out speaker output
      wavFile: 'sweep_recording.wav'  // Temporary filename
    };
    
    AudioRecord.init(options);
    
    // DON'T initialize classifier here - it will load lazily on first scan
    
    return () => {
      // Cleanup
    };
  }, []);

  // Animation effects
  useEffect(() => {
    if (phase === 'loading_model' || phase === 'ambient' || phase === 'playing' || phase === 'classifying') {
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

  useEffect(() => {
    if (phase === 'loading_model' || phase === 'ambient' || phase === 'playing' || phase === 'classifying') {
      Animated.loop(
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      sparkleAnim.stopAnimation();
      sparkleAnim.setValue(0);
    }
  }, [phase, sparkleAnim]);

  const startScan = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed to scan materials.");
        return;
      }

      // Load ML model on first scan (lazy loading)
      if (!classifierReady) {
        setPhase('loading_model');
        const ready = await initializeClassifier();
        setClassifierReady(ready);
        if (!ready) {
          Alert.alert("Error", "Failed to load classification model. Please try again.");
          setPhase('idle');
          return;
        }
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      // Start recording with AudioRecord (uncompressed WAV)
      AudioRecord.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setPhase('ambient');

      // Wait 1.5 seconds for ambient noise collection
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Load and play sweep sound
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/audiocheck.net_sweep_10Hz_22000Hz_-3dBFS_1s.wav'),
        { shouldPlay: false, volume: 1.0 }
      );

      sweepSoundRef.current = sound;
      setPhase('playing');

      // Get sound duration
      const status = await sound.getStatusAsync();
      const soundDuration = status.isLoaded && status.durationMillis ? status.durationMillis : 1000;

      // Play the sweep sound
      await sound.setVolumeAsync(1.0);
      await sound.playAsync();

      // Auto-stop after sweep + 500ms buffer
      autoStopTimerRef.current = setTimeout(() => {
        stopAndClassify();
      }, soundDuration + 500) as unknown as NodeJS.Timeout;

    } catch (err) {
      console.error("Failed to start scan:", err);
      Alert.alert("Error", "Failed to start material scan. Please try again.");
      resetState();
    }
  };

  const stopAndClassify = async () => {
    try {
      if (!isRecordingRef.current) return;

      // Clear timer
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }

      // Stop sweep sound
      if (sweepSoundRef.current) {
        try {
          await sweepSoundRef.current.stopAsync();
          await sweepSoundRef.current.unloadAsync();
          sweepSoundRef.current = null;
        } catch (e) {
          console.error("Error stopping sound:", e);
        }
      }

      // Stop recording
      const recordingUri = await AudioRecord.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      setPhase('classifying');

      // Copy to app documents for processing
      const destUri = `${FileSystem.documentDirectory}sweep_scan.wav`;
      await FileSystem.copyAsync({
        from: recordingUri,
        to: destUri,
      });

      // Run classification
      const result = await classifyMaterial(destUri);

      if (result) {
        const materialInfo = RECYCLABILITY_INFO[result.material] || RECYCLABILITY_INFO['Plastic'];
        
        setClassification({
          label: result.material,
          confidence: result.confidence,
          recyclability: materialInfo.recyclability,
        });
        setShowResultModal(true);
      } else {
        Alert.alert("Scan Failed", "Could not classify the material. Please try again.");
      }

      setPhase('idle');

    } catch (err) {
      console.error("Failed to classify:", err);
      Alert.alert("Error", "Classification failed. Please try again.");
      resetState();
    }
  };

  const resetState = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setPhase('idle');
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  };

  // Sparkle animations
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

  const materialInfo = classification ? RECYCLABILITY_INFO[classification.label] : null;

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
            colors={['#6ee7b7', '#16a34a']} 
            style={styles.gradientFill}
          >
            {phase === 'loading_model' ? (
              <Ionicons name="cloud-download" size={68} color="#ffffff" />
            ) : (phase === 'ambient' || phase === 'playing') ? (
              <Ionicons name="musical-notes" size={68} color="#ffffff" />
            ) : phase === 'classifying' ? (
              <Ionicons name="analytics" size={68} color="#ffffff" />
            ) : (
              <Svg width={90} height={54} viewBox="0 0 90 54">
                <Path d="M5 20c10-12 20 12 30 0s20 12 30 0 20 12 20 0" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round"/>
                <Path d="M5 36c10-12 20 12 30 0s20 12 30 0 20 12 20 0" stroke="#dcfce7" strokeWidth={6} fill="none" strokeLinecap="round"/>
              </Svg>
            )}

            {(phase === 'loading_model' || phase === 'ambient' || phase === 'playing' || phase === 'classifying') && (
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
          </LinearGradient>
        </Animated.View>

        <Text style={styles.stateTitle}>
          {phase === 'loading_model' && 'Loading AI Model...'}
          {phase === 'ambient' && 'Capturing Ambient...'}
          {phase === 'playing' && 'Playing Sound Sweep...'}
          {phase === 'classifying' && 'Classifying Material...'}
          {phase === 'idle' && 'Ready to Scan'}
        </Text>
        <Text style={styles.stateSubtitle}>
          {phase === 'idle' && 'Point your device at an item and tap to classify'}
          {phase === 'loading_model' && 'First scan - preparing neural network'}
          {phase === 'ambient' && 'Recording background noise'}
          {phase === 'playing' && 'Analyzing reflected frequencies'}
          {phase === 'classifying' && 'Processing material data'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.ctaButton, phase !== 'idle' && styles.ctaButtonActive]}
        onPress={startScan}
        disabled={phase !== 'idle'}
        activeOpacity={0.9}
      >
        <Ionicons name="scan" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={styles.ctaText}>
          {phase === 'loading_model' ? 'Loading Model...' : phase !== 'idle' ? 'Scanning...' : 'Scan Material'}
        </Text>
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
              <Text style={styles.confidenceLabel}>{Math.round((classification?.confidence ?? 0.9) * 100)}% confidence</Text>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.infoHeader}>
                <Ionicons 
                  name={classification?.recyclability === 'Recyclable' ? 'checkmark-circle' : classification?.recyclability === 'Not Recyclable' ? 'close-circle' : 'help-circle'} 
                  size={18} 
                  color={classification?.recyclability === 'Recyclable' ? '#16a34a' : classification?.recyclability === 'Not Recyclable' ? '#dc2626' : '#f59e0b'} 
                />
                <Text style={styles.infoTitle}>Recyclability: {classification?.recyclability}</Text>
              </View>
              <Text style={styles.infoBody}>{materialInfo?.info || 'Check local recycling guidelines for this material.'}</Text>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.infoHeader}><Ionicons name="location" size={18} color="#0ea5a4" /><Text style={styles.infoTitle}>Where to Recycle</Text></View>
              <View style={styles.badgeRow}>
                {(materialInfo?.locations || ['Check Locally']).map((loc, i) => (
                  <Text key={i} style={styles.badge}>{loc}</Text>
                ))}
              </View>
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
  ctaButtonActive: {
    backgroundColor: '#dc2626',
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
  confidenceLabel: { position: 'absolute', right: 0, top: -22, fontSize: 12, color: '#6b7280' },
  infoBlock: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginHorizontal: 14, marginBottom: 12 },
  infoHeader: { flexDirection: 'row', alignItems: 'center' },
  infoTitle: { marginLeft: 6, fontSize: 14, fontWeight: '700', color: '#111827' },
  infoBody: { marginTop: 8, color: '#4b5563', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  badge: { backgroundColor: '#EAF8EE', color: '#14532d', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 8, marginBottom: 8, fontSize: 12, fontWeight: '700' },
  secondaryCta: { margin: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center' },
  secondaryCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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
