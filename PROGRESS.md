# Overhand Knot & Main Menu Development Progress

## Overview
Developing the interactive AR Knot & Tie Tutorial suite for the Learn AR with SPECS Devpost hackathon.

---

## Current Architecture

### 1. Spatial Main Menu: COMPLETE
- [x] Dedicated 3D `MainMenuContainer` with title `"Knot Master AR"` and subtitle.
- [x] Selection Card 1: **Overhand Knot** (Utility • Level: Easy • 4 Steps).
- [x] Selection Card 2: **Four-in-Hand** (Necktie • Level: Classic • 6 Steps).
- [x] SIK Hand Pinch / Poke + Desktop preview tap fallbacks for card selection.
- [x] `MainMenuController.ts` orchestrates clean visibility toggling between `MainMenuContainer` and `TutorialContainer`.
- [x] Dedicated `← Menu` button in tutorial UI allows returning to the Main Menu at any time.
- [x] Git commit: `e7044a7`.

### 2. Overhand Knot Tutorial: FULLY PRESERVED & WORKING
- [x] Nested safely under `TutorialContainer`.
- [x] 4 data-driven steps from `Assets/knots/overhand.json` with 64-point arc-length resampling.
- [x] Two-tone procedural rope (warm tan standing part, crimson red working end).
- [x] 1.2s smoothstep ease-in/out animation between steps with caption updates.
- [x] 3D world controls: `Prev`, `Replay`, `Next`, `Restart`, and `Turn 360` rotation.
- [x] All 5 original stages visually verified and functional.

---

## Next Up
- **Four-in-Hand Necktie Knot**:
  - Tapered flat ribbon / blade geometry with distinct front fabric vs inner lining.
  - 6-step waypoint sequence for tying a necktie.
  - Floating collar reference guide.
