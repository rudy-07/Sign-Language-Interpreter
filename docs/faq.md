# Frequently Asked Questions (FAQ)

---

### 1. General & Capabilities

#### Can I use the system without the ESP32 smart glove?
**Yes.** The vision-based ASL Alphabet Detector runs completely standalone in your browser. You can spell all static letters (A–Z) using just your laptop webcam. The ESP32 smart glove is optional; when connected, it provides hardware sensor fusion to disambiguate dynamic and orientation-dependent signs ('J', 'Z', 'YES', 'HELLO', and 'SPACE').

#### How many sign language gestures are currently supported?
The current prototype supports the **26 standard letters of the American Sign Language (ASL) alphabet** (A through Z) plus **5 motion-fused gestures** ('J' scoop, 'Z' trajectory, 'YES' nod, 'HELLO' salute sweep, and 'SPACE' flat palm).

#### Does the system support two-handed signs?
The current prototype is configured for single-hand detection (`maxNumHands: 1`) to optimize inference frame rates. Continuous two-handed sign recognition is scheduled for Phase 3 of the [Roadmap](roadmap.md).

---

### 2. Machine Learning & Calibration

#### What if a specific letter fails to detect accurately for my hand shape?
You can use the **Manual Training** panel on the right side of the interface:
1. Select the problematic letter from the dropdown (e.g., 'E' or 'M').
2. Hold your hand in the target pose in front of the camera.
3. Click **📸 Capture Frame** 3–5 times from slight variations.
4. The system will immediately use an active k-NN override whenever that hand formation is recognized.
5. Click **💾 Save** to persist your overrides across browser sessions in `localStorage`.

#### Where is the deep learning model executed?
The neural network runs **100% locally on your computer** using TensorFlow.js with WebGL hardware acceleration. No video frames, landmark coordinates, or biometric images are ever transmitted to any external server.

---

### 3. Hardware & Firmware

#### Which ESP32 boards are compatible?
Any standard ESP32 development board featuring Bluetooth 4.2+ (e.g., ESP32 Dev Module, NodeMCU-32S, ESP32-WROOM-32, or FireBeetle ESP32) is fully compatible.

#### Can I power the glove with a battery?
Yes. You can power the ESP32 using a standard $3.7\text{V}$ Lithium-Polymer (LiPo) battery connected through a 5V boost converter or directly to the board's battery management header (e.g., on ESP32 boards with integrated TP4056 chargers). A $500\text{ mAh}$ battery provides approximately 4.25 hours of continuous streaming.

---

### 4. Software & Browser Support

#### Why does Web Bluetooth not work in Firefox or Safari?
The W3C Web Bluetooth specification is currently implemented primarily in Chromium-based browsers (**Google Chrome**, **Microsoft Edge**, **Opera**, and **Brave**). Firefox and Safari have not yet enabled Web Bluetooth by default.

#### How does the multi-language translation work?
The sentence builder sends the composed English text string to Google Translate's translation endpoint and vocalizes the result using the native browser SpeechSynthesis API in the selected language's accent/voice pack.

---

### 5. Security & Privacy

#### Is my camera stream private?
**Yes.** All computer vision and landmark tracking operations occur strictly in client-side browser memory. The only feature that makes external API calls is the optional **AI Chatbot** (`chat.html`), which only sends user-uploaded photos to Puter.js / OpenAI when explicitly commanded by the user.
