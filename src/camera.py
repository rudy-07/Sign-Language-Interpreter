"""
Camera Acquisition and Processing Module.
Provides low-latency OpenCV video capture with FPS tracking and frame preprocessing.
"""

import time
from typing import Generator, Optional, Tuple
import cv2
import numpy as np


class CameraManager:
    """
    Manages webcam capture, frame resizing, mirroring, and frame-rate tracking.
    """

    def __init__(
        self,
        camera_index: int = 0,
        width: int = 640,
        height: int = 480,
        mirror: bool = True,
    ):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.mirror = mirror
        self.cap: Optional[cv2.VideoCapture] = None

        # FPS Tracker
        self._prev_time = time.time()
        self._fps = 0.0
        self._frame_count = 0

    def start(self) -> bool:
        """Initializes and opens the video capture stream."""
        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            return False

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        return True

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """
        Captures a single frame from the camera stream.

        Returns:
            Tuple[bool, Optional[np.ndarray]]: (Success flag, BGR frame image)
        """
        if self.cap is None or not self.cap.isOpened():
            return False, None

        ret, frame = self.cap.read()
        if not ret:
            return False, None

        if self.mirror:
            frame = cv2.flip(frame, 1)

        # Update FPS
        self._frame_count += 1
        now = time.time()
        elapsed = now - self._prev_time
        if elapsed >= 1.0:
            self._fps = self._frame_count / elapsed
            self._frame_count = 0
            self._prev_time = now

        return True, frame

    @property
    def fps(self) -> float:
        """Returns the current observed frames per second."""
        return self._fps

    def stop(self) -> None:
        """Releases the camera hardware."""
        if self.cap is not None:
            self.cap.release()
            self.cap = None


if __name__ == "__main__":
    cam = CameraManager()
    if cam.start():
        print("Camera started. Press 'q' to exit.")
        while True:
            ret, frame = cam.read_frame()
            if not ret:
                break
            cv2.putText(
                frame,
                f"FPS: {cam.fps:.1f}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 255, 0),
                2,
            )
            cv2.imshow("Sign Language Interpreter - Video Feed", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
        cam.stop()
        cv2.destroyAllWindows()
    else:
        print("Failed to open camera device.")
