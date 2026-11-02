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

// --- Recognition Modes & Gesture Switcher ---
let currentRecognitionMode = 'alphabet'; // 'alphabet' | 'numbers' | 'signs' | 'unified' | 'os_control'
const RECOGNITION_MODES = ['alphabet', 'numbers', 'signs', 'unified', 'os_control'];
const modePills = document.getElementById('mode-pills');
const gestureHoldIndicator = document.getElementById('gesture-hold-indicator');
const gestureHoldMeter = document.getElementById('gesture-hold-meter');
const gestureHoldText = document.getElementById('gesture-hold-text');
let gestureHoldFrames = 0;
const GESTURE_SWITCH_THRESHOLD = 30; // ~1.5 - 2s at ~20fps
let gestureSwitchCooldown = 0;

function setRecognitionMode(mode) {
    if (!RECOGNITION_MODES.includes(mode)) return;
    currentRecognitionMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-mode') === mode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    const osPanel = document.getElementById('os-control-panel');
    if (osPanel) {
        osPanel.style.display = (mode === 'os_control') ? 'flex' : 'none';
    }

    const osCompanionOverlay = document.getElementById('os-companion-overlay');
    if (mode === 'os_control') {
        if (typeof osBridge !== 'undefined' && !osBridge.isConnected) {
            osBridge.connect();
            // Prompt in camera area if bridge is offline
            if (osCompanionOverlay && osCompanionOverlay.dataset.dismissed !== 'true') {
                osCompanionOverlay.classList.remove('hidden');
            }
        } else if (osCompanionOverlay) {
            osCompanionOverlay.classList.add('hidden');
        }
        if (detectedLetterEl) detectedLetterEl.textContent = 'OS';
        updateConfidenceUI(1.0);
    } else {
        if (osCompanionOverlay) {
            osCompanionOverlay.classList.add('hidden');
        }
        if (typeof osControlState !== 'undefined' && osControlState.isDragging) {
            if (typeof osBridge !== 'undefined') osBridge.send({ action: 'mouse_up', button: 'left' });
            osControlState.isDragging = false;
        }
    }

    console.log(`[Mode Switch] Recognition Mode set to: ${mode}`);
}

function cycleRecognitionMode() {
    const currentIndex = RECOGNITION_MODES.indexOf(currentRecognitionMode);
    const nextIndex = (currentIndex + 1) % RECOGNITION_MODES.length;
    setRecognitionMode(RECOGNITION_MODES[nextIndex]);
    playDetectionSound();
}

if (modePills) {
    modePills.addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (btn) {
            const mode = btn.getAttribute('data-mode');
            if (mode) setRecognitionMode(mode);
        }
    });
}

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

// MediaPipe Hands setup (reuses shared HandsPipeline if instantiated)
const hands = (window.sharedHandsPipeline && window.sharedHandsPipeline.hands)
    ? window.sharedHandsPipeline.hands
    : new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

hands.setOptions({
    maxNumHands: 2, // Support both hands for Two-Way Room and 2-hand signs
    modelComplexity: 0, // Lite model for smooth 30+ FPS real-time tracking
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// ============================================================================
// Multi-Device Resilient Camera Manager (Progressive Fallback & Diagnostics)
// ============================================================================
class CameraManager {
    constructor(videoEl, onFrameCallback) {
        this.videoEl = videoEl;
        this.onFrameCallback = onFrameCallback;
        this.stream = null;
        this.activeDeviceId = null;
        this.isMirrored = true;
        this.isProcessing = false;
        this.isActive = false;
        this.perfMode = 'fast';
        this.frameCallbackId = null;
        this.animFrameId = null;
        this.deviceSelectEl = document.getElementById('camera-device-select');
        this.errorOverlay = document.getElementById('camera-error-overlay');
        this.errorTitle = document.getElementById('camera-error-title');
        this.errorDesc = document.getElementById('camera-error-desc');
        this.troubleshootList = document.getElementById('camera-troubleshoot-list');
        this.mirrorBtn = document.getElementById('camera-mirror-btn');

        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => this.populateDevices());
        }
    }

    async populateDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !this.deviceSelectEl) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            const currentVal = this.deviceSelectEl.value;
            this.deviceSelectEl.innerHTML = '';

            if (videoDevices.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Default Camera';
                this.deviceSelectEl.appendChild(opt);
                return;
            }

            videoDevices.forEach((dev, idx) => {
                const opt = document.createElement('option');
                opt.value = dev.deviceId;
                opt.textContent = dev.label || `Camera ${idx + 1}`;
                if (dev.deviceId === this.activeDeviceId || (!this.activeDeviceId && idx === 0)) {
                    opt.selected = true;
                }
                this.deviceSelectEl.appendChild(opt);
            });

            if (currentVal && Array.from(this.deviceSelectEl.options).some(o => o.value === currentVal)) {
                this.deviceSelectEl.value = currentVal;
            }
        } catch (e) {
            console.warn('[CameraManager] Could not enumerate devices:', e);
        }
    }

    getConstraints(deviceId, fallbackLevel = 0) {
        const isHd = this.perfMode === 'hd';
        const targetWidth = isHd ? 1280 : 640;
        const targetHeight = isHd ? 720 : 480;

        if (fallbackLevel === 0) {
            const videoConstraints = {
                width: { ideal: targetWidth },
                height: { ideal: targetHeight },
                frameRate: { ideal: 30 }
            };
            if (deviceId) {
                videoConstraints.deviceId = { exact: deviceId };
            } else {
                videoConstraints.facingMode = 'user';
            }
            return { video: videoConstraints, audio: false };
        } else if (fallbackLevel === 1) {
            const videoConstraints = {
                width: { ideal: 640 },
                height: { ideal: 480 }
            };
            if (deviceId) videoConstraints.deviceId = deviceId;
            return { video: videoConstraints, audio: false };
        } else {
            return { video: true, audio: false };
        }
    }

    async start(deviceId = null) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError({
                name: 'NotSupportedError',
                message: 'Your browser or current connection does not support the Camera API. (Note: Browsers require HTTPS or localhost for camera access).'
            });
            return false;
        }

        this.stopStream();
        if (deviceId) this.activeDeviceId = deviceId;

        let stream = null;
        let lastError = null;

        for (let level = 0; level <= 2; level++) {
            try {
                const constraints = this.getConstraints(this.activeDeviceId, level);
                console.log(`[CameraManager] Attempting to open camera (level ${level}):`, constraints);
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (err) {
                lastError = err;
                console.warn(`[CameraManager] Level ${level} failed:`, err.name, err.message);
                if (err.name === 'NotAllowedError' || err.name === 'NotReadableError') {
                    break;
                }
            }
        }

        if (!stream) {
            this.showError(lastError || new Error('Failed to open camera.'));
            return false;
        }

        this.stream = stream;
        this.videoEl.srcObject = stream;
        try {
            await this.videoEl.play();
        } catch (playErr) {
            console.warn('[CameraManager] video.play() exception:', playErr);
        }

        const tracks = stream.getVideoTracks();
        if (tracks.length > 0) {
            const settings = tracks[0].getSettings();
            if (settings && settings.deviceId) {
                this.activeDeviceId = settings.deviceId;
            }
        }

        this.hideError();
        this.isActive = true;
        this.startFrameLoop();
        await this.populateDevices();

        if (footerCameraStatus) footerCameraStatus.textContent = 'Active';
        if (footerCameraDot) {
            footerCameraDot.style.background = 'var(--accent-color)';
            footerCameraDot.style.boxShadow = '0 0 6px var(--accent-glow)';
        }

        console.log('[CameraManager] Camera active successfully');
        return true;
    }

    startFrameLoop() {
        this.stopFrameLoop();
        const pump = async () => {
            if (!this.isActive || !this.stream) return;

            if (this.videoEl.readyState >= 2 && !this.isProcessing) {
                this.isProcessing = true;
                try {
                    await this.onFrameCallback();
                } catch (e) {
                } finally {
                    this.isProcessing = false;
                }
            }

            if ('requestVideoFrameCallback' in this.videoEl) {
                this.frameCallbackId = this.videoEl.requestVideoFrameCallback(pump);
            } else {
                this.animFrameId = requestAnimationFrame(pump);
            }
        };

        if ('requestVideoFrameCallback' in this.videoEl) {
            this.frameCallbackId = this.videoEl.requestVideoFrameCallback(pump);
        } else {
            this.animFrameId = requestAnimationFrame(pump);
        }
    }

    stopFrameLoop() {
        if (this.frameCallbackId && 'cancelVideoFrameCallback' in this.videoEl) {
            this.videoEl.cancelVideoFrameCallback(this.frameCallbackId);
            this.frameCallbackId = null;
        }
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.isProcessing = false;
    }

    stopStream() {
        this.stopFrameLoop();
        this.isActive = false;
        if (this.stream) {
            try {
                this.stream.getTracks().forEach(track => track.stop());
            } catch (e) {}
            this.stream = null;
        }
        if (this.videoEl) {
            this.videoEl.srcObject = null;
        }
    }

    stop() {
        this.stopStream();
        if (footerCameraStatus) footerCameraStatus.textContent = 'Paused';
        if (footerCameraDot) {
            footerCameraDot.style.background = 'var(--text-tertiary)';
            footerCameraDot.style.boxShadow = 'none';
        }
    }

    async restart() {
        this.stop();
        return await this.start(this.activeDeviceId);
    }

    toggleMirror() {
        this.isMirrored = !this.isMirrored;
        if (this.mirrorBtn) {
            this.mirrorBtn.classList.toggle('active', this.isMirrored);
        }
        return this.isMirrored;
    }

    setPerfMode(mode) {
        this.perfMode = mode;
        if (this.isActive) {
            this.restart();
        }
    }

    showError(err) {
        console.error('[CameraManager] Camera error reported:', err);
        if (footerCameraStatus) footerCameraStatus.textContent = 'Error';
        if (footerCameraDot) {
            footerCameraDot.style.background = 'var(--danger-color)';
            footerCameraDot.style.boxShadow = '0 0 6px rgba(244, 63, 94, 0.5)';
        }

        if (!this.errorOverlay) return;

        let title = 'Camera Access Issue';
        let desc = err.message || 'Unable to open video stream.';
        let tips = [];

        const errName = err.name || '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            title = 'Camera Access Blocked';
            desc = 'The browser blocked access to your webcam.';
            tips = [
                'Look at your browser address bar and click the 🔒 Lock or 🎥 Camera icon.',
                'Ensure "Camera" is set to "Allow".',
                'If prompted again, click "Allow" when the dialog appears.',
                'Check Windows Settings > Privacy & security > Camera > "Let desktop apps access your camera".'
            ];
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            title = 'Camera Already in Use';
            desc = 'Another application or browser tab has locked the webcam.';
            tips = [
                'Close Zoom, Microsoft Teams, Discord, Skype, OBS, or other video chat apps.',
                'Close any other browser tabs that might be using the camera.',
                'Unplug and re-plug your USB webcam if using an external device.',
                'Click "Refresh Camera" once other applications are closed.'
            ];
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            title = 'No Webcam Detected';
            desc = 'Windows did not report any connected video capture devices.';
            tips = [
                'Ensure your webcam is securely plugged in or laptop camera privacy shutter is open.',
                'Check Windows Device Manager to ensure camera drivers are functioning.',
                'Restart your browser after connecting the camera.'
            ];
        } else if (errName === 'OverconstrainedError') {
            title = 'Resolution Not Supported';
            desc = 'The requested camera resolution is not supported by your hardware.';
            tips = [
                'Switch the Performance dropdown to "Fast (30+ FPS)".',
                'Select a different webcam device from the dropdown.'
            ];
        } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            title = 'Insecure Network Context';
            desc = 'Modern browsers strictly require HTTPS to access webcams on remote network addresses.';
            tips = [
                'If opening from another PC/phone, use localhost or forward via an HTTPS tunnel (e.g. ngrok / localtunnel).',
                'Access the application directly on the host computer at http://localhost:8000.'
            ];
        } else {
            tips = [
                'Ensure camera permissions are allowed in your browser.',
                'Try selecting a different camera from the device list above.',
                'Check if your laptop has a physical webcam privacy slider or Fn key switch.'
            ];
        }

        if (this.errorTitle) this.errorTitle.textContent = title;
        if (this.errorDesc) this.errorDesc.textContent = desc;
        if (this.troubleshootList) {
            this.troubleshootList.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
        }
        this.errorOverlay.classList.remove('hidden');
    }

    hideError() {
        if (this.errorOverlay) {
            this.errorOverlay.classList.add('hidden');
        }
    }
}

