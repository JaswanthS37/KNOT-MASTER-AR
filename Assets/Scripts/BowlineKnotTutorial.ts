import {
  BOWLINE_KNOT_DATA,
  KnotStep,
  BOWLINE_WAYPOINTS_1_TO_2,
  BOWLINE_WAYPOINTS_2_TO_3,
  BOWLINE_WAYPOINTS_3_TO_4,
  BOWLINE_WAYPOINTS_4_TO_5,
} from "../knots/BowlineKnotData";

/**
 * BowlineKnotTutorial.ts
 *
 * Core educational tutorial engine for the Bowline Knot ("King of Knots").
 * Strictly implements the classic "rabbit, hole and tree" narrative and geometry rules:
 *
 * THE 5 STORY STEPS:
 *   1. Form the Rabbit Hole:
 *      Make a small loop (the "rabbit hole") in the rope, a couple of feet away from the free end (the "rabbit").
 *   2. The Rabbit Comes Up:
 *      Take the free end of the rope (the rabbit) and pass it up through the bottom of the small loop.
 *   3. The Rabbit Goes Around the Tree:
 *      Bring the free end behind the main, longer section of the rope (the "tree") from right to left.
 *   4. The Rabbit Goes Down the Hole:
 *      Pass the free end back down through the original small loop (the rabbit hole) that you created in Step 1.
 *   5. Tighten and Dress the Knot:
 *      Hold the free end and the sides of the loop while pulling firmly on the standing part of the rope to cinch and dress the knot tight.
 *
 * GEOMETRY & MOTION RULES:
 *   - Units in cm (X right, Y up, Z toward viewer).
 *   - Exploded view: crossing strands on different Z layers separated by >= 2.5 cm.
 *   - Identical rope length in every pose (~149.0 cm within 1%).
 *   - Exactly 61 points per pose, evenly spaced along arc length.
 *   - Working end is indices 37..60 in crimson PBR (emerges directly through loop).
 *   - Standing trunk & loop are indices 0..36 in nautical tan hemp.
 *   - Sub-move sequences (~0.8s per sub-move) with zero self-intersection.
 *   - Free end leads with tip-lead delay (D = 0.45):
 *       local_t = clamp((t - D*(1-s))/(1-D), 0, 1), followed by smoothstep.
 *       Standing end (s=0) remains strictly fixed.
 *   - Next, Previous, Replay, and Start Over interactive controls.
 *       Replay plays all sub-moves of the current step.
 */

@component
export class BowlineKnotTutorial extends BaseScriptComponent {
  @input
  @allowUndefined
  hempMaterial?: Material;

  @input
  @allowUndefined
  crimsonMaterial?: Material;

  @input
  @allowUndefined
  captionTextObject?: SceneObject;

  @input
  @allowUndefined
  titleTextObject?: SceneObject;

  @input
  modelScale: number = 1.0;

  @input
  modelCenterY: number = 0.0;

  /** Rope radius in cm (default 0.55 cm = 1.1 cm diameter, scaled by modelScale) */
  @input
  ropeRadius: number = 0.55;

  // Geometry configuration
  private readonly RADIAL_SEGMENTS = 16;
  public readonly POINT_COUNT = 61; // Exactly 61 points per pose
  private readonly TRANSITION_INDEX = 53; // Split index: 0..52 is standing tree & loop (tan hemp, 88%), 53..60 is rabbit (crimson red, last 12%)

  // Motion configuration
  private readonly SUBMOVE_DURATION = 0.8; // Seconds per sub-move
  private readonly TIP_LEAD_D = 0.45; // Free end leads delay factor
  private animTimer = 0.0;
  private isAnimating = false;
  public isPaused = false;
  private currentT = 1.0;
  private activeKeyframes: [number, number, number][][] = [];

  // Step state (0 = Step 1 ... 5 = Step 6)
  private currentStepIndex = 0;
  private targetStepIndex = 0;
  private previousStepIndex = 0;

  // 61-point step curves
  private stepCurves: [number, number, number][][] = [];
  private currentCurve: [number, number, number][] = [];

