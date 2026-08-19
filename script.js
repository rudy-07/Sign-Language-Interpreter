const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const statusText = document.getElementById('status-text');
const detectedLetterEl = document.getElementById('detected-letter');
const letterDisplayEl = document.querySelector('.letter-display');

// --- New UI Elements ---
const fpsBadgeEl = document.getElementById('fps-badge');
const confidenceFillEl = document.getElementById('confidence-fill');
const confidenceTextEl = document.getElementById('confidence-text');
const footerCameraStatus = document.getElementById('footer-camera-status');
const footerCameraDot = document.getElementById('footer-camera-dot');
const footerModelStatus = document.getElementById('footer-model-status');
const footerModelDot = document.getElementById('footer-model-dot');
const footerFps = document.getElementById('footer-fps');
const footerGloveStatus = document.getElementById('footer-glove-status');
const footerGloveDot = document.getElementById('footer-glove-dot');
const cameraContainer = document.getElementById('camera-container');

// --- FPS Counter ---
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFps = 0;

function updateFps() {
    fpsFrameCount++;
    const now = performance.now();
    if (now - fpsLastTime >= 1000) {
        currentFps = fpsFrameCount;
        fpsFrameCount = 0;
        fpsLastTime = now;
        if (fpsBadgeEl) fpsBadgeEl.textContent = 'FPS: ' + currentFps;
        if (footerFps) footerFps.textContent = currentFps;
    }
}

// --- Confidence Display ---
let currentConfidence = 0;
function updateConfidenceUI(conf) {
    currentConfidence = conf;
    const pct = Math.round(conf * 100);
    if (confidenceFillEl) confidenceFillEl.style.width = pct + '%';
    if (confidenceTextEl) confidenceTextEl.textContent = pct + '%';
}

// Check if browser supports getUserMedia
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.innerText = 'Camera API not supported in this browser.';
    alert('Browser does not support camera API');
}

// MediaPipe Hands setup
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1, // Focus on single hand for ASL spelling
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5  // Lower tracking confidence for smoother frame-to-frame tracking
});

hands.onResults(onResults);

// Setup WebCam using MediaPipe CameraUtils
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start()
    .then(() => {
        console.log("Camera started successfully");
        if (footerCameraStatus) footerCameraStatus.textContent = 'Active';
        if (footerCameraDot) { footerCameraDot.style.background = 'var(--accent-color)'; footerCameraDot.style.boxShadow = '0 0 6px var(--accent-glow)'; }
    })
    .catch((err) => {
        console.error("Error starting camera:", err);
        statusText.innerText = 'Error accessing camera. Please grant permission.';
        if (footerCameraStatus) footerCameraStatus.textContent = 'Error';
        if (footerCameraDot) { footerCameraDot.style.background = 'var(--danger-color)'; }
    });

// --- Web Bluetooth (Hardware Integration) ---
const connectBleBtn = document.getElementById('connect-ble-btn');
const bleStatusEl = document.getElementById('ble-status');
const gloveRollEl = document.getElementById('glove-roll');
const glovePitchEl = document.getElementById('glove-pitch');
const debugPitchDeltaEl = document.getElementById('debug-pitch-delta');
const debugRollDeltaEl = document.getElementById('debug-roll-delta');

// Hardware Data Global State
let gloveRoll = 0.0;
let glovePitch = 0.0;
let isGloveConnected = false;

// Bluetooth UUIDs from the ESP32 code
const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleDevice;
let bleServer;
let sensorCharacteristic;

if (connectBleBtn) {
    connectBleBtn.addEventListener('click', connectToBluetooth);
}

