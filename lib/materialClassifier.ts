/**
 * Material Classifier for Sweepy Mobile App
 * 
 * Implements the full trained neural network for material classification
 * using spectral subtraction and the actual model weights.
 */

import * as FileSystem from 'expo-file-system/legacy';

// Type definitions
interface ModelWeights {
  architecture: {
    input_size: number;
    layers: Array<{ type: string; units?: number; activation?: string; rate?: number }>;
  };
  weights: {
    dense_0: { kernel: number[][]; bias: number[] };
    dense_1: { kernel: number[][]; bias: number[] };
    dense_2: { kernel: number[][]; bias: number[] };
  };
}

interface ModelParams {
  version: string;
  model_specs: {
    input_shape: number;
    num_classes: number;
    sample_rate: number;
    ambient_duration_sec: number;
  };
  scaler: {
    means: number[];
    stds: number[];
  };
  metadata_encodings: {
    size: { mapping: Record<string, number> };
    shape: { mapping: Record<string, number> };
  };
  label_encoder: {
    classes: string[];
  };
}

// Lazy-loaded model data (only loaded when needed)
let cachedWeights: ModelWeights | null = null;
let cachedParams: ModelParams | null = null;
let isLoading = false;

// Binary format types
interface BinaryMatrix {
  data: string;  // base64 encoded Float32Array
  rows: number;
  cols: number;
}

interface BinaryArray {
  data: string;  // base64 encoded Float32Array
  length: number;
}

interface BinaryWeights {
  architecture: ModelWeights['architecture'];
  weights: {
    dense_0: { kernel: BinaryMatrix; bias: BinaryArray };
    dense_1: { kernel: BinaryMatrix; bias: BinaryArray };
    dense_2: { kernel: BinaryMatrix; bias: BinaryArray };
  };
}

/**
 * Decode base64 to Float32Array
 */
function base64ToFloat32Array(base64: string): Float32Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === '=') bufferLength--;
  if (base64[base64.length - 2] === '=') bufferLength--;
  
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];
    
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }
  
  return new Float32Array(bytes.buffer);
}

/**
 * Decode binary matrix to 2D number array
 */
function decodeBinaryMatrix(bm: BinaryMatrix): number[][] {
  const flat = base64ToFloat32Array(bm.data);
  const result: number[][] = [];
  
  for (let i = 0; i < bm.rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < bm.cols; j++) {
      row.push(flat[i * bm.cols + j]);
    }
    result.push(row);
  }
  
  return result;
}

/**
 * Decode binary array to number array
 */
function decodeBinaryArray(ba: BinaryArray): number[] {
  return Array.from(base64ToFloat32Array(ba.data));
}

/**
 * Load model files lazily at runtime (not at bundle time)
 */
async function loadModelFiles(): Promise<{ weights: ModelWeights; params: ModelParams }> {
  if (cachedWeights && cachedParams) {
    return { weights: cachedWeights, params: cachedParams };
  }
  
  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (cachedWeights && cachedParams) {
      return { weights: cachedWeights, params: cachedParams };
    }
  }
  
  isLoading = true;
  
  try {
    // Use require() - files are loaded lazily when this function is called
    const binaryWeights = require('../assets/models/model_weights_binary.json') as BinaryWeights;
    const paramsData = require('../assets/models/model_params.json');
    
    cachedWeights = {
      architecture: binaryWeights.architecture,
      weights: {
        dense_0: {
          kernel: decodeBinaryMatrix(binaryWeights.weights.dense_0.kernel),
          bias: decodeBinaryArray(binaryWeights.weights.dense_0.bias)
        },
        dense_1: {
          kernel: decodeBinaryMatrix(binaryWeights.weights.dense_1.kernel),
          bias: decodeBinaryArray(binaryWeights.weights.dense_1.bias)
        },
        dense_2: {
          kernel: decodeBinaryMatrix(binaryWeights.weights.dense_2.kernel),
          bias: decodeBinaryArray(binaryWeights.weights.dense_2.bias)
        }
      }
    };
    
    cachedParams = paramsData as ModelParams;
    
    return { weights: cachedWeights, params: cachedParams };
  } finally {
    isLoading = false;
  }
}

// ============================================================================
// FFT IMPLEMENTATION
// ============================================================================

/**
 * Cooley-Tukey FFT algorithm implemented in pure JavaScript
 */