// Instantiate resilient Camera Manager
const cameraManager = new CameraManager(videoElement, async () => {
    await hands.send({ image: videoElement });
});
window.cameraManager = cameraManager;
const camera = cameraManager; // Backward compatibility

// Wire up UI Controls
const cameraPerfSelect = document.getElementById('camera-perf-mode');
if (cameraPerfSelect) {
    cameraPerfSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'hd') {
            hands.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.7 });
            console.log('[Camera Perf] Switched to HD Precision profile');
        } else {
            hands.setOptions({ modelComplexity: 0, minDetectionConfidence: 0.65 });
            console.log('[Camera Perf] Switched to Fast 30+ FPS profile');
        }
        cameraManager.setPerfMode(mode);
    });
}

const cameraDeviceSelect = document.getElementById('camera-device-select');
if (cameraDeviceSelect) {
    cameraDeviceSelect.addEventListener('change', (e) => {
        const devId = e.target.value;
        cameraManager.start(devId);
    });
}

const cameraMirrorBtn = document.getElementById('camera-mirror-btn');
if (cameraMirrorBtn) {
    cameraMirrorBtn.addEventListener('click', () => {
        cameraManager.toggleMirror();
    });
}

const cameraRestartBtn = document.getElementById('camera-restart-btn');
if (cameraRestartBtn) {
    cameraRestartBtn.addEventListener('click', () => {
        cameraManager.restart();
    });
}

const cameraRetryActionBtn = document.getElementById('camera-retry-action-btn');
if (cameraRetryActionBtn) {
    cameraRetryActionBtn.addEventListener('click', () => {
        cameraManager.restart();
    });
}

const cameraDismissErrBtn = document.getElementById('camera-dismiss-err-btn');
if (cameraDismissErrBtn) {
    cameraDismissErrBtn.addEventListener('click', () => {
        cameraManager.hideError();
    });
}

