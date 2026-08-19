"""
ESP32 Smart Glove Bluetooth Low Energy (BLE) Telemetry Receiver.
Connects to MPU6050_Glove GATT server and processes 50 Hz roll/pitch orientation streams.
"""

import asyncio
from collections import deque
import re
from typing import Callable, Deque, Optional, Tuple

BLE_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"
BLE_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
DEVICE_NAME = "MPU6050_Glove"


class GloveBleReceiver:
    """
    Receives and parses real-time orientation telemetry from the ESP32 MPU-6050 smart glove.
    """

    def __init__(self, history_size: int = 10):
        self.history_size = history_size
        self.roll: float = 0.0
        self.pitch: float = 0.0
        self.is_connected: bool = False

        self.roll_history: Deque[float] = deque(maxlen=history_size)
        self.pitch_history: Deque[float] = deque(maxlen=history_size)

        self._pattern = re.compile(r"R:([-\d\.]+),P:([-\d\.]+)")
        self._on_update_callback: Optional[Callable[[float, float], None]] = None

    def set_callback(self, callback: Callable[[float, float], None]) -> None:
        """Sets a listener callback for incoming roll/pitch pairs."""
        self._on_update_callback = callback

    def parse_packet(self, data_str: str) -> Optional[Tuple[float, float]]:
        """
        Parses packet format: 'R:<roll>,P:<pitch>'
        Example: 'R:45.2,P:-12.1'
        """
        match = self._pattern.search(data_str.strip())
        if match:
            try:
                r = float(match.group(1))
                p = float(match.group(2))
                self.roll = r
                self.pitch = p
                self.roll_history.append(r)
                self.pitch_history.append(p)
                if self._on_update_callback:
                    self._on_update_callback(r, p)
                return r, p
            except ValueError:
                pass
        return None

    def notification_handler(self, sender: int, data: bytearray) -> None:
        """Handles incoming GATT notifications."""
        try:
            text = data.decode("utf-8")
            self.parse_packet(text)
        except UnicodeDecodeError:
            pass


if __name__ == "__main__":
    receiver = GloveBleReceiver()
    test_packets = [
        "R:10.5,P:-2.3\n",
        "R:25.0,P:-15.4\n",
        "R:65.0,P:42.1\n",
    ]
    for pkt in test_packets:
        parsed = receiver.parse_packet(pkt)
        print(f"Packet: {pkt.strip()} -> Parsed: {parsed}")
    print(f"Buffer sizes: Roll={len(receiver.roll_history)}, Pitch={len(receiver.pitch_history)}")
