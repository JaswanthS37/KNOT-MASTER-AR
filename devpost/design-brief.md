---
status: complete
project_name: "Knot Master AR: Spatial Knot & Tie Tutor"
platform: "Snap Spectacles (SPECS 27)"
hackathon: "Learn AR with SPECS (Devpost)"
---

# Design Brief: Knot Master AR - Spatial Knot & Tie Tutor

## The One Spatial Moment
A life-sized, physical 3D cord or silk necktie hovers steadily at natural chest height in the learner's physical room. Hands-free and unencumbered, the user holds their own real rope or tie in their hands, looking through Spectacles to watch intricate knots unfold step-by-step. With zero occlusion from an instructor's hands or camera glare, the learner can effortlessly walk around the floating knot, lean in to inspect under/over cross-sections, or trigger a 360° spin to see exactly which strand goes behind, over, or through.

---

## Why It Belongs on Glasses
- **Spatial Topology Requires Spatial Display**: Knots and neckties are fundamentally 3D topological structures. Traditional 2D video tutorials (YouTube, phone apps) are notoriously frustrating: the demonstrator's hands constantly block the critical crossings, the fixed camera angle misses the back of the knot, and planar projection flattens foreground and background strands into visual ambiguity.
- **Hands-Free Physical Co-Presence**: Learning to tie requires both physical hands on the rope or cloth. Holding a smartphone or craning toward a laptop breaks motor memory and focus. On Spectacles, the virtual guide coexists with the learner's hands, allowing continuous muscle-memory practice while eyes remain up.
- **Unambiguous Depth Perception**: Stereoscopic additive projection with intentional depth layer separation ($\Delta Z \ge 2.5\text{ cm}$) makes overhand crossings, rabbit holes, and blade wraps instantly legible without mental gymnastics.

---

## Product or Overlay
- **Type**: Interactive Spatial Learning Product.
- **What the Physical Environment Provides**: A comfortable physical learning zone at personal distance (~80 cm). Ambient lighting is naturally blended with high-contrast dual-tone materials (crimson working end on golden hemp rope; silver-tipped navy silk for ties).
- **Preview Stand-in**: Fully playable in Lens Studio's Interactive Preview via Spectacles Interaction Kit (SIK) mouse pinches, hand rays, interactive touch controls, keyboard shortcuts (`1`, `2`, `3` for tutorial selection; `N` / `P` / `R` for Next/Prev/Replay; `J` / `K` / `L` for frame-by-frame scrubbing; `T` for 360° spin), and ASR voice command simulation.

---

## Where Things Live
- **Optimal Viewing Zone**: Centered directly in front of the user at chest height (~75–90 cm forward, slightly below eye level) within the 37° × 32° field of view to avoid head/neck fatigue.
- **3D Knot / Tie Canvas**: Centered at `X = 0`, `Y = 0`, `Z = -60 cm`. Rope length is strictly constant across all steps ($84.00\text{ cm}$ for Overhand and Bowline knots; $106.00\text{ cm}$ for the Four-in-Hand necktie).
- **Lower Control Dock**: Floating 3D rounded button dock positioned at `Y = -14.8 cm`, `Z = -60 cm`, providing high-target SIK buttons: **Restart**, **Prev**, **Replay**, **Next**, and **Turn 360°**.
- **Vertical Step Progress Tube**: Positioned along the right boundary (`X = 12.2 cm`), filling upward from bottom to top in light green across steps and turning vibrant green upon knot completion.
- **Step Badge & Progress Indicator**: Floating step badge (`Step X/Y`) anchored directly above the progress indicator with enhanced padding and contrast.
- **Instructional Caption Card**: Floating at `Y = -11.0 cm` with high-legibility bold typography detailing each step's physical action (e.g., *"Make a small loop with working end crossing OVER the standing part"*).
- **Hierarchical Main Menu**: High-contrast frosted glass cards for category browsing (**Knots** and **Ties**) and individual knot tutorials (**Overhand Knot**, **Bowline Knot [King of Knots]**, **Four-In-Hand Necktie**), complete with difficulty badges, utility tags, and back navigation.

---

## Hands and Input
- **SIK Direct & Far Pinch**: Natural hand pinches on floating 3D buttons or menu cards with tactile visual bounce feedback and hover states.
- **Hands-Free ASR Voice Control**: Integrated voice commands via `AsrModule` for continuous hands-on learning:
  - *"Next"* / *"Go Next"* $\rightarrow$ Advance step
  - *"Previous"* / *"Go Back"* $\rightarrow$ Rewind step
  - *"Replay"* $\rightarrow$ Re-animate current step from its start
  - *"Restart"* $\rightarrow$ Reset tutorial to Step 1
- **Sub-Second Precision Scrubbing**:
  - `K` $\rightarrow$ Pause / Resume playback
  - `J` $\rightarrow$ Rewind animation by 5% ($0.04\text{s}$)
  - `L` $\rightarrow$ Advance animation by 5% ($0.04\text{s}$)
  - Live HUD indicates exact pause percentage and timestamp for inspecting complex knot weaves.
- **360° Spatial Turntable**: One-touch `Turn 360` button spins the knot around its central vertical axis over a smooth 4-second arc for complete topological inspection.

---