// Start camera stream
cameraManager.start().catch((err) => {
    console.error("Error starting camera:", err);
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
        connectBleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline></svg><span>Glove Connected</span>';
        if (footerGloveStatus) footerGloveStatus.textContent = 'Connected';
        if (footerGloveDot) { footerGloveDot.style.background = 'var(--accent-color)'; footerGloveDot.style.boxShadow = '0 0 6px var(--accent-glow)'; }
        console.log('BLE Connection Established and Listening!');
    } catch (error) {
        if (error.name === 'NotFoundError') {
            // User cancelled the Bluetooth device chooser: not a real error
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
    connectBleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline></svg><span>Connect Glove BLE</span>';
    gloveRollEl.innerText = '0.0°';
    glovePitchEl.innerText = '0.0°';
    if (footerGloveStatus) footerGloveStatus.textContent = 'Disconnected';
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
    statusText.innerText = 'Loading pre-trained neural network...';

    // 1. Direct load from local pre-trained model directory
    try {
        console.log("Loading local pre-trained model from ./models/model.json...");
        const model = await tf.loadLayersModel('./models/model.json');
        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        mlModel = model;
        isModelReady = true;
        console.log("Pre-trained Neural Network Loaded Successfully from ./models/model.json!");
        statusText.innerText = 'Pre-trained Model Online! Show hands.';
        if (footerModelStatus) footerModelStatus.textContent = 'Active (Local)';
        if (footerModelDot) {
            footerModelDot.style.background = 'var(--accent-color)';
            footerModelDot.style.boxShadow = '0 0 6px var(--accent-glow)';
        }

        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 500);
        return;
    } catch (err) {
        console.warn("Direct ./models/model.json load failed, checking cache...", err);
    }

    // 2. Fallback to IndexedDB cached model if available
    try {
        const cachedModel = await tf.loadLayersModel('indexeddb://asl-alphabet-model');
        mlModel = cachedModel;
        mlModel.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        isModelReady = true;
        console.log("Loaded cached model from IndexedDB!");
        statusText.innerText = 'Cached Neural Network Online!';
        if (footerModelStatus) footerModelStatus.textContent = 'Active (Cached)';
        if (footerModelDot) {
            footerModelDot.style.background = 'var(--accent-color)';
            footerModelDot.style.boxShadow = '0 0 6px var(--accent-glow)';
        }
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 500);
        return;
    } catch (e) {
        console.error("No model could be loaded:", e);
        statusText.innerText = 'Model offline. Manual calibration active.';
        setTimeout(() => {
            statusOverlay.classList.add('hidden');
        }, 1500);
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

// ==================== GEOMETRIC LANDMARK ANALYZER ====================
// Rotation-invariant, scale-independent detector for ASL Numbers (0-9) & Common Static Signs
function lmDist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function detectStaticSignAndNumber(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;

    const wrist = landmarks[0];
    const palmSize = lmDist(wrist, landmarks[9]) || 0.1; // wrist to middle MCP scale

    // Finger extensions
    const isIndexExt = lmDist(landmarks[8], wrist) > lmDist(landmarks[6], wrist) * 1.15 &&
                       lmDist(landmarks[8], landmarks[5]) > palmSize * 0.70;
    const isMiddleExt = lmDist(landmarks[12], wrist) > lmDist(landmarks[10], wrist) * 1.15 &&
                        lmDist(landmarks[12], landmarks[9]) > palmSize * 0.70;
    const isRingExt = lmDist(landmarks[16], wrist) > lmDist(landmarks[14], wrist) * 1.15 &&
                      lmDist(landmarks[16], landmarks[13]) > palmSize * 0.70;
    const isPinkyExt = lmDist(landmarks[20], wrist) > lmDist(landmarks[18], wrist) * 1.15 &&
                       lmDist(landmarks[20], landmarks[17]) > palmSize * 0.70;
    const isThumbExt = lmDist(landmarks[4], landmarks[9]) > palmSize * 0.85;

    // Finger curls
    const isIndexCurled = lmDist(landmarks[8], wrist) < lmDist(landmarks[6], wrist) * 1.08;
    const isMiddleCurled = lmDist(landmarks[12], wrist) < lmDist(landmarks[10], wrist) * 1.08;
    const isRingCurled = lmDist(landmarks[16], wrist) < lmDist(landmarks[14], wrist) * 1.08;
    const isPinkyCurled = lmDist(landmarks[20], wrist) < lmDist(landmarks[18], wrist) * 1.08;

    // Thumb pinches / touches with fingertips
    const touchThumbIndex = lmDist(landmarks[4], landmarks[8]) < palmSize * 0.42;
    const touchThumbMiddle = lmDist(landmarks[4], landmarks[12]) < palmSize * 0.42;
    const touchThumbRing = lmDist(landmarks[4], landmarks[16]) < palmSize * 0.42;
    const touchThumbPinky = lmDist(landmarks[4], landmarks[20]) < palmSize * 0.42;

    // Thumb orientation
    const isThumbUp = (landmarks[4].y < landmarks[3].y) && (landmarks[4].y < landmarks[5].y);
    const isThumbDown = (landmarks[4].y > landmarks[3].y) && (landmarks[4].y > landmarks[0].y);
    const isIndexMiddleSpread = lmDist(landmarks[8], landmarks[12]) > palmSize * 0.32;

    // --- EVALUATE COMMON STATIC SIGNS ---
    if (isThumbUp && isThumbExt && isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
        return { label: 'THUMBS_UP', type: 'SIGN', confidence: 0.92 };
    }
    if (isThumbDown && isThumbExt && isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
        return { label: 'THUMBS_DOWN', type: 'SIGN', confidence: 0.90 };
    }
    if (touchThumbIndex && isMiddleExt && isRingExt && isPinkyExt) {
        return { label: 'OK', type: 'SIGN', confidence: 0.91 };
    }
    if (isThumbExt && isIndexExt && isPinkyExt && isMiddleCurled && isRingCurled) {
        return { label: 'I_LOVE_YOU', type: 'SIGN', confidence: 0.93 };
    }
    if (isIndexExt && isPinkyExt && isMiddleCurled && isRingCurled && !isThumbExt) {
        return { label: 'ROCK_ON', type: 'SIGN', confidence: 0.90 };
    }
    if (isIndexExt && isMiddleExt && isRingCurled && isPinkyCurled && isIndexMiddleSpread) {
        return { label: 'PEACE', type: 'SIGN', confidence: 0.88 };
    }
    if (isThumbExt && isIndexExt && isMiddleExt && isRingExt && isPinkyExt) {
        return { label: 'OPEN_PALM', type: 'SIGN', confidence: 0.89 };
    }
    if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled && !isThumbExt) {
        return { label: 'FIST', type: 'SIGN', confidence: 0.86 };
    }

    // --- EVALUATE ASL NUMBERS (0 - 9) ---
    if (touchThumbIndex && touchThumbMiddle) {
        return { label: '0', type: 'NUMBER', confidence: 0.88 };
    }
    if (isIndexExt && isMiddleCurled && isRingCurled && isPinkyCurled && !isThumbExt) {
        return { label: '1', type: 'NUMBER', confidence: 0.90 };
    }
    if (isIndexExt && isMiddleExt && isRingCurled && isPinkyCurled && !isThumbExt) {
        return { label: '2', type: 'NUMBER', confidence: 0.89 };
    }
    if (isThumbExt && isIndexExt && isMiddleExt && isRingCurled && isPinkyCurled) {
        // In ASL, 3 is thumb + index + middle extended
        return { label: '3', type: 'NUMBER', confidence: 0.92 };
    }
    if (!isThumbExt && isIndexExt && isMiddleExt && isRingExt && isPinkyExt) {
        return { label: '4', type: 'NUMBER', confidence: 0.91 };
    }
    if (isThumbExt && isIndexExt && isMiddleExt && isRingExt && isPinkyExt) {
        return { label: '5', type: 'NUMBER', confidence: 0.90 };
    }
    if (isIndexExt && isMiddleExt && isRingExt && touchThumbPinky) {
        return { label: '6', type: 'NUMBER', confidence: 0.87 };
    }
    if (isIndexExt && isMiddleExt && isPinkyExt && touchThumbRing) {
        return { label: '7', type: 'NUMBER', confidence: 0.87 };
    }
    if (isIndexExt && isRingExt && isPinkyExt && touchThumbMiddle) {
        return { label: '8', type: 'NUMBER', confidence: 0.87 };
    }
    if (isMiddleExt && isRingExt && isPinkyExt && touchThumbIndex) {
        return { label: '9', type: 'NUMBER', confidence: 0.88 };
    }

    return null;
}

// Hands-free Gesture Mode Switcher: holding ROCK_ON for 2s cycles through modes
function checkGestureModeSwitch(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        if (gestureHoldFrames > 0) {
            gestureHoldFrames = 0;
            if (gestureHoldIndicator) gestureHoldIndicator.classList.remove('active');
        }
        return false;
    }

    if (Date.now() < gestureSwitchCooldown) return false;

    const res = detectStaticSignAndNumber(landmarks);
    const isHorns = res && res.label === 'ROCK_ON';

    if (isHorns) {
        gestureHoldFrames++;
        if (gestureHoldIndicator) {
            gestureHoldIndicator.classList.add('active');
            const pct = Math.min(100, Math.round((gestureHoldFrames / GESTURE_SWITCH_THRESHOLD) * 100));
            if (gestureHoldMeter) gestureHoldMeter.style.width = pct + '%';
            if (gestureHoldText) gestureHoldText.textContent = `Switching Mode... ${pct}%`;
        }

        if (gestureHoldFrames >= GESTURE_SWITCH_THRESHOLD) {
            cycleRecognitionMode();
            gestureHoldFrames = 0;
            gestureSwitchCooldown = Date.now() + 1800; // 1.8s debounce
            if (gestureHoldIndicator) gestureHoldIndicator.classList.remove('active');
            return true;
        }
    } else {
        if (gestureHoldFrames > 0) {
            gestureHoldFrames = Math.max(0, gestureHoldFrames - 2);
            if (gestureHoldFrames === 0 && gestureHoldIndicator) {
                gestureHoldIndicator.classList.remove('active');
            }
        }
    }
    return false;
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

let isModelInferenceBusy = false;

function onResults(results) {
    // Feed shared hands pipeline for Two-Way Room and other consumers (zero duplicate tracking)
    if (window.sharedHandsPipeline && typeof window.sharedHandsPipeline.handleMediaPipeResults === 'function') {
        window.sharedHandsPipeline.handleMediaPipeResults(results);
    }

    // Update FPS
    updateFps();

    // Prepare Canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Mirror feed and drawings if mirror mode is enabled
    if (cameraManager.isMirrored) {
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);
    }

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

            // Check hands-free gesture mode switcher
            checkGestureModeSwitch(landmarks);

            // 1. Process for KNN Manual Override (allocate tensor only if calibrating or calibrated)
            let knnTensor = null;
            if (isTraining && trainClassSelect) {
                knnTensor = getLandmarkTensor(landmarks);
                const className = trainClassSelect.value;
                classifier.addExample(knnTensor, className);
                classExamples[className] = (classExamples[className] || 0) + 1;
                updateStats();
                isTraining = false; // Capture 1 frame per click
            }

            // If currently in OS Control mode, immediately execute native Windows gesture control pipeline!
            if (currentRecognitionMode === 'os_control') {
                if (typeof processOSControlGestures === 'function') {
                    processOSControlGestures(landmarks);
                }
                if (cameraContainer) cameraContainer.classList.add('detecting');
                canvasCtx.restore();
                return;
            }

            // 2. Main Prediction Logic
            if (classifier.getNumClasses() > 0) {
                if (!knnTensor) knnTensor = getLandmarkTensor(landmarks);
                classifier.predictClass(knnTensor).then((res) => {
                    const knnConfidence = res.confidences[res.label];
                    if (knnConfidence > 0.70) {
                        updateConfidenceUI(knnConfidence);
                        handlePrediction(res.label);
                        if (knnTensor) knnTensor.dispose();
                    } else {
                        processModePrediction();
                    }
                });
            } else {
                if (knnTensor) knnTensor.dispose();
                processModePrediction();
            }

            function processModePrediction() {
                if (currentRecognitionMode === 'os_control') {
                    if (typeof processOSControlGestures === 'function') {
                        processOSControlGestures(landmarks);
                    }
                    return;
                } else if (currentRecognitionMode === 'numbers') {
                    const numRes = detectStaticSignAndNumber(landmarks);
                    if (numRes && numRes.type === 'NUMBER') {
                        updateConfidenceUI(numRes.confidence);
                        handlePrediction(numRes.label);
                    } else {
                        updateConfidenceUI(0);
                        handlePrediction('-');
                    }
                } else if (currentRecognitionMode === 'signs') {
                    const signRes = detectStaticSignAndNumber(landmarks);
                    if (signRes && signRes.type === 'SIGN') {
                        updateConfidenceUI(signRes.confidence);
                        handlePrediction(signRes.label);
                    } else {
                        updateConfidenceUI(0);
                        handlePrediction('-');
                    }
                } else if (currentRecognitionMode === 'unified') {
                    const staticRes = detectStaticSignAndNumber(landmarks);
                    if (staticRes && staticRes.confidence >= 0.88) {
                        updateConfidenceUI(staticRes.confidence);
                        handlePrediction(staticRes.label);
                    } else {
                        runDeepLearningModel();
                    }
                } else {
                    // Default Alphabet Mode
                    runDeepLearningModel();
                }
            }

            function runDeepLearningModel() {
                if (!isModelReady || !mlModel || isModelInferenceBusy) {
                    return;
                }

                isModelInferenceBusy = true;
                const features = extractNormalizedFeatures(landmarks);
                const dlTensor = tf.tensor2d([features]);

                try {
                    const prediction = mlModel.predict(dlTensor);
                    const probabilities = prediction.dataSync();
                    
                    // Pure JS argMax: 0 GPU stall, 100x faster than tensor argMax + dataSync
                    let classId = 0;
                    let maxProb = probabilities[0];
                    for (let i = 1; i < probabilities.length; i++) {
                        if (probabilities[i] > maxProb) {
                            maxProb = probabilities[i];
                            classId = i;
                        }
                    }

                    updateConfidenceUI(maxProb);

                    if (maxProb > 0.58) {
                        const predictedChar = ALPHABET[classId] || '-';
                        handlePrediction(predictedChar);
                    } else {
                        handlePrediction('-');
                    }

                    prediction.dispose();
                } catch (err) {
                    console.warn('Inference error:', err);
                } finally {
                    dlTensor.dispose();
                    isModelInferenceBusy = false;
                }
            }
        }
    } else {
        // No hand detected
        checkGestureModeSwitch(null);
        if (currentRecognitionMode === 'os_control') {
            if (typeof handleOSControlNoHand === 'function') {
                handleOSControlNoHand();
            }
        } else {
            handlePrediction('-');
            updateConfidenceUI(0);
        }
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

    const FRIENDLY_NAMES = {
        'SPACE': 'Space',
        'YES': 'Yes',
        'HELLO': 'Hello',
        'THUMBS_UP': 'Thumbs Up',
        'THUMBS_DOWN': 'Thumbs Down',
        'PEACE': 'Peace',
        'OK': 'OK',
        'I_LOVE_YOU': 'I Love You',
        'ROCK_ON': 'Rock On',
        'OPEN_PALM': 'Open Palm',
        'FIST': 'Fist',
        '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
        '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
    };

    if (letter === lastLetter) {
        if (letter !== '-') {
            consecutiveFrames++;
        }
    } else {
        // Reset and update immediate feedback
        consecutiveFrames = 1;
        lastLetter = letter;

        if (FRIENDLY_NAMES[letter]) {
            if (['0','1','2','3','4','5','6','7','8','9'].includes(letter)) {
                detectedLetterEl.innerText = letter;
                detectedLetterEl.style.fontSize = '3.5rem';
            } else {
                detectedLetterEl.innerText = FRIENDLY_NAMES[letter];
                detectedLetterEl.style.fontSize = FRIENDLY_NAMES[letter].length > 7 ? '1.7rem' : '2.3rem';
            }
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

            // Read out the letter, number, or sign word
            synth.cancel();
            let speechText = FRIENDLY_NAMES[letter] || letter;

            const utterance = new SpeechSynthesisUtterance(speechText);
            utterance.pitch = 1.1;
            utterance.rate = 1.0;
            synth.speak(utterance);

            currentSpokenLetter = letter;
        }

        // Continuous Stream logic: Instantly add if it's a new letter/word/number
        if (letter !== lastAddedLetter) {
            // Hands-Free Autocomplete Acceptance: Check if user makes THUMBS_UP while suggestions are active
            if (letter === 'THUMBS_UP' && window.predictiveEngine && window.predictiveEngine.hasSuggestions()) {
                const accepted = window.predictiveEngine.tryGestureAccept('THUMBS_UP');
                if (accepted) {
                    lastAddedLetter = letter;
                    lastDetectionTime = Date.now();
                    return;
                }
            }

            if (letter === 'SPACE') {
                if (!currentSentence.endsWith(' ')) {
                    currentSentence += ' ';
                }
            } else if (['0','1','2','3','4','5','6','7','8','9'].includes(letter)) {
                currentSentence += letter;
            } else if (FRIENDLY_NAMES[letter]) {
                const wordToken = FRIENDLY_NAMES[letter].toUpperCase();
                currentSentence += (currentSentence.length > 0 && !currentSentence.endsWith(' ') ? ' ' : '') + wordToken + ' ';
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
    if (rect.width > 0 && rect.height > 0) {
        canvasElement.width = rect.width;
        canvasElement.height = rect.height;
    } else {
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
    }
}

window.addEventListener('resize', resizeCanvas);
videoElement.addEventListener('loadedmetadata', resizeCanvas);
setTimeout(resizeCanvas, 500);

// --- Sentence Builder Logic ---
const sentenceDisplay = document.getElementById('sentence-display');
const clearSentenceBtn = document.getElementById('clear-sentence-btn');
const speakSentenceBtn = document.getElementById('speak-sentence-btn');

let currentSentence = "";

function updateSentenceDisplay(skipAutocomplete = false) {
    if (!sentenceDisplay) return;
    sentenceDisplay.innerHTML = "";

    if (currentSentence.length === 0) {
        if (window.predictiveEngine) {
            window.predictiveEngine.clearSuggestions();
        }
        return;
    }

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

    // Expose globally for Two-Way Room synchronization
    window.currentSentence = currentSentence;

    // Stream live interim preview to connected partner
    if (window.twoWayManager && window.twoWayManager.isConnected) {
        window.twoWayManager.sendInterim(currentSentence.trim(), 'signing');
    }

    // Trigger Smart Predictive Autocomplete suggestions
    if (!skipAutocomplete && window.predictiveEngine) {
        window.predictiveEngine.updateSuggestions(currentSentence);
    }
}

window.getCurrentSentence = () => currentSentence;
window.setSentence = (newSentence) => {
    currentSentence = newSentence;
    window.currentSentence = newSentence;
    updateSentenceDisplay(true);
};

if (clearSentenceBtn) {
    clearSentenceBtn.addEventListener('click', () => {
        currentSentence = "";
        window.currentSentence = "";
        updateSentenceDisplay();
        if (window.predictiveEngine) {
            window.predictiveEngine.clearSuggestions();
        }
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

            // Also broadcast to connected Two-Way Room partner
            if (window.twoWayManager && window.twoWayManager.isConnected) {
                window.twoWayManager.sendSign(currentSentence.trim());
                console.log('[TwoWay] Broadcasted sentence to partner:', currentSentence.trim());
            }
        }
    });
}

// Send to Two-Way Room Partner Button
const sendToRoomBtn = document.getElementById('send-to-room-btn');
if (sendToRoomBtn) {
    sendToRoomBtn.addEventListener('click', () => {
        const text = currentSentence.trim();
        if (!text) {
            alert('Sentence is empty. Form a sentence with sign gestures first.');
            return;
        }

        if (!window.twoWayManager || !window.twoWayManager.isConnected) {
            const modal = document.getElementById('two-way-modal');
            if (modal) modal.classList.add('open');
            alert('Please connect to a partner room code first to send your signed sentence.');
            return;
        }

        window.twoWayManager.sendSign(text);
        const originalSpan = sendToRoomBtn.querySelector('span');
        if (originalSpan) {
            const oldText = originalSpan.textContent;
            originalSpan.textContent = 'Sent!';
            setTimeout(() => { originalSpan.textContent = oldText; }, 2000);
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


// =========================================================================
// TWO-WAY COMMUNICATION: SPEECH-TO-SIGN TRANSLATOR
// =========================================================================

function initSpeechToSign() {
    const toggleMicBtn = document.getElementById('toggle-speech-rec-btn');
    const micBtnText = document.getElementById('speech-rec-btn-text');
    const speechStatusBadge = document.getElementById('speech-status-badge');
    const transcriptPlaceholder = document.getElementById('transcript-placeholder');
    const transcriptTextEl = document.getElementById('speech-transcript-text');
    const playerContainer = document.getElementById('sign-player-container');
    const activeGlyphEl = document.getElementById('active-sign-glyph');
    const activeTitleEl = document.getElementById('active-sign-title');
    const activeDescEl = document.getElementById('active-sign-desc');
    const timelineEl = document.getElementById('sign-sequence-timeline');
    const replayBtn = document.getElementById('replay-sign-btn');
    const speedSelect = document.getElementById('sign-playback-speed');

    if (!toggleMicBtn) return;

    let isListening = false;
    let sequenceTimeout = null;
    let currentTokens = [];

    // Check Speech Recognition capability
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (speechStatusBadge) {
            speechStatusBadge.textContent = 'Voice Not Supported';
            speechStatusBadge.className = 'status-badge disconnected';
        }
        toggleMicBtn.disabled = true;
        if (transcriptPlaceholder) {
            transcriptPlaceholder.textContent = 'Speech recognition is not supported in this browser. Use Chrome or Edge.';
        }
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        toggleMicBtn.classList.add('listening');
        if (micBtnText) micBtnText.textContent = 'Listening...';
        if (speechStatusBadge) {
            speechStatusBadge.textContent = 'Listening';
            speechStatusBadge.className = 'status-badge connected';
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        handleSpokenTranscript(transcript);
    };

    recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        stopListening();
    };

    recognition.onend = () => {
        stopListening();
    };

    function startListening() {
        try {
            recognition.start();
        } catch (err) {
            console.warn('Recognition already started:', err);
        }
    }

    function stopListening() {
        isListening = false;
        toggleMicBtn.classList.remove('listening');
        if (micBtnText) micBtnText.textContent = 'Listen to Voice';
        if (speechStatusBadge) {
            speechStatusBadge.textContent = 'Mic Inactive';
            speechStatusBadge.className = 'status-badge disconnected';
        }
    }

    toggleMicBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            stopListening();
        } else {
            startListening();
        }
    });

    // Known word to sign mapping
    const WORD_TO_SIGN = {
        'HELLO': { id: 'HELLO', name: 'Hello (Salute)', desc: 'Open flat hand near forehead moving outward.' },
        'HI': { id: 'HELLO', name: 'Hello (Salute)', desc: 'Open flat hand near forehead moving outward.' },
        'YES': { id: 'YES', name: 'Yes (Nodding Fist)', desc: 'Closed fist nodding up and down from the wrist.' },
        'OK': { id: 'OK', name: 'OK Sign', desc: 'Thumb and index form circle, other 3 fingers upright.' },
        'OKAY': { id: 'OK', name: 'OK Sign', desc: 'Thumb and index form circle, other 3 fingers upright.' },
        'PEACE': { id: 'PEACE', name: 'Peace / Victory', desc: 'Index and middle fingers extended in a wide V shape.' },
        'VICTORY': { id: 'PEACE', name: 'Peace / Victory', desc: 'Index and middle fingers extended in a wide V shape.' },
        'LOVE': { id: 'I_LOVE_YOU', name: 'I Love You', desc: 'Thumb, index, and pinky fingers extended; middle and ring curled.' },
        'ROCK': { id: 'ROCK_ON', name: 'Rock On', desc: 'Index and pinky fingers extended; thumb holds middle and ring.' },
        'STOP': { id: 'OPEN_PALM', name: 'Open Palm (Stop)', desc: 'All five fingers extended flat facing forward.' },
        'FIST': { id: 'FIST', name: 'Closed Fist', desc: 'All fingers curled tightly into palm with thumb wrapped.' },
        'GOOD': { id: 'THUMBS_UP', name: 'Thumbs Up (Good)', desc: 'Closed fist with thumb extended straight up.' },
        'BAD': { id: 'THUMBS_DOWN', name: 'Thumbs Down (Bad)', desc: 'Closed fist with thumb extended straight down.' },
        'ZERO': { id: '0', name: 'Number 0', desc: 'Fingertips touch thumb tip forming O.' },
        'ONE': { id: '1', name: 'Number 1', desc: 'Index finger extended straight up.' },
        'TWO': { id: '2', name: 'Number 2', desc: 'Index and middle fingers extended in a V.' },
        'THREE': { id: '3', name: 'Number 3', desc: 'Thumb, index, and middle fingers extended.' },
        'FOUR': { id: '4', name: 'Number 4', desc: 'Four fingers extended upright, thumb folded in.' },
        'FIVE': { id: '5', name: 'Number 5', desc: 'All five fingers spread open.' },
        'SIX': { id: '6', name: 'Number 6', desc: 'Thumb tip touches pinky tip.' },
        'SEVEN': { id: '7', name: 'Number 7', desc: 'Thumb tip touches ring finger tip.' },
        'EIGHT': { id: '8', name: 'Number 8', desc: 'Thumb tip touches middle finger tip.' },
        'NINE': { id: '9', name: 'Number 9', desc: 'Thumb touches index tip forming circle.' }
    };

    function parseTextToTokens(rawText) {
        const tokens = [];
        const words = rawText.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/);

        words.forEach((word, wordIdx) => {
            if (!word) return;

            if (WORD_TO_SIGN[word]) {
                const sign = WORD_TO_SIGN[word];
                tokens.push({
                    type: 'SIGN',
                    token: word,
                    glyph: sign.id,
                    name: sign.name,
                    desc: sign.desc
                });
            } else {
                // Fingerspell letter by letter
                for (let i = 0; i < word.length; i++) {
                    const ch = word[i];
                    tokens.push({
                        type: ch >= '0' && ch <= '9' ? 'NUMBER' : 'LETTER',
                        token: ch,
                        glyph: ch,
                        name: `Sign '${ch}'`,
                        desc: `ASL fingerspelling for character ${ch}`
                    });
                }
            }

            // Space between words if not last
            if (wordIdx < words.length - 1) {
                tokens.push({
                    type: 'SPACE',
                    token: '[PAUSE]',
                    glyph: '---',
                    name: 'Word Pause',
                    desc: 'Rest hands momentarily between words.'
                });
            }
        });

        return tokens;
    }

    function handleSpokenTranscript(text) {
        if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';
        if (transcriptTextEl) transcriptTextEl.textContent = `"${text}"`;

        currentTokens = parseTextToTokens(text);
        if (currentTokens.length === 0) return;

        playSignSequence(currentTokens);
    }

    function playSignSequence(tokens) {
        if (!tokens || tokens.length === 0) return;

        if (sequenceTimeout) {
            clearTimeout(sequenceTimeout);
            sequenceTimeout = null;
        }

        if (playerContainer) playerContainer.style.display = 'flex';
        if (timelineEl) {
            timelineEl.innerHTML = '';
            tokens.forEach((t, idx) => {
                const chip = document.createElement('div');
                chip.className = 'sign-token';
                chip.id = `sign-token-${idx}`;
                chip.textContent = t.token;
                timelineEl.appendChild(chip);
            });
        }

        if (replayBtn) replayBtn.disabled = false;

        let currentIndex = 0;

        function step() {
            if (currentIndex >= tokens.length) {
                // Completed sequence
                timelineEl.querySelectorAll('.sign-token').forEach(c => c.classList.remove('active-token'));
                if (activeGlyphEl) {
                    activeGlyphEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                }
                if (activeTitleEl) activeTitleEl.textContent = 'Sequence Complete';
                if (activeDescEl) activeDescEl.textContent = 'Finished signing spoken phrase.';
                return;
            }

            const current = tokens[currentIndex];
            const speed = parseInt(speedSelect ? speedSelect.value : '800', 10) || 800;

            // Highlight chip
            timelineEl.querySelectorAll('.sign-token').forEach(c => c.classList.remove('active-token'));
            const activeChip = document.getElementById(`sign-token-${currentIndex}`);
            if (activeChip) {
                activeChip.classList.add('active-token');
                activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }

            // Update display card with image or clean text
            if (activeGlyphEl) {
                if (current.type === 'SPACE') {
                    activeGlyphEl.innerHTML = `<span style="font-size: 0.85rem; font-weight: 700; color: var(--text-tertiary);">PAUSE</span>`;
                } else {
                    const imgPath = `assets/signs/${current.glyph}.png?v=3.2.0`;
                    activeGlyphEl.innerHTML = `
                        <img src="${imgPath}" alt="${current.name}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1'; this.src='assets/signs/${current.glyph}.svg';}else{this.style.display='none'; this.nextElementSibling.style.display='block';}" style="width:100%; height:100%; object-fit:contain; display:block;" />
                        <span style="display:none; font-size:1.1rem; font-weight:800; color:var(--text-primary); text-align:center;">${current.glyph}</span>
                    `;
                }
            }
            if (activeTitleEl) activeTitleEl.textContent = current.name;
            if (activeDescEl) activeDescEl.textContent = current.desc;

            currentIndex++;
            sequenceTimeout = setTimeout(step, current.type === 'SPACE' ? speed * 0.6 : speed);
        }

        step();
    }

    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            if (currentTokens.length > 0) {
                playSignSequence(currentTokens);
            }
        });
    }
}