async function connectToBluetooth() {
    try {
        console.log('Requesting Bluetooth Device...');
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'MPU6050_Glove' }],
            optionalServices: [BLE_SERVICE_UUID]
        });

        bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

        console.log('Connecting to GATT Server...');
        bleServer = await bleDevice.gatt.connect();

        console.log('Getting Service...');
        const service = await bleServer.getPrimaryService(BLE_SERVICE_UUID);

        console.log('Getting Characteristic...');
        sensorCharacteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

        await sensorCharacteristic.startNotifications();
        sensorCharacteristic.addEventListener('characteristicvaluechanged', handleSensorData);

        // Update UI
        isGloveConnected = true;
        bleStatusEl.innerText = 'Connected';
        bleStatusEl.classList.remove('disconnected');
        bleStatusEl.classList.add('connected');
        connectBleBtn.innerText = 'Glove Active ⚡';
        if (footerGloveStatus) footerGloveStatus.textContent = 'Active';
        if (footerGloveDot) { footerGloveDot.style.background = 'var(--accent-color)'; footerGloveDot.style.boxShadow = '0 0 6px var(--accent-glow)'; }
        console.log('BLE Connection Established and Listening!');
    } catch (error) {
        if (error.name === 'NotFoundError') {
            // User cancelled the Bluetooth device chooser — not a real error
            console.log('Bluetooth pairing was cancelled by the user.');
        } else {
            console.error('BLE Connection error:', error);
            alert('Could not connect to the glove. Make sure it is powered on and near the computer.');
        }
    }
}

function onDisconnected() {
    console.log('BLE Device Disconnected');
    isGloveConnected = false;
    bleStatusEl.innerText = 'Disconnected';
    bleStatusEl.classList.remove('connected');
    bleStatusEl.classList.add('disconnected');
    connectBleBtn.innerText = 'Connect Glove 📡';
    gloveRollEl.innerText = '0.0°';
    glovePitchEl.innerText = '0.0°';
    if (footerGloveStatus) footerGloveStatus.textContent = 'Off';
    if (footerGloveDot) { footerGloveDot.style.background = 'var(--danger-color)'; footerGloveDot.style.boxShadow = '0 0 6px var(--danger-glow)'; }
}

function handleSensorData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const dataString = decoder.decode(value);

    // Expected format: "R:x.x,P:y.y"
    // Example: "R:45.2,P:-12.1"

    try {
        const parts = dataString.split(',');
        if (parts.length === 2) {
            const rollPart = parts[0].split(':');
            const pitchPart = parts[1].split(':');

            if (rollPart[0] === 'R' && pitchPart[0] === 'P') {
                gloveRoll = parseFloat(rollPart[1]);
                glovePitch = parseFloat(pitchPart[1]);

                // Update UI visually
                gloveRollEl.innerText = gloveRoll.toFixed(1) + '°';
                glovePitchEl.innerText = glovePitch.toFixed(1) + '°';
            }
        }
    } catch (e) {
        console.error("Error parsing BLE data:", e);
    }
}

// --- Dynamic Machine Learning Model ---
const REQUIRED_FRAMES = 3; // Reduced from 10 for faster detection response
let lastLetter = '-';
let consecutiveFrames = 0;
let mlModel = null;
let isModelReady = false;

// Label mapping for ASL (0 -> A, 1 -> B ...)
const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// Show loading UI
statusOverlay.classList.remove('hidden');
statusText.innerText = 'Initializing Deep Learning Neural Network...';

async function buildAndTrainModel() {
    try {
        // Try to load cached model first
        statusText.innerText = 'Checking for cached neural network...';
        const cachedModel = await tf.loadLayersModel('indexeddb://asl-alphabet-model');

        // If successful
        mlModel = cachedModel;
        mlModel.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log("Loaded cached model from IndexedDB!");
        isModelReady = true;
        statusText.innerText = 'Cached Neural Network Online! Show hands.';
        if (footerModelStatus) footerModelStatus.textContent = 'Loaded';
        if (footerModelDot) { footerModelDot.style.background = 'var(--accent-color)'; footerModelDot.style.boxShadow = '0 0 6px var(--accent-glow)'; }
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 1000);
        return; // Exit early! No need to train.

    } catch (e) {
        console.log("No cached model found, initiating fresh training...", e);
    }

    try {
        statusText.innerText = 'Downloading Dataset (36,000+ gestures)...';
        const response = await fetch('./models/keypoint.csv');
        const csvText = await response.text();

        statusText.innerText = 'Compiling Neural Network...';

        const lines = csvText.split('\n');
        const xs = [];
        const ys = [];

        for (let i = 0; i < lines.length; i++) {
            const row = lines[i].trim();
            if (!row) continue;

            const cols = row.split(',').map(Number);
            const label = cols[0];
            const features = cols.slice(1); // 42 features (x, y for 21 points)

            // Basic sanity check to avoid bad lines
            if (features.length === 42 && !isNaN(label)) {
                xs.push(features);
                ys.push(label);
            }
        }

        const xTensor = tf.tensor2d(xs);
        const maxLabel = Math.max(...ys);
        const numClasses = maxLabel + 1;
        const yTensor = tf.oneHot(tf.tensor1d(ys, 'int32'), numClasses);

        // Build a highly powerful Deep Neural Network
        const model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [42], units: 256, activation: 'relu' }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        statusText.innerText = `Training Powerful Deep Learning Model on ${xs.length} variations. Please wait...`;

        await model.fit(xTensor, yTensor, {
            epochs: 20,
            batchSize: 256,
            shuffle: true,
            yieldEvery: 'epoch',
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    const progress = Math.round(((epoch + 1) / 20) * 100);
                    statusText.innerText = `Training Powerful NN... ${progress}%`;
                }
            }
        });

        mlModel = model;
        isModelReady = true;

        // Save model to browser DB for infinite fast subsequent loads!
        statusText.innerText = 'Caching model for future use...';
        await model.save('indexeddb://asl-alphabet-model');

        statusText.innerText = 'Neural Network Online! Show hands.';
        if (footerModelStatus) footerModelStatus.textContent = 'Loaded';
        if (footerModelDot) { footerModelDot.style.background = 'var(--accent-color)'; footerModelDot.style.boxShadow = '0 0 6px var(--accent-glow)'; }
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 1000);

        // cleanup training tensors
        xTensor.dispose();
        yTensor.dispose();

    } catch (err) {
        console.error("Error building model:", err);
        statusText.innerText = 'Falling back to Manual Overrides (Base Network Failed).';
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 2000);
    }
}

