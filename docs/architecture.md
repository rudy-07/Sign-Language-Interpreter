# System Architecture

The **Sign Language Interpreter** is engineered as a distributed, multi-tiered pipeline that couples embedded IoT firmware with high-performance browser-based computer vision and deep learning runtimes.

---

## High-Level Architectural Block Diagram

```mermaid
flowchart TB
    subgraph Hardware Layer
        CAM[Laptop / USB Webcam]
        GLOVE[Smart Glove: ESP32 + MPU-6050]
    end

    subgraph Transport & Ingestion Layer
        V_STREAM[getUserMedia Video Stream 640x480]
        BLE_TRANS[Web Bluetooth BLE GATT 50Hz]
    end

    subgraph Vision & Feature Pipeline
        MP[MediaPipe Hands Model]
        NORM[Wrist-Relative Bounding Normalizer]
    end

    subgraph Classification Engine
        DNN[TensorFlow.js Deep Neural Network]
        KNN[k-NN Active Learning Overrides]
        ARB{k-NN Confidence > 0.70?}
    end

    subgraph Sensor Fusion & Heuristics
        BUF[10-Frame IMU History Buffer]
        FUSION[Dynamic Gesture Disambiguation Engine]
    end

    subgraph Application & Output Layer
        LOCK[Debounce & 3-Frame Lock-in Filter]
        BUILDER[Sentence Builder & Continuous Typing]
        TTS[Web SpeechSynthesis Vocalizer]
        TRANS[14-Language Cloud Translator]
        CHAT[Puter.js GPT-4o Vision Chatbot]
    end

    CAM --> V_STREAM --> MP --> NORM --> ARB
    ARB -->|Yes| KNN --> FUSION
    ARB -->|No| DNN --> FUSION

    GLOVE --> BLE_TRANS --> BUF --> FUSION

    FUSION --> LOCK --> BUILDER
    BUILDER --> TTS
    BUILDER --> TRANS
    CHAT -.->|Photo Analysis| BUILDER
```

---

## Signal Processing & Inference Sequence

The following sequence diagram illustrates the frame-by-frame execution lifecycle from optical and inertial capture to translated vocalization:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Hand
    participant Cam as Webcam Feed
    participant MP as MediaPipe Hands
    participant TF as TensorFlow.js NN
    participant ESP as ESP32 Glove (50Hz)
    participant BLE as Web Bluetooth
    participant App as Fusion & Sentence Engine
    participant TTS as Speech Synthesis

    loop Every Video Frame (~33ms / 30 FPS)
        Cam->>MP: Deliver 640x480 RGB Video Frame
        MP->>MP: Extract 21 3D Hand Landmarks
        MP->>TF: 42 Normalized Features (x, y relative to wrist)
        TF->>TF: Feedforward Pass (Dense 256 -> 128 -> 64 -> 26)
        TF->>App: Raw Class Prediction & Confidence (0.0 to 1.0)
    end

    loop Every IMU Cycle (20ms / 50 Hz)
        ESP->>BLE: Notify 'R:<roll>,P:<pitch>' ASCII Packet
        BLE->>App: Update Global Roll & Pitch State
    end

    opt Sensor Fusion & Disambiguation
        App->>App: Check 10-frame IMU trajectory window
        Note over App: If Raw == 'I' and (PitchDelta > 40° then RollDelta > 40°) -> Transform to 'J'
        Note over App: If Raw == 'D' and PitchDelta > 20° -> Transform to 'Z'
        Note over App: If Raw == 'S' and Fist Nods (Dev > 25°, Return < 15°) -> Transform to 'YES'
        Note over App: If Raw == 'B' and RollDelta > 40° -> Transform to 'HELLO'
        Note over App: If Pitch < 20° and |Roll| > 150° -> Transform to 'SPACE'
    end

    opt Lock-in & Output
        Note over App: Hold gesture for 3 consecutive frames
        App->>App: Append character to active sentence buffer
        App->>TTS: Trigger 880Hz audio chime & speak letter/word
    end
```

---

## State Machine: Debounce, Lock-In, and Stream Handling

```mermaid
stateDiagram-v2
    [*] --> Idle: App Initialized & Camera Ready

    Idle --> Tracking: Hand Detected in Frame
    Tracking --> Idle: Hand Dropped / Not Detected (Resets Last Added Letter)

    state Tracking {
        [*] --> Evaluating
        Evaluating --> CandidateMatch: Confidence >= 0.60
        CandidateMatch --> CandidateMatch: Same Sign Detected (Frame Count + 1)
        CandidateMatch --> LockedIn: Consecutive Frames == 3
        LockedIn --> Cooldown: Trigger Chime + Speak + Append Word
        Cooldown --> Evaluating: Elapsed Time > 300ms
        CandidateMatch --> Evaluating: Sign Changed (Reset Count to 1)
    }
```

---

## Architectural Subsystems

### 1. Embedded Sensing Subsystem (`firmware/esp_glove/`)
- **Microcontroller**: Espressif ESP32 dual-core Xtensa LX6 microprocessor running at $240\text{ MHz}$.
- **Sensor**: InvenSense MPU-6050 6-axis MEMS accelerometer and gyroscope sampled via I2C at $100\text{ kHz}$.
- **On-Chip Preprocessing**: Digital low-pass filtering ($\alpha = 0.85$) and trigonometric tilt angle calculation (`atan2`).
- **Telemetry Server**: Custom Bluetooth Low Energy (BLE) GATT server broadcasting formatted ASCII string notifications.

### 2. Vision & Landmark Subsystem
- **Model**: Google MediaPipe Hands ML pipeline utilizing a two-stage detector/tracker architecture (Palm Detector followed by 3D Hand Landmark Model).
- **Coordinate Normalization**: Translates all 21 joints relative to landmark 0 (wrist) and scales by maximum coordinate magnitude to achieve scale- and translation-invariance.

### 3. Deep Learning Classifier Subsystem
- **Runtime**: TensorFlow.js WebGL/WebGPU-accelerated inference engine.
- **Topology**: 4-layer feedforward architecture with Batch Normalization and Dropout regularization.
- **Persistence**: IndexedDB zero-latency client caching (`indexeddb://asl-alphabet-model`).

### 4. Sensor Fusion & Active Learning Subsystem
- **k-Nearest Neighbors (k-NN)**: Active learning override layer enabling real-time local calibration for non-standard hand geometries.
- **Dynamic Heuristic Engine**: Circular buffer ($N=10$) analyzing angular derivatives ($\Delta \text{Roll}, \Delta \text{Pitch}$) to distinguish motion-dependent signs.

### 5. Assistive Output Subsystem
- **Web SpeechSynthesis API**: Vocalization with pitch and rate modulation.
- **Google Translate REST Endpoint**: Multilingual translation into 14 languages.
- **Puter.js GPT-4o Vision**: Multimodal conversational assistant for asynchronous gesture photo analysis.