// ==================== WINDOWS OS NATIVE CONTROLLER & WEBSOCKET BRIDGE ====================

class WindowsOSBridgeClient {
    constructor(url = 'ws://127.0.0.1:8765') {
        this.url = url;
        this.ws = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.reconnectInterval = 3000;
        this.telemetry = {
            screenWidth: 1920,
            screenHeight: 1080,
            mouseX: 0,
            mouseY: 0,
            volume: 50,
            isMuted: false,
            brightness: 50,
            lastAction: 'Ready'
        };
        this.onTelemetryCallbacks = [];
        this.onStatusChangeCallbacks = [];
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[OS Bridge] Connected to Python native bridge at', this.url);
                this.isConnected = true;
                if (this.reconnectTimer) {
                    clearInterval(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                this._notifyStatus(true);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const t = data.type === 'telemetry' ? data : (data.telemetry || (data.type === 'handshake' ? data.telemetry : null));
                    if (t) {
                        if (t.screen_width) this.telemetry.screenWidth = t.screen_width;
                        if (t.screen_height) this.telemetry.screenHeight = t.screen_height;
                        if (t.mouse_pos) {
                            this.telemetry.mouseX = t.mouse_pos[0];
                            this.telemetry.mouseY = t.mouse_pos[1];
                        }
                        if (typeof t.volume === 'number') this.telemetry.volume = Math.round(t.volume);
                        if (typeof t.is_muted === 'boolean') this.telemetry.isMuted = t.is_muted;
                        if (typeof t.brightness === 'number') this.telemetry.brightness = Math.round(t.brightness);
                        if (t.last_action) this.telemetry.lastAction = t.last_action;

                        this._notifyTelemetry(this.telemetry);
                    }
                    if (data.type === 'volume_update' && typeof data.volume === 'number') {
                        this.telemetry.volume = Math.round(data.volume);
                        if (typeof data.is_muted === 'boolean') this.telemetry.isMuted = data.is_muted;
                        this._notifyTelemetry(this.telemetry);
                    }
                    if (data.type === 'brightness_update' && typeof data.brightness === 'number') {
                        this.telemetry.brightness = Math.round(data.brightness);
                        this._notifyTelemetry(this.telemetry);
                    }
                } catch (e) {
                    console.warn('[OS Bridge] Failed to parse message:', e);
                }
            };

            this.ws.onclose = () => {
                if (this.isConnected) {
                    console.warn('[OS Bridge] Disconnected from Python native bridge.');
                }
                this.isConnected = false;
                this._notifyStatus(false);
                this._scheduleReconnect();
            };

            this.ws.onerror = () => {
                this.isConnected = false;
                this._notifyStatus(false);
            };
        } catch (err) {
            this.isConnected = false;
            this._notifyStatus(false);
            this._scheduleReconnect();
        }
    }

    _scheduleReconnect() {
        if (!this.reconnectTimer && currentRecognitionMode === 'os_control') {
            this.reconnectTimer = setInterval(() => {
                if (!this.isConnected && currentRecognitionMode === 'os_control') {
                    this.connect();
                }
            }, this.reconnectInterval);
        }
    }

    send(command) {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(command));
                return true;
            } catch (err) {
                console.warn('[OS Bridge] Send error:', err);
            }
        }
        return false;
    }

    _notifyStatus(connected) {
        this.onStatusChangeCallbacks.forEach(cb => {
            try { cb(connected); } catch (e) { console.error(e); }
        });
    }

    _notifyTelemetry(data) {
        this.onTelemetryCallbacks.forEach(cb => {
            try { cb(data); } catch (e) { console.error(e); }
        });
    }

    onStatusChange(cb) {
        this.onStatusChangeCallbacks.push(cb);
    }

    onTelemetry(cb) {
        this.onTelemetryCallbacks.push(cb);
    }
}