// Start model build in background
buildAndTrainModel();

// Standard Keypoint Normalization (Relative to wrist, scaled to -1 ... 1)
function extractNormalizedFeatures(landmarks) {
    const features = [];
    const wristX = landmarks[0].x;
    const wristY = landmarks[0].y;

    for (let i = 0; i < landmarks.length; i++) {
        features.push(landmarks[i].x - wristX);
        features.push(landmarks[i].y - wristY);
    }

    // Normalize to bounding box to match keypoint.csv structure exactly
    let maxVal = 0;
    for (let i = 0; i < features.length; i++) {
        if (Math.abs(features[i]) > maxVal) {
            maxVal = Math.abs(features[i]);
        }
    }

    if (maxVal === 0) maxVal = 1;

    for (let i = 0; i < features.length; i++) {
        features[i] = features[i] / maxVal;
    }

    return features;
}

// --- Hybrid KNN Model (Manual Override) ---
const classifier = knnClassifier.create();
let isTraining = false;
let classExamples = {};

const trainClassSelect = document.getElementById('train-class');
const addExampleBtn = document.getElementById('add-example-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const exampleCountEl = document.getElementById('example-count');

if (addExampleBtn) {
    addExampleBtn.addEventListener('click', () => { isTraining = true; });
}

if (clearDataBtn) {
    clearDataBtn.addEventListener('click', () => {
        classifier.clearAllClasses();
        classExamples = {};
        updateStats();
    });
}

if (trainClassSelect) {
    trainClassSelect.addEventListener('change', updateStats);
}

function updateStats() {
    if (!trainClassSelect || !exampleCountEl) return;
    const className = trainClassSelect.value;
    exampleCountEl.innerText = classExamples[className] || 0;
}

const saveModelBtn = document.getElementById('save-model-btn');
if (saveModelBtn) {
    saveModelBtn.addEventListener('click', () => {
        if (classifier.getNumClasses() > 0) {
            const dataset = classifier.getClassifierDataset();
            const datasetObj = {};
            Object.keys(dataset).forEach((key) => {
                let data = dataset[key].dataSync();
                datasetObj[key] = { data: Array.from(data), shape: dataset[key].shape };
            });
            localStorage.setItem("asl_knn_dataset", JSON.stringify(datasetObj));
            localStorage.setItem("asl_knn_counts", JSON.stringify(classExamples));
            alert("Overrides saved successfully!");
        } else {
            alert("No overrides to save.");
        }
    });
}

const loadModelBtn = document.getElementById('load-model-btn');
if (loadModelBtn) {
    loadModelBtn.addEventListener('click', () => {
        const savedData = localStorage.getItem("asl_knn_dataset");
        const savedCounts = localStorage.getItem("asl_knn_counts");
        if (savedData && savedCounts) {
            const parsed = JSON.parse(savedData);
            const tensorObj = {};
            Object.keys(parsed).forEach((key) => {
                tensorObj[key] = tf.tensor(parsed[key].data, parsed[key].shape);
            });
            classifier.setClassifierDataset(tensorObj);

            const counts = JSON.parse(savedCounts);
            for (const k in counts) { classExamples[k] = counts[k]; }
            updateStats();
            alert("Overrides loaded successfully!");
        } else {
            alert("No saved overrides found.");
        }
    });
}

// Convert 21 3D landmarks into a 1D tensor normalized to the wrist (landmark 0)
function getLandmarkTensor(landmarks) {
    const wrist = landmarks[0];
    const features = [];
    for (let i = 0; i < landmarks.length; i++) {
        features.push(landmarks[i].x - wrist.x);
        features.push(landmarks[i].y - wrist.y);
        features.push(landmarks[i].z - wrist.z);
    }
    return tf.tensor1d(features);
}

function onResults(results) {
    // Update FPS
    updateFps();

    // Prepare Canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // We want the drawing to mirror the webcam feed
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    // Draw the camera feed onto canvas
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Draw the landmarks
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                { color: '#58a6ff', lineWidth: 4 });
            drawLandmarks(canvasCtx, landmarks, {
                color: '#238636',
                lineWidth: 2,
                radius: 4
            });

            // Neural Network Prediction Pipeline!
            if (!isModelReady || !mlModel) {
                handlePrediction('-');
                continue;
            }

            // 1. Process for KNN Manual Override Setup
            const knnTensor = getLandmarkTensor(landmarks);

            if (isTraining && trainClassSelect) {
                const className = trainClassSelect.value;
                classifier.addExample(knnTensor, className);
                classExamples[className] = (classExamples[className] || 0) + 1;
                updateStats();
                isTraining = false; // Capture 1 frame per click
            }

            // 2. Main Prediction Logic
            const features = extractNormalizedFeatures(landmarks);
            const dlTensor = tf.tensor2d([features]);

            if (classifier.getNumClasses() > 0) {
                // If the user taught the AI anything, check KNN first
                classifier.predictClass(knnTensor).then((res) => {
                    const knnConfidence = res.confidences[res.label];
                    // If KNN is extremely confident, use the override
                    if (knnConfidence > 0.7) {
                        handlePrediction(res.label);
                        disposeTensors();
                    } else {
                        // Otherwise fallback to Deep Learning
                        runDeepLearningModel();
                    }
                });
            } else {
                // Pure Deep Learning Branch
                runDeepLearningModel();
            }

            function runDeepLearningModel() {
                const prediction = mlModel.predict(dlTensor);
                const probabilities = prediction.dataSync();
                const classId = prediction.argMax(-1).dataSync()[0];
                const confidence = probabilities[classId];

                // Update confidence UI
                updateConfidenceUI(confidence);

                if (confidence > 0.6) {
                    const predictedChar = ALPHABET[classId] || '-';
                    handlePrediction(predictedChar);
                } else {
                    handlePrediction('-');
                }
                prediction.dispose();
                disposeTensors();
            }

            function disposeTensors() {
                dlTensor.dispose();
                knnTensor.dispose();
            }
        }
    } else {
        // No hand detected
        handlePrediction('-');
        updateConfidenceUI(0);
        if (cameraContainer) cameraContainer.classList.remove('detecting');
    }

    // Camera detecting glow
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (cameraContainer) cameraContainer.classList.add('detecting');
    }

    canvasCtx.restore();
}