  // 360 Turntable Inspection state
  private isRotating = false;
  private rotationProgress = 0.0;
  private readonly ROTATION_SPEED = 0.2; // ~5.0 seconds for full 360 spin
  private baseRotation: quat = quat.quatIdentity();

  // Mesh visual components
  private standingRmv!: RenderMeshVisual;
  private workingRmv!: RenderMeshVisual;
  private workingChildObj?: SceneObject;

  onAwake(): void {
    try {
      // 1. Standing part mesh (on this SceneObject)
      this.standingRmv = this.sceneObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (!this.standingRmv) {
        this.standingRmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      }

      // Auto-load fallback materials if not bound in inspector
      if (!this.hempMaterial) {
        try {
          this.hempMaterial = requireAsset("../Materials/RopeHempMaterial.mat") as Material;
        } catch (e) {}
      }
      if (!this.crimsonMaterial) {
        try {
          this.crimsonMaterial = requireAsset("../Materials/RopeCrimsonMaterial.mat") as Material;
        } catch (e) {}
      }

      if (this.hempMaterial) {
        this.standingRmv.mainMaterial = this.hempMaterial;
      }

      // 2. Working end mesh (on child SceneObject 'BowlineRabbit')
      if (this.sceneObject.getChildrenCount() > 0) {
        this.workingChildObj = this.sceneObject.getChild(0);
      } else {
        this.workingChildObj = global.scene.createSceneObject("BowlineRabbit");
        this.workingChildObj.setParent(this.sceneObject);
      }
      this.workingChildObj.layer = this.sceneObject.layer;
      const childTrans = this.workingChildObj.getTransform();
      childTrans.setLocalPosition(vec3.zero());
      childTrans.setLocalRotation(quat.quatIdentity());
      childTrans.setLocalScale(vec3.one());

      this.workingRmv = this.workingChildObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (!this.workingRmv) {
        this.workingRmv = this.workingChildObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      }
      this.standingRmv.renderOrder = 0;
      this.workingRmv.renderOrder = 0;
      if (this.crimsonMaterial) {
        this.workingRmv.mainMaterial = this.crimsonMaterial;
      }

      this.baseRotation = this.sceneObject.getTransform().getWorldRotation();

      // Load steps from Bowline knot data
      this.loadSteps();

      // Start at Step 1
      this.currentStepIndex = 0;
      this.targetStepIndex = 0;
      this.previousStepIndex = 0;
      this.currentCurve = this.cloneCurve(this.stepCurves[0]);
      this.rebuildAllMeshes(this.currentCurve);

      // Register update loop for animation & rotation
      this.createEvent("UpdateEvent").bind(() => this.onUpdate());

      this.createEvent("OnStartEvent").bind(() => {
        this.updateTexts();
        console.log(`[BowlineKnotTutorial] Initialized with ${this.stepCurves.length} verified 61-point steps.`);
      });
    } catch (e) {
      console.error("[BowlineKnotTutorial] onAwake error: " + e);
    }
  }

  private loadSteps(): void {
    this.stepCurves = [];
    const steps = BOWLINE_KNOT_DATA.steps;
    for (let i = 0; i < steps.length; i++) {
      this.stepCurves.push(steps[i].points);
    }
  }

  // ------------------------------------------------------------------
  // Tip-Lead Interpolation & Sub-Move Animation Engine
  // ------------------------------------------------------------------

  /**
   * Evaluates tip-lead interpolation between two 61-point curves.
   * Free end leads (s=1), standing end (s=0) is fixed.
   * D = 0.45 delay parameter with cubic smoothstep ease.
   */
  private interpolateTipLead(
    c1: [number, number, number][],
    c2: [number, number, number][],
    t: number
  ): [number, number, number][] {
    const N = this.POINT_COUNT;
    const D = this.TIP_LEAD_D;
    const out: [number, number, number][] = [];

    for (let i = 0; i < N; i++) {
      const s = i / (N - 1); // 0 at standing end, 1 at free rabbit tip
      const val = (t - D * (1.0 - s)) / (1.0 - D);
      const local_t = Math.max(0.0, Math.min(1.0, val));
      const ease = local_t * local_t * (3.0 - 2.0 * local_t);

      out.push([
        c1[i][0] + (c2[i][0] - c1[i][0]) * ease,
        c1[i][1] + (c2[i][1] - c1[i][1]) * ease,
        c1[i][2] + (c2[i][2] - c1[i][2]) * ease,
      ]);
    }
    return out;
  }

