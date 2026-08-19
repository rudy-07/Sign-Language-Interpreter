# Engineering Roadmap & Future Milestones

This document outlines the phased engineering roadmap for the **Sign Language Interpreter**, charting the progression from the current working prototype to a full-featured, continuous, accessible human-computer interaction platform.

---

## Roadmap Overview

```mermaid
gantt
    title Sign Language Interpreter Development Phases
    dateFormat YYYY-MM
    axisFormat %Y-Q%q

    section Phase 1: Prototype
    Alphabet Vision & BLE IMU Glove :done, 2026-07, 2026-08
    Active Learning k-NN & Translations :done, 2026-08, 2026-08

    section Phase 2: Refinements
    Synthetic Augmentation & Calibration :active, 2026-09, 2026-11
    Confidence Calibration & Lighting Robustness :2026-10, 2026-12

    section Phase 3: Continuous
    ST-GCN / Temporal Sequence Modeling :2027-01, 2027-04
    Bilateral Two-Handed Sign Lexicon :2027-03, 2027-06

    section Phase 4: OS Control
    Virtual HID Mouse & Typing Emulation :2027-06, 2027-09
    Accessibility Gesture Shortcut Layer :2027-08, 2027-11

    section Phase 5: Edge Platform
    Standalone Edge TPU / Raspberry Pi Kiosk :2027-11, 2028-03
    Multilingual Sign Lexicons (ISL / BSL) :2028-01, 2028-06
```

---

## Detailed Phase Breakdown

### Phase 1 — Current Working Prototype (Completed)
- [x] **21-Landmark Vision Tracking**: Browser-based MediaPipe Hands at 30–60 FPS.
- [x] **On-Device Neural Inference**: 4-layer Sequential DNN with IndexedDB persistent caching.
- [x] **Smart Glove Telemetry**: ESP32 + MPU-6050 BLE GATT server streaming at $50\text{ Hz}$.
- [x] **Dynamic Heuristic Fusion**: Motion disambiguation for 'J', 'Z', 'YES', 'HELLO', 'SPACE'.
- [x] **Active Learning Overrides**: On-device k-NN calibration for user-specific hand shapes.
- [x] **Sentence Builder & Vocalizer**: Continuous typing stream, audio chime, and Web SpeechSynthesis.
- [x] **Multilingual Translation**: Real-time translation to 14 languages.
- [x] **Multimodal AI Chatbot**: Puter.js GPT-4o Vision photo analysis interface.

---

### Phase 2 — Dataset & Model Robustness (In Progress)
- [ ] **Synthetic 3D Augmentation**: Augment dataset with 3D rotations, perspective warping, and joint jittering.
- [ ] **Lighting & Background Invariance**: Add contrast adaptive histogram equalization (CLAHE) to improve landmark detection in low-light environments.
- [ ] **Confidence Calibration**: Implement temperature scaling on softmax logits to prevent overconfident false positives.
- [ ] **Multi-User Profile Management**: Allow multiple signers to save and load personalized calibration profiles.

---

### Phase 3 — Continuous Sign Language & Temporal Modeling
- [ ] **Spatial-Temporal Graph Convolutional Networks (ST-GCN)**: Transition from static frame classification to continuous joint graph sequence modeling.
- [ ] **CNN + LSTM / Transformer Temporal Pipeline**: Model dynamic sign transitions and continuous sentence construction.
- [ ] **Bilateral Two-Handed Tracking**: Enable simultaneous dual-hand tracking for complex ASL signs.
- [ ] **Grammar & Context Decoder**: Implement n-gram language models and beam search to correct finger-spelling typos automatically.

---

### Phase 4 — OS-Level Accessibility Control (Virtual HID)
Transform recognized signs and gestures into native operating system input commands:

```mermaid
flowchart LR
    SIGN[Recognized Sign / Gesture] --> INTENT[Intent & Command Mapper]
    INTENT --> DRIVER[Virtual HID Driver / WebHID]
    DRIVER --> OS[Operating System Action]

    subgraph OS Actions
        OS --> MOUSE[Mouse Movement & Click]
        OS --> KEY[Keyboard Typing & Shortcuts]
        OS --> WIN[Window Switching & Media Control]
        OS --> SCR[Screenshot & Accessibility Commands]
    end
```

- [ ] **Virtual Cursor Control**: Map hand roll/pitch to mouse cursor coordinates.
- [ ] **Click & Scroll Gestures**: Pinch gestures for left click, double click, and fluid scroll.
- [ ] **Global Shortcut Triggering**: Execute system shortcuts (e.g., screenshot, mute, switch workspace).

---

### Phase 5 — Edge Hardware & Multilingual Expansion
- [ ] **Embedded Edge Deployment**: Port inference to standalone edge hardware (e.g., Raspberry Pi 5 + Coral Edge TPU).
- [ ] **Multilingual Sign Languages**: Expand beyond ASL to Indian Sign Language (ISL), British Sign Language (BSL), and French Sign Language (LSF).
- [ ] **Low-Power Bluetooth 5.0 Custom PCB**: Design a miniaturized custom flex-PCB with integrated IMU and LiPo charging for ergonomic all-day wear.