// Audio Context for sound effect
let audioCtx;
const synth = window.speechSynthesis;
let currentSpokenLetter = '';

function playDetectionSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep

    // Smooth envelope
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

let lastAddedLetter = ''; // Track the last letter added to the sentence for continuous stream

// Cooldown to prevent rapid detection between signs
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 300; // Reduced from 1000ms for faster consecutive detections

// --- Hardware Heuristic State ---
let iToJHistory = [];
let dToZHistory = [];
const IMU_HISTORY_SIZE = 10;
let lastWordOutputTime = 0;
let lastDetectedWord = '';

function trackImuHistory() {
    if (!isGloveConnected) return;

    // Maintain a rolling history of the last N roll/pitch updates
    iToJHistory.push(gloveRoll);
    if (iToJHistory.length > IMU_HISTORY_SIZE) iToJHistory.shift();

    dToZHistory.push(glovePitch); // Pitch might be better for 'Z' drawing, or we use roll.
    if (dToZHistory.length > IMU_HISTORY_SIZE) dToZHistory.shift();
}

function applyHardwareHeuristics(predictedChar) {
    if (!isGloveConnected) return predictedChar;

    trackImuHistory();

    // Heuristic: The SPACEBAR 
    // User description: "palm facing up hand flat"
    // The user specifically wants roll around 180 degrees for this gesture.
    if (Math.abs(glovePitch) < 20) { // Hand is generally flat horizontally
        if (Math.abs(gloveRoll) > 150) { // Palm is facing straight up (roll near 180)

            // To ensure it's a deliberate hold and not a passing motion, ensure the history is stable
            let isStable = true;
            for (let i = 0; i < iToJHistory.length; i++) {
                if (Math.abs(dToZHistory[i]) > 30) isStable = false; // Pitch wasn't flat recently
            }

            if (isStable) return 'SPACE';
        }
    }

    // Heuristic 2: The ASL Word "YES"
    // Visual model detects 'S' (fist). "YES" is signing 'S' while nodding the fist up and down (pitch changes).
    if (predictedChar === 'S') {
        // Debounce: prevent 'S' from immediately overwriting 'YES' right after a nod
        if (lastDetectedWord === 'YES' && (Date.now() - lastWordOutputTime < 2000)) {
            return 'YES';
        }

        if (dToZHistory.length === IMU_HISTORY_SIZE) {
            // We want to detect a "nod" (up then down in a short duration).
            // This means moving away from the start pitch by a large margin, but the end pitch returns to near the start pitch.
            const startPitch = dToZHistory[0];
            const endPitch = dToZHistory[IMU_HISTORY_SIZE - 1];

            let maxDeviation = 0;
            for (let i = 1; i < IMU_HISTORY_SIZE - 1; i++) {
                const dev = Math.abs(dToZHistory[i] - startPitch);
                if (dev > maxDeviation) maxDeviation = dev;
            }

            const returnDelta = Math.abs(endPitch - startPitch);

            // If the fist bobbed up/down by at least 25 degrees total, but returned to within 15 degrees of start
            if (maxDeviation > 25 && returnDelta < 15) {
                // Clear history to prevent rapid-fire repeated "YES" triggers
                iToJHistory = [];
                dToZHistory = [];

                lastDetectedWord = 'YES';
                lastWordOutputTime = Date.now();
                return 'YES';
            }
        }
    }

    // Heuristic 3: The ASL Word "HELLO"
    // Visual model detects 'B' (flat hand). "HELLO" is moving the hand away from the forehead in a salute.
    // The arm extends/drops slightly causing Pitch to drop across history, and the wrist rolls forward/outward.
    if (predictedChar === 'B') {
        // Debounce: prevent 'B' from immediately overwriting 'HELLO'
        if (lastDetectedWord === 'HELLO' && (Date.now() - lastWordOutputTime < 2000)) {
            return 'HELLO';
        }

        if (dToZHistory.length === IMU_HISTORY_SIZE && iToJHistory.length === IMU_HISTORY_SIZE) {
            const startPitch = dToZHistory[0];
            const endPitch = dToZHistory[IMU_HISTORY_SIZE - 1];

            // Check if pitch significantly changed in one direction
            const pitchDelta = Math.abs(endPitch - startPitch);

            const startRoll = iToJHistory[0];
            const endRoll = iToJHistory[IMU_HISTORY_SIZE - 1];
            const rollDelta = Math.abs(endRoll - startRoll);

            // Update Debug UI
            if (debugPitchDeltaEl) debugPitchDeltaEl.innerText = pitchDelta.toFixed(1) + '°';
            if (debugRollDeltaEl) debugRollDeltaEl.innerText = rollDelta.toFixed(1) + '°';

            console.log(`B -> HELLO check: pitchDelta=${pitchDelta.toFixed(1)}, rollDelta=${rollDelta.toFixed(1)}`);

            // Look for a steady sweep: We are now checking ONLY Roll (twisting wrist outward) 
            if (rollDelta > 40) {
                iToJHistory = [];
                dToZHistory = [];

                // Clear debug UI
                if (debugPitchDeltaEl) debugPitchDeltaEl.innerText = '0.0°';
                if (debugRollDeltaEl) debugRollDeltaEl.innerText = '0.0°';

                lastDetectedWord = 'HELLO';
                lastWordOutputTime = Date.now();
                return 'HELLO';
            }
        }
    }

    // Heuristic 4: The 'J' Scoop
    // Visual model detects 'I'. 'J' is visually 'I' but with a twisted wrist (user specifically said: pitch increases first, then roll increases).
    if (predictedChar === 'I') {
        if (iToJHistory.length === IMU_HISTORY_SIZE && dToZHistory.length === IMU_HISTORY_SIZE) {

            // To detect a sequence (pitch then roll), let's look at the first half of history vs the second half
            const midPoint = Math.floor(IMU_HISTORY_SIZE / 2);

            const startPitch = dToZHistory[0];
            const midPitch = dToZHistory[midPoint];
            const pitchDeltaFirstHalf = midPitch - startPitch; // Check if pitch *increased*

            const midRoll = iToJHistory[midPoint];
            const endRoll = iToJHistory[IMU_HISTORY_SIZE - 1];
            const rollDeltaSecondHalf = endRoll - midRoll;     // Check if roll *increased*

            // Update Debug UI
            if (debugPitchDeltaEl) debugPitchDeltaEl.innerText = pitchDeltaFirstHalf.toFixed(1) + '°';
            if (debugRollDeltaEl) debugRollDeltaEl.innerText = rollDeltaSecondHalf.toFixed(1) + '°';

            // Helpful debug log
            console.log(`Detecting I -> J: pitchDelta=${pitchDeltaFirstHalf.toFixed(2)}, rollDelta=${rollDeltaSecondHalf.toFixed(2)}`);

            // Threshold set to 40 degrees given user reported ~60-70 degree movements
            if (pitchDeltaFirstHalf > 40 && rollDeltaSecondHalf > 40) {
                // Clear history to prevent rapid-fire repeated 'J' triggers from the same motion
                iToJHistory = [];
                dToZHistory = [];

                // Clear debug UI
                if (debugPitchDeltaEl) debugPitchDeltaEl.innerText = '0.0°';
                if (debugRollDeltaEl) debugRollDeltaEl.innerText = '0.0°';

                return 'J';
            }
        }
    } else {
        // If not looking at 'I', clear the debug stats to keep it clean (unless it's 'B' debugging)
        if (predictedChar !== 'B') {
            if (debugPitchDeltaEl) debugPitchDeltaEl.innerText = '0.0°';
            if (debugRollDeltaEl) debugRollDeltaEl.innerText = '0.0°';
        }
    }

    // Heuristic 2: The 'Z' Zig-Zag
    // Visual model detects 'D' (index finger pointing). 'Z' is drawn with the index finger.
    // Differentiating purely on static frame is hard, but tracking movement helps.
    if (predictedChar === 'D') {
        if (dToZHistory.length === IMU_HISTORY_SIZE) {
            const startPitch = dToZHistory[0];
            const endPitch = dToZHistory[IMU_HISTORY_SIZE - 1];
            const pitchDelta = Math.abs(endPitch - startPitch);

            // If wrist pitches up/down significantly while holding 'D', assume 'Z' signature
            if (pitchDelta > 20) {
                return 'Z';
            }
        }
    }

    return predictedChar;
}