  // Intermediate collision-free waypoints for Step 4 <-> Step 5
  private waypoint4A: [number, number, number][] = [
[0.0000, 18.0000, 0.0000],
      [0.0000, 16.6000, 0.0000],
      [0.0000, 15.1999, 0.0000],
      [-0.0001, 13.7999, -0.0000],
      [-0.0744, 12.4035, -0.0572],
      [-0.1442, 11.0069, -0.1108],
      [0.1360, 9.6776, 0.1115],
      [0.9243, 8.7556, 0.7897],
      [2.0170, 8.3916, 1.5303],
      [3.0711, 9.1579, 1.9941],
      [3.8465, 10.2815, 1.9505],
      [3.8079, 11.0191, 0.8033],
      [3.4871, 11.4867, -0.4759],
      [3.0474, 11.8915, -1.7413],
      [2.2543, 12.2540, -2.7797],
      [0.8984, 12.1719, -2.5606],
      [-0.4612, 12.1089, -2.5853],
      [-1.0770, 11.7006, -1.4157],
      [-1.2541, 11.2306, -0.1164],
      [-1.0284, 10.7193, 1.1651],
      [-0.5554, 10.3060, 2.4081],
      [0.0042, 9.6761, 3.0631],
      [-0.2029, 8.3200, 2.7776],
      [-0.4829, 6.9958, 2.4072],
      [-0.7767, 5.6766, 2.0293],
      [-1.0827, 4.3589, 1.6559],
      [-1.4087, 3.0495, 1.2704],
      [-1.7338, 1.7407, 0.8818],
      [-2.0735, 0.4417, 0.4747],
      [-2.3763, -0.8676, 0.0780],
      [-2.3290, -2.2566, -0.0592],
      [-1.9481, -3.5992, -0.0061],
      [-0.7343, -4.0745, 0.0000],
      [0.6649, -4.0540, 0.0232],
      [1.9272, -3.6598, -0.0390],
      [2.3322, -2.3689, -0.3734],
      [2.3641, -1.0549, -0.8460],
      [2.0903, 0.1966, -1.4173],
      [1.8950, 1.5257, -1.8189],
      [1.7344, 2.8860, -2.1239],
      [1.6016, 4.2562, -2.3962],
      [1.5033, 5.6180, -2.7196],
      [1.4349, 6.9910, -2.9966],
      [1.4404, 8.3532, -2.7864],
      [1.5769, 9.3091, -1.7855],
      [1.6857, 10.0515, -0.6024],
      [1.7652, 10.6157, 0.6800],
      [1.8615, 11.2403, 1.9313],
      [2.0807, 12.3573, 2.6392],
      [2.3735, 13.6546, 2.2626],
      [2.4173, 14.5583, 1.2231],
      [2.3207, 14.9882, -0.1073],
      [2.1090, 15.2946, -1.4594],
      [1.4969, 15.6189, -2.6501],
      [0.2302, 15.8338, -3.1646],
      [-1.0240, 15.3263, -3.2758],
      [-1.9327, 14.2912, -3.0345],
      [-2.3811, 13.9185, -1.9606],
      [-2.2918, 14.1273, -0.5798],
      [-2.2158, 14.1981, 0.8195],
      [-2.0000, 14.1000, 2.2000],
  ];

