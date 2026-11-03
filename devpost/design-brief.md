---
status: approved
---

# Design brief: Overhand Knot Tutorial (SPECS AR)

## The one spatial moment
A 3D rope floats at eye/chest level in the user's room. When the user interacts with 3D floating controls, the rope smoothly animates through the physical steps of tying an Overhand Knot. The user can walk around, lean in, and view the knot from any 3D angle to clearly see which part passes over and under.

## Why it belongs on glasses
- Uses: draws in the world, leaves body and hands free.
- Why it's better than a phone/video: Knots are 3D spatial topologies. 2D video tutorials are notoriously difficult to follow because hands block the view and depth/layers are ambiguous. In AR glasses, the knot is suspended in real 3D space with colored working vs standing ends, and the learner can inspect it from all sides while practicing with real rope in their hands.

## Stages & Done Criteria
1. STAGE 1: Procedural rope tube placed ~60 cm in front of the camera, ~40 cm long. Standing part and working end (last 20%) colored distinctly.
2. STAGE 2: Knot defined in data file (knots/overhand.json) with 4 steps resampled to 64 points by arc length.
3. STAGE 3: Smooth 1.2s ease-in/out transitions between steps, step caption text displayed below rope, advance/replay capability.
4. STAGE 4: World-space 3D cube controls (Previous, Replay, Next) under the rope, title text above rope, Start Over / Main Menu cubes off to side.
5. STAGE 5: 360-degree rotation of the rope around vertical axis for spatial inspection.