const osBridge = new WindowsOSBridgeClient();

const osControlState = {
    // Tuning parameters
    sensitivity: 1.8,
    smoothingAlpha: 0.65,
    dragThresholdMs: 380,

    // Filtered coordinates (0.0 to 1.0)
    smoothX: 0.5,
    smoothY: 0.5,
    lastSentTime: 0,
    sendIntervalMs: 20, // ~50Hz max rate limit for silky motion

    // Click / Drag state
    isPinchingIndex: false,
    pinchStartTime: 0,
    isDragging: false,
    lastLeftClickTime: 0,

    // Right click state
    lastRightClickTime: 0,

    // Scroll state
    lastScrollY: 0,
    lastScrollTime: 0,

    // Volume state
    lastVolTime: 0,

    // Brightness state
    lastBriTime: 0,

    // Timed hold gestures
    holdGesture: null,
    holdStartTime: 0,
    lastActionTime: 0,

    // Current action label
    currentAction: 'Tracking Standby',
    currentDetail: 'Point index finger to steer cursor'
};

function setOSActionHUD(action, detail) {
    osControlState.currentAction = action;
    osControlState.currentDetail = detail || '';
    const actDisplay = document.getElementById('os-action-display');
    const actDetail = document.getElementById('os-action-detail');
    if (actDisplay) actDisplay.textContent = action;
    if (actDetail && detail) actDetail.textContent = detail;
}