  private waypoint4B: [number, number, number][] = [
[0.0000, 18.0000, 0.0000],
      [0.0000, 16.6000, 0.0000],
      [0.0000, 15.1999, 0.0000],
      [-0.0001, 13.7999, -0.0000],
      [-0.0744, 12.4035, -0.0572],
      [-0.1442, 11.0069, -0.1108],
      [0.1360, 9.6776, 0.1115],
      [0.9243, 8.7556, 0.7897],
      [2.0170, 8.3916, 1.5303],
      [3.0711, 9.1579, 1.9941],
      [3.8465, 10.2815, 1.9505],
      [3.8079, 11.0191, 0.8033],
      [3.4871, 11.4867, -0.4759],
      [3.0474, 11.8915, -1.7413],
      [2.2543, 12.2540, -2.7797],
      [0.8984, 12.1719, -2.5606],
      [-0.4612, 12.1089, -2.5853],
      [-1.0770, 11.7006, -1.4157],
      [-1.2541, 11.2306, -0.1164],
      [-1.0284, 10.7193, 1.1651],
      [-0.5554, 10.3060, 2.4081],
      [0.0042, 9.6761, 3.0631],
      [-0.2426, 8.3400, 2.7244],
      [-0.5703, 7.0453, 2.2935],
      [-0.9090, 5.7525, 1.8653],
      [-1.2733, 4.4691, 1.4301],
      [-1.6475, 3.1914, 0.9865],
      [-2.0255, 1.9194, 0.5307],
      [-2.3780, 0.6429, 0.0746],
      [-2.2871, -0.7401, -0.0556],
      [-1.6501, -1.9477, 0.0000],
      [-0.2685, -2.0459, 0.0000],
      [1.1331, -2.0517, 0.0425],
      [2.1618, -1.2830, -0.1674],
      [2.4024, 0.0118, -0.6330],
      [2.1566, 1.2208, -1.2925],
      [1.9066, 2.5032, -1.7960],
      [1.7171, 3.8459, -2.1569],
      [1.5685, 5.2018, -2.4860],
      [1.4640, 6.5438, -2.8822],
      [1.4221, 7.9268, -2.9543],
      [1.5321, 9.0312, -2.1329],
      [1.6575, 9.8440, -0.9968],
      [1.7398, 10.4402, 0.2700],
      [1.8261, 11.0186, 1.5453],
      [1.9840, 11.9316, 2.5527],
      [2.2956, 13.2654, 2.4664],
      [2.4318, 14.3466, 1.6157],
      [2.3605, 14.8730, 0.3224],
      [2.1954, 15.2021, -1.0310],
      [1.7837, 15.5056, -2.3289],
      [0.6646, 15.8064, -3.0658],
      [-0.6764, 15.6058, -3.2812],
      [-1.6608, 14.6256, -3.1513],
      [-2.3866, 13.8592, -2.4048],
      [-2.3016, 14.0982, -1.0290],
      [-2.2082, 14.1756, 0.3689],
      [-1.9058, 14.1904, 1.7318],
      [-1.0174, 14.0052, 2.7852],
      [0.1959, 13.5174, 3.1967],
      [1.0500, 12.6000, 2.8000],
  ];

  /**
   * Returns intermediate collision-free sub-move waypoints between adjacent steps.
   */
  private getStepTransitionWaypoints(stepA: number, stepB: number): [number, number, number][][] {
    // Step 4 <-> Step 5 (indices 3 <-> 4)
    if (stepA === 3 && stepB === 4) {
      return [this.waypoint4A, this.waypoint4B];
    }
    if (stepA === 4 && stepB === 3) {
      return [this.waypoint4B, this.waypoint4A];
    }
    return [];
  }

  /**
   * Constructs the complete chain of keyframe curves from fromStep to toStep.
   */
  private getKeyframeSequence(fromStep: number, toStep: number): [number, number, number][][] {
    if (fromStep === toStep) {
      return [this.stepCurves[fromStep]];
    }

    const keyframes: [number, number, number][][] = [this.stepCurves[fromStep]];
    const stepDir = toStep > fromStep ? 1 : -1;
    let curr = fromStep;

    while (curr !== toStep) {
      const next = curr + stepDir;
      const wps = this.getStepTransitionWaypoints(curr, next);
      for (let w = 0; w < wps.length; w++) {
        keyframes.push(wps[w]);
      }
      keyframes.push(this.stepCurves[next]);
      curr = next;
    }

    return keyframes;
  }