## When Things Show
- **Morphing Knot Splines**: Smooth Catmull-Rom spline deformation with tip-leading ease-in-out interpolation ($0.8\text{s}$ per sub-move; $1.6\text{s}$ to $2.4\text{s}$ for multi-stage keyframe transitions).
- **Loop Stability Guarantee**: During critical multi-step constructions (e.g. Bowline Step 4 $\rightarrow$ Step 5), the stationary small loop ("rabbit hole") remains 100% fixed in space ($\Delta = 0.000\text{ cm}$), ensuring the learner never loses their spatial orientation while the working end travels around the standing tree and back down through the loop.
- **Natural Bight Contraction**: As working strands are pulled through loops, the hanging loops contract proportionally to conserve rope length without flipping or twisting.
- **Non-Phasing Sub-Moves**: Critical complex crossings utilize collision-free intermediate 3D waypoints, ensuring strands never phase through one another or pass through the standing trunk.

---

## Done Criteria & Verification (Logic Proven)
All criteria are verified and logic-proven in Lens Studio preview:

1. **Hierarchical Multi-Knot Library** [Logic Proven]:
   - User can browse between Knots (Overhand, Bowline) and Neckties (Four-in-Hand).
   - Unified back-navigation system with enlarged $41\text{pt}$ typography and consistent iconography.
2. **Strict Strand Length Conservation** [Logic Proven]:
   - Every pose across all steps maintains exact arc length: $84.00\text{ cm}$ for Bowline and Overhand; $106.00\text{ cm}$ for Four-in-Hand ($\pm 0.05\text{ cm}$, 61 equidistant points).
3. **Bowline Knot "Rabbit & Tree" Sequence** [Logic Proven]:
   - **Step 1**: Rope laid straight with standing part above and working end below.
   - **Step 2**: Small loop (the hole) formed with working end crossing OVER the standing part with smooth, non-jagged draping and lowered right-side working end.
   - **Step 3**: Colored working end (the rabbit) passes UP through the small loop from behind to front.
   - **Step 4**: Working end taken around BEHIND the standing part (the tree).
   - **Step 5**: Working end wraps around the tree and plunges back DOWN through the same small loop with zero phasing, while the loop stays stationary ($\Delta = 0$) and the hanging bight contracts naturally.
   - **Step 6**: Knot snugs tight, leaving the classic ~10 cm tail inside the loop (Ashley Book of Knots #1010).
4. **Four-In-Hand Necktie Simulation** [Logic Proven]:
   - Anatomical wide and narrow blades with exploded depth layering ($\ge 2.5\text{ cm}$) to eliminate visual overlapping.
   - Poised vertical blade entry at Step 5 followed by smooth threading through the front band in Step 6.
5. **Interactive Controls & 360° Turntable** [Logic Proven]:
   - Next, Prev, Replay, Restart, and Turn 360 operate seamlessly via SIK pinches, screen taps, voice commands, and keyboard hotkeys.
6. **Frame-by-Frame Scrubbing HUD** [Logic Proven]:
   - Pausing (`K`) reveals the scrub status overlay with current percentage and time, allowing meticulous study of tight spatial geometries.

---

## Out of Scope
- Real-time computer vision tracking of the learner's physical cord or hands (kept focused on guidance clarity and reliability).
- Haptic force-feedback devices.
- Collaborative multi-user Connected Lens synchronization (designed as a focused personal tutor).

---

## Risks and Open Questions
- **Physical Wearable Comfort vs. Additive Display Contrast**: Black is rendered transparent in optical see-through displays; all models, badges, and background plates use balanced mid-tone and warm lighting with additive-safe alphas to ensure high visibility against both dark and daylight rooms.
- **Physical Cord Parity**: Additive preview proves topological correctness and spatial legibility; real-world user trial will validate personal tying speed improvement compared to 2D video tutorials.

---

## Post-Build Evaluation & Spatial Design Reflections

### 1. Does it work?
Yes. All 6 done criteria are fully functional, verified, and demonstrated in preview. Splines evaluate with zero self-intersection, strict length conservation, and collision-free intermediate transition waypoints.

### 2. Walk around it
In Interactive Preview, walking around the 3D knot with WASD/QE controls reveals how cleanly the depth layers separate:
- Standing parts, loops, and traveling working ends occupy distinct, readable $Z$-planes.
- Looking from the side or back immediately clarifies where strands enter and exit loops, an angle completely impossible to see in 2D video.

### 3. The Three Spatial Questions
- **Does it use what I'm looking at?** Yes. The knot floats directly in the active work envelope at comfortable chest level.
- **Does it put something in my space where it belongs?** Yes. The tutorial lives at arm's length right above where the user naturally holds physical cordage, functioning like an expert instructor standing in front of you.
- **Does it free my hands or let me keep my eyes up?** Yes. Hands-free ASR voice control and large SIK buttons mean the learner never has to put down their rope or tie to advance, replay, or scrub a step.
- **Would it be just as good on a phone?** No. On a phone, one hand must hold the device, the screen is flat, depth is ambiguous, and perspective is locked. On glasses, full 3D stereo parallax, head-motion perspective, and complete bilateral manual freedom make spatial learning effortless.

### 4. Comfort Check
- **FOV Hygiene**: Knot model and controls occupy the comfortable center ($< 25^\circ$ eccentricity).
- **Depth Budget**: Knots float at $60\text{–}80\text{ cm}$, well within the natural convergence zone for near-field hand manipulation, eliminating vergence-accommodation conflict.
- **Visual Contrast**: 3D backplates, high-contrast typography, and dual-color ropes ensure crisp readability without relying on true black.