function handleOSControlNoHand() {
    if (osControlState.isDragging) {
        osBridge.send({ action: 'mouse_up', button: 'left' });
        osControlState.isDragging = false;
        setOSActionHUD('Drag Released', 'Hand left camera viewport');
    } else if (osControlState.isPinchingIndex) {
        osControlState.isPinchingIndex = false;
    }
    osControlState.holdGesture = null;
    osControlState.lastScrollY = 0;
    setOSActionHUD('No Hand Detected', 'Position hand within camera feed');
    if (detectedLetterEl) detectedLetterEl.textContent = 'OS';
    updateConfidenceUI(0);
}

function drawReticle(ctx, normX, normY, color = '#58a6ff', label = 'Pointer') {
    const px = normX * canvasElement.width;
    const py = normY * canvasElement.height;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    // Outer Target Ring
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Dot
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(px - 26, py); ctx.lineTo(px - 10, py);
    ctx.moveTo(px + 10, py); ctx.lineTo(px + 26, py);
    ctx.moveTo(px, py - 26); ctx.lineTo(px, py - 10);
    ctx.moveTo(px, py + 10); ctx.lineTo(px, py + 26);
    ctx.stroke();

    // Label tag (unmirrored for easy reading)
    ctx.translate(px, py);
    ctx.scale(-1, 1); // Flip text so it reads left-to-right on mirrored canvas
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, 22, -10);

    ctx.restore();
}