function handlePrediction(rawPrediction) {
    // If we recently detected a letter, ignore all input until cooldown finishes
    if (Date.now() - lastDetectionTime < DETECTION_COOLDOWN_MS) {
        return;
    }

    // Apply Hardware Overrides
    const letter = applyHardwareHeuristics(rawPrediction);

    if (letter === lastLetter) {
        if (letter !== '-' && letter !== 'SPACE' && letter !== 'YES' && letter !== 'HELLO') {
            consecutiveFrames++;
        } else if (letter === 'SPACE' || letter === 'YES' || letter === 'HELLO') {
            // Let words and space bypass strict consecutive frame requirements since the heuristic handles the timing
            consecutiveFrames++;
        }
    } else {
        // Reset and update immediate feedback
        consecutiveFrames = 1;
        lastLetter = letter;

        if (letter === 'SPACE') {
            detectedLetterEl.innerText = '[SPACE]';
            detectedLetterEl.style.fontSize = '2.5rem';
        } else if (letter === 'YES') {
            detectedLetterEl.innerText = 'YES!';
            detectedLetterEl.style.fontSize = '3rem';
        } else if (letter === 'HELLO') {
            detectedLetterEl.innerText = 'HELLO!';
            detectedLetterEl.style.fontSize = '2.5rem';
        } else {
            detectedLetterEl.innerText = letter;
            detectedLetterEl.style.fontSize = ''; // Reset to default CSS
        }

        // Trigger pop animation on letter change
        if (detectedLetterEl) {
            detectedLetterEl.classList.remove('letter-pop');
            void detectedLetterEl.offsetWidth; // Force reflow
            detectedLetterEl.classList.add('letter-pop');
        }

        if (letter === '-') {
            lastAddedLetter = ''; // Reset, allowing double letters when hand is dropped
            letterDisplayEl.classList.remove('active');
            currentSpokenLetter = '';
        } else {
            letterDisplayEl.classList.add('transitioning');
        }
    }

    // Lock in the prediction if held long enough
    if (consecutiveFrames === REQUIRED_FRAMES && letter !== '-') {
        // Update UI lock style
        letterDisplayEl.classList.remove('transitioning');
        if (!letterDisplayEl.classList.contains('active')) {
            letterDisplayEl.classList.add('active');
        }

        // Produce sound and speech when newly detected
        if (currentSpokenLetter !== letter) {
            playDetectionSound();

            // Read out the letter or word
            synth.cancel();
            let speechText = letter;
            if (letter === 'SPACE') speechText = 'Space';
            if (letter === 'YES') speechText = 'Yes';
            if (letter === 'HELLO') speechText = 'Hello';

            const utterance = new SpeechSynthesisUtterance(speechText);
            utterance.pitch = 1.1;
            utterance.rate = 1.0;
            synth.speak(utterance);

            currentSpokenLetter = letter;
        }

        // Continuous Stream logic: Instantly add if it's a new letter
        if (letter !== lastAddedLetter) {
            if (letter === 'SPACE') {
                // Ensure we don't add multiple spaces in a row
                if (!currentSentence.endsWith(' ')) {
                    currentSentence += ' ';
                }
            } else if (letter === 'YES' || letter === 'HELLO') {
                // For words, add spaces padding it automatically
                currentSentence += (currentSentence.length > 0 && !currentSentence.endsWith(' ') ? ' ' : '') + letter + ' ';
            } else {
                currentSentence += letter;
            }

            updateSentenceDisplay();
            lastAddedLetter = letter;

            // Set cooldown timer after successfully locking in and outputting anything
            lastDetectionTime = Date.now();

            // Visual feedback
            letterDisplayEl.style.transform = 'scale(1.1)';
            letterDisplayEl.style.borderColor = 'var(--accent-color)';
            letterDisplayEl.style.boxShadow = '0 0 30px var(--glow-color)';
            setTimeout(() => {
                letterDisplayEl.style.transform = '';
                letterDisplayEl.style.borderColor = '';
                letterDisplayEl.style.boxShadow = '';
            }, 300);
        }
    }

    setTimeout(() => letterDisplayEl.classList.remove('transitioning'), 100);
}

