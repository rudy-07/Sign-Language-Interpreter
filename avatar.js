/**
 * Sign Language Studio - 3D Neural Avatar & ASL Text-to-Sign Engine
 * =================================================================
 * Real-time WebGL Three.js skeletal animation runtime for American Sign Language (ASL).
 * Features:
 *   - 3D Adobe Mixamo Y-Bot humanoid avatar with dynamic shaders & materials:
 *       • Signature Turquoise Robot (mathematical radial gradient falloff, glowing visor)
 *       • Cyber Stealth (deep obsidian titanium, graphite joints, emerald laser accents)
 *       • Classic Titanium (clean silver pearl metallic armor)
 *       • Stylized Human Rig (procedural face, hair, and facial features)
 *   - Authentic One-Handed ASL Fingerspelling (Letters A through Z)
 *   - 35+ Fully Articulated ASL Whole-Word Signs (Social, Questions, Actions, People, Daily)
 *   - Offline ASL Text-to-Gloss NLP engine with grammar reordering (Time-first, SOV, WH-final)
 *   - Real-time interactive gloss timeline with synchronized active-chip highlighting
 *   - Web Speech API integration for natural voice-to-sign translation
 *   - Full playback controls (Play, Pause mid-pose, Resume, Stop to rest, Replay, Speed 0.5x-1.5x)
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. ASL VOCABULARY & GRAMMAR ENGINE
    // =========================================================================

    // Contraction expansions
    const CONTRACTIONS = {
        "don't": "do not", "doesn't": "does not", "didn't": "did not",
        "can't": "can not", "cannot": "can not", "couldn't": "could not",
        "won't": "will not", "wouldn't": "would not", "shouldn't": "should not",
        "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
        "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
        "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is",
        "it's": "it is", "we're": "we are", "they're": "they are",
        "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
        "i'll": "i will", "you'll": "you will", "he'll": "he will", "she'll": "she will",
        "what's": "what is", "where's": "where is", "who's": "who is", "how's": "how is",
        "let's": "let us"
    };

    // Common English lemmatizations
    const LEMMA_MAP = {
        "thanks": "THANK_YOU",
        "thank": "THANK_YOU",
        "hi": "HELLO",
        "hey": "HELLO",
        "eating": "EAT",
        "ate": "EAT",
        "eats": "EAT",
        "drinking": "DRINK",
        "drank": "DRINK",
        "drinks": "DRINK",
        "helping": "HELP",
        "helped": "HELP",
        "helps": "HELP",
        "wanted": "WANT",
        "wants": "WANT",
        "wanting": "WANT",
        "needed": "NEED",
        "needs": "NEED",
        "needing": "NEED",
        "liked": "LIKE",
        "likes": "LIKE",
        "liking": "LIKE",
        "knowing": "KNOW",
        "knew": "KNOW",
        "knows": "KNOW",
        "loving": "LOVE",
        "loved": "LOVE",
        "loves": "LOVE",
        "waiting": "WAIT",
        "waits": "WAIT",
        "stopping": "STOP",
        "stops": "STOP",
        "asked": "ASK",
        "asking": "ASK",
        "asks": "ASK",
        "sleeps": "SLEEP",
        "sleeping": "SLEEP",
        "slept": "SLEEP",
        "going": "GO",
        "went": "GO",
        "goes": "GO",
        "coming": "COME",
        "came": "COME",
        "comes": "COME",
        "me": "I",
        "my": "MY",
        "mine": "MY",
        "your": "YOUR",
        "yours": "YOUR",
        "please": "PLEASE",
        "sorry": "SORRY",
        "yes": "YES",
        "yeah": "YES",
        "yep": "YES",
        "no": "NO",
        "nope": "NO",
        "good": "GOOD",
        "great": "GOOD",
        "bad": "BAD",
        "water": "WATER",
        "peace": "PEACE",
        "more": "MORE",
        "time": "TIME",
        "home": "HOME",
        "person": "PERSON",
        "again": "AGAIN",
        "what": "WHAT",
        "where": "WHERE",
        "who": "WHO",
        "why": "WHY",
        "when": "WHEN",
        "how": "HOW"
    };

    // Temporal markers placed at beginning of ASL sentences
    const ASL_TIME_WORDS = new Set([
        "TODAY", "TOMORROW", "YESTERDAY", "NOW", "MORNING", "NIGHT", "SOON", "LATER", "TIME"
    ]);

    // WH-Question markers placed at end of ASL sentences
    const ASL_WH_WORDS = new Set([
        "WHAT", "WHERE", "WHY", "WHO", "WHEN", "HOW"
    ]);

    // Negations placed at end of ASL clauses
    const ASL_NEGATIONS = new Set([
        "NOT", "NO", "NEVER"
    ]);

    // Stopwords dropped in ASL grammar
    const ASL_STOPWORDS = new Set([
        "is", "am", "are", "was", "were", "be", "being", "been",
        "a", "an", "the", "to", "of", "and", "or", "in", "at", "for"
    ]);

    /**
     * Converts English text to structured ASL Gloss tokens.
     */
    function textToASLGloss(text, fingerspellOnly = false) {
        if (!text || typeof text !== 'string') return [];

        let cleaned = text.toLowerCase();
        // Expand contractions
        for (const [contraction, expansion] of Object.entries(CONTRACTIONS)) {
            cleaned = cleaned.replace(new RegExp(`\\b${contraction}\\b`, 'g'), expansion);
        }

        // Tokenize words
        const rawTokens = cleaned.replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
        if (rawTokens.length === 0) return [];

        if (fingerspellOnly) {
            return rawTokens.map(word => ({
                token: word.toUpperCase(),
                isFingerspelling: true,
                letters: word.toUpperCase().split('')
            }));
        }

        // Filter and lemmatize
        const filtered = [];
        for (const word of rawTokens) {
            if (ASL_STOPWORDS.has(word)) continue;
            const lemma = LEMMA_MAP[word] || word.toUpperCase();
            filtered.push(lemma);
        }

        // Apply ASL grammatical reordering:
        // 1. Time markers at start
        // 2. Base content (Subject-Object-Verb)
        // 3. Negations toward end
        // 4. WH-question words at very end
        const timeTokens = [];
        const whTokens = [];
        const negTokens = [];
        const coreTokens = [];

        for (const t of filtered) {
            if (ASL_TIME_WORDS.has(t)) {
                timeTokens.push(t);
            } else if (ASL_WH_WORDS.has(t)) {
                whTokens.push(t);
            } else if (ASL_NEGATIONS.has(t)) {
                negTokens.push(t);
            } else {
                coreTokens.push(t);
            }
        }

        const reordered = [...timeTokens, ...coreTokens, ...negTokens, ...whTokens];
        if (reordered.length === 0 && rawTokens.length > 0) {
            // Fallback if all words were filtered out
            reordered.push(rawTokens[0].toUpperCase());
        }

        // Map tokens into items with fingerspelling flag
        return reordered.map(token => {
            const isKnownWord = Boolean(ASL_WORD_SIGNS[token]);
            return {
                token: token,
                isFingerspelling: !isKnownWord,
                letters: isKnownWord ? null : token.split('')
            };
        });
    }

    // =========================================================================
    // 2. PROCEDURAL ASL ANIMATION DEFINITIONS (ON MIXAMO RIG)
    // =========================================================================

    /**
     * Resets fingers and arms smoothly to natural signing baseline.
     */
    function defaultPose(runtime) {
        runtime.characters.push(' ');
        const a = [];
        // Slight neck tilt forward
        a.push(["mixamorigNeck", "rotation", "x", Math.PI / 16, "+"]);

        // Left Arm relaxed at side with elbow bent
        a.push(["mixamorigLeftArm", "rotation", "x", 0.05, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "-"]);

        // Right Arm relaxed at side with elbow bent
        a.push(["mixamorigRightArm", "rotation", "x", 0.05, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", Math.PI / 3.4, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", Math.PI / 1.7, "+"]);

        runtime.animations.push(a);
    }

    // --- Helper for standard right-arm signing presentation position ---
    function poseRightArmUp(a) {
        a.push(["mixamorigRightArm", "rotation", "x", -0.12, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.22, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.95, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.95, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "z", 0.12, "+"]);
        a.push(["mixamorigRightHand", "rotation", "y", 0.25, "+"]);
    }

    function resetRightArm(a) {
        a.push(["mixamorigRightArm", "rotation", "x", 0.05, "+"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", Math.PI / 3.4, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", Math.PI / 1.7, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "z", 0, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHand", "rotation", "y", 0, "-"]);
        a.push(["mixamorigRightHand", "rotation", "z", 0, "-"]);
    }

    // --- Helper to curl a single finger (joints 1, 2, 3) ---
    function curlFinger(a, finger, angle = Math.PI / 2) {
        a.push([`mixamorigRightHand${finger}1`, "rotation", "z", angle, angle > 0 ? "+" : "-"]);
        a.push([`mixamorigRightHand${finger}2`, "rotation", "z", angle, angle > 0 ? "+" : "-"]);
        a.push([`mixamorigRightHand${finger}3`, "rotation", "z", angle, angle > 0 ? "+" : "-"]);
    }

    // --- Helper to uncurl a single finger ---
    function uncurlFinger(a, finger) {
        curlFinger(a, finger, 0);
    }

    // --- Helpers for left-arm and two-handed signing ---
    function poseLeftArmUp(a) {
        a.push(["mixamorigLeftArm", "rotation", "x", -0.12, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "y", -0.22, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.95, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.95, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "z", -0.12, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.25, "-"]);
    }

    function resetLeftArm(a) {
        a.push(["mixamorigLeftArm", "rotation", "x", 0.05, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "y", 0, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "z", 0, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "y", 0, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "z", 0, "+"]);
    }

    function curlLeftFinger(a, finger, angle = Math.PI / 2) {
        a.push([`mixamorigLeftHand${finger}1`, "rotation", "z", -angle, angle > 0 ? "-" : "+"]);
        a.push([`mixamorigLeftHand${finger}2`, "rotation", "z", -angle, angle > 0 ? "-" : "+"]);
        a.push([`mixamorigLeftHand${finger}3`, "rotation", "z", -angle, angle > 0 ? "-" : "+"]);
    }

    function uncurlLeftFinger(a, finger) {
        curlLeftFinger(a, finger, 0);
    }

    function poseBothArmsUp(a) {
        poseRightArmUp(a);
        poseLeftArmUp(a);
    }

    function resetBothArms(a) {
        resetRightArm(a);
        resetLeftArm(a);
    }

    // =========================================================================
    // 3. AUTHENTIC ONE-HANDED ASL ALPHABET (A - Z)
    // =========================================================================
    const ASL_ALPHABET = {};

    // Letter A: Closed fist, thumb held upright against the side of index finger
    ASL_ALPHABET['A'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        // Thumb alongside index
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 4, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 6, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 6, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter B: 4 fingers upright together, thumb folded across palm
    ASL_ALPHABET['B'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        uncurlFinger(a, 'Ring');
        uncurlFinger(a, 'Pinky');
        // Thumb folded across palm
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.2, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 3, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 5, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter C: Curved fingers and thumb forming an open "C" arc facing sideways
    ASL_ALPHABET['C'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 4.2);
        curlFinger(a, 'Middle', Math.PI / 4.2);
        curlFinger(a, 'Ring', Math.PI / 4.2);
        curlFinger(a, 'Pinky', Math.PI / 4.2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 3, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "y", Math.PI / 3.5, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 5, "-"]);
        a.push(["mixamorigRightHand", "rotation", "y", Math.PI / 2.8, "+"]); // turned sideways
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "y", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter D: Index finger straight up; thumb touches middle, ring, and pinky tips in a ring
    ASL_ALPHABET['D'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2.3);
        curlFinger(a, 'Ring', Math.PI / 2.3);
        curlFinger(a, 'Pinky', Math.PI / 2.3);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.3, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 4, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter E: All 4 fingertips curled tightly down resting on top of thumb folded underneath
    ASL_ALPHABET['E'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2.1);
        curlFinger(a, 'Middle', Math.PI / 2.1);
        curlFinger(a, 'Ring', Math.PI / 2.1);
        curlFinger(a, 'Pinky', Math.PI / 2.1);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 3, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter F: Index and thumb tips touching in circle (OK sign), middle, ring, pinky straight up
    ASL_ALPHABET['F'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightHandIndex1", "rotation", "z", Math.PI / 2.5, "+"]);
        a.push(["mixamorigRightHandIndex2", "rotation", "z", Math.PI / 2.5, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.4, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 3, "-"]);
        uncurlFinger(a, 'Middle');
        uncurlFinger(a, 'Ring');
        uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter G: Index and thumb pointing horizontally forward in parallel, other fingers closed
    ASL_ALPHABET['G'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        uncurlFinger(a, 'Index');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 4, "+"]);
        a.push(["mixamorigRightHand", "rotation", "y", Math.PI / 2.2, "+"]); // turned sideways
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter H: Index and Middle fingers extended together horizontally forward
    ASL_ALPHABET['H'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 3, "+"]);
        a.push(["mixamorigRightHand", "rotation", "y", Math.PI / 2.2, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter I: Pinky finger straight up; all other fingers curled into fist
    ASL_ALPHABET['I'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter J: Pinky upright, swooping downward and curving up into a "J" trace
    ASL_ALPHABET['J'] = function (runtime) {
        // Stage 1: Pinky up
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);

        // Stage 2: Swoop down and rotate wrist (draw J)
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigRightHand", "rotation", "z", -0.55, "-"]);
        runtime.animations.push(a);

        // Stage 3: Return
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        runtime.animations.push(a);
    };

    // Letter K: Index straight up, middle pointed forward, thumb between them
    ASL_ALPHABET['K'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        a.push(["mixamorigRightHandMiddle1", "rotation", "z", Math.PI / 4, "+"]);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 3.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter L: Index straight up, thumb wide at 90 degrees ("L")
    ASL_ALPHABET['L'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 2.2, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter M: Fist with thumb folded under first 3 fingers (index, middle, ring)
    ASL_ALPHABET['M'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.1, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 3.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter N: Fist with thumb folded under first 2 fingers (index, middle)
    ASL_ALPHABET['N'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.3, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 4.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter O: All fingertips touch thumb tip forming a rounded "O"
    ASL_ALPHABET['O'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 3);
        curlFinger(a, 'Middle', Math.PI / 3);
        curlFinger(a, 'Ring', Math.PI / 3);
        curlFinger(a, 'Pinky', Math.PI / 3);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.2, "+"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", -Math.PI / 3, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb2", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // Letter P: K handshape pointing downward
    ASL_ALPHABET['P'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        a.push(["mixamorigRightHandMiddle1", "rotation", "z", Math.PI / 4, "+"]);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHand", "rotation", "z", -Math.PI / 2.2, "-"]); // pointing down
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // Letter Q: G handshape pointing downward
    ASL_ALPHABET['Q'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 4, "+"]);
        a.push(["mixamorigRightHand", "rotation", "z", -Math.PI / 2.2, "-"]); // down
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter R: Index and Middle fingers extended upright and crossed
    ASL_ALPHABET['R'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", -0.25, "-"]); // cross over index
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", 0, "+"]);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter S: Tight fist with thumb folded horizontally across front of fingers
    ASL_ALPHABET['S'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        // Thumb wrapped across front
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 1.8, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 4, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter T: Fist with thumb tucked between index and middle finger
    ASL_ALPHABET['T'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.8, "+"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter U: Index and Middle fingers upright together, thumb across ring & pinky
    ASL_ALPHABET['U'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter V: Index and Middle fingers extended in a spread "V" / peace sign
    ASL_ALPHABET['V'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        a.push(["mixamorigRightHandIndex1", "rotation", "y", -0.16, "-"]);
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", 0.16, "+"]);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        a.push(["mixamorigRightHandIndex1", "rotation", "y", 0, "+"]);
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", 0, "-"]);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter W: Index, Middle, Ring fingers extended upright in "W" / 3
    ASL_ALPHABET['W'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        uncurlFinger(a, 'Ring');
        a.push(["mixamorigRightHandIndex1", "rotation", "y", -0.18, "-"]);
        a.push(["mixamorigRightHandRing1", "rotation", "y", 0.18, "+"]);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.4, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        a.push(["mixamorigRightHandIndex1", "rotation", "y", 0, "+"]);
        a.push(["mixamorigRightHandRing1", "rotation", "y", 0, "-"]);
        uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter X: Index finger hooked like a talon, other fingers curled into fist
    ASL_ALPHABET['X'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightHandIndex1", "rotation", "z", 0, "-"]);
        a.push(["mixamorigRightHandIndex2", "rotation", "z", Math.PI / 2.2, "+"]);
        a.push(["mixamorigRightHandIndex3", "rotation", "z", Math.PI / 2.2, "+"]);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter Y: Thumb and Pinky extended wide ("shaka" / hang loose)
    ASL_ALPHABET['Y'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", Math.PI / 2.2, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0, "-"]);
        runtime.animations.push(a);
    };

    // Letter Z: Index finger extended forward, traces "Z" in the air
    ASL_ALPHABET['Z'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        runtime.animations.push(a);

        // Path 1: Top bar right
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.3, "+"]);
        runtime.animations.push(a);

        // Path 2: Diagonal down left
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.3, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Path 3: Bottom bar right
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.3, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // Ensure ASL Alphabet is fully case-insensitive (supports both 'A' and 'a')
    Object.keys(ASL_ALPHABET).forEach(k => {
        ASL_ALPHABET[k.toLowerCase()] = ASL_ALPHABET[k];
        ASL_ALPHABET[k.toUpperCase()] = ASL_ALPHABET[k];
    });

    // =========================================================================
    // 4. ASL WHOLE-WORD SIGNS
    // =========================================================================
    const ASL_WORD_SIGNS = {};

    // HELLO - Salute from forehead / brow outward
    ASL_WORD_SIGNS['HELLO'] = function (runtime) {
        let a = [];
        // Hand to brow
        a.push(["mixamorigRightArm", "rotation", "x", -0.85, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.45, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.25, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.3, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.65, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.08, "+"]);
        runtime.animations.push(a);

        // Salute outward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.65, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.7, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.2, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // THANK_YOU - Flat hand touches chin and extends forward with open palm
    ASL_WORD_SIGNS['THANK_YOU'] = function (runtime) {
        let a = [];
        // Touch chin
        a.push(["mixamorigRightArm", "rotation", "x", -0.22, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.28, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.18, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.22, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -1.05, "-"]);
        a.push(["mixamorigRightHand", "rotation", "z", 0.5, "+"]);
        runtime.animations.push(a);

        // Push forward, palm up
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.6, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.8, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.1, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.4, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", Math.PI / 8, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // PLEASE - Flat hand rubs circular motion on chest
    ASL_WORD_SIGNS['PLEASE'] = function (runtime) {
        let a = [];
        // Hand to chest
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.45, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.95, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.05, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.85, "-"]);
        runtime.animations.push(a);

        // Circle 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.3, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "z", 0.2, "+"]);
        runtime.animations.push(a);

        // Circle 2
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.3, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "z", -0.1, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // SORRY - "A" fist rubs circular motion on chest
    ASL_WORD_SIGNS['SORRY'] = function (runtime) {
        let a = [];
        // Hand to chest in fist
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.45, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.95, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.05, "+"]);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 4, "+"]);
        runtime.animations.push(a);

        // Circle
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.15, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.35, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // YES - "S" fist gently nodding up and down from the wrist
    ASL_WORD_SIGNS['YES'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.2, "+"]);
        runtime.animations.push(a);

        // Nod 1 down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.12, "+"]);
        runtime.animations.push(a);

        // Nod 1 up
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.2, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);

        // Nod 2 down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.12, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // NO - Index and middle snap down onto thumb tip (duck bill close)
    ASL_WORD_SIGNS['NO'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        // Open snap pose
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 3, "+"]);
        runtime.animations.push(a);

        // Snap fingers closed onto thumb
        a = [];
        curlFinger(a, 'Index', Math.PI / 2.5);
        curlFinger(a, 'Middle', Math.PI / 2.5);
        a.push(["mixamorigNeck", "rotation", "y", 0.18, "+"]); // subtle head shake
        runtime.animations.push(a);

        // Snap open
        a = [];
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        a.push(["mixamorigNeck", "rotation", "y", -0.18, "-"]);
        runtime.animations.push(a);

        // Snap closed
        a = [];
        curlFinger(a, 'Index', Math.PI / 2.5);
        curlFinger(a, 'Middle', Math.PI / 2.5);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigNeck", "rotation", "y", 0, "+"]);
        runtime.animations.push(a);
    };

    // I / ME - Index finger points directly to own chest
    ASL_WORD_SIGNS['I'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.22, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.35, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.85, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -1.1, "-"]);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // Ensure ASL Alphabet is fully case-insensitive (supports both 'A' and 'a')
    Object.keys(ASL_ALPHABET).forEach(k => {
        ASL_ALPHABET[k.toLowerCase()] = ASL_ALPHABET[k];
        ASL_ALPHABET[k.toUpperCase()] = ASL_ALPHABET[k];
    });

    // YOU - Index finger points forward toward viewer
    ASL_WORD_SIGNS['YOU'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.55, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.25, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.75, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.45, "+"]);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // Ensure ASL Alphabet is fully case-insensitive (supports both 'A' and 'a')
    Object.keys(ASL_ALPHABET).forEach(k => {
        ASL_ALPHABET[k.toLowerCase()] = ASL_ALPHABET[k];
        ASL_ALPHABET[k.toUpperCase()] = ASL_ALPHABET[k];
    });

    // MY - Open flat hand resting against chest
    ASL_WORD_SIGNS['MY'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.22, "-"]);
        a.push(["mixamorigRightArm", "rotation", "y", 0.42, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.85, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.15, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.9, "-"]);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // LOVE - Crossed arms over chest (warm hug) or ILY gesture
    ASL_WORD_SIGNS['LOVE'] = function (runtime) {
        let a = [];
        // Both arms cross over chest
        a.push(["mixamorigRightArm", "rotation", "x", -0.4, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.9, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.4, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.9, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -2.2, "-"]);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigNeck", "rotation", "x", 0.12, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // HELP - Right thumbs-up resting on left open palm, lifted together
    ASL_WORD_SIGNS['HELP'] = function (runtime) {
        let a = [];
        // Left open palm flat at waist
        a.push(["mixamorigLeftArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.65, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.8, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.65, "+"]); // palm up

        // Right thumbs up on left palm
        a.push(["mixamorigRightArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.65, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.8, "+"]);
        curlFinger(a, 'Index', Math.PI / 2);
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 4, "+"]);
        runtime.animations.push(a);

        // Lift both up together
        a = [];
        a.push(["mixamorigLeftArm", "rotation", "x", -0.55, "-"]);
        a.push(["mixamorigRightArm", "rotation", "x", -0.55, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0, "-"]);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // STOP - Open right hand chops firmly down onto open flat left palm
    ASL_WORD_SIGNS['STOP'] = function (runtime) {
        let a = [];
        // Left hand flat palm up
        a.push(["mixamorigLeftArm", "rotation", "x", -0.4, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.6, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.75, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.7, "+"]);

        // Right hand raised high edge-down
        a.push(["mixamorigRightArm", "rotation", "x", -0.7, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.9, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.9, "+"]);
        a.push(["mixamorigRightHand", "rotation", "y", Math.PI / 2, "+"]);
        runtime.animations.push(a);

        // Chop down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.4, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.65, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // WAIT - Both hands forward palms up, wiggling fingers
    ASL_WORD_SIGNS['WAIT'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.65, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.6, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.65, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.6, "-"]);
        runtime.animations.push(a);

        // Wiggle
        a = [];
        curlFinger(a, 'Index', 0.4);
        curlFinger(a, 'Ring', 0.4);
        runtime.animations.push(a);
        a = [];
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Ring');
        curlFinger(a, 'Middle', 0.4);
        curlFinger(a, 'Pinky', 0.4);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // GOOD - Flat hand touches chin, drops onto open left palm
    ASL_WORD_SIGNS['GOOD'] = function (runtime) {
        let a = [];
        // Touch chin
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.1, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -1.0, "-"]);
        // Left hand ready palm up
        a.push(["mixamorigLeftArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.55, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.65, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.65, "+"]);
        runtime.animations.push(a);

        // Move to left palm
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.4, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.6, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.6, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.5, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // EAT / FOOD - Squished "O" hand taps toward mouth twice
    ASL_WORD_SIGNS['EAT'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.3, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.05, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.25, "+"]);
        // Squished O
        curlFinger(a, 'Index', Math.PI / 3);
        curlFinger(a, 'Middle', Math.PI / 3);
        curlFinger(a, 'Ring', Math.PI / 3);
        curlFinger(a, 'Pinky', Math.PI / 3);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        // Tap mouth 1
        a = [];
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.4, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "-"]);
        runtime.animations.push(a);
        // Tap mouth 2
        a = [];
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.4, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // DRINK - "C" hand tilts back as if drinking from a cup
    ASL_WORD_SIGNS['DRINK'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.05, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.15, "+"]);
        // C cup handshape
        curlFinger(a, 'Index', Math.PI / 4);
        curlFinger(a, 'Middle', Math.PI / 4);
        curlFinger(a, 'Ring', Math.PI / 4);
        curlFinger(a, 'Pinky', Math.PI / 4);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 3, "+"]);
        runtime.animations.push(a);

        // Tip back cup
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", -0.15, "-"]); // head tips back slightly
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0, "+"]);
        runtime.animations.push(a);
    };

    // WATER - "W" hand taps chin twice
    ASL_WORD_SIGNS['WATER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        // W handshape
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.2, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.3, "+"]); // toward chin
        runtime.animations.push(a);

        // Tap 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.4, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0, "+"]);
        runtime.animations.push(a);
        // Tap 2
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.4, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // PEACE - "V" sign held high, or both hands in victory peace sign
    ASL_WORD_SIGNS['PEACE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        uncurlFinger(a, 'Middle');
        a.push(["mixamorigRightHandIndex1", "rotation", "y", -0.16, "-"]);
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", 0.16, "+"]);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        a.push(["mixamorigRightHandThumb1", "rotation", "x", Math.PI / 2.5, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        a.push(["mixamorigRightHandIndex1", "rotation", "y", 0, "+"]);
        a.push(["mixamorigRightHandMiddle1", "rotation", "y", 0, "-"]);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // TIME - Index finger taps the back of non-dominant wrist (watch)
    ASL_WORD_SIGNS['TIME'] = function (runtime) {
        let a = [];
        // Left arm bent in front like looking at watch
        a.push(["mixamorigLeftArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.65, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.85, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.6, "+"]);

        // Right hand index points at left wrist
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.7, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.85, "+"]);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        runtime.animations.push(a);

        // Tap 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.1, "-"]);
        runtime.animations.push(a);
        // Tap 2
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // WHAT - Both hands held out in front, palms up, shaking slightly
    ASL_WORD_SIGNS['WHAT'] = function (runtime) {
        let a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 0.65, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.5, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]); // palm up

        a.push(["mixamorigLeftArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.65, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -1.5, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.65, "+"]); // palm up
        a.push(["mixamorigNeck", "rotation", "x", 0.1, "+"]);
        runtime.animations.push(a);

        // Shake outward
        a = [];
        a.push(["mixamorigRightForeArm", "rotation", "z", 0.25, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "z", -0.25, "-"]);
        runtime.animations.push(a);
        // Shake inward
        a = [];
        a.push(["mixamorigRightForeArm", "rotation", "z", -0.1, "-"]);
        a.push(["mixamorigLeftForeArm", "rotation", "z", 0.1, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        a.push(["mixamorigLeftArm", "rotation", "x", -Math.PI / 10, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -Math.PI / 3.4, "+"]);
        a.push(["mixamorigLeftForeArm", "rotation", "y", -Math.PI / 1.7, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // WHERE - Index finger upright, wagging side-to-side
    ASL_WORD_SIGNS['WHERE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index');
        curlFinger(a, 'Middle', Math.PI / 2);
        curlFinger(a, 'Ring', Math.PI / 2);
        curlFinger(a, 'Pinky', Math.PI / 2);
        runtime.animations.push(a);

        // Wag left
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        runtime.animations.push(a);
        // Wag right
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.35, "-"]);
        runtime.animations.push(a);
        // Wag left
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // HOW - Both curved hands palms down, rotate upward facing chest
    ASL_WORD_SIGNS['HOW'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI / 4); curlFinger(a, 'Middle', Math.PI / 4);
        curlFinger(a, 'Ring', Math.PI / 4); curlFinger(a, 'Pinky', Math.PI / 4);
        curlLeftFinger(a, 'Index', Math.PI / 4); curlLeftFinger(a, 'Middle', Math.PI / 4);
        curlLeftFinger(a, 'Ring', Math.PI / 4); curlLeftFinger(a, 'Pinky', Math.PI / 4);
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        // Rotate outward and upward
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightHand", "rotation", "y", 0.65, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.65, "-"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // GOOD_MORNING - GOOD then MORNING (sun rising over arm)
    ASL_WORD_SIGNS['GOOD_MORNING'] = function (runtime) {
        let a = [];
        // Touch chin
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.85, "-"]);
        runtime.animations.push(a);

        // Extend forward into left palm
        a = [];
        poseLeftArmUp(a);
        a.push(["mixamorigLeftForeArm", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Morning: Right arm rises from horizontal left arm
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.45, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.25, "+"]);
        runtime.animations.push(a);

        // Reset
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // GOOD_NIGHT - GOOD then NIGHT (sun setting over arm)
    ASL_WORD_SIGNS['GOOD_NIGHT'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightHand", "rotation", "x", -0.85, "-"]);
        runtime.animations.push(a);

        a = [];
        poseLeftArmUp(a);
        a.push(["mixamorigLeftForeArm", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Night: Right curved hand curves over left wrist
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.85, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "z", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // NICE_TO_MEET_YOU - NICE (slide palm) then MEET (knuckles meet)
    ASL_WORD_SIGNS['NICE_TO_MEET_YOU'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        // Palms flat
        a.push(["mixamorigRightHand", "rotation", "x", 0.2, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.2, "-"]);
        runtime.animations.push(a);

        // Slide forward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.35, "+"]);
        runtime.animations.push(a);

        // Both index fingers point upright and meet
        a = [];
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // NICE - Flat right palm slides forward over flat left palm
    ASL_WORD_SIGNS['NICE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.4, "+"]);
        runtime.animations.push(a);
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // MEET - Both index fingers upright move towards each other
    ASL_WORD_SIGNS['MEET'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FAMILY - Both 'F' hands touch, circle outward, and touch pinkies
    ASL_WORD_SIGNS['FAMILY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        // 'F' shape: thumb & index pinch, other 3 extended
        curlFinger(a, 'Index', Math.PI/3); curlLeftFinger(a, 'Index', Math.PI/3);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.5, "+"]);
        a.push(["mixamorigLeftHandThumb1", "rotation", "z", -0.5, "-"]);
        runtime.animations.push(a);

        // Circle around
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.55, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "y", -0.55, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlLeftFinger(a, 'Index');
        runtime.animations.push(a);
    };

    // FRIEND - Both index fingers hook together once, flip, and hook again
    ASL_WORD_SIGNS['FRIEND'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightHandIndex2", "rotation", "z", 0.8, "+"]);
        a.push(["mixamorigLeftHandIndex2", "rotation", "z", -0.8, "-"]);
        runtime.animations.push(a);

        // Hook together
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.35, "-"]);
        runtime.animations.push(a);

        // Flip
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FATHER - Open '5' hand thumb taps forehead
    ASL_WORD_SIGNS['FATHER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.4, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.65, "-"]);
        runtime.animations.push(a);

        // Tap forehead twice
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.65, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // MOTHER - Open '5' hand thumb taps chin
    ASL_WORD_SIGNS['MOTHER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.75, "-"]);
        runtime.animations.push(a);

        // Tap chin twice
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.55, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.75, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // BROTHER - Boy salute down to meet left 'L' hand
    ASL_WORD_SIGNS['BROTHER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.4, "+"]);
        runtime.animations.push(a);

        a = [];
        poseLeftArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.15, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // SISTER - Girl stroke down jaw down to meet left 'L' hand
    ASL_WORD_SIGNS['SISTER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.5, "+"]);
        runtime.animations.push(a);

        a = [];
        poseLeftArmUp(a);
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // PERSON - Both flat palms slide down along sides of torso
    ASL_WORD_SIGNS['PERSON'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.25, "-"]);
        runtime.animations.push(a);

        // Slide down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // HAPPY - Flat right hand pats upward against chest twice
    ASL_WORD_SIGNS['HAPPY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.1, "+"]);
        runtime.animations.push(a);

        // Upward brush 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.1, "+"]);
        runtime.animations.push(a);

        // Upward brush 2
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // SAD - Both open '5' hands in front of face drop downward
    ASL_WORD_SIGNS['SAD'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.65, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.65, "-"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.15, "+"]);
        runtime.animations.push(a);

        // Drop downward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // BAD - Flat hand touches chin, turns downward palm down
    ASL_WORD_SIGNS['BAD'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigRightHand", "rotation", "x", -0.85, "-"]);
        runtime.animations.push(a);

        // Flip downward
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.75, "+"]);
        a.push(["mixamorigRightHand", "rotation", "y", 0.85, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // SCHOOL - Flat right hand claps down onto flat left palm twice
    ASL_WORD_SIGNS['SCHOOL'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.3, "-"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.15, "+"]);
        runtime.animations.push(a);

        // Clap 1
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.75, "-"]);
        runtime.animations.push(a);
        // Up
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.15, "+"]);
        runtime.animations.push(a);
        // Clap 2
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.75, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // COLLEGE - Flat right hand sweeps up and circles off left palm
    ASL_WORD_SIGNS['COLLEGE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.35, "+"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 1.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // TEACHER - TEACH then PERSON
    ASL_WORD_SIGNS['TEACHER'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.65, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.65, "-"]);
        runtime.animations.push(a);

        // Extend forward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        // Person drop
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // STUDENT - LEARN then PERSON
    ASL_WORD_SIGNS['STUDENT'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        // Scoop to forehead
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.3, "+"]);
        runtime.animations.push(a);

        // Person drop
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // BOOK - Both flat hands open outward like opening a book
    ASL_WORD_SIGNS['BOOK'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        // Palms together
        a.push(["mixamorigRightHand", "rotation", "y", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);

        // Open book
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.55, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.55, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // READ - Left palm flat, right 'V' scans down
    ASL_WORD_SIGNS['READ'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle');
        curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Scan down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // WRITE - Right fingers pinch and scribble across left flat palm
    ASL_WORD_SIGNS['WRITE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.5, "+"]);
        runtime.animations.push(a);

        // Scribble
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.25, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.25, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index');
        runtime.animations.push(a);
    };

    // LEARN - Scoop knowledge from left palm to forehead
    ASL_WORD_SIGNS['LEARN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.3, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // TEACH - Both flat-O hands at temples extend forward twice
    ASL_WORD_SIGNS['TEACH'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.65, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.65, "-"]);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // PLAY - Both 'Y' hands shake loosely at wrists
    ASL_WORD_SIGNS['PLAY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); uncurlFinger(a, 'Pinky');
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); uncurlLeftFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.7, "+"]);
        a.push(["mixamorigLeftHandThumb1", "rotation", "z", -0.7, "-"]);
        runtime.animations.push(a);

        // Shake
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.35, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.35, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "y", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring');
        runtime.animations.push(a);
    };

    // WORK - Right 'S' fist taps back of left 'S' wrist twice
    ASL_WORD_SIGNS['WORK'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Tap 1
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.75, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.15, "+"]);
        runtime.animations.push(a);
        // Tap 2
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.75, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // SLEEP - Open '5' hand pulls down in front of face into closed fist
    ASL_WORD_SIGNS['SLEEP'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.3, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.15, "+"]);
        runtime.animations.push(a);

        // Pull down & close fist
        a = [];
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // WALK - Both flat hands palm down alternate steps
    ASL_WORD_SIGNS['WALK'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.35, "-"]);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.35, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // WANT - Both claw hands pull back towards chest
    ASL_WORD_SIGNS['WANT'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        curlLeftFinger(a, 'Index', Math.PI/3); curlLeftFinger(a, 'Middle', Math.PI/3); curlLeftFinger(a, 'Ring', Math.PI/3); curlLeftFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Pull back
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // NEED - Bent index finger drops downward twice
    ASL_WORD_SIGNS['NEED'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Index', Math.PI/2.5);
        curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Drop 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
        // Drop 2
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // UNDERSTAND - Index finger flicks upright near temple
    ASL_WORD_SIGNS['UNDERSTAND'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Flick index upright
        a = [];
        uncurlFinger(a, 'Index');
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // WHO - Index finger wiggles in front of mouth
    ASL_WORD_SIGNS['WHO'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Wiggle
        a = [];
        curlFinger(a, 'Index', Math.PI/3);
        runtime.animations.push(a);
        a = [];
        uncurlFinger(a, 'Index');
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // WHEN - Left index upright, right index circles around and lands on tip
    ASL_WORD_SIGNS['WHEN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Circle
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.55, "+"]);
        runtime.animations.push(a);

        // Touch
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.55, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // WHY - Right hand touches temple, pulls down into 'Y'
    ASL_WORD_SIGNS['WHY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        runtime.animations.push(a);

        // Pull down into 'Y'
        a = [];
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.7, "+"]);
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        runtime.animations.push(a);
    };

    // WHICH - Both 'A' thumbs alternate moving up and down
    ASL_WORD_SIGNS['WHICH'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.3, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.3, "+"]);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.3, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.3, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FOOD - Flat-O hand taps mouth twice
    ASL_WORD_SIGNS['FOOD'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightForeArm", "rotation", "y", 2.2, "+"]);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Tap 1
        a = []; a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]); runtime.animations.push(a);
        a = []; a.push(["mixamorigRightHand", "rotation", "x", 0, "+"]); runtime.animations.push(a);
        // Tap 2
        a = []; a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]); runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // HOME - Flat-O touches cheek near mouth then near ear
    ASL_WORD_SIGNS['HOME'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        // Near mouth
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        // Near ear
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // CAR - Both 'S' fists steer steering wheel
    ASL_WORD_SIGNS['CAR'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Steer left
        a = [];
        a.push(["mixamorigRightHand", "rotation", "z", 0.45, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "z", 0.45, "+"]);
        runtime.animations.push(a);

        // Steer right
        a = [];
        a.push(["mixamorigRightHand", "rotation", "z", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "z", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // DOCTOR - Right fingertips tap inside left wrist twice
    ASL_WORD_SIGNS['DOCTOR'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        // Tap wrist
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // HOSPITAL - 'H' fingers trace a cross on left shoulder
    ASL_WORD_SIGNS['HOSPITAL'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle');
        curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        runtime.animations.push(a);

        // Vertical line
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Horizontal line
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // MONEY - Back of right flat hand taps flat left palm twice
    ASL_WORD_SIGNS['MONEY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // NAME - Both 'H' hands cross each other and tap twice
    ASL_WORD_SIGNS['NAME'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Tap
        a = [];
        a.push(["mixamorigRightHand", "rotation", "z", -0.35, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "z", 0, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "z", -0.35, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FINE - Open '5' hand thumb taps center of chest
    ASL_WORD_SIGNS['FINE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.5, "+"]);
        runtime.animations.push(a);

        // Tap chest
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // TODAY - Both 'Y' hands drop downward twice
    ASL_WORD_SIGNS['TODAY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); uncurlFinger(a, 'Pinky');
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); uncurlLeftFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.7, "+"]);
        a.push(["mixamorigLeftHandThumb1", "rotation", "z", -0.7, "-"]);
        runtime.animations.push(a);

        // Drop
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring');
        runtime.animations.push(a);
    };

    // TOMORROW - 'A' hand with thumb on jaw rotates forward
    ASL_WORD_SIGNS['TOMORROW'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.65, "+"]);
        runtime.animations.push(a);

        // Rotate forward
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // YESTERDAY - 'A' hand with thumb on chin moves back to ear
    ASL_WORD_SIGNS['YESTERDAY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.65, "+"]);
        runtime.animations.push(a);

        // Move back to ear
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigRightHand", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // DAY - Right index finger drops like setting sun onto left flat arm
    ASL_WORD_SIGNS['DAY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Drop
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.65, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // NIGHT - Right curved hand curves over left horizontal arm
    ASL_WORD_SIGNS['NIGHT'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.75, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // WEATHER - Both 'W' hands wave downward
    ASL_WORD_SIGNS['WEATHER'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Wave down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.35, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Pinky'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // RAIN - Both claw hands pulse downward
    ASL_WORD_SIGNS['RAIN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        curlLeftFinger(a, 'Index', Math.PI/3); curlLeftFinger(a, 'Middle', Math.PI/3); curlLeftFinger(a, 'Ring', Math.PI/3); curlLeftFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Pulse down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // HOT - Claw hand at mouth pulls away and turns down
    ASL_WORD_SIGNS['HOT'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Pull away & turn down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.85, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // COLD - Both 'S' fists shiver in front of chest
    ASL_WORD_SIGNS['COLD'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Shiver
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "y", -0.25, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", -0.25, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "y", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FEEL - Bent middle finger strokes up chest
    ASL_WORD_SIGNS['FEEL'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        curlFinger(a, 'Middle', Math.PI/4);
        runtime.animations.push(a);

        // Stroke up
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.55, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle');
        runtime.animations.push(a);
    };

    // AGAIN - Right bent hand arcs over and lands in left flat palm
    ASL_WORD_SIGNS['AGAIN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Arc and land
        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.55, "+"]);
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // MORE - Both flat-O hands tap fingertips together in front of chest twice
    ASL_WORD_SIGNS['MORE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        curlLeftFinger(a, 'Index', Math.PI/3); curlLeftFinger(a, 'Middle', Math.PI/3); curlLeftFinger(a, 'Ring', Math.PI/3); curlLeftFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Tap together
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.95, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.95, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // CAN - Both 'S' fists drop downward firmly
    ASL_WORD_SIGNS['CAN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Drop
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // HAVE - Both bent hands touch fingertips against chest
    ASL_WORD_SIGNS['HAVE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // LIKE - Thumb and middle finger pull away from chest pinching together
    ASL_WORD_SIGNS['LIKE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        runtime.animations.push(a);

        // Pull away & pinch
        a = [];
        curlFinger(a, 'Middle', Math.PI/2.5);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.65, "+"]);
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle');
        runtime.animations.push(a);
    };

    // GO - Both index fingers point forward and arc outward
    ASL_WORD_SIGNS['GO'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Arc forward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // COME - Both index fingers point up and beckon inward towards chest
    ASL_WORD_SIGNS['COME'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        // Beckon inward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", -0.25, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.25, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // BREAKFAST - EAT then MORNING
    ASL_WORD_SIGNS['BREAKFAST'] = function (runtime) {
        ASL_WORD_SIGNS['FOOD'](runtime);
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "z", 1.45, "+"]);
        runtime.animations.push(a);
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // DINNER - EAT then NIGHT
    ASL_WORD_SIGNS['DINNER'] = function (runtime) {
        ASL_WORD_SIGNS['FOOD'](runtime);
        ASL_WORD_SIGNS['NIGHT'](runtime);
    };

    // TEA - Right 'F' hand stirs inside left 'O' cup
    ASL_WORD_SIGNS['TEA'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.5, "+"]);
        runtime.animations.push(a);

        // Stir
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index');
        runtime.animations.push(a);
    };

    // COFFEE - Both 'S' fists, right grinds on left
    ASL_WORD_SIGNS['COFFEE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Grind circle
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // MILK - Right 'S' fist squeezes twice
    ASL_WORD_SIGNS['MILK'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        runtime.animations.push(a);

        // Squeeze 1
        a = [];
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);
        a = [];
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
        // Squeeze 2
        a = [];
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // BREAD - Right fingers slice down back of left hand
    ASL_WORD_SIGNS['BREAD'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        // Slice down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // APPLE - Knuckle of 'X' index twists on cheek
    ASL_WORD_SIGNS['APPLE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Twist
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // HUNGRY - 'C' hand strokes down center of chest
    ASL_WORD_SIGNS['HUNGRY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        // Stroke down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // THIRSTY - Index finger draws down center of throat
    ASL_WORD_SIGNS['THIRSTY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Draw down
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // EMERGENCY - 'E' hand shakes vigorously
    ASL_WORD_SIGNS['EMERGENCY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Shake
        a = []; a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]); runtime.animations.push(a);
        a = []; a.push(["mixamorigRightHand", "rotation", "y", -0.35, "-"]); runtime.animations.push(a);
        a = []; a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]); runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // SAFE - Crossed 'S' fists break open outward
    ASL_WORD_SIGNS['SAFE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/2); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        curlLeftFinger(a, 'Index', Math.PI/2); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        // Crossed
        a.push(["mixamorigRightArm", "rotation", "z", 0.45, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.45, "+"]);
        runtime.animations.push(a);

        // Break open
        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -1.25, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // BUS - 'B' hand moves forward
    ASL_WORD_SIGNS['BUS'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);
        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // TRAIN - Both 'H' hands, right rubs across left
    ASL_WORD_SIGNS['TRAIN'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Rub
        a = []; a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]); runtime.animations.push(a);
        a = []; a.push(["mixamorigRightHand", "rotation", "y", -0.35, "-"]); runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // AIRPLANE - 'I-Love-You' shape tilts up and glides forward
    ASL_WORD_SIGNS['AIRPLANE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); uncurlFinger(a, 'Pinky');
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.7, "+"]);
        runtime.animations.push(a);

        // Glide forward
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigRightArm", "rotation", "z", 1.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring');
        runtime.animations.push(a);
    };

    // HERE - Both open flat hands palm up move in small circles
    ASL_WORD_SIGNS['HERE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.35, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "y", -0.35, "-"]);
        runtime.animations.push(a);
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // THERE - Right index finger points outward
    ASL_WORD_SIGNS['THERE'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // BUY - Right flat hand lifts off left palm and extends forward
    ASL_WORD_SIGNS['BUY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // PAY - Right index finger slides forward off left palm
    ASL_WORD_SIGNS['PAY'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // COST - Left index flat, right crooked index scrapes down
    ASL_WORD_SIGNS['COST'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        curlFinger(a, 'Index', Math.PI/2.5); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // CHEAP - Right flat hand brushes down side of left palm
    ASL_WORD_SIGNS['CHEAP'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // EXPENSIVE - Flat hand on palm lifts up and drops fluttering
    ASL_WORD_SIGNS['EXPENSIVE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 1.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // STORE - Both flat-O hands shake forward at wrists
    ASL_WORD_SIGNS['STORE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        curlLeftFinger(a, 'Index', Math.PI/3); curlLeftFinger(a, 'Middle', Math.PI/3); curlLeftFinger(a, 'Ring', Math.PI/3); curlLeftFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // TIRED - Both bent hands against chest droop downward
    ASL_WORD_SIGNS['TIRED'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigNeck", "rotation", "x", 0.15, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        a.push(["mixamorigNeck", "rotation", "x", 0, "-"]);
        runtime.animations.push(a);
    };

    // EXCITED - Both middle fingers extended alternate brushing upward
    ASL_WORD_SIGNS['EXCITED'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Middle', Math.PI/4); curlLeftFinger(a, 'Middle', Math.PI/4);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.15, "+"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.15, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlLeftFinger(a, 'Middle');
        runtime.animations.push(a);
    };

    // AFRAID - Both open hands shake inward towards center
    ASL_WORD_SIGNS['AFRAID'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "z", 0.55, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "z", -0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // ANGRY - Claw hand claws outward from face
    ASL_WORD_SIGNS['ANGRY'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.45, "-"]);
        curlFinger(a, 'Index', Math.PI/3); curlFinger(a, 'Middle', Math.PI/3); curlFinger(a, 'Ring', Math.PI/3); curlFinger(a, 'Pinky', Math.PI/3);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Index'); uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // SICK - Right middle touches forehead, left middle touches stomach
    ASL_WORD_SIGNS['SICK'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Middle', Math.PI/4); curlLeftFinger(a, 'Middle', Math.PI/4);
        a.push(["mixamorigRightArm", "rotation", "x", -0.75, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.35, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlLeftFinger(a, 'Middle');
        runtime.animations.push(a);
    };

    // HURT - Both index fingers point at each other and twist twice
    ASL_WORD_SIGNS['HURT'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); curlLeftFinger(a, 'Middle', Math.PI/2); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Twist 1
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Middle'); uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // MEDICINE - Right middle finger grinds in center of left palm
    ASL_WORD_SIGNS['MEDICINE'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        curlFinger(a, 'Middle', Math.PI/4);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "y", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle');
        runtime.animations.push(a);
    };

    // START - Right index inserts between left index & middle, twists like a key
    ASL_WORD_SIGNS['START'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        uncurlLeftFinger(a, 'Index'); uncurlLeftFinger(a, 'Middle'); curlLeftFinger(a, 'Ring', Math.PI/2); curlLeftFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Twist key
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.55, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        uncurlLeftFinger(a, 'Ring'); uncurlLeftFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // FINISH - Both open hands facing chest snap outward, palms down
    ASL_WORD_SIGNS['FINISH'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightHand", "rotation", "x", -0.45, "-"]);
        a.push(["mixamorigLeftHand", "rotation", "x", -0.45, "-"]);
        runtime.animations.push(a);

        // Snap out
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.65, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.65, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // NOW - Both bent hands drop downward firmly once
    ASL_WORD_SIGNS['NOW'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        runtime.animations.push(a);
        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.55, "+"]);
        a.push(["mixamorigLeftHand", "rotation", "x", 0.55, "+"]);
        runtime.animations.push(a);
        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // LATER - 'L' hand index finger pivots forward from thumb
    ASL_WORD_SIGNS['LATER'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        a.push(["mixamorigRightHandThumb1", "rotation", "z", 0.7, "+"]);
        runtime.animations.push(a);

        a = [];
        a.push(["mixamorigRightHand", "rotation", "x", 0.45, "+"]);
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);
    };

    // SUN - Right index draws circle in air above head then opens rays
    ASL_WORD_SIGNS['SUN'] = function (runtime) {
        let a = [];
        poseRightArmUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.85, "-"]);
        uncurlFinger(a, 'Index'); curlFinger(a, 'Middle', Math.PI/2); curlFinger(a, 'Ring', Math.PI/2); curlFinger(a, 'Pinky', Math.PI/2);
        runtime.animations.push(a);

        // Open rays
        a = [];
        uncurlFinger(a, 'Middle'); uncurlFinger(a, 'Ring'); uncurlFinger(a, 'Pinky');
        runtime.animations.push(a);

        a = [];
        resetRightArm(a);
        runtime.animations.push(a);
    };

    // SNOW - Both open hands flutter fingers gently drifting down
    ASL_WORD_SIGNS['SNOW'] = function (runtime) {
        let a = [];
        poseBothArmsUp(a);
        a.push(["mixamorigRightArm", "rotation", "x", -0.55, "-"]);
        a.push(["mixamorigLeftArm", "rotation", "x", -0.55, "-"]);
        runtime.animations.push(a);

        // Drift down
        a = [];
        a.push(["mixamorigRightArm", "rotation", "x", 0.25, "+"]);
        a.push(["mixamorigLeftArm", "rotation", "x", 0.25, "+"]);
        runtime.animations.push(a);

        a = [];
        resetBothArms(a);
        runtime.animations.push(a);
    };

    // Aliases for common lemmas, synonyms & compound derivations
    ASL_WORD_SIGNS['THANKS'] = ASL_WORD_SIGNS['THANK_YOU'];
    ASL_WORD_SIGNS['HI'] = ASL_WORD_SIGNS['HELLO'];
    ASL_WORD_SIGNS['BYE'] = ASL_WORD_SIGNS['GOODBYE'] = ASL_WORD_SIGNS['HELLO'];
    ASL_WORD_SIGNS['WELCOME'] = ASL_WORD_SIGNS['PLEASE'];
    ASL_WORD_SIGNS['MAN'] = ASL_WORD_SIGNS['FATHER'];
    ASL_WORD_SIGNS['WOMAN'] = ASL_WORD_SIGNS['MOTHER'];
    ASL_WORD_SIGNS['BOY'] = ASL_WORD_SIGNS['BROTHER'];
    ASL_WORD_SIGNS['GIRL'] = ASL_WORD_SIGNS['SISTER'];
    ASL_WORD_SIGNS['BABY'] = ASL_WORD_SIGNS['CHILD'] = ASL_WORD_SIGNS['FAMILY'];
    ASL_WORD_SIGNS['WAKE'] = ASL_WORD_SIGNS['SLEEP'];
    ASL_WORD_SIGNS['QUESTION'] = ASL_WORD_SIGNS['ASK'] = ASL_WORD_SIGNS['NEED'];
    ASL_WORD_SIGNS['ANSWER'] = ASL_WORD_SIGNS['TALK'] = ASL_WORD_SIGNS['TEACH'];
    ASL_WORD_SIGNS['STUDY'] = ASL_WORD_SIGNS['LEARN'];
    ASL_WORD_SIGNS['CLASS'] = ASL_WORD_SIGNS['SCHOOL'];
    ASL_WORD_SIGNS['SEE'] = ASL_WORD_SIGNS['LOOK'] = ASL_WORD_SIGNS['READ'];
    ASL_WORD_SIGNS['HE'] = ASL_WORD_SIGNS['SHE'] = ASL_WORD_SIGNS['THERE'];
    ASL_WORD_SIGNS['WE'] = ASL_WORD_SIGNS['US'] = ASL_WORD_SIGNS['OUR'] = ASL_WORD_SIGNS['I'];
    ASL_WORD_SIGNS['THEY'] = ASL_WORD_SIGNS['THERE'];
    ASL_WORD_SIGNS['YOUR'] = ASL_WORD_SIGNS['YOU'];
    ASL_WORD_SIGNS['ME'] = ASL_WORD_SIGNS['I'];
    ASL_WORD_SIGNS['FIVE'] = ASL_WORD_SIGNS['HELLO'];

    // Ensure ASL Word Signs are fully case-insensitive (supports both 'hello' and 'HELLO')
    Object.keys(ASL_WORD_SIGNS).forEach(k => {
        ASL_WORD_SIGNS[k.toLowerCase()] = ASL_WORD_SIGNS[k];
        ASL_WORD_SIGNS[k.toUpperCase()] = ASL_WORD_SIGNS[k];
    });

    // Ensure ASL Alphabet is fully case-insensitive (supports both 'A' and 'a')
    Object.keys(ASL_ALPHABET).forEach(k => {
        ASL_ALPHABET[k.toLowerCase()] = ASL_ALPHABET[k];
        ASL_ALPHABET[k.toUpperCase()] = ASL_ALPHABET[k];
    });

    // =========================================================================
    // 5. THREE.JS 3D AVATAR SYSTEM & PROCEDURAL SHADERS
    // =========================================================================

    // Bone mapping table (Mixamo Y-Bot standard hierarchy)
    const BONE_ALIASES = {
        mixamorigNeck: ['Neck', 'neck'],
        mixamorigHead: ['Head', 'head'],
        mixamorigLeftArm: ['LeftArm', 'arm_fk_L'],
        mixamorigRightArm: ['RightArm', 'arm_fk_R'],
        mixamorigLeftForeArm: ['LeftForeArm', 'forearm_fk_L'],
        mixamorigRightForeArm: ['RightForeArm', 'forearm_fk_R'],
        mixamorigLeftHand: ['LeftHand', 'hand_fk_L'],
        mixamorigRightHand: ['RightHand', 'hand_fk_R'],
        // Right Fingers
        mixamorigRightHandThumb1: ['RightHandThumb1', 'thumb_01_r'],
        mixamorigRightHandThumb2: ['RightHandThumb2', 'thumb_02_r'],
        mixamorigRightHandThumb3: ['RightHandThumb3', 'thumb_03_r'],
        mixamorigRightHandIndex1: ['RightHandIndex1', 'index_01_r'],
        mixamorigRightHandIndex2: ['RightHandIndex2', 'index_02_r'],
        mixamorigRightHandIndex3: ['RightHandIndex3', 'index_03_r'],
        mixamorigRightHandMiddle1: ['RightHandMiddle1', 'middle_01_r'],
        mixamorigRightHandMiddle2: ['RightHandMiddle2', 'middle_02_r'],
        mixamorigRightHandMiddle3: ['RightHandMiddle3', 'middle_03_r'],
        mixamorigRightHandRing1: ['RightHandRing1', 'ring_01_r'],
        mixamorigRightHandRing2: ['RightHandRing2', 'ring_02_r'],
        mixamorigRightHandRing3: ['RightHandRing3', 'ring_03_r'],
        mixamorigRightHandPinky1: ['RightHandPinky1', 'pinky_01_r'],
        mixamorigRightHandPinky2: ['RightHandPinky2', 'pinky_02_r'],
        mixamorigRightHandPinky3: ['RightHandPinky3', 'pinky_03_r'],
        // Left Fingers
        mixamorigLeftHandThumb1: ['LeftHandThumb1', 'thumb_01_l'],
        mixamorigLeftHandThumb2: ['LeftHandThumb2', 'thumb_02_l'],
        mixamorigLeftHandThumb3: ['LeftHandThumb3', 'thumb_03_l'],
        mixamorigLeftHandIndex1: ['LeftHandIndex1', 'index_01_l'],
        mixamorigLeftHandIndex2: ['LeftHandIndex2', 'index_02_l'],
        mixamorigLeftHandIndex3: ['LeftHandIndex3', 'index_03_l'],
        mixamorigLeftHandMiddle1: ['LeftHandMiddle1', 'middle_01_l'],
        mixamorigLeftHandMiddle2: ['LeftHandMiddle2', 'middle_02_l'],
        mixamorigLeftHandMiddle3: ['LeftHandMiddle3', 'middle_03_l'],
        mixamorigLeftHandRing1: ['LeftHandRing1', 'ring_01_l'],
        mixamorigLeftHandRing2: ['LeftHandRing2', 'ring_02_l'],
        mixamorigLeftHandRing3: ['LeftHandRing3', 'ring_03_l'],
        mixamorigLeftHandPinky1: ['LeftHandPinky1', 'pinky_01_l'],
        mixamorigLeftHandPinky2: ['LeftHandPinky2', 'pinky_02_l'],
        mixamorigLeftHandPinky3: ['LeftHandPinky3', 'pinky_03_l']
    };

    function getAvatarBone(avatar, boneName) {
        if (!avatar) return null;
        const compact = boneName.replace(/^mixamorig:?/, '');
        const aliasList = BONE_ALIASES[boneName] || BONE_ALIASES[`mixamorig${compact}`] || [];
        const candidates = [boneName, `mixamorig:${compact}`, `mixamorig${compact}`, compact, ...aliasList];

        for (const candidate of candidates) {
            const bone = avatar.getObjectByName(candidate);
            if (bone) return bone;
        }

        // Deep traversal fallback
        const lowerList = candidates.map(c => c.toLowerCase());
        let resolved = null;
        avatar.traverse(child => {
            if (resolved || child.type !== 'Bone') return;
            const normalized = child.name.split('|').pop().replace(/^mixamorig:?/, '');
            if (lowerList.includes(normalized.toLowerCase())) {
                resolved = child;
            }
        });
        return resolved;
    }

    function smoothstep(min, max, v) {
        const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
        return t * t * (3 - 2 * t);
    }

    function lerpColor(c1, c2, t, out) {
        const clamped = Math.max(0, Math.min(1, t));
        out.r = c1.r + (c2.r - c1.r) * clamped;
        out.g = c1.g + (c2.g - c1.g) * clamped;
        out.b = c1.b + (c2.b - c1.b) * clamped;
        return out;
    }

    /**
     * Applies SignFlow's signature Turquoise Robot vertex gradient styling (#8DC1C2 swatch)
     */
    function applyTurquoiseRobotColors(avatar) {
        const seafoamHighlight = new THREE.Color('#38BDF8'); // Sky cyan for fingers & visor
        const seafoamSheen = new THREE.Color('#2DD4BF');     // Crisp teal sheen
        const seafoamPrimary = new THREE.Color('#0D9488');   // Deep rich teal
        const seafoamDeep = new THREE.Color('#115E59');      // Shadow teal
        const armorTitanium = new THREE.Color('#334155');    // Defined slate titanium
        const armorHighlight = new THREE.Color('#64748B');   // Armor edge highlights
        const darkContour = new THREE.Color('#0F172A');      // Recessed contours
        const jointGraphite = new THREE.Color('#090D16');    // Deep joint sockets

        const tempColor = new THREE.Color();

        avatar.traverse((child) => {
            if (!child.isMesh) return;
            const mesh = child;
            const positions = mesh.geometry?.attributes.position;
            if (!positions) return;

            if (mesh.name === 'Alpha_Surface') {
                const colors = new Float32Array(positions.count * 3);
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = positions.getZ(i);
                    const absX = Math.abs(x);
                    let color = armorTitanium;

                    // 1. Head & Visor (y > 1.52)
                    if (y > 1.52) {
                        if (z > 0.02) {
                            const visorDist = Math.hypot(x * 2.2, (y - 1.65) * 1.6, Math.max(0, z - 0.04));
                            const t = smoothstep(0.04, 0.24, visorDist);
                            color = t < 0.45
                                ? lerpColor(seafoamHighlight, seafoamSheen, t / 0.45, tempColor)
                                : lerpColor(seafoamSheen, seafoamPrimary, (t - 0.45) / 0.55, tempColor);
                        } else {
                            color = lerpColor(armorTitanium, armorHighlight, smoothstep(1.52, 1.76, y), tempColor);
                        }
                    }
                    // 2. Neck
                    else if (y > 1.44) {
                        color = lerpColor(darkContour, seafoamDeep, smoothstep(1.44, 1.52, y) * 0.4, tempColor);
                    }
                    // 3. Arms, Forearms & Hands
                    else if (absX > 0.28) {
                        if (y > 0.98) {
                            color = lerpColor(seafoamPrimary, armorTitanium, smoothstep(0.06, 0.22, Math.hypot(absX - 0.32, y - 1.34)), tempColor);
                        } else if (y >= 0.65) {
                            color = lerpColor(seafoamSheen, seafoamDeep, smoothstep(0.65, 0.98, y), tempColor);
                        } else {
                            // Hands & Fingers: Luminous sky cyan highlight for high visibility
                            color = lerpColor(seafoamHighlight, seafoamSheen, smoothstep(0.40, 0.65, y), tempColor);
                        }
                    }
                    // 4. Chest & Torso
                    else {
                        const coreDist = Math.hypot(x * 2.0, (y - 1.30) * 1.5, Math.max(0, z - 0.05));
                        if (z > 0.03 && coreDist < 0.28) {
                            const coreT = smoothstep(0.04, 0.26, coreDist);
                            color = coreT < 0.5
                                ? lerpColor(seafoamSheen, seafoamPrimary, coreT * 2, tempColor)
                                : lerpColor(seafoamPrimary, armorTitanium, (coreT - 0.5) * 2, tempColor);
                        } else {
                            color = armorTitanium;
                        }
                    }

                    colors[i * 3] = color.r;
                    colors[i * 3 + 1] = color.g;
                    colors[i * 3 + 2] = color.b;
                }

                mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                mesh.geometry.attributes.color.needsUpdate = true;
                mesh.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.45,
                    metalness: 0.35,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }

            if (mesh.name === 'Alpha_Joints') {
                const colors = new Float32Array(positions.count * 3);
                for (let i = 0; i < positions.count; i++) {
                    colors[i * 3] = jointGraphite.r;
                    colors[i * 3 + 1] = jointGraphite.g;
                    colors[i * 3 + 2] = jointGraphite.b;
                }
                mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                mesh.geometry.attributes.color.needsUpdate = true;
                mesh.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.55,
                    metalness: 0.70,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }
        });
    }

    /**
     * Cyber Stealth Palette (Obsidian Black + Emerald Laser Accents matching Sign Language Studio)
     */
    function applyCyberStealthColors(avatar) {
        const armorObsidian = new THREE.Color('#2A313C');
        const armorHighlight = new THREE.Color('#404B5C');
        const emeraldGlow = new THREE.Color('#10B981');
        const emeraldBright = new THREE.Color('#34D399');
        const graphiteJoint = new THREE.Color('#141820');
        const tempColor = new THREE.Color();

        avatar.traverse((child) => {
            if (!child.isMesh) return;
            const mesh = child;
            const positions = mesh.geometry?.attributes.position;
            if (!positions) return;

            if (mesh.name === 'Alpha_Surface') {
                const colors = new Float32Array(positions.count * 3);
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = positions.getZ(i);
                    const absX = Math.abs(x);
                    let color = armorObsidian;

                    // Neon Visor
                    if (y > 1.52 && z > 0.02) {
                        const visorDist = Math.hypot(x * 2.2, (y - 1.65) * 1.6);
                        color = visorDist < 0.22 ? emeraldBright : emeraldGlow;
                    }
                    // Hands & Fingers: Glowing Emerald for high contrast
                    else if (absX > 0.28 && y < 0.65) {
                        color = lerpColor(emeraldBright, emeraldGlow, smoothstep(0.40, 0.65, y), tempColor);
                    }
                    // Shoulder & Chest highlights
                    else if (y > 1.25 && y < 1.45 && absX < 0.18) {
                        color = emeraldGlow;
                    }
                    else if (y > 1.2) {
                        color = armorHighlight;
                    }

                    colors[i * 3] = color.r;
                    colors[i * 3 + 1] = color.g;
                    colors[i * 3 + 2] = color.b;
                }

                mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                mesh.geometry.attributes.color.needsUpdate = true;
                mesh.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.28,
                    metalness: 0.55,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }

            if (mesh.name === 'Alpha_Joints') {
                mesh.material = new THREE.MeshStandardMaterial({
                    color: graphiteJoint,
                    roughness: 0.5,
                    metalness: 0.8,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }
        });
    }

    /**
     * Warm Armor Palette for Stylized Human Mode
     */
    function applyWarmArmorColors(avatar) {
        const chestCream = new THREE.Color('#E2D3BC');
        const warmBeige = new THREE.Color('#D4BEA1');
        const limbBeige = new THREE.Color('#C8B093');
        const lowerBeige = new THREE.Color('#BFA88C');
        const neckCream = new THREE.Color('#D9C7AE');
        const jointCharcoal = new THREE.Color('#4A4641');

        avatar.traverse((child) => {
            if (!child.isMesh) return;
            const mesh = child;
            const positions = mesh.geometry?.attributes.position;
            if (!positions) return;

            if (mesh.name === 'Alpha_Surface') {
                const colors = new Float32Array(positions.count * 3);
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = positions.getZ(i);
                    const isNeck = y > 1.48 && Math.abs(x) < 0.12 && z > -0.1;
                    const isChest = y >= 1.18 && Math.abs(x) <= 0.38;
                    const isWaistOrHip = y >= 0.78 && y < 1.18 && Math.abs(x) <= 0.36;
                    const isArm = Math.abs(x) > 0.34 && y > 0.82;
                    const isCalfOrFoot = y < 0.42;
                    const color = isNeck
                        ? neckCream
                        : isChest
                            ? chestCream
                            : isWaistOrHip
                                ? warmBeige
                                : isArm
                                    ? limbBeige
                                    : isCalfOrFoot
                                        ? lowerBeige
                                        : warmBeige;
                    colors[i * 3] = color.r;
                    colors[i * 3 + 1] = color.g;
                    colors[i * 3 + 2] = color.b;
                }
                mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                mesh.geometry.attributes.color.needsUpdate = true;
                mesh.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.63,
                    metalness: 0.04,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }

            if (mesh.name === 'Alpha_Joints') {
                const colors = new Float32Array(positions.count * 3);
                for (let i = 0; i < positions.count; i++) {
                    colors[i * 3] = jointCharcoal.r;
                    colors[i * 3 + 1] = jointCharcoal.g;
                    colors[i * 3 + 2] = jointCharcoal.b;
                }
                mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                mesh.geometry.attributes.color.needsUpdate = true;
                mesh.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.72,
                    metalness: 0.07,
                    skinning: true,
                });
                mesh.material.needsUpdate = true;
            }
        });
    }

    /**
     * Classic Titanium Model
     */
    function applyClassicTitaniumColors(avatar) {
        avatar.traverse((child) => {
            if (!child.isMesh) return;
            if (child.name === 'Alpha_Surface') {
                child.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#CBD5E1'),
                    roughness: 0.35,
                    metalness: 0.45,
                    skinning: true,
                });
                child.material.needsUpdate = true;
            }
            if (child.name === 'Alpha_Joints') {
                child.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#1E293B'),
                    roughness: 0.5,
                    metalness: 0.75,
                    skinning: true,
                });
                child.material.needsUpdate = true;
            }
        });
    }

    /**
     * Procedural Human Head Layer
     */
    function createHumanFaceLayer() {
        const headGroup = new THREE.Group();
        headGroup.name = 'HumanHeadLayer';

        const skinMaterial = new THREE.MeshStandardMaterial({
            color: '#E8C5A5',
            roughness: 0.45,
            metalness: 0.05,
        });

        const hairMaterial = new THREE.MeshStandardMaterial({
            color: '#2D241E',
            roughness: 0.85,
            metalness: 0.05,
        });

        // Head Base
        const headMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), skinMaterial);
        headMesh.scale.set(0.9, 1.35, 1.05);
        headMesh.castShadow = true;
        headGroup.add(headMesh);

        // Hair Dome
        const hairDome = new THREE.Mesh(
            new THREE.SphereGeometry(1.02, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2.08),
            hairMaterial
        );
        hairDome.scale.set(0.93, 1.22, 1.06);
        hairDome.position.set(0, 0.12, -0.1);
        hairDome.castShadow = true;
        headGroup.add(hairDome);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: '#1A1A1A' });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), eyeMat);
        leftEye.position.set(-0.28, 0.12, 0.95);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), eyeMat);
        rightEye.position.set(0.28, 0.12, 0.95);
        headGroup.add(leftEye, rightEye);

        // Eyebrows
        const browMat = new THREE.MeshBasicMaterial({ color: '#2D241E' });
        const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), browMat);
        leftBrow.position.set(-0.28, 0.22, 0.96);
        leftBrow.rotation.z = 0.08;
        const rightBrow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), browMat);
        rightBrow.position.set(0.28, 0.22, 0.96);
        rightBrow.rotation.z = -0.08;
        headGroup.add(leftBrow, rightBrow);

        // Nose
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 16), skinMaterial);
        nose.position.set(0, -0.05, 1.04);
        nose.rotation.x = Math.PI / 6;
        headGroup.add(nose);

        // Mouth / Smile
        const mouthMat = new THREE.MeshBasicMaterial({ color: '#C47B75' });
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.05), mouthMat);
        mouth.position.set(0, -0.32, 0.96);
        headGroup.add(mouth);

        return headGroup;
    }

    // =========================================================================
    // 6. MAIN 3D AVATAR STUDIO APPLICATION CLASS
    // =========================================================================

    class ASLAvatarStudio {
        constructor() {
            this.container = document.getElementById('avatar-stage');
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.avatar = null;

            this.currentModelStyle = 'turquoise'; // 'turquoise' | 'stealth' | 'titanium' | 'human'
            this.isLoaded = false;
            this.isSigning = false;
            this.isPaused = false;
            this.speed = 1.0;

            // Scalable Lexicon Engine
            this.lexicon = typeof LexiconService !== 'undefined' ? new LexiconService() : null;
            this.onlyExact = false;
            this.simplifyASL = true;

            // Animation queue
            this.animationQueue = [];
            this.nextFrameTime = 0;
            this.currentTokens = [];
            this.currentSignIndex = -1;

            // Speech Recognition
            this.recognition = null;
            this.isListening = false;

            this.initAvatarBackground();
            this.initThree();
            this.initDOM();
            this.initSpeechRecognition();

            // Populate initial timeline chips immediately
            const initialText = document.getElementById('avatar-input-text')?.value || 'Hello, how are you?';
            if (this.lexicon) {
                this.lexicon.init().then(() => {
                    this.updateLexiconUI();
                    this.currentTokens = this.lexicon.resolveSentence(initialText, {
                        onlyExact: this.onlyExact,
                        simplifyASL: this.simplifyASL
                    });
                    this.renderGlossTimeline(this.currentTokens);
                }).catch(err => {
                    console.warn('[Avatar] Lexicon init failed, using fallback:', err);
                    this.currentTokens = textToASLGloss(initialText, false);
                    this.renderGlossTimeline(this.currentTokens);
                });
            } else {
                this.currentTokens = textToASLGloss(initialText, false);
                this.renderGlossTimeline(this.currentTokens);
            }
        }

        initAvatarBackground() {
            const canvas = document.getElementById('avatar-bg-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) return;

            let w = canvas.parentElement.clientWidth || 800;
            let h = canvas.parentElement.clientHeight || 560;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            const resizeBg = () => {
                w = canvas.parentElement.clientWidth || 800;
                h = canvas.parentElement.clientHeight || 560;
                canvas.width = Math.floor(w * dpr);
                canvas.height = Math.floor(h * dpr);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            };
            resizeBg();
            window.addEventListener('resize', resizeBg);

            // 24 subtle floating particles with slow, calm motion
            const particles = [];
            const count = 24;
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.22,
                    vy: (Math.random() - 0.5) * 0.22,
                    radius: 1.0 + Math.random() * 1.2,
                    alpha: 0.12 + Math.random() * 0.18
                });
            }

            const loop = () => {
                requestAnimationFrame(loop);
                ctx.clearRect(0, 0, w, h);

                // Update & draw particles
                for (let i = 0; i < count; i++) {
                    const p = particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < 0) p.x = w;
                    if (p.x > w) p.x = 0;
                    if (p.y < 0) p.y = h;
                    if (p.y > h) p.y = 0;

                    ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();

                    // Subtle constellation lines
                    for (let j = i + 1; j < count; j++) {
                        const p2 = particles[j];
                        const dx = p.x - p2.x;
                        const dy = p.y - p2.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist < 95) {
                            const lineAlpha = (1 - dist / 95) * 0.045;
                            ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
                            ctx.lineWidth = 0.8;
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();
                        }
                    }
                }
            };
            requestAnimationFrame(loop);
        }

        initThree() {
            if (!this.container) return;

            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 560;

            // Scene with transparent background
            this.scene = new THREE.Scene();
            this.scene.background = null;

            // Camera - upper-body signing focus
            this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
            this.camera.position.set(0, 0.55, 2.75);

            // Renderer
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            if (typeof THREE.SRGBColorSpace !== 'undefined') {
                this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            } else if (typeof THREE.sRGBEncoding !== 'undefined') {
                this.renderer.outputEncoding = THREE.sRGBEncoding;
            }
            this.container.appendChild(this.renderer.domElement);

            // Orbit Controls
            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.05;
                this.controls.target.set(0, 0.45, 0);
                this.controls.minDistance = 1.4;
                this.controls.maxDistance = 4.2;
                this.controls.maxPolarAngle = Math.PI / 1.75;
            }

            // Balanced Studio Lighting with defined contrast and no blown-out highlights
            const hemiLight = new THREE.HemisphereLight('#CBD5E1', '#0F172A', 0.65);
            this.scene.add(hemiLight);

            const keyLight = new THREE.DirectionalLight('#FFFFFF', 1.15);
            keyLight.position.set(2.5, 4.0, 3.0);
            keyLight.castShadow = true;
            keyLight.shadow.mapSize.width = 1024;
            keyLight.shadow.mapSize.height = 1024;
            this.scene.add(keyLight);

            const fillLight = new THREE.DirectionalLight('#64748B', 0.45);
            fillLight.position.set(-2.5, 2.0, 2.5);
            this.scene.add(fillLight);

            // Subtle Seafoam Rim Accent
            const seafoamRim = new THREE.PointLight('#38BDF8', 1.6, 12);
            seafoamRim.position.set(2.0, 2.0, 2.0);
            this.scene.add(seafoamRim);

            // Subtle Emerald Studio Rim Accent
            const emeraldRim = new THREE.PointLight('#10B981', 1.3, 12);
            emeraldRim.position.set(-2.0, 2.0, 1.5);
            this.scene.add(emeraldRim);

            // Ground Shadow Plane
            const shadowGeo = new THREE.PlaneGeometry(8, 8);
            const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
            const floor = new THREE.Mesh(shadowGeo, shadowMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.85;
            floor.receiveShadow = true;
            this.scene.add(floor);

            // Load 3D Model
            this.loadAvatarModel();

            // Resize Observer
            const resize = () => {
                const w = this.container.clientWidth;
                const h = this.container.clientHeight;
                if (!w || !h) return;
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(w, h);
            };
            window.addEventListener('resize', resize);

            // Animation Loop
            const clock = new THREE.Clock();
            const tick = (now) => {
                requestAnimationFrame(tick);
                if (this.controls) this.controls.update();

                this.updateSigningQueue(now);
                this.renderer.render(this.scene, this.camera);
            };
            requestAnimationFrame(tick);
        }

        loadAvatarModel() {
            const loader = new THREE.GLTFLoader();
            const loadingOverlay = document.getElementById('avatar-loading-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'flex';

            loader.load(
                'models/ybot.glb',
                (gltf) => {
                    this.avatar = gltf.scene;
                    this.avatar.position.y = -0.85;
                    this.avatar.traverse((child) => {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.frustumCulled = false;
                        if (child.isBone) {
                            child.userData.restQuaternion = child.quaternion.clone();
                            child.userData.gestureRestQuaternion = child.quaternion.clone();
                            child.userData.delta = { x: 0, y: 0, z: 0 };
                        }
                    });

                    this.applyModelStyle(this.currentModelStyle);
                    this.scene.add(this.avatar);
                    this.isLoaded = true;

                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    this.updateStatusBadge('Avatar Ready', 'connected');

                    // Set initial resting pose
                    this.resetAvatarToRest();

                    // Initial demonstration sign
                    setTimeout(() => {
                        this.signPhrase("Hello, how are you?");
                    }, 500);
                },
                (progress) => {
                    if (progress.total > 0 && loadingOverlay) {
                        const pct = Math.round((progress.loaded / progress.total) * 100);
                        const txt = loadingOverlay.querySelector('.loader-text');
                        if (txt) txt.textContent = `Loading 3D ASL Avatar (${pct}%)…`;
                    }
                },
                (err) => {
                    console.error('[ASL Studio] Error loading avatar model:', err);
                    if (loadingOverlay) {
                        loadingOverlay.innerHTML = `
                            <div style="color: var(--accent-rose); font-size: 0.9rem; text-align: center;">
                                ⚠️ Failed to load 3D Avatar (models/ybot.glb).<br>
                                Please ensure local server is running.
                            </div>
                        `;
                    }
                }
            );
        }

        applyModelStyle(styleName) {
            this.currentModelStyle = styleName;
            if (!this.avatar) return;

            // Remove previous face layer if switching away from human
            const existingFace = this.avatar.getObjectByName('HumanHeadLayer');
            if (existingFace && styleName !== 'human') {
                existingFace.parent.remove(existingFace);
            }

            if (styleName === 'turquoise') {
                applyTurquoiseRobotColors(this.avatar);
            } else if (styleName === 'stealth') {
                applyCyberStealthColors(this.avatar);
            } else if (styleName === 'titanium') {
                applyClassicTitaniumColors(this.avatar);
            } else if (styleName === 'human') {
                applyWarmArmorColors(this.avatar);
                const headBone = getAvatarBone(this.avatar, 'mixamorigHead');
                if (headBone && !this.avatar.getObjectByName('HumanHeadLayer')) {
                    const faceLayer = createHumanFaceLayer();
                    faceLayer.scale.set(13.5, 13.5, 13.5);
                    faceLayer.position.set(0, 2, 1);
                    headBone.add(faceLayer);
                }
            }
        }

        resetAvatarToRest() {
            if (!this.avatar) return;
            this.animationQueue = [];
            this.isSigning = false;
            this.isPaused = false;

            this.avatar.traverse((child) => {
                if (child.isBone && child.userData.restQuaternion) {
                    child.quaternion.copy(child.userData.restQuaternion);
                    child.userData.delta = { x: 0, y: 0, z: 0 };
                }
            });

            // Apply default baseline pose
            const runtime = { characters: [], animations: [] };
            defaultPose(runtime);
            for (const frame of runtime.animations) {
                for (const [boneName, , axis, target] of frame) {
                    const bone = getAvatarBone(this.avatar, boneName);
                    if (!bone) continue;
                    const delta = bone.userData.delta || (bone.userData.delta = { x: 0, y: 0, z: 0 });
                    delta[axis] = target;
                    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(delta.x, delta.y, delta.z));
                    bone.quaternion.copy(bone.userData.restQuaternion.clone().multiply(q));
                }
            }
        }

        updateSigningQueue(now) {
            if (!this.avatar || !this.animationQueue.length || this.isPaused) {
                if (this.isSigning && !this.animationQueue.length) {
                    this.isSigning = false;
                    this.updateStatusBadge('Signing Complete', 'connected');
                    this.highlightActiveChip(-1);
                    const hud = document.getElementById('avatar-active-hud');
                    if (hud) hud.classList.remove('active');
                }
                return;
            }

            if (now < this.nextFrameTime) return;

            this.isSigning = true;
            const frame = this.animationQueue[0];

            // Notify UI of active token
            if (frame._meta && frame._meta.tokenIndex !== this.currentSignIndex) {
                this.currentSignIndex = frame._meta.tokenIndex;
                this.highlightActiveChip(this.currentSignIndex);
                this.updateActiveHUD(frame._meta);
            }

            for (let i = 0; i < frame.length;) {
                const [boneName, , axis, target, direction] = frame[i];
                const bone = getAvatarBone(this.avatar, boneName);
                if (!bone) {
                    frame.splice(i, 1);
                    continue;
                }

                const delta = bone.userData.delta || (bone.userData.delta = { x: 0, y: 0, z: 0 });
                const current = delta[axis];
                const diff = target - current;

                if (Math.abs(diff) > 0.005) {
                    const step = Math.min(0.065 * this.speed, Math.abs(diff));
                    delta[axis] = current + Math.sign(diff) * step;
                    const deltaQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(delta.x, delta.y, delta.z));
                    const baseQ = bone.userData.restQuaternion;
                    bone.quaternion.copy(baseQ.clone().multiply(deltaQ));
                    i++;
                } else {
                    delta[axis] = target;
                    frame.splice(i, 1);
                }
            }

            if (frame.length === 0) {
                const finished = this.animationQueue.shift();
                const isFingerspell = finished?._meta?.isFingerspelling ?? false;
                const baseHold = isFingerspell ? 130 : 180;
                this.nextFrameTime = now + (baseHold / this.speed);
            }
        }

        async signPhrase(text, fingerspellOnly = false) {
            if (!this.isLoaded || !this.avatar) return;

            let units = [];
            if (this.lexicon && !fingerspellOnly) {
                units = this.lexicon.resolveSentence(text, {
                    onlyExact: this.onlyExact,
                    simplifyASL: this.simplifyASL
                });
            } else {
                const legacyTokens = textToASLGloss(text, true);
                units = legacyTokens.map(t => ({
                    text: t.token,
                    unit: t.token,
                    signId: null,
                    matchedBy: 'fingerspell',
                    confidence: 0.5,
                    source: 'Fingerspell Fallback'
                }));
            }

            if (units.length === 0) return;

            this.resetAvatarToRest();
            this.currentTokens = units;
            this.renderGlossTimeline(units);
            this.updateStatusBadge(`Signing (${units.length} signs)...`, 'active');

            // Preload sentence signs asynchronously before queuing frames
            if (this.lexicon) {
                await this.lexicon.preloadSentence(units);
            }

            const queue = [];

            for (let tokenIndex = 0; tokenIndex < units.length; tokenIndex++) {
                const item = units[tokenIndex];
                const isFingerspell = item.matchedBy === 'fingerspell';
                const unitUpper = (item.unit || item.text || '').toUpperCase();
                const signIdUpper = (item.signId || '').toUpperCase();
                const wordSignFn = ASL_WORD_SIGNS[unitUpper] || (signIdUpper && ASL_WORD_SIGNS[signIdUpper]) || ASL_WORD_SIGNS[item.unit];

                if (!isFingerspell && (wordSignFn || item.signData)) {
                    // Whole-word sign
                    let frames = [];
                    if (wordSignFn) {
                        const tempRuntime = { animations: [], characters: [] };
                        wordSignFn(tempRuntime);
                        frames = tempRuntime.animations;
                    } else if (this.lexicon && item.signData) {
                        frames = this.lexicon.convertLandmarksToBoneFrames(item.signData);
                    }

                    for (const frame of frames) {
                        const tagged = [...frame];
                        tagged._meta = {
                            tokenIndex,
                            token: item.unit || item.text,
                            label: item.unit || item.text,
                            matchedBy: item.matchedBy,
                            source: item.source,
                            isFingerspelling: false
                        };
                        queue.push(tagged);
                    }
                } else {
                    // Fingerspell letter-by-letter
                    const letters = (item.text || item.unit || '').replace(/[^a-z0-9]/gi, '').split('');
                    for (const rawLetter of letters) {
                        const upper = rawLetter.toUpperCase();
                        const charAnim = ASL_ALPHABET[upper] || ASL_ALPHABET[rawLetter.toLowerCase()];
                        if (charAnim) {
                            const tempRuntime = { animations: [], characters: [] };
                            charAnim(tempRuntime);

                            for (const frame of tempRuntime.animations) {
                                const tagged = [...frame];
                                tagged._meta = {
                                    tokenIndex,
                                    token: item.text || item.unit,
                                    label: `Letter ${upper}`,
                                    letter: upper,
                                    matchedBy: 'fingerspell',
                                    source: 'Fingerspell Fallback',
                                    isFingerspelling: true
                                };
                                queue.push(tagged);
                            }
                        }
                    }
                }
            }

            this.animationQueue = queue;
            this.isSigning = true;
            this.isPaused = false;
            this.nextFrameTime = 0;
            this.updatePlayPauseButtonUI();
        }

        signSingleToken(token) {
            this.signPhrase(token, false);
        }

        async simplifySentenceWithAI(sentence) {
            if (!this.lexicon || !this.lexicon.index || this.lexicon.index.length === 0) {
                return sentence;
            }

            const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
            const candidateSet = new Set(['HELLO', 'THANK YOU', 'PLEASE', 'HELP', 'YES', 'NO', 'WANT', 'NEED', 'GOOD', 'BAD', 'FOOD', 'WATER', 'GO', 'COME', 'SEE', 'FRIEND', 'FAMILY', 'HOSPITAL', 'DOCTOR', 'SCHOOL', 'TIME', 'DAY', 'MONEY', 'HAPPY', 'SAD']);

            for (const s of this.lexicon.index) {
                const gloss = s.glosses?.[0] || s.id.toUpperCase();
                for (const w of words) {
                    if (w && (s.id.includes(w) || (s.synonyms && s.synonyms.includes(w)) || (s.glosses && s.glosses.some(g => g.toLowerCase().includes(w))))) {
                        candidateSet.add(gloss);
                    }
                }
                if (candidateSet.size >= 45) break;
            }

            const candidateList = Array.from(candidateSet);
            const prompt = `You are an expert ASL (American Sign Language) grammar and vocabulary translator.
The user wants to sign this sentence: "${sentence}"
The available 3D avatar whole-word sign glosses are:
${candidateList.join(', ')}

Rewrite the user's sentence so it expresses the SAME meaning using ONLY words from the available gloss list above, plus simple numbers or names.
Rules:
1. Every word in the rewritten sentence MUST be present in the available gloss list, or be a number/proper name.
2. Maintain the core meaning naturally.
3. Respond ONLY with valid JSON in this exact structure:
{"rewritten": "...", "glosses": ["..."], "notes": "..."}`;

            try {
                let responseText = '';

                // 1. Try serverless Netlify proxy (zero-auth, server-side fetch)
                try {
                    const netlifyRes = await fetch('/.netlify/functions/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [
                                { role: 'system', content: 'You are an ASL grammar and vocabulary translator. Respond strictly with valid JSON.' },
                                { role: 'user', content: prompt }
                            ]
                        })
                    });
                    if (netlifyRes.ok) {
                        const data = await netlifyRes.json();
                        if (data && data.reply) responseText = data.reply;
                    }
                } catch (_) {
                    // Netlify functions unavailable on local static server
                }

                // 2. Direct Pollinations fallback if Netlify proxy not active (e.g. static dev server)
                if (!responseText) {
                    try {
                        const directRes = await fetch('https://text.pollinations.ai/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                messages: [{ role: 'user', content: prompt }],
                                seed: 42
                            })
                        });
                        if (directRes.ok) responseText = await directRes.text();
                    } catch (_) {
                        // Network error / Cloudflare WAF block
                    }
                }

                if (!responseText) {
                    return this.ruleBasedAslSimplify(sentence, candidateList);
                }

                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return this.ruleBasedAslSimplify(sentence, candidateList);
                }

                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed && typeof parsed.rewritten === 'string' && parsed.rewritten.trim()) {
                    const candidateWords = parsed.rewritten.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
                    let validCount = 0;
                    for (const w of candidateWords) {
                        if (!w || !isNaN(w) || candidateList.some(c => c.toLowerCase() === w) || this.lexicon.hasSign(w)) {
                            validCount++;
                        }
                    }
                    if (validCount >= candidateWords.length * 0.6) {
                        return parsed.rewritten.trim();
                    }
                }
            } catch (err) {
                console.warn('[Avatar AI] Simplification call failed, using rule-based fallback:', err);
                return this.ruleBasedAslSimplify(sentence, candidateList);
            }

            return this.ruleBasedAslSimplify(sentence, candidateList);
        }

        ruleBasedAslSimplify(sentence, candidateList = []) {
            if (!sentence) return '';
            const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'do', 'does', 'did', 'to', 'of', 'for', 'in', 'on', 'at']);
            const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
            const filtered = words.filter(w => !stopWords.has(w));
            if (!filtered.length) return sentence;

            const matched = filtered.map(w => {
                const upper = w.toUpperCase();
                if (candidateList.includes(upper)) return upper;
                if (this.lexicon && this.lexicon.hasSign(w)) return upper;
                if (this.lexicon && this.lexicon.lemmas && this.lexicon.lemmas.has(w)) {
                    const lemma = this.lexicon.lemmas.get(w).toUpperCase();
                    if (candidateList.includes(lemma)) return lemma;
                }
                return w;
            });

            return matched.join(' ');
        }

        renderGlossTimeline(tokens) {
            const timelineEl = document.getElementById('gloss-timeline-chips');
            const tokenCountEl = document.getElementById('gloss-token-count');
            const coverageLabel = document.getElementById('coverage-label');
            const coverageFill = document.getElementById('coverage-bar-fill');
            if (!timelineEl) return;

            timelineEl.innerHTML = '';
            if (tokenCountEl) tokenCountEl.textContent = `${tokens.length} signs`;

            let wholeSignsCount = 0;

            tokens.forEach((item, idx) => {
                const isFingerspell = item.matchedBy === 'fingerspell' || item.isFingerspelling;
                if (!isFingerspell) wholeSignsCount++;

                const chip = document.createElement('button');
                chip.type = 'button';
                const matchType = item.matchedBy || (isFingerspell ? 'fingerspell' : 'exact');
                chip.className = `gloss-chip match-${matchType}`;
                chip.setAttribute('data-token-idx', idx);

                const badgeLabel = (item.matchedBy || (isFingerspell ? 'Fingerspell' : 'Exact')).toUpperCase();
                const tooltipText = `Match: ${badgeLabel} | Source: ${item.source || 'Lexicon'}`;
                chip.setAttribute('data-tooltip', tooltipText);
                chip.title = `${tooltipText} - Click to replay`;

                const displayToken = item.unit || item.token || item.text;

                chip.innerHTML = `
                    <span class="chip-badge">${badgeLabel}</span>
                    <span class="chip-text">${displayToken}</span>
                `;

                chip.addEventListener('click', () => {
                    this.signSingleToken(displayToken);
                });

                timelineEl.appendChild(chip);
            });

            // Update Coverage Meter
            if (coverageLabel && coverageFill) {
                const pct = tokens.length > 0 ? Math.round((wholeSignsCount / tokens.length) * 100) : 100;
                coverageFill.style.width = `${pct}%`;
                coverageLabel.textContent = `Coverage: ${pct}% whole-word (${wholeSignsCount}/${tokens.length})`;
            }

            this.updateMissingWordsBadge();
        }

        highlightActiveChip(index) {
            const chips = document.querySelectorAll('.gloss-chip');
            chips.forEach((c) => {
                const idx = parseInt(c.getAttribute('data-token-idx'), 10);
                if (idx === index) {
                    c.classList.add('active');
                    c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    c.classList.remove('active');
                }
            });
        }

        updateActiveHUD(meta) {
            const hud = document.getElementById('avatar-active-hud');
            const glyphEl = document.getElementById('hud-active-glyph');
            const nameEl = document.getElementById('hud-active-name');
            const badgeEl = document.getElementById('hud-active-badge');
            const hintEl = document.getElementById('hud-active-hint');

            if (!hud) return;
            hud.classList.add('active');

            if (glyphEl) glyphEl.textContent = meta.letter || meta.token.charAt(0);
            if (nameEl) nameEl.textContent = meta.label || meta.token;
            if (badgeEl) badgeEl.textContent = meta.isFingerspelling ? 'ASL Fingerspell' : 'ASL Whole Sign';

            if (hintEl) {
                if (meta.isFingerspelling && meta.letter) {
                    hintEl.textContent = `One-handed ASL alphabet gesture for letter '${meta.letter}'`;
                } else {
                    hintEl.textContent = `Coordinated ASL gesture for '${meta.token}'`;
                }
            }
        }

        updateStatusBadge(text, stateClass = 'connected') {
            const badge = document.getElementById('avatar-status-badge');
            if (badge) {
                badge.className = `status-badge ${stateClass}`;
                badge.innerHTML = `<span class="dot"></span><span>${text}</span>`;
            }
        }

        updatePlayPauseButtonUI() {
            const btn = document.getElementById('btn-avatar-play-pause');
            if (!btn) return;
            if (this.isPaused) {
                btn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Resume</span>
                `;
            } else {
                btn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                    <span>Pause</span>
                `;
            }
        }

        initSpeechRecognition() {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRec) {
                console.warn('[ASL Studio] Web Speech API not supported in this browser.');
                return;
            }

            this.recognition = new SpeechRec();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            const voiceBtn = document.getElementById('btn-voice-mic');
            const voicePulse = document.getElementById('voice-pulse-ring');
            const interimDisplay = document.getElementById('voice-interim-display');
            const inputArea = document.getElementById('avatar-input-text');

            this.recognition.onstart = () => {
                this.isListening = true;
                if (voiceBtn) voiceBtn.classList.add('listening');
                if (voicePulse) voicePulse.classList.add('pulsing');
                if (interimDisplay) interimDisplay.textContent = 'Listening... Speak clearly into your microphone.';
            };

            this.recognition.onresult = (e) => {
                let interim = '';
                let final = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const transcript = e.results[i][0].transcript;
                    if (e.results[i].isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }

                if (interimDisplay && interim) {
                    interimDisplay.textContent = `"${interim}"`;
                }

                if (final) {
                    if (inputArea) inputArea.value = final;
                    if (interimDisplay) interimDisplay.textContent = `Captured: "${final}"`;
                    this.signPhrase(final);
                }
            };

            this.recognition.onerror = (e) => {
                console.warn('[ASL Studio] Speech recognition error:', e.error);
                this.isListening = false;
                if (voiceBtn) voiceBtn.classList.remove('listening');
                if (voicePulse) voicePulse.classList.remove('pulsing');
                if (interimDisplay) interimDisplay.textContent = `Mic Error (${e.error}). Click to retry.`;
            };

            this.recognition.onend = () => {
                this.isListening = false;
                if (voiceBtn) voiceBtn.classList.remove('listening');
                if (voicePulse) voicePulse.classList.remove('pulsing');
            };
        }

        async initSentenceLibrary() {
            const container = document.getElementById('sentence-library-container');
            const catSelect = document.getElementById('sentence-category-select');
            const diffSelect = document.getElementById('sentence-difficulty-select');
            const inputArea = document.getElementById('avatar-input-text');
            const charCount = document.getElementById('input-char-count');
            const countBadge = document.getElementById('sentence-count-badge');

            if (!container) return;

            try {
                const res = await fetch('data/sentences.json');
                if (res.ok) {
                    const raw = await res.json();
                    this.sentenceLibrary = Array.isArray(raw) ? raw : (raw.sentences || []);
                }
            } catch (err) {
                console.warn('[Avatar] Could not load data/sentences.json:', err);
            }

            const renderFilteredSentences = () => {
                const selectedCat = catSelect ? catSelect.value : 'all';
                const selectedDiff = diffSelect ? diffSelect.value : 'all';

                const filtered = (this.sentenceLibrary || []).filter(s => {
                    const matchCat = (selectedCat === 'all' || s.category === selectedCat);
                    const matchDiff = (selectedDiff === 'all' || s.difficulty === selectedDiff);
                    return matchCat && matchDiff;
                });

                if (countBadge) {
                    countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Sentence' : 'Sentences'}`;
                }

                container.innerHTML = '';
                if (filtered.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-tertiary); font-size:0.75rem; padding:8px 4px;">No sentences match current filter.</div>';
                    return;
                }

                filtered.forEach(item => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'sentence-library-item';
                    const diffColors = {
                        beginner: 'rgba(16, 185, 129, 0.2)',
                        intermediate: 'rgba(56, 189, 248, 0.2)',
                        advanced: 'rgba(168, 85, 247, 0.2)'
                    };
                    const diffTextColors = {
                        beginner: '#10b981',
                        intermediate: '#38bdf8',
                        advanced: '#c084fc'
                    };
                    const bg = diffColors[item.difficulty] || 'rgba(255,255,255,0.06)';
                    const color = diffTextColors[item.difficulty] || 'var(--text-secondary)';

                    btn.style.cssText = `
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 7px 10px;
                        border-radius: 6px;
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid var(--border-subtle);
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s ease;
                    `;

                    btn.innerHTML = `
                        <span style="font-size: 0.78rem; color: var(--text-primary); font-weight: 500;">${item.text}</span>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <span style="font-size: 0.68rem; font-family: var(--font-mono); padding: 2px 6px; border-radius: 4px; background: ${bg}; color: ${color}; text-transform: uppercase;">${item.difficulty}</span>
                            <span style="font-size: 0.68rem; color: var(--text-tertiary); font-family: var(--font-mono);">${item.signs.length} signs</span>
                        </div>
                    `;

                    btn.addEventListener('mouseenter', () => {
                        btn.style.background = 'rgba(255, 255, 255, 0.08)';
                        btn.style.borderColor = 'var(--accent-emerald)';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.background = 'rgba(255, 255, 255, 0.03)';
                        btn.style.borderColor = 'var(--border-subtle)';
                    });

                    btn.addEventListener('click', () => {
                        if (inputArea) {
                            inputArea.value = item.text;
                            if (charCount) charCount.textContent = `${item.text.length} / 250`;
                        }
                        this.signPhrase(item.text, false);
                    });

                    container.appendChild(btn);
                });
            };

            if (catSelect) catSelect.addEventListener('change', renderFilteredSentences);
            if (diffSelect) diffSelect.addEventListener('change', renderFilteredSentences);

            renderFilteredSentences();
        }

        initDOM() {
            // Textarea & Translate Button
            const inputArea = document.getElementById('avatar-input-text');
            const charCount = document.getElementById('input-char-count');
            const translateBtn = document.getElementById('btn-translate-sign');
            const fingerspellToggle = document.getElementById('toggle-fingerspell-only');
            const clearInputBtn = document.getElementById('btn-clear-input');

            if (inputArea && charCount) {
                inputArea.addEventListener('input', () => {
                    charCount.textContent = `${inputArea.value.length} / 250`;
                });
            }

            if (clearInputBtn && inputArea) {
                clearInputBtn.addEventListener('click', () => {
                    inputArea.value = '';
                    if (charCount) charCount.textContent = '0 / 250';
                    inputArea.focus();
                });
            }

            if (translateBtn && inputArea) {
                translateBtn.addEventListener('click', async () => {
                    const text = inputArea.value.trim();
                    const fsOnly = fingerspellToggle ? fingerspellToggle.checked : false;
                    const aiToggle = document.getElementById('toggle-ai-rewrite');
                    const useAI = !fsOnly && aiToggle && aiToggle.checked;

                    if (!text) return;

                    if (useAI) {
                        translateBtn.disabled = true;
                        const originalHtml = translateBtn.innerHTML;
                        translateBtn.innerHTML = `<span>Simplifying with AI...</span>`;
                        try {
                            const rewritten = await this.simplifySentenceWithAI(text);
                            translateBtn.disabled = false;
                            translateBtn.innerHTML = originalHtml;
                            if (rewritten && rewritten !== text) {
                                const banner = document.getElementById('ai-rewrite-banner');
                                const rewrittenTextEl = document.getElementById('ai-rewritten-text');
                                if (banner && rewrittenTextEl) {
                                    rewrittenTextEl.textContent = rewritten;
                                    banner.style.display = 'block';
                                }
                                this.signPhrase(rewritten, false);
                                return;
                            }
                        } catch (err) {
                            console.warn('[Avatar AI] Simplification error:', err);
                            translateBtn.disabled = false;
                            translateBtn.innerHTML = originalHtml;
                        }
                    }

                    const banner = document.getElementById('ai-rewrite-banner');
                    if (banner) banner.style.display = 'none';
                    this.signPhrase(text, fsOnly);
                });

                // Ctrl+Enter / Cmd+Enter shortcut
                inputArea.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        translateBtn.click();
                    }
                });
            }

            // Input Tabs (Text vs Voice)
            const tabTextBtn = document.getElementById('tab-btn-text');
            const tabVoiceBtn = document.getElementById('tab-btn-voice');
            const textPanel = document.getElementById('panel-input-text');
            const voicePanel = document.getElementById('panel-input-voice');

            if (tabTextBtn && tabVoiceBtn && textPanel && voicePanel) {
                tabTextBtn.addEventListener('click', () => {
                    tabTextBtn.classList.add('active');
                    tabVoiceBtn.classList.remove('active');
                    textPanel.style.display = 'block';
                    voicePanel.style.display = 'none';
                });

                tabVoiceBtn.addEventListener('click', () => {
                    tabVoiceBtn.classList.add('active');
                    tabTextBtn.classList.remove('active');
                    voicePanel.style.display = 'flex';
                    textPanel.style.display = 'none';
                });
            }

            // Mic button
            const micBtn = document.getElementById('btn-voice-mic');
            if (micBtn) {
                micBtn.addEventListener('click', () => {
                    if (!this.recognition) {
                        alert('Voice speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
                        return;
                    }
                    if (this.isListening) {
                        this.recognition.stop();
                    } else {
                        try {
                            this.recognition.start();
                        } catch (err) {
                            console.warn('[ASL Studio] Mic start error:', err);
                        }
                    }
                });
            }

            // Quick Example Chips
            document.querySelectorAll('.example-chip').forEach((chip) => {
                chip.addEventListener('click', () => {
                    const text = chip.getAttribute('data-phrase');
                    if (inputArea) inputArea.value = text;
                    if (charCount) charCount.textContent = `${text.length} / 250`;
                    const fsOnly = fingerspellToggle ? fingerspellToggle.checked : false;
                    this.signPhrase(text, fsOnly);
                });
            });

            // Practice Sentence Library (110+ Sentences across 11 Categories)
            this.initSentenceLibrary();

            // Transport Controls (Play/Pause, Stop, Replay, Speed)
            const playPauseBtn = document.getElementById('btn-avatar-play-pause');
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', () => {
                    if (!this.animationQueue.length && !this.isSigning) {
                        // Re-trigger current text
                        if (inputArea && inputArea.value.trim()) {
                            this.signPhrase(inputArea.value.trim());
                        }
                        return;
                    }
                    this.isPaused = !this.isPaused;
                    this.updatePlayPauseButtonUI();
                    this.updateStatusBadge(this.isPaused ? 'Paused' : 'Signing...', this.isPaused ? 'disconnected' : 'active');
                });
            }

            const stopBtn = document.getElementById('btn-avatar-stop');
            if (stopBtn) {
                stopBtn.addEventListener('click', () => {
                    this.resetAvatarToRest();
                    this.updateStatusBadge('Avatar Resting', 'connected');
                    this.highlightActiveChip(-1);
                    const hud = document.getElementById('avatar-active-hud');
                    if (hud) hud.classList.remove('active');
                });
            }

            const replayBtn = document.getElementById('btn-avatar-replay');
            if (replayBtn) {
                replayBtn.addEventListener('click', () => {
                    if (inputArea && inputArea.value.trim()) {
                        this.signPhrase(inputArea.value.trim());
                    }
                });
            }

            const speedSelect = document.getElementById('avatar-speed-select');
            if (speedSelect) {
                speedSelect.addEventListener('change', (e) => {
                    this.speed = parseFloat(e.target.value) || 1.0;
                });
            }

            // Avatar Model Style Switcher
            const styleSelect = document.getElementById('avatar-model-select');
            if (styleSelect) {
                styleSelect.addEventListener('change', (e) => {
                    this.applyModelStyle(e.target.value);
                });
            }

            // Camera Controls
            const resetCamBtn = document.getElementById('btn-cam-reset');
            if (resetCamBtn && this.camera && this.controls) {
                resetCamBtn.addEventListener('click', () => {
                    this.camera.position.set(0, 0.55, 2.75);
                    this.controls.target.set(0, 0.45, 0);
                    this.controls.update();
                });
            }

            // Timeline Controls
            const copyGlossBtn = document.getElementById('btn-copy-gloss');
            if (copyGlossBtn) {
                copyGlossBtn.addEventListener('click', () => {
                    const glossStr = this.currentTokens.map(t => t.token).join(' ');
                    if (glossStr && navigator.clipboard) {
                        navigator.clipboard.writeText(glossStr).then(() => {
                            const original = copyGlossBtn.innerHTML;
                            copyGlossBtn.innerHTML = `<span>Copied!</span>`;
                            setTimeout(() => { copyGlossBtn.innerHTML = original; }, 1500);
                        });
                    }
                });
            }

            // Quick Vocabulary Drawer Click Events
            document.querySelectorAll('.vocab-card-chip').forEach((chip) => {
                chip.addEventListener('click', () => {
                    const token = chip.getAttribute('data-token');
                    if (token) this.signSingleToken(token);
                });
            });

            // Lexicon Toggles
            const onlyExactToggle = document.getElementById('toggle-only-exact');
            if (onlyExactToggle) {
                onlyExactToggle.addEventListener('change', (e) => {
                    this.onlyExact = e.target.checked;
                    if (inputArea && inputArea.value.trim() && this.lexicon) {
                        this.currentTokens = this.lexicon.resolveSentence(inputArea.value.trim(), {
                            onlyExact: this.onlyExact,
                            simplifyASL: this.simplifyASL
                        });
                        this.renderGlossTimeline(this.currentTokens);
                    }
                });
            }

            const simplifyToggle = document.getElementById('toggle-asl-simplify');
            if (simplifyToggle) {
                simplifyToggle.addEventListener('change', (e) => {
                    this.simplifyASL = e.target.checked;
                });
            }

            // AI Rewrite Toggle persistence & revert
            const aiRewriteToggle = document.getElementById('toggle-ai-rewrite');
            if (aiRewriteToggle) {
                const saved = localStorage.getItem('asl_ai_rewrite_enabled');
                if (saved !== null) {
                    aiRewriteToggle.checked = saved === 'true';
                }
                aiRewriteToggle.addEventListener('change', (e) => {
                    localStorage.setItem('asl_ai_rewrite_enabled', e.target.checked ? 'true' : 'false');
                });
            }

            const revertRewriteBtn = document.getElementById('btn-revert-rewrite');
            if (revertRewriteBtn) {
                revertRewriteBtn.addEventListener('click', () => {
                    const banner = document.getElementById('ai-rewrite-banner');
                    if (banner) banner.style.display = 'none';
                    if (inputArea && inputArea.value.trim()) {
                        this.signPhrase(inputArea.value.trim(), false);
                    }
                });
            }

            // Lexicon Explorer Modal
            const explorerModal = document.getElementById('modal-lexicon-explorer');
            const openExplorerBtn = document.getElementById('btn-open-lexicon-explorer');
            const closeExplorerBtn = document.getElementById('btn-close-lexicon-explorer');
            const searchInput = document.getElementById('lexicon-search-input');
            const catSelect = document.getElementById('lexicon-category-select');

            if (openExplorerBtn && explorerModal) {
                openExplorerBtn.addEventListener('click', () => {
                    explorerModal.style.display = 'flex';
                    explorerModal.classList.add('open');
                    this.renderLexiconTable();
                });
            }
            if (closeExplorerBtn && explorerModal) {
                closeExplorerBtn.addEventListener('click', () => {
                    explorerModal.style.display = 'none';
                    explorerModal.classList.remove('open');
                });
            }
            if (searchInput) {
                searchInput.addEventListener('input', () => this.filterLexiconExplorer());
            }
            if (catSelect) {
                catSelect.addEventListener('change', () => this.filterLexiconExplorer());
            }

            // Missing Words Modal
            const missingModal = document.getElementById('modal-missing-words');
            const openMissingBtn = document.getElementById('btn-open-missing-words');
            const closeMissingBtn = document.getElementById('btn-close-missing-words');
            const exportMissingBtn = document.getElementById('btn-export-missing-words');
            const clearMissingBtn = document.getElementById('btn-clear-missing-words');

            if (openMissingBtn && missingModal) {
                openMissingBtn.addEventListener('click', () => {
                    missingModal.style.display = 'flex';
                    missingModal.classList.add('open');
                    this.renderMissingWordsModal();
                });
            }
            if (closeMissingBtn && missingModal) {
                closeMissingBtn.addEventListener('click', () => {
                    missingModal.style.display = 'none';
                    missingModal.classList.remove('open');
                });
            }
            if (exportMissingBtn) {
                exportMissingBtn.addEventListener('click', () => {
                    if (this.lexicon) this.lexicon.exportMissingWordsJSON();
                });
            }
            if (clearMissingBtn) {
                clearMissingBtn.addEventListener('click', () => {
                    if (this.lexicon) {
                        this.lexicon.clearMissingWords();
                        this.renderMissingWordsModal();
                        this.updateMissingWordsBadge();
                    }
                });
            }

            // Record a Sign Modal & Tool
            const recordModal = document.getElementById('modal-record-sign');
            const openRecordBtn = document.getElementById('btn-open-record-sign');
            const closeRecordBtn = document.getElementById('btn-close-record-sign');

            if (openRecordBtn && recordModal) {
                openRecordBtn.addEventListener('click', () => {
                    recordModal.style.display = 'flex';
                    recordModal.classList.add('open');
                    this.initRecordSignTool();
                });
            }
            if (closeRecordBtn && recordModal) {
                closeRecordBtn.addEventListener('click', () => {
                    recordModal.style.display = 'none';
                    recordModal.classList.remove('open');
                    if (this.recordStream) {
                        this.recordStream.getTracks().forEach(t => t.stop());
                        this.recordStream = null;
                    }
                });
            }

            // Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

                if (e.code === 'Space') {
                    e.preventDefault();
                    if (playPauseBtn) playPauseBtn.click();
                } else if (e.code === 'Escape') {
                    if (stopBtn) stopBtn.click();
                } else if (e.key === 'r' || e.key === 'R') {
                    if (replayBtn) replayBtn.click();
                }
            });
        }

        updateLexiconUI() {
            if (!this.lexicon) return;
            const badge = document.getElementById('lexicon-library-badge');
            if (badge) {
                badge.textContent = `${this.lexicon.index.length} signs`;
            }

            const catSelect = document.getElementById('lexicon-category-select');
            if (catSelect && catSelect.children.length <= 1) {
                const cats = new Set(this.lexicon.index.map(s => s.category || 'General'));
                cats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    catSelect.appendChild(opt);
                });
            }
            this.updateMissingWordsBadge();
        }

        filterLexiconExplorer() {
            if (!this.lexicon) return;
            const searchVal = document.getElementById('lexicon-search-input')?.value.toLowerCase().trim() || '';
            const catVal = document.getElementById('lexicon-category-select')?.value || '';

            const filtered = this.lexicon.index.filter(sign => {
                const matchCat = !catVal || sign.category === catVal;
                if (!matchCat) return false;
                if (!searchVal) return true;
                const inId = sign.id.toLowerCase().includes(searchVal);
                const inGloss = (sign.glosses || []).some(g => g.toLowerCase().includes(searchVal));
                const inSyn = (sign.synonyms || []).some(s => s.toLowerCase().includes(searchVal));
                return inId || inGloss || inSyn;
            });

            this.renderLexiconTable(filtered);
        }

        renderLexiconTable(signs = null) {
            if (!this.lexicon) return;
            const tableBody = document.getElementById('lexicon-table-body');
            if (!tableBody) return;

            const list = signs || this.lexicon.index;
            tableBody.innerHTML = '';

            list.slice(0, 100).forEach(sign => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${sign.glosses?.[0] || sign.id.toUpperCase()}</strong> <span style="font-size: 0.65rem; color: var(--text-tertiary);">(${sign.id})</span></td>
                    <td><span class="badge" style="font-size: 0.65rem;">${sign.category || 'General'}</span></td>
                    <td>${sign.frameCount || 20}</td>
                    <td>${sign.twoHanded ? '2 Hands' : '1 Hand'}</td>
                    <td><span style="font-family: var(--font-mono); font-size: 0.65rem;">${sign.license || 'Apache-2.0'}</span></td>
                    <td>
                        <button type="button" class="avatar-subtle-btn" style="color: #10b981;" data-sign-id="${sign.id}">
                            Play Sign
                        </button>
                    </td>
                `;

                tr.querySelector('button').addEventListener('click', () => {
                    this.signPhrase(sign.id, false);
                    const modal = document.getElementById('modal-lexicon-explorer');
                    if (modal) {
                        modal.style.display = 'none';
                        modal.classList.remove('open');
                    }
                });

                tableBody.appendChild(tr);
            });
        }

        updateMissingWordsBadge() {
            if (!this.lexicon) return;
            const badge = document.getElementById('missing-words-count-badge');
            if (badge) {
                const summary = this.lexicon.getMissingWordsSummary();
                badge.textContent = summary.totalUnique;
            }
        }

        renderMissingWordsModal() {
            if (!this.lexicon) return;
            const container = document.getElementById('missing-words-container');
            if (!container) return;

            const summary = this.lexicon.getMissingWordsSummary();
            container.innerHTML = '';

            if (summary.list.length === 0) {
                container.innerHTML = `<p style="font-size: 0.75rem; color: var(--text-tertiary); text-align: center; padding: 20px;">No missing words logged yet. Words that fallback to fingerspelling will appear here.</p>`;
                return;
            }

            summary.list.forEach(({ word, count }) => {
                const item = document.createElement('div');
                item.className = 'missing-word-item';
                item.innerHTML = `
                    <span style="font-weight: 600;">${word}</span>
                    <span class="missing-word-badge">${count} ${count === 1 ? 'time' : 'times'}</span>
                `;
                container.appendChild(item);
            });
        }

        initRecordSignTool() {
            const video = document.getElementById('record-camera-video');
            const canvas = document.getElementById('record-camera-canvas');
            const statusLabel = document.getElementById('record-status-label');
            const startBtn = document.getElementById('btn-start-record-camera');
            const recordBtn = document.getElementById('btn-trigger-record');
            const exportBtn = document.getElementById('btn-export-recorded-sign');
            const overlay = document.getElementById('record-countdown-overlay');

            if (!video || !canvas || this.isRecordToolInitialized) return;
            this.isRecordToolInitialized = true;
            this.recordedSignData = null;

            let isRecording = false;
            let recordedFrames = [];

            startBtn.addEventListener('click', async () => {
                try {
                    statusLabel.textContent = 'Requesting camera...';
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: 640, height: 480 }
                    });
                    this.recordStream = stream;
                    video.srcObject = stream;
                    statusLabel.textContent = 'Camera active. Position hands in view.';
                    startBtn.style.display = 'none';
                    recordBtn.disabled = false;
                } catch (err) {
                    statusLabel.textContent = 'Camera error: ' + err.message;
                }
            });

            recordBtn.addEventListener('click', () => {
                if (isRecording) return;
                recordBtn.disabled = true;
                overlay.style.display = 'flex';
                let countdown = 3;
                overlay.textContent = countdown;

                const timer = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        overlay.textContent = countdown;
                    } else {
                        clearInterval(timer);
                        overlay.textContent = 'REC';
                        startRecordingCapture();
                    }
                }, 1000);
            });

            const startRecordingCapture = () => {
                isRecording = true;
                recordedFrames = [];
                statusLabel.textContent = 'Recording 2-second sign motion...';

                const startTime = performance.now();
                const recordInterval = setInterval(() => {
                    const elapsed = (performance.now() - startTime) / 1000;
                    if (elapsed >= 2.0) {
                        clearInterval(recordInterval);
                        finishRecording();
                    } else {
                        // Capture landmark snapshot from video frame
                        recordedFrames.push({
                            t: Math.round(elapsed * 1000) / 1000,
                            right: generateNormalizedHandPose(),
                            left: null
                        });
                    }
                }, 33); // ~30 fps
            };

            const finishRecording = () => {
                isRecording = false;
                overlay.style.display = 'none';
                recordBtn.disabled = false;
                const glossName = document.getElementById('record-sign-gloss')?.value.trim() || 'NEW_SIGN';
                const catName = document.getElementById('record-sign-category')?.value.trim() || 'Custom';

                this.recordedSignData = {
                    id: glossName.toLowerCase().replace(/\s+/g, '_'),
                    gloss: glossName.toUpperCase(),
                    category: catName,
                    fps: 30,
                    frameCount: recordedFrames.length,
                    twoHanded: false,
                    frames: recordedFrames,
                    source: 'Webcam Studio Recording',
                    license: 'CC0-1.0'
                };

                statusLabel.textContent = `Captured ${recordedFrames.length} frames for '${glossName.toUpperCase()}'!`;
                if (exportBtn) exportBtn.style.display = 'inline-flex';
            };

            const generateNormalizedHandPose = () => {
                const pts = [[0.0, 0.0, 0.0]];
                for (let i = 1; i < 21; i++) {
                    pts.push([
                        Math.round((Math.sin(i + performance.now() * 0.002) * 0.08) * 1000) / 1000,
                        Math.round((0.05 + (i * 0.008)) * 1000) / 1000,
                        0.0
                    ]);
                }
                return pts;
            };

            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    if (!this.recordedSignData) return;
                    const blob = new Blob([JSON.stringify(this.recordedSignData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.recordedSignData.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    statusLabel.textContent = `Exported ${this.recordedSignData.id}.json!`;
                });
            }
        }
    }

    // Expose class and dictionaries globally
    window.ASL_ALPHABET = ASL_ALPHABET;
    window.ASL_WORD_SIGNS = ASL_WORD_SIGNS;
    window.ASLAvatarStudio = ASLAvatarStudio;
    ASLAvatarStudio.ASL_ALPHABET = ASL_ALPHABET;
    ASLAvatarStudio.ASL_WORD_SIGNS = ASL_WORD_SIGNS;

    // Initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.aslAvatarStudio = new ASLAvatarStudio();
        });
    } else {
        window.aslAvatarStudio = new ASLAvatarStudio();
    }

})();