function processOSControlGestures(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        handleOSControlNoHand();
        return;
    }

    const now = performance.now();
    updateConfidenceUI(1.0);
    if (detectedLetterEl) detectedLetterEl.textContent = 'OS';

    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];
    const wrist = landmarks[0];

    // Extension states
    const isIndexExt = indexTip.y < indexPip.y;
    const isMiddleExt = middleTip.y < middlePip.y;
    const isRingExt = ringTip.y < ringPip.y;
    const isPinkyExt = pinkyTip.y < pinkyPip.y;
    const isThumbExt = Math.hypot(thumbTip.x - landmarks[2].x, thumbTip.y - landmarks[2].y) > 0.07;

    // Euclidean Distances
    const distThumbIndex = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const distThumbMiddle = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
    const distIndexMiddle = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y);

    // 1. Mirrored coordinates & Active Interaction Area Mapping
    // In camera space: x=0 is left, x=1 is right. When user looks at screen, physical right is 1 - x
    const userX = 1 - indexTip.x;
    const userY = indexTip.y;

    // Deadzone margin (20% on each edge so user doesn't need to reach border of camera)
    const margin = 0.18;
    const rawX = Math.max(0, Math.min(1, (userX - margin) / (1 - 2 * margin)));
    const rawY = Math.max(0, Math.min(1, (userY - margin) / (1 - 2 * margin)));

    // Interactive Sensitivity Scale
    const scaledX = Math.max(0, Math.min(1, 0.5 + (rawX - 0.5) * osControlState.sensitivity));
    const scaledY = Math.max(0, Math.min(1, 0.5 + (rawY - 0.5) * osControlState.sensitivity));

    // Exponential Moving Average Smoothing Filter
    const alpha = osControlState.smoothingAlpha;
    osControlState.smoothX = alpha * scaledX + (1 - alpha) * osControlState.smoothX;
    osControlState.smoothY = alpha * scaledY + (1 - alpha) * osControlState.smoothY;

    // 2. Gesture Evaluation Pipeline

    // A. Instant Screenshot / Snipping Tool ("L" Shape: Thumb horizontal + Index upright, other 3 curled)
    const isLShape = isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && isThumbExt &&
                     Math.abs(thumbTip.x - indexTip.x) > 0.14 &&
                     thumbTip.y > indexTip.y;

    if (isLShape) {
        if (osControlState.holdGesture !== 'screenshot') {
            osControlState.holdGesture = 'screenshot';
            osControlState.holdStartTime = now;
        } else {
            const heldDuration = now - osControlState.holdStartTime;
            if (heldDuration >= 1100 && (now - osControlState.lastActionTime >= 2800)) {
                osBridge.send({ type: 'action', action: 'snip', command: 'snip' });
                osControlState.lastActionTime = now;
                setOSActionHUD('Snipping Tool Launched', 'Win+Shift+S snipping mode active');
                playDetectionSound();
                osControlState.holdGesture = null;
            } else {
                const pct = Math.min(100, Math.round((heldDuration / 1100) * 100));
                setOSActionHUD('Snip Tool Armed', `Holding "L" pose: ${pct}%`);
            }
        }
        drawReticle(canvasCtx, indexTip.x, indexTip.y, '#f43f5e', 'Snip [Hold]');
        return;
    } else if (osControlState.holdGesture === 'screenshot') {
        osControlState.holdGesture = null;
    }

    // B. Screen Brightness Adjustment (3 Fingers upright: Index, Middle, Ring up; Pinky closed)
    const isThreeFingers = isIndexExt && isMiddleExt && isRingExt && !isPinkyExt;
    if (isThreeFingers) {
        // Vertical elevation determines brightness level (from 0.75 low to 0.20 high)
        const briNorm = Math.max(0, Math.min(1, (0.75 - indexTip.y) / 0.52));
        const briPercent = Math.round(10 + briNorm * 90);

        if (now - osControlState.lastBriTime >= 150) {
            osBridge.send({ type: 'brightness', action: 'set_brightness', percent: briPercent, value: briPercent });
            osControlState.lastBriTime = now;
            setOSActionHUD(`Brightness: ${briPercent}%`, 'Elevate hand up/down to adjust');
        }
        drawReticle(canvasCtx, indexTip.x, indexTip.y, '#a855f7', `Brightness ${briPercent}%`);
        return;
    }

    // D1. Incremental Volume: Thumbs Up / Thumbs Down (All 4 fingers curled into a fist)
    const isFistExceptThumb = !isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt && isThumbExt;
    if (isFistExceptThumb) {
        const isThumbUp = thumbTip.y < landmarks[2].y - 0.05;
        const isThumbDown = thumbTip.y > landmarks[2].y + 0.05;
        if ((isThumbUp || isThumbDown) && (now - osControlState.lastVolTime >= 200)) {
            const delta = isThumbUp ? 5 : -5;
            osBridge.send({ type: 'volume', action: 'volume', delta: delta });
            osControlState.lastVolTime = now;
            setOSActionHUD(isThumbUp ? 'Volume Up (+5%)' : 'Volume Down (-5%)', isThumbUp ? 'Thumbs Up pose' : 'Thumbs Down pose');
            playDetectionSound();
        }
        drawReticle(canvasCtx, thumbTip.x, thumbTip.y, '#ec4899', isThumbUp ? 'Vol Up' : 'Vol Down');
        return;
    }

    // D2. Master Volume Aperture Dial: Horizontal Thumb-Index Caliper
    // Requires thumb extended and tips at approximately the same vertical plane
    const isApertureDial = !isRingExt && !isPinkyExt && !isMiddleExt && isThumbExt &&
                           Math.abs(thumbTip.y - indexTip.y) < 0.09 &&
                           distThumbIndex >= 0.05 && distThumbIndex <= 0.28;
    if (isApertureDial) {
        const volNorm = Math.max(0, Math.min(1, (distThumbIndex - 0.05) / 0.22));
        const volPercent = Math.round(volNorm * 100);

        if (now - osControlState.lastVolTime >= 140) {
            osBridge.send({ type: 'volume', action: 'set_volume', percent: volPercent, value: volPercent });
            osControlState.lastVolTime = now;
            setOSActionHUD(`Volume: ${volPercent}%`, 'Adjust aperture distance to set volume');
        }
        drawReticle(canvasCtx, (thumbTip.x + indexTip.x) / 2, (thumbTip.y + indexTip.y) / 2, '#ec4899', `Volume ${volPercent}%`);
        return;
    }

    // E. Smooth Wheel Scroll (Two fingers parallel: Index + Middle upright, Ring & Pinky closed)
    const isTwoFingerScroll = isIndexExt && isMiddleExt && !isRingExt && !isPinkyExt && distIndexMiddle < 0.075;
    if (isTwoFingerScroll) {
        const currentMidY = (indexTip.y + middleTip.y) / 2;
        if (!osControlState.lastScrollY) {
            osControlState.lastScrollY = currentMidY;
        }

        const deltaY = currentMidY - osControlState.lastScrollY;
        if (Math.abs(deltaY) > 0.014 && (now - osControlState.lastScrollTime >= 70)) {
            // Hand moves up -> scroll up (+clicks), hand moves down -> scroll down (-clicks)
            const clicks = deltaY < 0 ? 3 : -3;
            osBridge.send({ type: 'scroll', action: 'scroll', dy: clicks, clicks: clicks });
            osControlState.lastScrollTime = now;
            osControlState.lastScrollY = currentMidY;
            setOSActionHUD(clicks > 0 ? 'Scrolling Up' : 'Scrolling Down', `Wheel ${clicks > 0 ? '+' : ''}${clicks}`);
        }
        drawReticle(canvasCtx, (indexTip.x + middleTip.x) / 2, currentMidY, '#06b6d4', 'Scrolling');
        return;
    } else {
        osControlState.lastScrollY = 0;
    }

    // F. Right Click (Thumb + Middle pinch)
    const isPinchingMiddle = distThumbMiddle < 0.046 && distThumbIndex >= 0.055;
    if (isPinchingMiddle) {
        if (now - osControlState.lastRightClickTime >= 600) {
            osBridge.send({ type: 'mouse_click', action: 'right_click', button: 'right' });
            osControlState.lastRightClickTime = now;
            setOSActionHUD('Right Click', 'Context menu opened');
            playDetectionSound();
        }
        drawReticle(canvasCtx, middleTip.x, middleTip.y, '#eab308', 'Right Click');
        return;
    }

    // G. Left Click & Drag (Thumb + Index pinch)
    const isPinchingIndex = distThumbIndex < 0.046;
    if (isPinchingIndex) {
        if (!osControlState.isPinchingIndex) {
            // Pinch initiated
            osControlState.isPinchingIndex = true;
            osControlState.pinchStartTime = now;
        } else {
            // Check if held long enough to become a Drag & Drop
            const pinchDuration = now - osControlState.pinchStartTime;
            if (!osControlState.isDragging && pinchDuration >= osControlState.dragThresholdMs) {
                osControlState.isDragging = true;
                osBridge.send({ type: 'mouse_drag', action: 'start', button: 'left' });
                setOSActionHUD('DRAGGING', 'Left button held - drag window or file');
            }
        }

        drawReticle(canvasCtx, indexTip.x, indexTip.y, osControlState.isDragging ? '#f59e0b' : '#10b981', osControlState.isDragging ? 'DRAGGING' : 'Pinch');
    } else {
        if (osControlState.isPinchingIndex) {
            osControlState.isPinchingIndex = false;
            if (osControlState.isDragging) {
                // Drag completed
                osControlState.isDragging = false;
                osBridge.send({ type: 'mouse_drag', action: 'end', button: 'left' });
                setOSActionHUD('Drag Released', 'Drop operation complete');
            } else {
                // Short pinch -> Click or Double Click
                if (now - osControlState.lastLeftClickTime < 320) {
                    osBridge.send({ type: 'mouse_click', action: 'double_click', button: 'double' });
                    setOSActionHUD('Double Click', 'Double left click triggered');
                    playDetectionSound();
                    osControlState.lastLeftClickTime = 0;
                } else {
                    osBridge.send({ type: 'mouse_click', action: 'left_click', button: 'left' });
                    setOSActionHUD('Left Click', 'Left click triggered');
                    playDetectionSound();
                    osControlState.lastLeftClickTime = now;
                }
            }
        }
    }

    // H. Continuous Cursor Movement (Stream to bridge at smooth frame rate)
    if (now - osControlState.lastSentTime >= osControlState.sendIntervalMs) {
        osBridge.send({
            type: 'mouse_move',
            action: 'move',
            x: osControlState.smoothX,
            y: osControlState.smoothY,
            smooth: true
        });
        osControlState.lastSentTime = now;
    }

    if (!isPinchingIndex) {
        drawReticle(canvasCtx, indexTip.x, indexTip.y, '#3b82f6', 'Pointer');
        setOSActionHUD('Tracking Cursor', `Screen: ${Math.round(osControlState.smoothX * 100)}%, ${Math.round(osControlState.smoothY * 100)}%`);
    }
}

