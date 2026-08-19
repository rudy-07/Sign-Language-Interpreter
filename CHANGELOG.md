# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-20

### Added
- **Real-Time Vision Pipeline**: MediaPipe Hands landmark tracking (21 3D hand landmarks) running at 30–60 FPS in browser.
- **On-Device Neural Inference**: 4-layer Sequential Deep Neural Network (`Dense(256) -> Dense(128) -> Dense(64) -> Dense(26)`) running in TensorFlow.js with client-side IndexedDB caching.
- **ESP32 Smart Glove Firmware**: C++/Arduino firmware (`firmware/esp_glove/`) streaming MPU-6050 accelerometer roll and pitch telemetry over BLE GATT at 50 Hz.
- **Web Bluetooth Integration**: Direct browser-to-ESP32 BLE GATT connection with auto-reconnection and telemetry visualizer.
- **Heuristic Sensor Fusion Engine**: Motion-based disambiguation for dynamic gestures ('J' wrist scoop, 'Z' finger zig-zag, 'YES' fist nod, 'HELLO' salute sweep, and 'SPACE' flat palm-up gesture).
- **Hybrid Active Learning (KNN Overrides)**: On-device k-Nearest Neighbors classifier allowing instant user calibration for difficult hand shapes.
- **Sentence Builder & Speech Synthesis**: Real-time sign-to-text typing stream with debounce cooldown and native browser Web Speech API vocalization.
- **Multilingual Translation**: Real-time translation to 14 languages (Tamil, Hindi, Telugu, Malayalam, Kannada, Spanish, French, German, Japanese, Korean, Chinese, Arabic, Portuguese, Russian) with localized speech synthesis voices.
- **Multimodal AI Gesture Chatbot**: Integrated Puter.js GPT-4o Vision chatbot interface (`chat.html`) for analyzing uploaded gesture photographs.
- **Python Companion Tooling**: Added `src/` modules (camera, feature extractor, classifier, BLE receiver) and `scripts/` (dataset evaluator, offline trainer, dev server).
- **Engineering Documentation Suite**: 14 comprehensive technical guides under `docs/` covering architecture, hardware, preprocessing, communication, evaluation, and roadmap.

---

## [0.2.0] - 2026-08-10

### Added
- Prototype MediaPipe landmark extraction and static alphabet matching.
- Initial ESP32 MPU-6050 serial orientation tracker.
- Dark theme glassmorphism UI layout.

---

## [0.1.0] - 2026-08-01

### Added
- Initial project concept and dataset collection (`keypoint.csv`).
- Proof-of-concept landmark coordinate extraction.