function fft(signal: number[]): { real: number[]; imag: number[] } {
  const n = signal.length;
  
  if (n <= 1) {
    return { real: signal, imag: new Array(n).fill(0) };
  }
  
  // Pad to next power of 2 if needed
  if ((n & (n - 1)) !== 0) {
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    const padded = [...signal, ...new Array(nextPow2 - n).fill(0)];
    return fft(padded);
  }
  
  // Divide
  const even = [];
  const odd = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      even.push(signal[i]);
    } else {
      odd.push(signal[i]);
    }
  }
  
  // Conquer
  const fftEven = fft(even);
  const fftOdd = fft(odd);
  
  // Combine
  const real = new Array(n);
  const imag = new Array(n);
  
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const tReal = cos * fftOdd.real[k] - sin * fftOdd.imag[k];
    const tImag = sin * fftOdd.real[k] + cos * fftOdd.imag[k];
    
    real[k] = fftEven.real[k] + tReal;
    imag[k] = fftEven.imag[k] + tImag;
    
    real[k + n / 2] = fftEven.real[k] - tReal;
    imag[k + n / 2] = fftEven.imag[k] - tImag;
  }
  
  return { real, imag };
}

function fftMagnitude(signal: number[]): number[] {
  const result = fft(signal);
  return result.real.map((r, i) => Math.sqrt(r * r + result.imag[i] * result.imag[i]));
}

// ============================================================================
// NEURAL NETWORK IMPLEMENTATION
// ============================================================================

/**
 * ReLU activation function
 */
function relu(x: number[]): number[] {
  return x.map(v => Math.max(0, v));
}

/**
 * Softmax activation function
 */
function softmax(x: number[]): number[] {
  const maxVal = Math.max(...x);
  const expValues = x.map(v => Math.exp(v - maxVal));
  const sumExp = expValues.reduce((a, b) => a + b, 0);
  return expValues.map(v => v / sumExp);
}

/**
 * Dense layer forward pass: y = x @ W + b
 */
function denseLayer(input: number[], kernel: number[][], bias: number[]): number[] {
  const outputSize = bias.length;
  const output = new Array(outputSize).fill(0);
  
  for (let j = 0; j < outputSize; j++) {
    let sum = bias[j];
    for (let i = 0; i < input.length; i++) {
      sum += input[i] * kernel[i][j];
    }
    output[j] = sum;
  }
  
  return output;
}

/**
 * Full neural network forward pass
 * Architecture: Input → Dense(128, ReLU) → Dense(64, ReLU) → Dense(4, Softmax)
 */
function neuralNetworkForward(input: number[], weights: ModelWeights): number[] {
  // Layer 1: Dense(128) + ReLU
  let x = denseLayer(input, weights.weights.dense_0.kernel, weights.weights.dense_0.bias);
  x = relu(x);
  
  // Layer 2: Dense(64) + ReLU (Dropout is only for training, skip in inference)
  x = denseLayer(x, weights.weights.dense_1.kernel, weights.weights.dense_1.bias);
  x = relu(x);
  
  // Output Layer: Dense(num_classes) + Softmax
  const logits = denseLayer(x, weights.weights.dense_2.kernel, weights.weights.dense_2.bias);
  return softmax(logits);
}

// ============================================================================
// AUDIO PROCESSING
// ============================================================================

/**
 * Base64 decode for React Native (atob is not available)
 */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  
  // Remove padding and calculate output length
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === '=') bufferLength--;
  if (base64[base64.length - 2] === '=') bufferLength--;
  
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];
    
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
  }
  
  return bytes;
}

/**
 * Find the 'data' chunk in a WAV file and return its offset and size
 * WAV files can have variable header sizes with padding chunks
 */
function findWAVDataChunk(bytes: Uint8Array): { offset: number; size: number } | null {
  // Search for 'data' marker (0x64617461)
  for (let i = 12; i < Math.min(bytes.length - 8, 8192); i++) {
    if (bytes[i] === 0x64 && bytes[i+1] === 0x61 && bytes[i+2] === 0x74 && bytes[i+3] === 0x61) {
      // Found 'data' - next 4 bytes are the size (little-endian)
      const dataView = new DataView(bytes.buffer);
      const size = dataView.getUint32(i + 4, true);
      return { offset: i + 8, size };
    }
  }
  return null;
}

/**
 * Load a WAV file and extract raw audio samples
 */
async function loadWAVFile(uri: string): Promise<Float32Array | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    
    const bytes = base64ToBytes(base64);
    
    // Find the actual data chunk (WAV files can have extended headers with padding)
    const dataChunk = findWAVDataChunk(bytes);
    if (!dataChunk) {
      console.error('❌ Could not find data chunk in WAV file');
      return null;
    }
    
    const dataOffset = dataChunk.offset;
    const numSamples = dataChunk.size / 2; // 16-bit = 2 bytes per sample
    
    const dataView = new DataView(bytes.buffer);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const offset = dataOffset + (i * 2);
      const sample = dataView.getInt16(offset, true);
      samples[i] = sample / 32768.0;
    }
    
    return samples;
  } catch (error) {
    console.error('❌ Failed to load WAV file:', error);
    return null;
  }
}

/**
 * Resample array to target length using linear interpolation
 */