// Adjust canvas internal resolution initially
function resizeCanvas() {
    const rect = canvasElement.getBoundingClientRect();
    canvasElement.width = rect.width;
    canvasElement.height = rect.height;
}

window.addEventListener('resize', resizeCanvas);
// Call once slightly delayed to ensure DOM is ready
setTimeout(resizeCanvas, 500);

// --- Sentence Builder Logic ---
const sentenceDisplay = document.getElementById('sentence-display');
const clearSentenceBtn = document.getElementById('clear-sentence-btn');
const speakSentenceBtn = document.getElementById('speak-sentence-btn');

let currentSentence = "";

function updateSentenceDisplay() {
    if (!sentenceDisplay) return;
    sentenceDisplay.innerHTML = "";

    if (currentSentence.length === 0) return;

    const words = currentSentence.split(' ');
    words.forEach((word) => {
        if (word.length > 0) {
            const span = document.createElement('span');
            span.className = 'word-tag';
            span.innerText = word;
            sentenceDisplay.appendChild(span);
        }
    });

    // Auto-scroll to bottom of the display area if it gets overflowing
    sentenceDisplay.scrollTop = sentenceDisplay.scrollHeight;
}

if (clearSentenceBtn) {
    clearSentenceBtn.addEventListener('click', () => {
        currentSentence = "";
        updateSentenceDisplay();
    });
}

