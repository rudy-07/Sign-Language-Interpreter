"""
Dataset Evaluation & Integrity Verification Script.
Inspects models/keypoint.csv for class balance, feature dimension correctness, and statistical distributions.
"""

import os
import sys
from collections import Counter
import numpy as np

ALPHABET = [chr(ord("A") + i) for i in range(26)]


def evaluate_keypoint_dataset(csv_path: str) -> None:
    """Evaluates the dataset CSV and prints detailed engineering statistics."""
    if not os.path.exists(csv_path):
        print(f"Error: Dataset file not found at {csv_path}", file=sys.stderr)
        sys.exit(1)

    print("=" * 70)
    print(" SIGN LANGUAGE INTERPRETER — DATASET INTEGRITY & EVALUATION REPORT")
    print("=" * 70)
    print(f"Dataset Path : {os.path.abspath(csv_path)}")
    file_size_mb = os.path.getsize(csv_path) / (1024 * 1024)
    print(f"File Size    : {file_size_mb:.2f} MB\n")

    labels = []
    features_list = []
    corrupt_rows = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            try:
                label = int(float(parts[0]))
                feats = [float(x) for x in parts[1:]]
                if len(feats) != 42:
                    corrupt_rows += 1
                    continue
                labels.append(label)
                features_list.append(feats)
            except ValueError:
                corrupt_rows += 1
                continue

    total_samples = len(labels)
    print(f"Total Valid Samples : {total_samples:,}")
    print(f"Corrupt / Skipped   : {corrupt_rows}")
    print(f"Feature Dimensions  : 42 (21 2D wrist-relative coordinates)\n")

    # Class distribution
    class_counts = Counter(labels)
    print("-" * 70)
    print(f"{'Class ID':<10} | {'Letter':<8} | {'Sample Count':<14} | {'Proportion (%)':<15}")
    print("-" * 70)

    for cid in range(26):
        count = class_counts.get(cid, 0)
        pct = (count / total_samples * 100) if total_samples > 0 else 0
        letter = ALPHABET[cid] if cid < len(ALPHABET) else f"Unknown ({cid})"
        print(f"{cid:<10} | {letter:<8} | {count:<14,} | {pct:>6.2f}%")

    print("-" * 70)

    # Statistical summary on features
    features_arr = np.array(features_list, dtype=np.float32)
    print(f"\nFeature Tensor Shape : {features_arr.shape}")
    print(f"Min Feature Value    : {np.min(features_arr):.4f}")
    print(f"Max Feature Value    : {np.max(features_arr):.4f}")
    print(f"Mean Feature Value   : {np.mean(features_arr):.4f}")
    print(f"Std Feature Value    : {np.std(features_arr):.4f}")
    print("\n[OK] Dataset validation completed successfully.")
    print("=" * 70)


if __name__ == "__main__":
    # Ensure stdout handles UTF-8 safely
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    default_path = os.path.join(os.path.dirname(__file__), "..", "models", "keypoint.csv")
    csv_file = sys.argv[1] if len(sys.argv) > 1 else default_path
    evaluate_keypoint_dataset(csv_file)
