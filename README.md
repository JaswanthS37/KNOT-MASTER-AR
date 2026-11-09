IMPORTANT : THE ACTUAL PROJECT IS PRESENT ONLY IN THE "main" BRANCH not "dummy"

# Knot Master AR: Spatial Knot & Tie Tutor 🪢👔

> **Learn AR with SPECS (Devpost Hackathon Submission)**  
> *A hands-free, step-by-step 3D spatial tutor for mastering knots and neckties on Snap Spectacles.*

---

## 🌟 Overview

Mastering knots and neckties from 2D flat video tutorials is clumsy: users constantly pause videos with tangled hands, struggle with inverted mirror angles, and fail to perceive critical depth and under/over crossings.

**Knot Master AR** solves this with true spatial computing:
- **True 3D Spatial Trajectories:** Interactive, life-sized 3D splines floating naturally in your physical environment.
- **Hands-Free Voice Control:** Keep both hands on your rope or tie—advance steps, replay animations, and inspect angles purely via voice.
- **Exploded Layer Architecture:** Unique depth offsets prevent visual overlap, ensuring under/over crossings are unmistakably clear.

---

## ✨ Features

- **👔 Four-in-Hand Necktie:** Exploded dual-mesh tutorial featuring a rich navy exterior, red contrast lining, and layered depth gaps so every fold and wrap is obvious.
- **⚓ Bowline Knot ("The King of Knots"):** Continuous, non-phasing waypoint animation tracing the classic *"rabbit comes out of the hole, around the tree, and back down"* rescue knot sequence.
- **🪢 Overhand Knot:** Foundational utility knot tutorial with animated working end highlights.
- **🎙️ Hands-Free Speech Recognition:** Powered by the SPECS 27 native `AsrModule`. Speak *"Next"*, *"Previous"*, *"Replay"*, *"Turn 360"*, or *"Restart"*.
- **🖐️ Multimodal SIK Hand Interactions:** Full raycast and direct pinch support via the Spectacles Interaction Kit (SIK) with ergonomic world-space floating cards.
- **🔄 360° Spatial Inspection:** Rotate the knot smoothly in 3D space to inspect wraps from behind, above, or below.

---

## 🛠️ Built With

- **Target Platform:** Snap Spectacles
- **Engine / IDE:** Snap Lens Studio 5.x
- **Language:** TypeScript
- **Interactions:** Spectacles Interaction Kit (`SpectaclesInteractionKit.lspkg`)
- **Voice Recognition:** Native Lens Studio `AsrModule` (on-device Speech-to-Text)
- **Geometry & Rendering:** Custom Catmull-Rom splines, Frenet-Serret tube/ribbon meshing via `MeshBuilder`, and PBR materials.
- **Dependencies:** 100% native Snap SDKs (no external 3rd-party libraries).

---

## 🚀 Getting Started

### Prerequisites
- [Lens Studio 5.22+](https://ar.snap.com/lens-studio) installed.
- (Optional) Snap Spectacles device for hardware deployment.

### Running in Lens Studio
1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/knot-master-ar.git
   ```
2. Open **Lens Studio**.
3. Click **Open Project** and select `test4.esproj`.
4. In the **Preview** panel, set the target preview device to **Spectacles (2024)**.
5. Interact using either:
   - Hand pinches in the interactive preview.
   - Microphone voice commands (e.g., *"Next"*, *"Turn"*).
   - Desktop keyboard shortcuts:
     - `1`: Overhand Knot
     - `2`: Bowline Knot
     - `3`: Four-in-Hand Necktie
     - `N` or `Right Arrow`: Next step
     - `P` or `Left Arrow`: Previous step
     - `R`: Replay step animation
     - `T`: 360° knot turn
     - `Space`: Restart tutorial
     - `M`: Return to menu

---

## 📂 Project Structure

```
├── Assets/
│   ├── Scripts/
│   │   ├── MainMenuController.ts      # Hierarchical 3D category & tutorial launcher
│   │   ├── KnotStepController.ts      # Tutorial state machine, HUD & voice routing
│   │   ├── FourInHandTutorial.ts      # Dual-layer exploded necktie procedural mesh
│   │   ├── BowlineKnotTutorial.ts     # Bowline Catmull-Rom spline with waypoint motion
│   │   ├── OverhandKnotTutorial.ts    # Overhand knot procedural generation
│   │   ├── AsrVoiceManager.ts         # SPECS 27 AsrModule speech integration
│   │   └── Math3D.ts                  # Frenet-Serret frame & spline interpolation math
│   └── knots/
│       ├── FourInHandData.ts          # Step-by-step tie control vectors
│       └── BowlineKnotData.ts         # High-precision 61-point spline coordinates
├── devpost/
│   ├── design-brief.md                # Devpost design brief & spatial reflections
│   └── submission.md                  # Complete hackathon submission narrative
└── test4.esproj                       # Lens Studio project configuration
```

---

## 👥 Hackathon Submission
Created for the **Learn AR with SPECS** hackathon on Devpost.
