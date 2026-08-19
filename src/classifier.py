"""
Landmark Classifier and Prediction State Engine.
Provides neural inference, confidence thresholding, and temporal smoothing logic.
"""

from typing import List, Optional, Tuple
import numpy as np

ALPHABET: List[str] = [chr(ord("A") + i) for i in range(26)]


class SignClassifier:
    """
    Classifies 42-feature normalized hand landmark vectors into ASL alphabet characters.
    """

    def __init__(
        self,
        confidence_threshold: float = 0.60,
        required_consecutive_frames: int = 3,
    ):
        self.confidence_threshold = confidence_threshold
        self.required_consecutive_frames = required_consecutive_frames

        # State tracking
        self.last_letter: str = "-"
        self.consecutive_count: int = 0
        self.locked_letter: str = "-"

    def process_prediction(
        self, probabilities: np.ndarray
    ) -> Tuple[str, float, bool]:
        """
        Processes model output probabilities through confidence and temporal debounce filters.

        Args:
            probabilities: 1D array of length 26 representing class softmax probabilities.

        Returns:
            Tuple[str, float, bool]: (Detected character or '-', Confidence float, Is-Locked-In flag)
        """
        class_id = int(np.argmax(probabilities))
        confidence = float(probabilities[class_id])

        if confidence >= self.confidence_threshold:
            candidate = ALPHABET[class_id]
        else:
            candidate = "-"

        is_locked = False

        if candidate == self.last_letter and candidate != "-":
            self.consecutive_count += 1
            if self.consecutive_count == self.required_consecutive_frames:
                self.locked_letter = candidate
                is_locked = True
        else:
            self.consecutive_count = 1 if candidate != "-" else 0
            self.last_letter = candidate
            if candidate == "-":
                self.locked_letter = "-"

        return candidate, confidence, is_locked

    def reset(self) -> None:
        """Resets the internal debounce state machine."""
        self.last_letter = "-"
        self.consecutive_count = 0
        self.locked_letter = "-"


if __name__ == "__main__":
    clf = SignClassifier()
    # Simulate high-confidence 'B' detection across 3 consecutive frames
    dummy_probs = np.zeros(26, dtype=np.float32)
    dummy_probs[1] = 0.95  # 'B'

    for frame in range(1, 5):
        letter, conf, locked = clf.process_prediction(dummy_probs)
        print(f"Frame {frame}: Candidate={letter}, Conf={conf:.2f}, LockedIn={locked}")
