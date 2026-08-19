"""
Offline Training Pipeline for ASL Alphabet Classification.
Mirrors the browser Sequential Deep Neural Network architecture.
"""

import argparse
import os
import sys
import numpy as np

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


def load_dataset(csv_path: str):
    """Loads and parses the 42-feature landmark dataset."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    xs = []
    ys = []
    with open(csv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            try:
                label = int(float(parts[0]))
                feats = [float(x) for x in parts[1:]]
                if len(feats) == 42:
                    xs.append(feats)
                    ys.append(label)
            except ValueError:
                continue

    return np.array(xs, dtype=np.float32), np.array(ys, dtype=np.int32)


def train_keras_model(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    epochs: int = 20,
    batch_size: int = 256,
    num_classes: int = 26,
    output_dir: str = "models",
):
    """Trains the Keras Sequential Deep Neural Network."""
    import tensorflow as tf

    print("\n[+] Constructing Sequential Deep Neural Network:")
    print("    Input (42) -> Dense(256) -> BatchNorm -> Dropout(0.3) ->")
    print("    Dense(128) -> BatchNorm -> Dropout(0.2) -> Dense(64) -> Dense(26, Softmax)")

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(42,)),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    print(f"\n[+] Starting training for {epochs} epochs (Batch Size: {batch_size})...")
    history = model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        verbose=1,
    )

    # Evaluation
    val_loss, val_acc = model.evaluate(x_val, y_val, verbose=0)
    print(f"\n[OK] Final Validation Loss     : {val_loss:.4f}")
    print(f"[OK] Final Validation Accuracy : {val_acc * 100:.2f}%")

    os.makedirs(output_dir, exist_ok=True)
    model_json_path = os.path.join(output_dir, "model.json")
    with open(model_json_path, "w", encoding="utf-8") as f:
        f.write(model.to_json(indent=2))
    print(f"[OK] Saved model architecture to {model_json_path}")

    return model, history


def main():
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Train ASL Landmark Neural Network")
    parser.add_argument(
        "--dataset",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "models", "keypoint.csv"),
        help="Path to keypoint.csv",
    )
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=256, help="Batch size")
    parser.add_argument("--val-split", type=float, default=0.2, help="Validation split fraction")
    parser.add_argument("--output-dir", type=str, default="models", help="Output directory")

    args = parser.parse_args()

    print("=" * 70)
    print(" SIGN LANGUAGE INTERPRETER — MODEL TRAINING PIPELINE")
    print("=" * 70)

    print(f"[+] Loading dataset from {args.dataset}...")
    X, y = load_dataset(args.dataset)
    print(f"[+] Loaded {len(X):,} samples across {len(np.unique(y))} classes.")

    if SKLEARN_AVAILABLE:
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=args.val_split, random_state=42, stratify=y
        )
    else:
        split_idx = int(len(X) * (1 - args.val_split))
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]

    print(f"[+] Train Set: {len(X_train):,} samples | Val Set: {len(X_val):,} samples")

    try:
        train_keras_model(
            X_train,
            y_train,
            X_val,
            y_val,
            epochs=args.epochs,
            batch_size=args.batch_size,
            output_dir=args.output_dir,
        )
    except ImportError:
        print("[!] TensorFlow not installed in current Python environment.")
        print("[!] Install via: pip install tensorflow scikit-learn")


if __name__ == "__main__":
    main()