function resampleArray(arr: number[], targetLength: number): number[] {
  if (arr.length === targetLength) return arr;
  
  const result = new Array(targetLength);
  const ratio = (arr.length - 1) / (targetLength - 1);
  
  for (let i = 0; i < targetLength; i++) {
    const srcIdx = i * ratio;
    const lower = Math.floor(srcIdx);
    const upper = Math.min(lower + 1, arr.length - 1);
    const frac = srcIdx - lower;
    result[i] = arr[lower] * (1 - frac) + arr[upper] * frac;
  }
  
  return result;
}

/**
 * Perform spectral subtraction (ambient noise removal)
 */
function spectralSubtraction(ambient: Float32Array, chirp: Float32Array, targetBins: number): number[] {
  const n = Math.min(ambient.length, chirp.length);
  
  const ambientArray = Array.from(ambient.slice(0, n));
  const chirpArray = Array.from(chirp.slice(0, n));
  
  const magAmbient = fftMagnitude(ambientArray);
  const magChirp = fftMagnitude(chirpArray);
  
  // Spectral subtraction: use absolute difference to preserve signal even when ambient > chirp
  // (happens when phone's echo cancellation filters out the sweep sound)
  const cleanFFT = magChirp.map((val, i) => Math.abs(val - magAmbient[i]));
  
  // Get positive frequencies (first half of FFT result)
  const positiveFreqs = cleanFFT.slice(0, Math.floor(cleanFFT.length / 2));
  
  // Resample to match training's expected number of bins
  return resampleArray(positiveFreqs, targetBins);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Extract features from a recorded audio file
 */
export async function extractFeatures(
  audioUri: string,
  size: 'small' | 'medium' | 'large' = 'medium',
  shape: 'Flat' | 'Crushed' | 'Cylindrical' | 'Irregular' | 'Spherical' = 'Irregular'
): Promise<Float32Array | null> {
  try {
    // Load model params lazily
    const { params } = await loadModelFiles();
    
    // 1. Load audio samples
    const samples = await loadWAVFile(audioUri);
    if (!samples) return null;
    
    // 2. Split at 1.5 seconds
    const sampleRate = params.model_specs.sample_rate;
    const ambientDuration = params.model_specs.ambient_duration_sec;
    const splitPoint = Math.floor(sampleRate * ambientDuration);
    
    if (samples.length < splitPoint * 2) {
      console.error('Audio too short for classification');
      return null;
    }
    
    const ambient = samples.slice(0, splitPoint);
    const chirp = samples.slice(splitPoint, splitPoint * 2);
    
    // 3. Spectral subtraction - resample to match training's FFT size
    const targetSpectralBins = params.model_specs.input_shape - 2; // Total features minus 2 metadata
    const spectralFeatures = spectralSubtraction(ambient, chirp, targetSpectralBins);
    
    // 4. Add metadata features
    const sizeEncoding = params.metadata_encodings.size.mapping[size];
    const shapeEncoding = params.metadata_encodings.shape.mapping[shape];
    
    const allFeatures = [...spectralFeatures, sizeEncoding, shapeEncoding];
    
    // 5. Handle size mismatch by padding or truncating
    const expectedSize = params.model_specs.input_shape;
    let finalFeatures = allFeatures;
    if (allFeatures.length < expectedSize) {
      finalFeatures = [...allFeatures, ...new Array(expectedSize - allFeatures.length).fill(0)];
    } else if (allFeatures.length > expectedSize) {
      finalFeatures = allFeatures.slice(0, expectedSize);
    }
    
    // 6. Normalize using scaler parameters
    const normalized = finalFeatures.map((val, i) => {
      const mean = params.scaler.means[i] || 0;
      const std = params.scaler.stds[i] || 1;
      return (val - mean) / std;
    });
    
    return new Float32Array(normalized);
    
  } catch (error) {
    console.error('Feature extraction failed:', error);
    return null;
  }
}

/**
 * Classify a material from recorded audio using the trained neural network
 */
export async function classifyMaterial(
  audioUri: string
): Promise<{ material: string; confidence: number } | null> {
  try {
    // Load model lazily
    const { weights, params } = await loadModelFiles();
    
    // 1. Extract features
    const features = await extractFeatures(audioUri, 'medium', 'Irregular');
    if (!features) return null;
    
    // 2. Run neural network inference
    const probabilities = neuralNetworkForward(Array.from(features), weights);
    
    // 3. Get predicted class
    const maxProb = Math.max(...probabilities);
    const predictedIndex = probabilities.indexOf(maxProb);
    const materialName = params.label_encoder.classes[predictedIndex];
    
    return {
      material: materialName,
      confidence: maxProb
    };
    
  } catch (error) {
    console.error('Classification failed:', error);
    return null;
  }
}

/**
 * Initialize the classifier (preloads model files)
 */
export async function initializeClassifier(): Promise<boolean> {
  try {
    // Load model files lazily
    const { weights } = await loadModelFiles();
    
    // Verify weights are loaded
    return weights.weights.dense_0.kernel.length > 0;
  } catch (error) {
    console.error('Failed to initialize classifier:', error);
    return false;
  }
}
