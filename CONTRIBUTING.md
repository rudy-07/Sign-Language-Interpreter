# Contributing to Sign Language Interpreter

Thank you for your interest in contributing to **Sign Language Interpreter**! This project is an open-source research and engineering initiative aimed at creating an accessible, real-time sign language recognition and human-computer interaction platform.

Please review the following guidelines before submitting issues or pull requests.

---

## Code of Conduct

By participating in this project, you agree to abide by the terms of our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## How to Contribute

### 1. Reporting Bugs
- Search existing [GitHub Issues](https://github.com/rudy-07/Sign-Language-Interpreter/issues) to ensure the issue has not already been reported.
- If opening a new issue, include:
  - **Environment details**: Operating system, browser name & version, Python version (if using companion scripts), ESP32 board model.
  - **Steps to reproduce**: Clear, numbered steps to replicate the problem.
  - **Expected vs. actual behavior**: What you expected to happen vs. what occurred.
  - **Console / Serial logs**: Copy relevant browser developer console or serial monitor output.

### 2. Proposing Enhancements
- Open a feature request issue outlining:
  - The motivation behind the enhancement.
  - Potential implementation approaches.
  - Any hardware or computational trade-offs.

### 3. Submitting Pull Requests (PRs)
1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your modifications following our code style.
3. Test your changes thoroughly:
   - For web frontend changes, test across multiple browsers (Chrome, Edge, Firefox) with WebGL enabled.
   - For firmware modifications, verify clean compilation under Arduino IDE / PlatformIO and test BLE notification frequency.
   - For Python scripts, verify dataset processing and formatting.
4. Commit your changes using conventional commit messages:
   - `feat: add temporal smoothing buffer to landmark pipeline`
   - `fix: resolve BLE reconnection race condition in firmware`
   - `docs: update hardware wiring diagram for I2C pullups`
5. Push to your fork and submit a Pull Request targeting `main`.

---

## Development Standards

### Web Frontend (JavaScript / CSS / HTML)
- **Vanilla Modern JS**: Keep dependencies minimal and use modern ES6+ features (`async/await`, `const`/`let`).
- **Design Consistency**: Adhere to the glassmorphic dark theme tokens in [style.css](style.css).
- **Performance**: Avoid memory leaks in requestAnimationFrame loops; dispose of intermediate `tf.Tensor` instances using `tf.tidy()` or explicit `.dispose()`.

### Firmware (ESP32 / C++)
- **Non-blocking Loop**: Maintain a stable 50 Hz loop frequency ($20\text{ ms}$ interval); never use long blocking `delay()` calls in the main loop.
- **Telemetry Format**: Adhere strictly to the standard format `R:<roll>,P:<pitch>\n`.
- **I2C Safety**: Ensure bus initialization handles disconnected sensors gracefully without hardware watchdog timeouts.

### Python / Machine Learning (`src/` and `scripts/`)
- Adhere to **PEP 8** style guidelines and include type hints where practical.
- Keep data pipelines reproducible with deterministic random seeds (`seed=42`).

---

## Community & Questions

If you have questions about system architecture, hardware compatibility, or ML pipelines, feel free to open a discussion or reach out via GitHub Issues!
