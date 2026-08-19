# ESP32 Smart Glove Firmware

This directory contains the embedded firmware for the **Sign Language Interpreter Smart Glove**, powered by an **ESP32 Dev Module** and an **MPU-6050 6-DoF Inertial Measurement Unit (IMU)**.

The glove captures real-time hand roll and pitch orientations, applies on-chip digital low-pass filtering, and broadcasts high-frequency telemetry over **Bluetooth Low Energy (BLE)** to the companion web application.

---

## Hardware Pinout & Wiring

| MPU-6050 Pin | ESP32 GPIO | Signal Type | Description |
| :--- | :--- | :--- | :--- |
| **VCC** | 3.3V (or 5V) | Power | Power supply rail |
| **GND** | GND | Power | Common ground |
| **SDA** | GPIO 21 | I2C Data | Serial Data Line |
| **SCL** | GPIO 22 | I2C Clock | Serial Clock Line |
| **INT** | *Not Connected* | Digital | Optional interrupt pin |
| **AD0** | *GND / Floating* | Address | I2C Address `0x68` |

> [!IMPORTANT]
> **I2C Pull-up Resistors**: Most standard MPU-6050 breakout boards (GY-521) include on-board $4.7\text{ k}\Omega$ pull-up resistors on SDA and SCL connected to the internal 3.3V regulator output.

---

## BLE GATT Protocol Specification

- **Device Name Advertised**: `MPU6050_Glove`
- **Service UUID**: `0000ffe0-0000-1000-8000-00805f9b34fb`
- **Characteristic UUID**: `0000ffe1-0000-1000-8000-00805f9b34fb`
- **Properties**: `READ | NOTIFY`
- **Descriptor**: `BLE2902` (Client Characteristic Configuration Descriptor)
- **Broadcast Frequency**: $50\text{ Hz}$ ($20\text{ ms}$ interval)
- **Payload Format**: String in ASCII format:
  ```text
  R:<roll_deg>,P:<pitch_deg>
  ```
  *Example*: `R:45.2,P:-12.1`

---

## Flashing Instructions

### Option 1: Arduino IDE

1. Install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.0+ recommended).
2. Add ESP32 board support via **File > Preferences > Additional Boards Manager URLs**:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Install required libraries via **Tools > Manage Libraries** (`Ctrl+Shift+I`):
   - `Adafruit MPU6050`
   - `Adafruit Unified Sensor`
   - `ESP32 BLE Arduino`
4. Open [esp_glove.ino](esp_glove.ino).
5. Select your board (**Tools > Board > ESP32 Arduino > ESP32 Dev Module**) and active COM port.
6. Click **Upload** (`Ctrl+U`).

### Option 2: PlatformIO (VS Code)

1. Create a new project targeting `board = esp32dev` and `framework = arduino`.
2. Add the following to `platformio.ini`:
   ```ini
   [env:esp32dev]
   platform = espressif32
   board = esp32dev
   framework = arduino
   monitor_speed = 9600
   lib_deps =
       adafruit/Adafruit MPU6050@^2.2.4
       adafruit/Adafruit Unified Sensor@^1.1.9
   ```
3. Copy `esp_glove.ino` into `src/main.cpp` and run `pio run --target upload`.

---

## Verification & Serial Debugging

Open the Serial Monitor at **9600 baud**. On boot, you should observe:

```text
MPU6050 Hand Tracker with BLE
==============================
Initializing BLE...
BLE Ready: MPU6050_Glove

Initializing MPU6050...
MPU6050 READY
Format: R:x,P:y
==============================

R:0.0,P:0.0
R:1.2,P:-0.4
✓ BLE Connected
```
