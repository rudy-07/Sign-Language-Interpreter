#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

Adafruit_MPU6050 mpu;

// BLE
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;

#define SERVICE_UUID        "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID "0000ffe1-0000-1000-8000-00805f9b34fb"

const char* deviceName = "MPU6050_Glove";

bool deviceConnected = false;
bool oldDeviceConnected = false;

// Orientation (degrees)
float roll = 0;
float pitch = 0;

// Smoothing
const float SMOOTH = 0.85;

// BLE callbacks
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { 
    deviceConnected = true; 
    Serial.println("✓ BLE Connected");
  }
  void onDisconnect(BLEServer*) override { 
    deviceConnected = false; 
    Serial.println("✗ BLE Disconnected");
  }
};

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println("MPU6050 Hand Tracker with BLE");
  Serial.println("==============================");

  // BLE init
  Serial.println("\nInitializing BLE...");
  BLEDevice::init(deviceName);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* service = pServer->createService(SERVICE_UUID);
  pCharacteristic = service->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  service->start();
  BLEDevice::startAdvertising();
  Serial.println("BLE Ready: " + String(deviceName));

  // MPU init
  Serial.println("\nInitializing MPU6050...");
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found!");
    while (1);
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.println("MPU6050 READY");
  Serial.println("Format: R:x,P:y");
  Serial.println("==============================\n");
}

void loop() {
  // Handle BLE reconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(300);
    pServer->startAdvertising();
    Serial.println("Restarting BLE advertising...");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  sensors_event_t accel, gyro, temp;
  mpu.getEvent(&accel, &gyro, &temp);

  // --- PURE ACCELEROMETER TILT (STABLE) ---
  float newRoll =
    atan2(accel.acceleration.x,
          accel.acceleration.z) * 180.0 / PI;

  float newPitch =
    atan2(accel.acceleration.y,
          sqrt(accel.acceleration.x * accel.acceleration.x +
               accel.acceleration.z * accel.acceleration.z)) * 180.0 / PI;

  // --- LOW PASS FILTER ---
  roll  = SMOOTH * roll  + (1 - SMOOTH) * newRoll;
  pitch = SMOOTH * pitch + (1 - SMOOTH) * newPitch;

  // --- CLAMPS ---
  if (pitch > 90) pitch = 90;
  if (pitch < -90) pitch = -90;

  if (roll > 180) roll -= 360;
  if (roll < -180) roll += 360;

  // Format data
  String data = "R:" + String(roll, 1) + ",P:" + String(pitch, 1);

  // Send to Serial (for debugging)
  Serial.println(data);

  // Send to BLE (for web app)
  if (deviceConnected) {
    pCharacteristic->setValue(data.c_str());
    pCharacteristic->notify();
  }

  delay(20); // 50 Hz
}
