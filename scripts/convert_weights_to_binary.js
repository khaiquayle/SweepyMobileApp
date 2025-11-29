/**
 * Convert model weights from JSON to compact binary format
 * Run with: node scripts/convert_weights_to_binary.js
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../assets/models/model_weights.json');
const outputPath = path.join(__dirname, '../assets/models/model_weights_binary.json');

console.log('📦 Loading weights JSON (this may take a moment)...');
const weights = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log('🔄 Converting to binary format...');

// Helper to flatten 2D array and convert to base64
function matrixToBase64(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const floatArray = new Float32Array(rows * cols);
  
  let idx = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      floatArray[idx++] = matrix[i][j];
    }
  }
  
  // Convert to base64
  const buffer = Buffer.from(floatArray.buffer);
  return {
    data: buffer.toString('base64'),
    rows,
    cols
  };
}

function arrayToBase64(arr) {
  const floatArray = new Float32Array(arr);
  const buffer = Buffer.from(floatArray.buffer);
  return {
    data: buffer.toString('base64'),
    length: arr.length
  };
}

const binaryWeights = {
  architecture: weights.architecture,
  weights: {
    dense_0: {
      kernel: matrixToBase64(weights.weights.dense_0.kernel),
      bias: arrayToBase64(weights.weights.dense_0.bias)
    },
    dense_1: {
      kernel: matrixToBase64(weights.weights.dense_1.kernel),
      bias: arrayToBase64(weights.weights.dense_1.bias)
    },
    dense_2: {
      kernel: matrixToBase64(weights.weights.dense_2.kernel),
      bias: arrayToBase64(weights.weights.dense_2.bias)
    }
  }
};

console.log('💾 Writing binary weights...');
fs.writeFileSync(outputPath, JSON.stringify(binaryWeights));

// Stats
const originalSize = fs.statSync(inputPath).size;
const newSize = fs.statSync(outputPath).size;
const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);

console.log(`✅ Done!`);
console.log(`   Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Binary:   ${(newSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Reduction: ${reduction}%`);

