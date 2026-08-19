# Hardware Specifications & Sensor Integration

The **Sign Language Interpreter** hardware subsystem is built around an **ESP32 microcontroller** paired with an **InvenSense MPU-6050 6-DoF Inertial Measurement Unit (IMU)** mounted on a wearable smart glove.

---

## Hardware Component Breakdown

| Component | Function | Operating Voltage | Interface / Protocol | Key Specifications |
| :--- | :--- | :--- | :--- | :--- |
| **ESP32 Dev Module** | Main controller & BLE Server | 3.3V Logic (5V USB) | BLE 4.2 / I2C / UART | Dual-core Tensilica Xtensa LX6 @ 240 MHz, 520 KB SRAM, 4 MB Flash |
| **MPU-6050 (GY-521)** | 6-Axis Accelerometer & Gyroscope | 3.3V – 5.0V (Onboard LDO) | I2C (`0x68` / `0x69`) | 16-bit ADC, $\pm 2g$ Accelerometer, $\pm 250^\circ/\text{s}$ Gyroscope, $21\text{ Hz}$ DLPF |
| **Monocular Webcam** | Optical hand video feed | 5V (USB internal/external) | USB Video Class (UVC) | $640 \times 480$ minimum resolution @ 30–60 FPS |
| **Host PC / Laptop** | Machine learning inference host | Standard AC / Battery | Web Browser (Chromium) | WebGL 2.0 / WebGPU capable GPU / Integrated Graphics |

---

## Sensor Specifications (InvenSense MPU-6050)

The MPU-6050 combines a 3-axis MEMS accelerometer and a 3-axis MEMS gyroscope on the same silicon die with an onboard Digital Motion Processor (DMP).

### Operational Configuration
- **Accelerometer Range**: Configured to $\pm 2g$ for high sensitivity to gravitational tilt vectors.
  $$\text{Sensitivity Scale Factor} = 16,384\text{ LSB}/g$$
- **Digital Low-Pass Filter (DLPF)**: Configured to **$21\text{ Hz}$** bandwidth (`MPU6050_BAND_21_HZ`) to suppress high-frequency mechanical vibrations while preserving human hand kinematic response.
- **I2C Clock Speed**: Standard Mode ($100\text{ kHz}$).

---

## Glove Mechanical Construction & Sensor Placement

Proper mechanical mounting ensures accurate gesture orientation telemetry and prevents mechanical fatigue:

1. **Dorsal Placement**: The MPU-6050 module is mounted on the **dorsal (back) side of the hand / wrist area**.
   - *Rationale*: Mounting on the back of the hand ensures the sensor measures true palm orientation (roll) and wrist flexion/extension (pitch) without impeding finger movement or skin contact during signing.
2. **Axis Orientation**:
   - **X-axis**: Aligned longitudinally along the forearm toward the fingertips (roll rotation around forearm axis).
   - **Y-axis**: Aligned laterally across the knuckles (pitch rotation during wrist nodding).
   - **Z-axis**: Normal (perpendicular) to the dorsal surface of the hand.
3. **Strain Relief & Wiring**: Multi-strand flexible silicone wires ($28\text{ AWG}$) with strain relief prevent conductor breakage during continuous signing.

---

## Power Consumption & Battery Sizing

The smart glove can operate either via direct USB tethering or untethered using a lightweight Lithium-Polymer (LiPo) battery:

| Subsystem State | Current Draw (Typical) | Power @ 3.7V |
| :--- | :--- | :--- |
| **ESP32 Active + BLE Advertising (Unconnected)** | $\approx 85\text{ mA}$ | $314\text{ mW}$ |
| **ESP32 Active + BLE Connected (50 Hz Notify)** | $\approx 95\text{ mA}$ | $351\text{ mW}$ |
| **MPU-6050 Active Sensor Sampling** | $\approx 3.8\text{ mA}$ | $14\text{ mW}$ |
| **Total System Operational Load** | **$\approx 100\text{ mA}$** | **$\approx 370\text{ mW}$** |

### Battery Life Estimation
For untethered operation with a compact $500\text{ mAh}$, $3.7\text{V}$ single-cell LiPo battery:
$$\text{Runtime} = \frac{500\text{ mAh} \times 0.85\text{ (efficiency)}}{100\text{ mA}} \approx \mathbf{4.25\text{ hours continuous operation}}$$

---

## Electrical Considerations & Protection

- **Decoupling Capacitors**: GY-521 breakout modules include onboard $0.1\mu\text{F}$ and $10\mu\text{F}$ ceramic decoupling capacitors to filter power supply noise from the ESP32 radio.
- **ESD Protection**: When worn on clothing or synthetic gloves, static discharge can damage exposed GPIO pins. Enclosing the board in a 3D-printed case is strongly recommended.