  /**
   * Initiates a multi-submove transition across the keyframe sequence.
   */
  private startKeyframeTransition(keyframes: [number, number, number][][], targetStep: number): void {
    if (keyframes.length < 2) {
      this.currentStepIndex = targetStep;
      this.targetStepIndex = targetStep;
      this.currentCurve = this.cloneCurve(this.stepCurves[targetStep]);
      this.rebuildAllMeshes(this.currentCurve);
      this.updateTexts();
      return;
    }

    this.activeKeyframes = keyframes;
    this.targetStepIndex = targetStep;
    this.animTimer = 0.0;
    this.currentT = 0.0;
    this.isPaused = false;
    this.isAnimating = true;
    this.updateTexts();
  }

  private onUpdate(): void {
    const dt = getDeltaTime();

    if (this.isAnimating && this.activeKeyframes.length >= 2) {
      if (!this.isPaused) {
        this.animTimer += dt;
      }
      const totalSegments = this.activeKeyframes.length - 1;
      const totalDuration = totalSegments * this.SUBMOVE_DURATION;
      const linearT = Math.min(1.0, this.animTimer / totalDuration);
      this.currentT = linearT;

      if (linearT >= 1.0 && !this.isPaused) {
        this.isAnimating = false;
        this.currentStepIndex = this.targetStepIndex;
        this.currentCurve = this.cloneCurve(this.activeKeyframes[this.activeKeyframes.length - 1]);
        this.rebuildAllMeshes(this.currentCurve);
        this.updateTexts();
        console.log(`[BowlineKnotTutorial] Completed transition to Step ${this.currentStepIndex + 1}: ${BOWLINE_KNOT_DATA.steps[this.currentStepIndex].title}`);
      } else {
        const segIdx = Math.min(totalSegments - 1, Math.floor(this.animTimer / this.SUBMOVE_DURATION));
        const segTimer = this.animTimer - segIdx * this.SUBMOVE_DURATION;
        const segT = Math.max(0.0, Math.min(1.0, segTimer / this.SUBMOVE_DURATION));

        const c1 = this.activeKeyframes[segIdx];
        const c2 = this.activeKeyframes[segIdx + 1];
        this.currentCurve = this.interpolateTipLead(c1, c2, segT);
        this.rebuildAllMeshes(this.currentCurve);
      }
    }

    // 360 Turntable rotation
    if (this.isRotating) {
      this.rotationProgress += dt * this.ROTATION_SPEED;
      const trans = this.sceneObject.getTransform();
      if (this.rotationProgress >= 1.0) {
        this.isRotating = false;
        trans.setWorldRotation(this.baseRotation);
      } else {
        const spin = quat.fromEulerVec(new vec3(0, this.rotationProgress * 2.0 * Math.PI, 0));
        trans.setWorldRotation(spin.multiply(this.baseRotation));
      }
    }
  }

  // ------------------------------------------------------------------
  // Step Navigation Controls
  // ------------------------------------------------------------------

  public goToStep(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.stepCurves.length) return;
    if (stepIndex === this.currentStepIndex && !this.isAnimating && !this.isPaused) return;