if (speakSentenceBtn) {
    speakSentenceBtn.addEventListener('click', () => {
        if (currentSentence.trim().length > 0) {
            synth.cancel();
            const utterance = new SpeechSynthesisUtterance(currentSentence);
            utterance.pitch = 1.0;
            utterance.rate = 0.9;
            synth.speak(utterance);
        }
    });
}

// Keyboard shortcuts for smoother experience
document.addEventListener('keydown', (e) => {
    // Ignore keypresses if typing in an input field (unlikely in this app, but safe)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        if (currentSentence.length > 0 && !currentSentence.endsWith(' ')) {
            currentSentence += ' ';
            updateSentenceDisplay();
        }
    } else if (e.code === 'Enter') {
        e.preventDefault();
        const letter = detectedLetterEl.innerText;
        if (letter && letter !== '-') {
            currentSentence += letter;
            updateSentenceDisplay();
        }
    } else if (e.code === 'Backspace') {
        if (currentSentence.length > 0) {
            currentSentence = currentSentence.slice(0, -1);
            updateSentenceDisplay();
        }
    }
});

// =========================================================================
// MULTI-LANGUAGE TRANSLATION & SPEECH
// =========================================================================

const translateLangSelect = document.getElementById('translate-lang');
const translateBtn = document.getElementById('translate-btn');
const speakTranslatedBtn = document.getElementById('speak-translated-btn');
const translatedOutput = document.getElementById('translated-output');