// Initialize Windows OS Control Module and Wire UI DOM Elements
function initWindowsOSControl() {
    const osBridgeStatusBadge = document.getElementById('os-bridge-status');
    const footerBridgeStatus = document.getElementById('footer-bridge-status');
    const footerBridgeDot = document.getElementById('footer-bridge-dot');
    const osBridgeAlert = document.getElementById('os-bridge-alert');
    const osReconnectBtn = document.getElementById('os-reconnect-btn');
    const coordsDisplay = document.getElementById('os-coords-display');
    const screenDisplay = document.getElementById('os-screen-display');
    const volDisplay = document.getElementById('os-volume-display');
    const volBar = document.getElementById('os-volume-bar');
    const briDisplay = document.getElementById('os-brightness-display');
    const briBar = document.getElementById('os-brightness-bar');

    const osCompanionOverlay = document.getElementById('os-companion-overlay');
    const osLaunchConnectBtn = document.getElementById('os-launch-connect-btn');
    const osLaunchConnectLabel = document.getElementById('os-launch-connect-label');
    const osCompanionDismissBtn = document.getElementById('os-companion-dismiss-btn');
    const osDownloadExeBtn = document.getElementById('os-download-exe-btn');

    // Telemetry updates
    osBridge.onStatusChange((connected) => {
        if (connected) {
            if (osCompanionOverlay) {
                osCompanionOverlay.classList.add('hidden');
                osCompanionOverlay.dataset.dismissed = 'false';
            }
            if (osBridgeStatusBadge) {
                osBridgeStatusBadge.className = 'status-badge connected';
                osBridgeStatusBadge.textContent = 'Bridge Online';
            }
            if (footerBridgeStatus) footerBridgeStatus.textContent = 'Connected';
            if (footerBridgeDot) {
                footerBridgeDot.className = 'dot-indicator';
                footerBridgeDot.style.background = 'var(--accent-emerald)';
            }
            if (osBridgeAlert) {
                osBridgeAlert.className = 'os-bridge-alert connected';
                osBridgeAlert.innerHTML = `
                    <div class="os-bridge-alert-text">
                        <strong>Native Companion Online:</strong> Connected to local Windows automation bridge (127.0.0.1:8765). Gestures actively control your host desktop!
                    </div>
                `;
            }
        } else {
            if (currentRecognitionMode === 'os_control' && osCompanionOverlay && osCompanionOverlay.dataset.dismissed !== 'true') {
                osCompanionOverlay.classList.remove('hidden');
            }
            if (osBridgeStatusBadge) {
                osBridgeStatusBadge.className = 'status-badge disconnected';
                osBridgeStatusBadge.textContent = 'Bridge Offline';
            }
            if (footerBridgeStatus) footerBridgeStatus.textContent = 'Offline';
            if (footerBridgeDot) {
                footerBridgeDot.className = 'dot-indicator disconnected';
                footerBridgeDot.style.background = 'var(--accent-rose)';
            }
            if (osBridgeAlert) {
                osBridgeAlert.className = 'os-bridge-alert';
                osBridgeAlert.innerHTML = `
                    <div class="os-bridge-alert-text">
                        <strong>Native Companion Bridge:</strong> Launch <a href="downloads/SignLanguageOSBridge.exe" download="SignLanguageOSBridge.exe" class="accent-link" style="color: var(--accent-cyan); text-decoration: underline;">SignLanguageOSBridge.exe</a> to enable OS controls on your desktop.
                    </div>
                    <button type="button" id="os-reconnect-btn-dynamic" class="btn secondary sm" title="Retry bridge connection">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>Connect</span>
                    </button>
                `;
                const dynamicBtn = document.getElementById('os-reconnect-btn-dynamic');
                if (dynamicBtn) dynamicBtn.addEventListener('click', () => osBridge.connect());
            }
        }
    });

    // Custom protocol and connection trigger
    function attemptProtocolLaunch() {
        try {
            const protoFrame = document.createElement('iframe');
            protoFrame.style.display = 'none';
            protoFrame.src = 'signlanguage-bridge://launch';
            document.body.appendChild(protoFrame);
            setTimeout(() => {
                if (protoFrame.parentNode) protoFrame.parentNode.removeChild(protoFrame);
            }, 2000);
        } catch (e) {
            console.warn('[OS Bridge] Protocol launch attempted:', e);
        }
    }

    let isConnectingCompanion = false;
    let connectPollInterval = null;

    if (osLaunchConnectBtn) {
        osLaunchConnectBtn.addEventListener('click', () => {
            if (isConnectingCompanion) return;
            isConnectingCompanion = true;

            if (osLaunchConnectLabel) {
                osLaunchConnectLabel.innerHTML = 'Connecting to Companion...';
            }
            osLaunchConnectBtn.disabled = true;

            // Attempt custom URL protocol launch
            attemptProtocolLaunch();

            // Attempt WebSocket connection
            osBridge.connect();

            let attempts = 0;
            const maxAttempts = 12;

            if (connectPollInterval) clearInterval(connectPollInterval);
            connectPollInterval = setInterval(() => {
                attempts++;
                if (osBridge.isConnected) {
                    clearInterval(connectPollInterval);
                    connectPollInterval = null;
                    isConnectingCompanion = false;
                    if (osLaunchConnectLabel) {
                        osLaunchConnectLabel.innerHTML = '✓ Connected! Opening Controls...';
                    }
                    playDetectionSound();
                    setTimeout(() => {
                        if (osCompanionOverlay) {
                            osCompanionOverlay.classList.add('hidden');
                            osCompanionOverlay.dataset.dismissed = 'false';
                        }
                        if (osLaunchConnectLabel) {
                            osLaunchConnectLabel.innerHTML = 'Already Downloaded? Launch &amp; Connect';
                        }
                        if (osLaunchConnectBtn) osLaunchConnectBtn.disabled = false;
                    }, 400);
                } else if (attempts >= maxAttempts) {
                    clearInterval(connectPollInterval);
                    connectPollInterval = null;
                    isConnectingCompanion = false;
                    if (osLaunchConnectBtn) osLaunchConnectBtn.disabled = false;
                    if (osLaunchConnectLabel) {
                        osLaunchConnectLabel.innerHTML = 'Retry Launch &amp; Connect';
                    }
                    const card = osCompanionOverlay ? osCompanionOverlay.querySelector('.os-companion-card') : null;
                    if (card) {
                        let hint = card.querySelector('.os-conn-hint');
                        if (!hint) {
                            hint = document.createElement('div');
                            hint.className = 'os-conn-hint';
                            hint.style.cssText = 'margin-top: 8px; color: var(--accent-rose); font-weight: 500; font-size: 0.74rem;';
                            card.appendChild(hint);
                        }
                        hint.textContent = 'Companion not running yet. Please double-click SignLanguageOSBridge.exe in your Downloads folder, then click Retry.';
                    }
                } else {
                    osBridge.connect();
                }
            }, 500);
        });
    }

    if (osCompanionDismissBtn) {
        osCompanionDismissBtn.addEventListener('click', () => {
            if (osCompanionOverlay) {
                osCompanionOverlay.classList.add('hidden');
                osCompanionOverlay.dataset.dismissed = 'true';
            }
        });
    }

    if (osDownloadExeBtn) {
        osDownloadExeBtn.addEventListener('click', () => {
            const card = osCompanionOverlay ? osCompanionOverlay.querySelector('.os-companion-card') : null;
            if (card) {
                let hint = card.querySelector('.os-conn-hint');
                if (!hint) {
                    hint = document.createElement('div');
                    hint.className = 'os-conn-hint';
                    hint.style.cssText = 'margin-top: 8px; color: var(--accent-cyan); font-weight: 500; font-size: 0.74rem;';
                    card.appendChild(hint);
                }
                hint.textContent = 'Download started! Once downloaded, open SignLanguageOSBridge.exe and click "Launch & Connect".';
            }
        });
    }

    osBridge.onTelemetry((t) => {
        if (coordsDisplay) coordsDisplay.textContent = `X: ${t.mouseX}, Y: ${t.mouseY}`;
        if (screenDisplay) screenDisplay.textContent = `Screen: ${t.screenWidth} &times; ${t.screenHeight}`;
        if (volDisplay) volDisplay.textContent = t.isMuted ? 'Muted' : `${t.volume}%`;
        if (volBar) volBar.style.width = `${t.isMuted ? 0 : t.volume}%`;
        if (briDisplay) briDisplay.textContent = `${t.brightness}%`;
        if (briBar) briBar.style.width = `${t.brightness}%`;
    });

    if (osReconnectBtn) {
        osReconnectBtn.addEventListener('click', () => {
            console.log('[OS Bridge] User clicked connect button.');
            osBridge.connect();
        });
    }

    // Quick Action Buttons
    document.querySelectorAll('.os-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-os-action');
            if (action) {
                console.log(`[OS Quick Action] Triggering: ${action}`);
                osBridge.send({ type: 'action', action: action, command: action });
                setOSActionHUD(`Quick Action: ${action}`, `Command sent to Windows bridge`);
                playDetectionSound();
            }
        });
    });

    // Sliders
    const sensSlider = document.getElementById('os-sensitivity-slider');
    const sensVal = document.getElementById('os-sensitivity-val');
    if (sensSlider && sensVal) {
        sensSlider.addEventListener('input', (e) => {
            osControlState.sensitivity = parseFloat(e.target.value);
            sensVal.textContent = `${osControlState.sensitivity.toFixed(1)}x`;
        });
    }

    const smoothSlider = document.getElementById('os-smoothing-slider');
    const smoothVal = document.getElementById('os-smoothing-val');
    if (smoothSlider && smoothVal) {
        smoothSlider.addEventListener('input', (e) => {
            osControlState.smoothingAlpha = parseFloat(e.target.value);
            smoothVal.textContent = osControlState.smoothingAlpha.toFixed(2);
        });
    }

    const dragSlider = document.getElementById('os-drag-slider');
    const dragVal = document.getElementById('os-drag-val');
    if (dragSlider && dragVal) {
        dragSlider.addEventListener('input', (e) => {
            osControlState.dragThresholdMs = parseInt(e.target.value, 10);
            dragVal.textContent = `${osControlState.dragThresholdMs}ms`;
        });
    }

    // OS Guide Modal Open / Close
    const guideModal = document.getElementById('os-guide-modal');
    const openGuideBtn = document.getElementById('open-os-guide-btn');
    const closeGuideBtn = document.getElementById('close-os-guide-btn');

    if (openGuideBtn && guideModal) {
        openGuideBtn.addEventListener('click', () => {
            guideModal.classList.add('open');
        });
    }
    if (closeGuideBtn && guideModal) {
        closeGuideBtn.addEventListener('click', () => {
            guideModal.classList.remove('open');
        });
    }
    if (guideModal) {
        guideModal.addEventListener('click', (e) => {
            if (e.target === guideModal) guideModal.classList.remove('open');
        });
    }

    // Type to Windows App Button
    const typeToWinBtn = document.getElementById('type-to-windows-btn');
    if (typeToWinBtn) {
        typeToWinBtn.addEventListener('click', () => {
            if (typeof currentSentence !== 'undefined' && currentSentence.length > 0) {
                const textToType = typeof currentSentence === 'string' ? currentSentence.trim() : (Array.isArray(currentSentence) ? currentSentence.join(' ') : String(currentSentence));
                console.log(`[OS Injection] Typing sentence to active Windows app: "${textToType}"`);
                const sent = osBridge.send({ action: 'type_text', text: textToType });
                if (sent) {
                    setOSActionHUD('Text Injected', `Typed: "${textToType}"`);
                    playDetectionSound();
                } else {
                    alert('Windows OS Bridge is offline. Please launch the SignLanguageOSBridge.exe companion app.');
                }
            } else {
                alert('No sentence tokens detected yet to type.');
            }
        });
    }

    // Check URL parameters for requested recognition mode (e.g., ?mode=os_control)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const reqMode = urlParams.get('mode');
        if (reqMode && RECOGNITION_MODES.includes(reqMode)) {
            setRecognitionMode(reqMode);
        }
    } catch (e) {
        console.warn('URL mode parse error:', e);
    }

    // Try initial bridge connection silently
    osBridge.connect();
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    initSpeechToSign();
    initWindowsOSControl();
});