    this.isPaused = false;
    this.previousStepIndex = this.currentStepIndex;
    const keyframes = this.getKeyframeSequence(this.currentStepIndex, stepIndex);
    this.startKeyframeTransition(keyframes, stepIndex);
    console.log(`[BowlineKnotTutorial] Transitioning to Step ${stepIndex + 1}: ${BOWLINE_KNOT_DATA.steps[stepIndex].title}`);
  }

  public nextStep(): void {
    if (this.currentStepIndex < this.stepCurves.length - 1) {
      this.goToStep(this.currentStepIndex + 1);
    }
  }

  public previousStep(): void {
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1);
    }
  }

  public replayStep(): void {
    this.isPaused = false;
    if (this.currentStepIndex === 0) {
      this.startOver();
      return;
    }
    // Replay plays all sub-moves of the current step
    const keyframes = this.getKeyframeSequence(this.currentStepIndex - 1, this.currentStepIndex);
    this.startKeyframeTransition(keyframes, this.currentStepIndex);
    console.log(`[BowlineKnotTutorial] Replaying Step ${this.currentStepIndex + 1}: ${BOWLINE_KNOT_DATA.steps[this.currentStepIndex].title}`);
  }

  public startOver(): void {
    this.isPaused = false;
    this.isAnimating = false;
    this.currentStepIndex = 0;
    this.targetStepIndex = 0;
    this.previousStepIndex = 0;
    this.activeKeyframes = [];
    this.currentCurve = this.cloneCurve(this.stepCurves[0]);
    this.rebuildAllMeshes(this.currentCurve);
    this.updateTexts();
    console.log("[BowlineKnotTutorial] Reset to Step 1.");
  }

  public togglePause(): void {
    if (!this.isAnimating) {
      this.replayStep();
    }
    this.isPaused = !this.isPaused;
    console.log(`[BowlineKnotTutorial] ${this.isPaused ? "PAUSED" : "PLAYING"} at ${(this.currentT * 100).toFixed(0)}%`);
    this.updateTexts();
  }

  public scrub(delta: number): void {
    if (!this.isAnimating) {
      this.replayStep();
    }
    this.isPaused = true;
    const totalSegments = Math.max(1, this.activeKeyframes.length - 1);
    const totalDuration = totalSegments * this.SUBMOVE_DURATION;
    this.animTimer = Math.max(0.0, Math.min(totalDuration, this.animTimer + delta * totalDuration));
    const linearT = Math.min(1.0, this.animTimer / totalDuration);
    this.currentT = linearT;

    const segIdx = Math.min(totalSegments - 1, Math.floor(this.animTimer / this.SUBMOVE_DURATION));
    const segTimer = this.animTimer - segIdx * this.SUBMOVE_DURATION;
    const segT = Math.max(0.0, Math.min(1.0, segTimer / this.SUBMOVE_DURATION));

    if (this.activeKeyframes.length >= 2) {
      const c1 = this.activeKeyframes[segIdx];
      const c2 = this.activeKeyframes[segIdx + 1];
      this.currentCurve = this.interpolateTipLead(c1, c2, segT);
      this.rebuildAllMeshes(this.currentCurve);
    }
    this.updateTexts();
    console.log(`[BowlineKnotTutorial] Scrubbed to ${(linearT * 100).toFixed(0)}% (t = ${this.animTimer.toFixed(2)}s)`);
  }

  public triggerRotation(): void {
    if (this.isRotating) return;
    this.isRotating = true;
    this.rotationProgress = 0.0;
    console.log("[BowlineKnotTutorial] 360 rotation triggered.");
  }

  public isAtFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  public isAtLastStep(): boolean {
    return this.currentStepIndex === this.stepCurves.length - 1;
  }

  public getCurrentStep(): number {
    return this.currentStepIndex;
  }

  public getTargetStep(): number {
    return this.targetStepIndex !== undefined ? this.targetStepIndex : this.currentStepIndex;
  }

  public getTotalSteps(): number {
    return this.stepCurves ? this.stepCurves.length : 6;
  }

  public updateTexts(): void {
    const step = BOWLINE_KNOT_DATA.steps[this.targetStepIndex];
    if (!step) return;

    if (this.titleTextObject) {
      const titleComp = (this.titleTextObject.getComponent("Component.Text3D") as any) ||
                        (this.titleTextObject.getComponent("Component.Text") as any);
      if (titleComp) {
        titleComp.text = "Bowline Knot";
      }
    }

    if (this.captionTextObject) {
      const captionComp = (this.captionTextObject.getComponent("Component.Text3D") as any) ||
                          (this.captionTextObject.getComponent("Component.Text") as any);
      if (captionComp) {
        if (this.isAnimating && this.isPaused) {
          const pct = Math.round(this.currentT * 100);
          captionComp.text = `[PAUSED @ ${pct}% | t = ${this.animTimer.toFixed(2)}s]\nStep ${this.previousStepIndex + 1} -> Step ${this.targetStepIndex + 1}: ${step.title}\nKeys: [J] -5% | [L] +5% | [K] Play/Pause`;
        } else {
          captionComp.text = step.caption && step.caption.length > 0
            ? `${step.title}\n${step.caption}`
            : `${step.title}`;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 3D Procedural Rope Mesh Construction
  // ------------------------------------------------------------------

  public rebuildAllMeshes(curve: [number, number, number][]): void {
    const N = curve.length;
    if (N < 2) return;

    // Apply scale & vertical center offset
    const scaledCurve: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      scaledCurve.push([
        curve[i][0] * this.modelScale,
        (curve[i][1] + this.modelCenterY) * this.modelScale,
        curve[i][2] * this.modelScale,
      ]);
    }

    const radius = this.ropeRadius * this.modelScale;

    // 1. Standing part: curve points [0 ... TRANSITION_INDEX] (85% of rope, hemp material)
    const standingCurve = scaledCurve.slice(0, this.TRANSITION_INDEX + 1);
    const standingBuilder = this.buildTubeMesh(standingCurve, radius, this.RADIAL_SEGMENTS, true, false);
    standingBuilder.updateMesh();
    this.standingRmv.mesh = standingBuilder.getMesh();
    if (this.hempMaterial) {
      this.standingRmv.mainMaterial = this.hempMaterial;
    }

    // 2. Working end: curve points [TRANSITION_INDEX ... N-1] (last 15% of rope, crimson material)
    const workingCurve = scaledCurve.slice(this.TRANSITION_INDEX, N);
    const workingBuilder = this.buildTubeMesh(workingCurve, radius, this.RADIAL_SEGMENTS, false, true);
    workingBuilder.updateMesh();
    this.workingRmv.mesh = workingBuilder.getMesh();
    if (this.crimsonMaterial) {
      this.workingRmv.mainMaterial = this.crimsonMaterial;
    }
  }

  private buildTubeMesh(
    curve: [number, number, number][],
    radius: number,
    radialSegments: number,
    capStart: boolean,
    capEnd: boolean
  ): MeshBuilder {
    const builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;

    const N = curve.length;
    const R = radialSegments + 1;

    // Normalized tangents
    const tangents: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const pPrev = curve[Math.max(0, i - 1)];
      const pNext = curve[Math.min(N - 1, i + 1)];
      const tx = pNext[0] - pPrev[0];
      const ty = pNext[1] - pPrev[1];
      const tz = pNext[2] - pPrev[2];
      const len = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tangents.push([tx / len, ty / len, tz / len]);
    }

    // Parallel transport frames (Bishop frame) to eliminate torsion/twisting
    const frames: { n: [number, number, number]; b: [number, number, number] }[] = [];
    const t0 = tangents[0];
    const up: [number, number, number] = Math.abs(t0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const dot0 = up[0] * t0[0] + up[1] * t0[1] + up[2] * t0[2];
    let nf: [number, number, number] = [
      up[0] - dot0 * t0[0],
      up[1] - dot0 * t0[1],
      up[2] - dot0 * t0[2],
    ];
    let nlen = Math.sqrt(nf[0] * nf[0] + nf[1] * nf[1] + nf[2] * nf[2]) || 1;
    nf = [nf[0] / nlen, nf[1] / nlen, nf[2] / nlen];

    for (let i = 0; i < N; i++) {
      if (i > 0) {
        const tp = tangents[i - 1];
        const tc = tangents[i];
        const ax = tp[1] * tc[2] - tp[2] * tc[1];
        const ay = tp[2] * tc[0] - tp[0] * tc[2];
        const az = tp[0] * tc[1] - tp[1] * tc[0];
        const alen = Math.sqrt(ax * ax + ay * ay + az * az);

        if (alen > 1e-5) {
          const kx = ax / alen;
          const ky = ay / alen;
          const kz = az / alen;
          const cosA = Math.max(-1, Math.min(1, tp[0] * tc[0] + tp[1] * tc[1] + tp[2] * tc[2]));
          const sinA = Math.sin(Math.acos(cosA));
          const oneMinusCos = 1 - cosA;

          const kDotN = kx * nf[0] + ky * nf[1] + kz * nf[2];
          const kCrossNx = ky * nf[2] - kz * nf[1];
          const kCrossNy = kz * nf[0] - kx * nf[2];
          const kCrossNz = kx * nf[1] - ky * nf[0];

          nf = [
            nf[0] * cosA + kCrossNx * sinA + kx * kDotN * oneMinusCos,
            nf[1] * cosA + kCrossNy * sinA + ky * kDotN * oneMinusCos,
            nf[2] * cosA + kCrossNz * sinA + kz * kDotN * oneMinusCos,
          ];
        }
      }

      const t = tangents[i];
      const bf: [number, number, number] = [
        t[1] * nf[2] - t[2] * nf[1],
        t[2] * nf[0] - t[0] * nf[2],
        t[0] * nf[1] - t[1] * nf[0],
      ];
      frames.push({ n: [nf[0], nf[1], nf[2]], b: bf });
    }

    // Generate ring vertices
    const tubeVertexStart = 0;
    for (let i = 0; i < N; i++) {
      const p = curve[i];
      const { n, b } = frames[i];
      const v = N > 1 ? i / (N - 1) : 0;

      for (let j = 0; j < R; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const u = j / radialSegments;

        const nx = n[0] * cosT + b[0] * sinT;
        const ny = n[1] * cosT + b[1] * sinT;
        const nz = n[2] * cosT + b[2] * sinT;

        builder.appendVerticesInterleaved([
          p[0] + nx * radius,
          p[1] + ny * radius,
          p[2] + nz * radius,
          nx,
          ny,
          nz,
          u,
          v,
        ]);
      }
    }

    // Quad tube indices
    const indices: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const bl = tubeVertexStart + i * R + j;
        const br = tubeVertexStart + i * R + (j + 1);
        const tl = tubeVertexStart + (i + 1) * R + j;
        const tr = tubeVertexStart + (i + 1) * R + (j + 1);
        indices.push(bl, br, tr, bl, tr, tl);
      }
    }

    // Start hemispherical cap
    if (capStart) {
      const startCapCenterIdx = builder.getVerticesCount();
      const pStart = curve[0];
      const tStart = tangents[0];
      builder.appendVerticesInterleaved([
        pStart[0] - tStart[0] * radius * 0.4,
        pStart[1] - tStart[1] * radius * 0.4,
        pStart[2] - tStart[2] * radius * 0.4,
        -tStart[0],
        -tStart[1],
        -tStart[2],
        0.5,
        0.0,
      ]);
      for (let j = 0; j < radialSegments; j++) {
        indices.push(startCapCenterIdx, tubeVertexStart + j + 1, tubeVertexStart + j);
      }
    }

    // End hemispherical cap
    if (capEnd) {
      const endCapCenterIdx = builder.getVerticesCount();
      const pEnd = curve[N - 1];
      const tEnd = tangents[N - 1];
      builder.appendVerticesInterleaved([
        pEnd[0] + tEnd[0] * radius * 0.4,
        pEnd[1] + tEnd[1] * radius * 0.4,
        pEnd[2] + tEnd[2] * radius * 0.4,
        tEnd[0],
        tEnd[1],
        tEnd[2],
        0.5,
        1.0,
      ]);
      const lastRingStart = tubeVertexStart + (N - 1) * R;
      for (let j = 0; j < radialSegments; j++) {
        indices.push(endCapCenterIdx, lastRingStart + j, lastRingStart + j + 1);
      }
    }

    builder.appendIndices(indices);
    return builder;
  }

  private cloneCurve(curve: [number, number, number][]): [number, number, number][] {
    const res: [number, number, number][] = [];
    for (let i = 0; i < curve.length; i++) {
      res.push([curve[i][0], curve[i][1], curve[i][2]]);
    }
    return res;
  }
}
