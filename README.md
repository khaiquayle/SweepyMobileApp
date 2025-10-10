# Sweepy - Material Detection Scanner

A consumer-facing mobile app that uses acoustic analysis to detect and classify materials for recycling purposes.

## Features

- **Sound Playback**: Test the sweep sound system
- **Material Scanning**: Record acoustic signatures of materials
- **Real-time Classification**: Detect material type (Plastic, Glass, Metal, Paper)
- **Recycling Guidance**: Get specific recycling instructions for detected materials
- **Scan History**: View previous scan results

## How It Works

1. **Test Sound**: Play the sweep sound to ensure proper audio setup
2. **Scan Material**: Tap "Scan Material" to record the acoustic signature
3. **Get Results**: Receive instant material classification and recycling guidance
4. **View History**: Check previous scans in the history tab

## Technical Stack

- **React Native** with Expo
- **Expo Router** for navigation
- **Expo AV** for audio recording and playback
- **TypeScript** for type safety

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

This app is designed to work with a machine learning pipeline that processes the recorded acoustic signatures to classify materials. The current implementation includes placeholder classification logic that will be replaced with actual ML model integration.

## Data Collection vs Product App

- **Data Collection App**: Used to build training datasets for the ML model
- **Product App**: Consumer-facing app that uses the trained model for material classification

## Future Enhancements

- Integration with trained ML model
- Cloud processing for classification
- Enhanced recycling guidance
- Material-specific tips and information
- Offline classification capabilities