let lastTranslatedText = '';
let lastTranslatedLang = '';

// Translate using Google Translate free endpoint
async function translateText(text, targetLang) {
    if (!text || text.trim().length === 0) return '';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        // Parse the nested array response
        let translated = '';
        if (data && data[0]) {
            for (let i = 0; i < data[0].length; i++) {
                if (data[0][i][0]) translated += data[0][i][0];
            }
        }
        return translated;
    } catch (err) {
        console.error('Translation error:', err);
        return '[Translation failed]';
    }
}

// Language code to SpeechSynthesis lang mapping
const LANG_SPEECH_MAP = {
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh-CN': 'zh-CN',
    'ar': 'ar-SA',
    'pt': 'pt-BR',
    'ru': 'ru-RU',
    'te': 'te-IN',
    'ml': 'ml-IN',
    'kn': 'kn-IN'
};

// Speak translated text using browser TTS with correct language
function speakTranslated(text, langCode) {
    if (!text || text.trim().length === 0) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_SPEECH_MAP[langCode] || langCode;
    utterance.pitch = 1.0;
    utterance.rate = 0.85;

    // Try to find a matching voice for the language
    const voices = synth.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(langCode) || v.lang === LANG_SPEECH_MAP[langCode]);
    if (matchingVoice) {
        utterance.voice = matchingVoice;
    }

    synth.speak(utterance);
}

// Ensure voices are loaded
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices(); // Trigger voice list load
    };
}

if (translateBtn) {
    translateBtn.addEventListener('click', async () => {
        const text = currentSentence.trim();
        if (text.length === 0) {
            if (translatedOutput) {
                translatedOutput.style.display = 'block';
                translatedOutput.textContent = 'Type a sentence first!';
            }
            return;
        }

        const lang = translateLangSelect ? translateLangSelect.value : 'ta';

        // Show loading state
        translateBtn.textContent = '...';
        translateBtn.disabled = true;

        const translated = await translateText(text, lang);

        lastTranslatedText = translated;
        lastTranslatedLang = lang;

        if (translatedOutput) {
            translatedOutput.style.display = 'block';
            translatedOutput.textContent = translated;
        }

        translateBtn.textContent = 'Translate';
        translateBtn.disabled = false;
    });
}

if (speakTranslatedBtn) {
    speakTranslatedBtn.addEventListener('click', () => {
        if (lastTranslatedText) {
            speakTranslated(lastTranslatedText, lastTranslatedLang);
        } else {
            // If no translation yet, just speak the English sentence
            if (currentSentence.trim().length > 0) {
                const synth = window.speechSynthesis;
                synth.cancel();
                const utterance = new SpeechSynthesisUtterance(currentSentence);
                utterance.pitch = 1.0;
                utterance.rate = 0.9;
                synth.speak(utterance);
            }
        }
    });
}
