"""
Landmark Feature Extraction & Normalization Module.
Provides wrist-relative transformation and bounding normalization identical to the JS frontend.
"""

from typing import List, Tuple, Union
import numpy as np


class LandmarkFeatureExtractor:
    """
    Extracts and normalizes 21 2D/3D hand landmarks into a 42-dimensional feature vector.
    """

    def __init__(self, num_landmarks: int = 21):
        self.num_landmarks = num_landmarks

    def extract_normalized_features(
        self, landmarks: Union[np.ndarray, List[Tuple[float, float]]]
    ) -> np.ndarray:
        """
        Transforms raw (x, y) landmarks into wrist-relative normalized coordinates.

        Formula:
            1. (x_i', y_i') = (x_i - x_wrist, y_i - y_wrist)
            2. max_val = max(|x_i'|, |y_i'|) for all i in [0..20]
            3. features = [x_i' / max_val, y_i' / max_val]

        Args:
            landmarks: Array or list of shape (21, 2) or (21, 3) containing normalized [0..1] coordinates.

        Returns:
            np.ndarray: 1D array of 42 normalized float values bounded in [-1.0, 1.0].
        """
        landmarks_arr = np.asarray(landmarks)
        if landmarks_arr.shape[0] < self.num_landmarks:
            raise ValueError(f"Expected at least {self.num_landmarks} landmarks, got {landmarks_arr.shape[0]}")

        wrist_x = landmarks_arr[0, 0]
        wrist_y = landmarks_arr[0, 1]

        # Shift relative to wrist
        rel_x = landmarks_arr[:self.num_landmarks, 0] - wrist_x
        rel_y = landmarks_arr[:self.num_landmarks, 1] - wrist_y

        # Flatten into interleaved [x0, y0, x1, y1, ...]
        features = np.empty(self.num_landmarks * 2, dtype=np.float32)
        features[0::2] = rel_x
        features[1::2] = rel_y

        # Max absolute scaling
        max_val = np.max(np.abs(features))
        if max_val == 0.0:
            max_val = 1.0

        features /= max_val
        return features


if __name__ == "__main__":
    extractor = LandmarkFeatureExtractor()
    # Test with dummy 21 points
    dummy_landmarks = np.random.rand(21, 2)
    normalized = extractor.extract_normalized_features(dummy_landmarks)
    print(f"Extracted feature vector shape: {normalized.shape}")
    print(f"Feature vector min: {normalized.min():.4f}, max: {normalized.max():.4f}")
