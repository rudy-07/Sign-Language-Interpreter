# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-11-02

### Added & Overhauled
- **Advanced 3D Text-to-Sign Engine & NLP Pipeline**:
  - Full longest-match resolution hierarchy: Multi-word phrase -> Exact gloss -> Lemma derivation -> Synonym mapping -> Numbers -> Fingerspelling fallback.
  - Linked `src/lexicon_service.js` directly to `avatar.html` with IndexedDB preloading and continuous bone stepping to eliminate animation stutter and frozen avatar frames.
  - Case-insensitive fingerspelling supporting authentic letter-by-letter manual alphabet fallback.
- **Client-Side Zero-Auth AI Sentence Simplification**:
  - Replaced Puter.js with serverless Netlify proxy & unauthenticated zero-auth AI endpoints.
  - Added optional "Simplify with AI" feature to rewrite complex English sentences using exclusively available whole-word sign glosses.
  - Strict JSON schema validation ensuring that 100% of returned glosses exist in the lexicon or are valid numbers/proper names.
  - Seamless fallback to the original sentence on timeout or invalid gloss output.
  - Privacy notice informing users that only typed text is transmitted (zero video/camera egress).
- **Interactive Lexicon & Growth Tools**:
  - Added dynamic whole-word **Coverage Meter** (`coverage-label`, `coverage-bar-fill`) to `avatar.html`.
  - Added **Lexicon Explorer Modal** (`modal-lexicon-explorer`) allowing users to search 97+ signs by category and test-play them directly on the avatar.
  - Added **Missing Words Telemetry Modal** (`modal-missing-words`) tracking fingerspelled words locally and exporting them to CSV/JSON.
  - Added **Record a Sign Tool** (`modal-record-sign`) allowing users to capture 21 wrist-relative landmarks via webcam and save directly into the lexicon.
- **Verification & Documentation**:
  - Authored `docs/weekly-lexicon-growth.md` detailing the weekly lexicon expansion loop.
  - Expanded `tests/test_lexicon_resolver.js` with AI Rewrite output validation (12/12 passing).

---

## [1.0.0] - 2026-08-20

### Added
- **Real-Time Vision Pipeline**: MediaPipe Hands landmark tracking (21 3D hand landmarks) running at 30-60 FPS in browser.
- **On-Device Neural Inference**: 4-layer Sequential Deep Neural Network (`Dense(256) -> Dense(128) -> Dense(64) -> Dense(26)`) running in TensorFlow.js with client-side IndexedDB caching.
- **ESP32 Smart Glove Firmware**: C++/Arduino firmware (`firmware/esp_glove/`) streaming MPU-6050 accelerometer roll and pitch telemetry over BLE GATT at 50 Hz.
- **Web Bluetooth Integration**: Direct browser-to-ESP32 BLE GATT connection with auto-reconnection and telemetry visualizer.
- **Heuristic Sensor Fusion Engine**: Motion-based disambiguation for dynamic gestures ('J' wrist scoop, 'Z' finger zig-zag, 'YES' fist nod, 'HELLO' salute sweep, and 'SPACE' flat palm-up gesture).
- **Hybrid Active Learning (KNN Overrides)**: On-device k-Nearest Neighbors classifier allowing instant user calibration for difficult hand shapes.
- **Sentence Builder & Speech Synthesis**: Real-time sign-to-text typing stream with debounce cooldown and native browser Web Speech API vocalization.
- **Multilingual Translation**: Real-time translation to 14 languages (Tamil, Hindi, Telugu, Malayalam, Kannada, Spanish, French, German, Japanese, Korean, Chinese, Arabic, Portuguese, Russian) with localized speech synthesis voices.
- **Zero-Auth AI Gesture Assistant**: Implemented zero-authentication conversational AI assistant (`chat.html`) with serverless edge proxy and local ASL dictionary fallback (no login/logout required).
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
