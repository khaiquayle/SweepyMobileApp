import { Audio } from 'expo-av';
import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Index() {
  const [recording, setRecording] = useState<null | Audio.Recording>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const isRecordingRef = useRef(false);
  const sweepSoundRef = useRef<Audio.Sound | null>(null);

  const playSweepSound = async () => {
    if (isPlaying) {
      Alert.alert('Sound is already playing!');
      return;
    }

    try {
      setIsPlaying(true);
      
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/beep.wav')
      );
      
      await sound.playAsync();
      
      // Wait for sound to finish
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
        }
      });
      
    } catch (error) {
      Alert.alert('Error playing sound:', String(error));
      setIsPlaying(false);
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
        require('@/assets/sounds/beep.wav'),
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
      Alert.alert("Failed to start recording", err.message);
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
      
      // Simulate processing time and show result
      setTimeout(() => {
        // TODO: Replace with actual ML classification
        const materials = ['Plastic', 'Glass', 'Metal', 'Paper'];
        const randomMaterial = materials[Math.floor(Math.random() * materials.length)];
        setResult(randomMaterial);
        Alert.alert("Scan Complete!", `Detected material: ${randomMaterial}`);
      }, 2000);

    } catch (err) {
      console.error("Failed to stop recording", err);
      Alert.alert("Failed to stop recording");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sweepy</Text>
      <Text style={styles.subtitle}>Material Detection Scanner</Text>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.playButton]}
          onPress={playSweepSound}
          disabled={isPlaying}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? '🔊 Playing...' : '🔊 Test Sound'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.recordButton,
            recording !== null && styles.buttonActive
          ]}
          onPress={startRecordingWithSound}
          disabled={recording !== null}
        >
          <Text style={styles.buttonText}>
            {recording !== null ? '🔴 Recording...' : '📱 Scan Material'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.stopButton,
            recording === null && styles.buttonDisabled
          ]}
          onPress={stopRecording}
          disabled={recording === null}
        >
          <Text style={styles.buttonText}>■ Stop Scan</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={styles.resultSection}>
          <Text style={styles.resultTitle}>Scan Result</Text>
          <Text style={styles.resultText}>{result}</Text>
          <Text style={styles.resultSubtext}>
            {result === 'Plastic' && '♻️ Recyclable - Check local guidelines'}
            {result === 'Glass' && '♻️ Recyclable - Remove caps and rinse'}
            {result === 'Metal' && '♻️ Recyclable - Clean and dry'}
            {result === 'Paper' && '♻️ Recyclable - Keep dry and clean'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    padding: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1D1D1F',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 48,
    color: '#86868B',
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  button: {
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  playButton: {
    backgroundColor: '#007AFF',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
  },
  stopButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonActive: {
    opacity: 0.8,
  },
  resultSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultSubtext: {
    fontSize: 16,
    color: '#86868B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
