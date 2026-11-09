import { FOUR_IN_HAND_DATA, V3 } from "../knots/FourInHandData";

/**
 * FourInHandTutorial.ts
 *
 * Exploded-view 3D Four-in-Hand Necktie for SPECS AR:
 *  - Clear gap between layers so the cloth never touches itself.
 *  - Catmull-Rom smoothed spline with constant cloth length across all steps.
 *  - Dual-mesh: navy outside, rich red lining.
 *  - Step 7 "pulls it all together" by closing gaps and forming the 3D knot barrel.
 */

type Curve = { pts: V3[]; faces: V3[] };
type Dense = { pts: V3[]; hints: V3[] };

@component
export class FourInHandTutorial extends BaseScriptComponent {
  @input
  @allowUndefined
  navyMaterial?: Material;

  @input
  @allowUndefined
  silverMaterial?: Material; // used for the lining (back) side

  @input
  @allowUndefined
  captionTextObject?: SceneObject;

  @input
  @allowUndefined
  titleTextObject?: SceneObject;

  /** Model is built in cm. Default 1.0 preserves scene scale. */
  @input
  modelScale: number = 1.0;

  /** Vertical centre of the model (cm). Default 0 preserves scene center. */
  @input
  modelCenterY: number = 0.0;

  // ---- Look ----
  private readonly NAVY: V3 = [0.05, 0.10, 0.35]; // deep navy (#0D1A59)
  private readonly LINING: V3 = [0.70, 0.12, 0.18]; // red lining (#B31F2E)
  private readonly LIGHT: V3 = [0.2516, 0.4529, 0.8554]; // key light direction

  // ---- Geometry ----
  private readonly N_BLADE = 110;
  private readonly N_STRIP = 70;
  private readonly HALF_THICKNESS = 0.15;
  private readonly SEG_SAMPLES = 14;
  private readonly HANG_EXTRA = 6; // compact hang left in the longest step
  private readonly CENTER_X = 0.5;

  // Collar around the neck + narrow tail (one continuous strip, never changes)
  private readonly STRIP_CTRL: { p: V3; h: V3 }[] = [
    { p: [-1.5, -30.0, 0.0], h: [0, 0, 1] },
    { p: [-1.5, -12.0, 0.0], h: [0, 0, 1] },
    { p: [-1.5, 8.0, 0.0], h: [0, 0, 1] },
    { p: [-2.6, 10.5, -1.4], h: [-1, 0, 0] },
    { p: [-1.8, 12.5, -2.4], h: [-0.4, 0, -0.9] },
    { p: [0.5, 13.2, -2.8], h: [0, 0, -1] },
    { p: [2.8, 12.5, -2.4], h: [0.4, 0, -0.9] },
    { p: [3.6, 10.5, -1.4], h: [1, 0, 0] },
    { p: [2.5, 9.8, 0.0], h: [0, 0, 1] },
    { p: [2.5, 9.0, 0.0], h: [0, 0, 1] },
  ];

  // ---- Animation ----
  private readonly ANIM_DURATION = 1.2;
  private animDuration = 1.2;
  private animTimer = 1.2;
  private isAnimating = false;
  public isPaused = false;
  private currentT = 1.0;

  private currentStepIndex = 0;
  private targetStepIndex = 0;
  private previousStepIndex = 0;

  private stepCurves: Curve[] = [];
  private stepKnots: number[] = [];
  private step2to3MidCurve?: Curve;
  private step4to5RearCurve?: Curve;
  private step4to5UpCurve?: Curve;
  private strip!: Curve;
  private stripWidths: number[] = [];
  private bladeWidths: number[] = [];
  private bladeLength = 100;

  private curCurve!: Curve;
  private curKnot = 0;
  private animStartCurve!: Curve;
  private animTargetCurve!: Curve;
  private animStartKnot = 0;
  private animTargetKnot = 0;

  // ---- Rotation ----
  private isRotating = false;
  private rotationProgress = 0.0;
  private readonly ROTATION_SPEED = 0.1;
  private baseRotation: quat = quat.quatIdentity();

  // ---- Meshes ----
  private frontRmv!: RenderMeshVisual;
  private backRmv!: RenderMeshVisual;
  private backChildObj?: SceneObject;

  onAwake(): void {
    try {
      // Front (navy) mesh lives on this object
      this.frontRmv = this.sceneObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (!this.frontRmv) {
        this.frontRmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      }
      if (this.navyMaterial) {
        this.frontRmv.mainMaterial = this.navyMaterial;
      }

      // Back (lining) mesh lives on the first child (created if missing)
      if (this.sceneObject.getChildrenCount() > 0) {
        this.backChildObj = this.sceneObject.getChild(0);
      } else {
        this.backChildObj = global.scene.createSceneObject("TieBackLining");
        this.backChildObj.setParent(this.sceneObject);
      }
      this.backRmv = this.backChildObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (!this.backRmv) {
        this.backRmv = this.backChildObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      }
      if (this.silverMaterial) {
        this.backRmv.mainMaterial = this.silverMaterial;
      }

      this.baseRotation = this.sceneObject.getTransform().getWorldRotation();

      this.loadSteps();

      this.currentStepIndex = 0;
      this.targetStepIndex = 0;
      this.previousStepIndex = 0;
      this.curCurve = this.cloneCurve(this.stepCurves[0]);
      this.curKnot = this.stepKnots[0];
      this.rebuildAll(this.curCurve, this.curKnot);

      this.createEvent("UpdateEvent").bind(() => this.onUpdate());
      this.updateTexts();
      console.log("[FourInHandTutorial] ready: " + this.stepCurves.length + " steps, blade length " + this.bladeLength.toFixed(1) + " cm");
    } catch (e) {
      console.error("[FourInHandTutorial] onAwake exception: " + e);
    }
  }

  // ------------------------------------------------------------------
  // Loading and curve building
  // ------------------------------------------------------------------

  private loadSteps(): void {
    const steps = FOUR_IN_HAND_DATA.steps;
    this.stepCurves = [];
    this.stepKnots = [];

    // Pass 1: smooth every step and measure how much cloth it uses.
    const denses: Dense[] = [];
    let maxUsed = 0;
    for (let i = 0; i < steps.length; i++) {
      const d = this.buildBladeDense(steps[i].points, steps[i].faces);
      denses.push(d);
      maxUsed = Math.max(maxUsed, this.polyLength(d.pts));
    }
    // One cloth length for everybody, so the tie never "stretches".
    this.bladeLength = maxUsed + this.HANG_EXTRA;

    const extendDense = (d: Dense, customRemain?: number): Curve => {
      const used = this.polyLength(d.pts);
      const remain = customRemain !== undefined ? customRemain : Math.max(0, this.bladeLength - used);
      const n = d.pts.length;
      const last = d.pts[n - 1];
      const prev = d.pts[n - 2];
      const dx = last[0] - prev[0];
      const dy = last[1] - prev[1];
      const dz = last[2] - prev[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
      d.pts.push([last[0] + (dx / len) * remain, last[1] + (dy / len) * remain, last[2] + (dz / len) * remain]);
      const lastHint = d.hints[n - 1];
      d.hints.push([lastHint[0], lastHint[1], lastHint[2]]);
      return this.resample(d, this.N_BLADE);
    };

    // Pass 2: add the straight hanging part along the end tangent and resample to a fixed point count.
    for (let i = 0; i < steps.length; i++) {
      if (i === steps.length - 1) {
        // Step 7 (finished knot): hang to Y = -31.5 cm (just 1.5 cm below the narrow tail at -30 cm)
        const last = denses[i].pts[denses[i].pts.length - 1];
        const finishedHang = Math.max(10, last[1] - (-31.5));
        this.stepCurves.push(extendDense(denses[i], finishedHang));
      } else if (i === 4) {
        // Step 5: wide blade rests vertically above the newest/bottom loop (poised above front loop)
        this.stepCurves.push(extendDense(denses[i], 0.5));
      } else {
        this.stepCurves.push(extendDense(denses[i]));
      }
      this.stepKnots.push(steps[i].knot);
    }

    // Step 2 -> 3 Waypoint: Smooth curve with blade swung wide around outside left edge to the rear
    if (FOUR_IN_HAND_DATA.step2to3Mid) {
      const d23 = this.buildBladeDense(FOUR_IN_HAND_DATA.step2to3Mid.points, FOUR_IN_HAND_DATA.step2to3Mid.faces);
      this.step2to3MidCurve = extendDense(d23);
    }

    // Step 4 -> 5 Waypoint A (Rear): Smooth curve with blade swung behind knot
    if (FOUR_IN_HAND_DATA.step4to5Rear) {
      const dRear = this.buildBladeDense(FOUR_IN_HAND_DATA.step4to5Rear.points, FOUR_IN_HAND_DATA.step4to5Rear.faces);
      this.step4to5RearCurve = extendDense(dRear);
    }

    // Step 4 -> 5 Waypoint B (Up): Smooth curve with blade drawn straight UP through neck opening
    if (FOUR_IN_HAND_DATA.step4to5Up) {
      const dUp = this.buildBladeDense(FOUR_IN_HAND_DATA.step4to5Up.points, FOUR_IN_HAND_DATA.step4to5Up.faces);
      this.step4to5UpCurve = extendDense(dUp);
    }

    // Widths along the blade (decreased to a tailored, elegant profile: min 1.45 cm, max 3.10 cm)
    this.bladeWidths = [];
    for (let i = 0; i < this.N_BLADE; i++) {
      const s = i / (this.N_BLADE - 1);
      const k = Math.min(1, s / 0.4);
      let w = 1.45 + 1.65 * (k * k * (3 - 2 * k));
      if (s > 0.95) {
        w *= 1 - 0.88 * ((s - 0.95) / 0.05);
      }
      this.bladeWidths.push(w);
    }

    // Collar + narrow tail
    const cp: V3[] = [];
    const ch: V3[] = [];
    for (let i = 0; i < this.STRIP_CTRL.length; i++) {
      cp.push(this.STRIP_CTRL[i].p);
      ch.push(this.STRIP_CTRL[i].h);
    }
    this.strip = this.resample(this.sampleSpline(cp, ch), this.N_STRIP);
    this.stripWidths = [];
    for (let i = 0; i < this.N_STRIP; i++) {
      const s = i / (this.N_STRIP - 1);
      const tip = Math.min(1, s / 0.06);
      let w = i === 0 ? 0.5 : 2.6 * (0.2 + 0.8 * tip);
      if (s > 0.85) {
        const tTaper = (s - 0.85) / 0.15;
        w = 2.6 * (1.0 - tTaper) + 1.45 * tTaper;
      }
      this.stripWidths.push(w);
    }
  }

  private buildBladeDense(points: V3[], faces: V3[]): Dense {
    const p: V3[] = points.map((v) => [v[0], v[1], v[2]] as V3);
    const h: V3[] = faces.map((v) => [v[0], v[1], v[2]] as V3);
    // Extra point extending along the end tangent so the curve leaves smoothly in its direction of travel.
    const n = p.length;
    if (n >= 2) {
      const last = p[n - 1];
      const prev = p[n - 2];
      const dx = last[0] - prev[0];
      const dy = last[1] - prev[1];
      const dz = last[2] - prev[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
      p.push([last[0] + (dx / len) * 4.0, last[1] + (dy / len) * 4.0, last[2] + (dz / len) * 4.0]);
      const lastH = h[n - 1];
      h.push([lastH[0], lastH[1], lastH[2]]);
    } else {
      const last = p[0];
      p.push([last[0], last[1] - 4.0, last[2]]);
      h.push([0, 0, 1]);
    }
    return this.sampleSpline(p, h);
  }

  /** Centripetal Catmull-Rom through the control points, sampled densely. */
  private sampleSpline(cp: V3[], ch: V3[]): Dense {
    const n = cp.length;
    const P: V3[] = [];
    P.push([2 * cp[0][0] - cp[1][0], 2 * cp[0][1] - cp[1][1], 2 * cp[0][2] - cp[1][2]]);
    for (let i = 0; i < n; i++) {
      P.push(cp[i]);
    }
    P.push([2 * cp[n - 1][0] - cp[n - 2][0], 2 * cp[n - 1][1] - cp[n - 2][1], 2 * cp[n - 1][2] - cp[n - 2][2]]);

    const pts: V3[] = [];
    const hints: V3[] = [];
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < this.SEG_SAMPLES; k++) {
        const u = k / this.SEG_SAMPLES;
        pts.push(this.crPoint(P[i], P[i + 1], P[i + 2], P[i + 3], u));
        hints.push(this.mix(ch[i], ch[i + 1], u));
      }
    }
    pts.push([cp[n - 1][0], cp[n - 1][1], cp[n - 1][2]]);
    hints.push([ch[n - 1][0], ch[n - 1][1], ch[n - 1][2]]);
    return { pts: pts, hints: hints };
  }

  private crPoint(p0: V3, p1: V3, p2: V3, p3: V3, u: number): V3 {
    const t0 = 0;
    const t1 = t0 + Math.sqrt(this.dist(p0, p1)) + 1e-4;
    const t2 = t1 + Math.sqrt(this.dist(p1, p2)) + 1e-4;
    const t3 = t2 + Math.sqrt(this.dist(p2, p3)) + 1e-4;
    const t = t1 + (t2 - t1) * u;
    const A1 = this.mix(p0, p1, (t - t0) / (t1 - t0));
    const A2 = this.mix(p1, p2, (t - t1) / (t2 - t1));
    const A3 = this.mix(p2, p3, (t - t2) / (t3 - t2));
    const B1 = this.mix(A1, A2, (t - t0) / (t2 - t0));
    const B2 = this.mix(A2, A3, (t - t1) / (t3 - t1));
    return this.mix(B1, B2, (t - t1) / (t2 - t1));
  }

  /** Resample a dense polyline to n points, evenly spaced along its length. */
  private resample(d: Dense, n: number): Curve {
    const cum: number[] = [0];
    for (let i = 1; i < d.pts.length; i++) {
      cum.push(cum[i - 1] + this.dist(d.pts[i - 1], d.pts[i]));
    }
    const total = cum[cum.length - 1];
    const pts: V3[] = [];
    const faces: V3[] = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (total * i) / (n - 1);
      while (j < cum.length - 2 && cum[j + 1] < s) {
        j++;
      }
      const seg = cum[j + 1] - cum[j];
      const w = seg > 1e-6 ? (s - cum[j]) / seg : 0;
      pts.push(this.mix(d.pts[j], d.pts[j + 1], w));
      faces.push(this.mix(d.hints[j], d.hints[j + 1], w));
    }
    return { pts: pts, faces: faces };
  }

  private polyLength(pts: V3[]): number {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += this.dist(pts[i - 1], pts[i]);
    }
    return total;
  }

  // ------------------------------------------------------------------
  // Small vector helpers
  // ------------------------------------------------------------------

  private dist(a: V3, b: V3): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private mix(a: V3, b: V3, w: number): V3 {
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
  }

  private dot(a: V3, b: V3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  private cross(a: V3, b: V3): V3 {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  private norm(v: V3): V3 {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  private cloneCurve(c: Curve): Curve {
    return {
      pts: c.pts.map((v) => [v[0], v[1], v[2]] as V3),
      faces: c.faces.map((v) => [v[0], v[1], v[2]] as V3),
    };
  }

  private interpolateCurves(a: Curve, b: Curve, t: number): Curve {
    const pts: V3[] = [];
    const faces: V3[] = [];
    const n = Math.min(a.pts.length, b.pts.length);
    for (let i = 0; i < n; i++) {
      pts.push(this.mix(a.pts[i], b.pts[i], t));
      faces.push(this.mix(a.faces[i], b.faces[i], t));
    }
    return { pts: pts, faces: faces };
  }

  // ------------------------------------------------------------------
  // Update loop
  // ------------------------------------------------------------------

  private onUpdate(): void {
    const dt = getDeltaTime();

    if (this.isAnimating) {
      if (!this.isPaused) {
        this.animTimer += dt;
      }
      const linearT = Math.min(1.0, this.animTimer / this.animDuration);
      this.currentT = linearT;
      this.evaluateFrame(linearT);

      if (linearT >= 1.0 && !this.isPaused) {
        this.isAnimating = false;
        this.currentStepIndex = this.targetStepIndex;
        this.curCurve = this.cloneCurve(this.stepCurves[this.currentStepIndex]);
        this.curKnot = this.stepKnots[this.currentStepIndex];
        this.rebuildAll(this.curCurve, this.curKnot);
        this.updateTexts();
        console.log(`[FourInHandTutorial] Completed transition to Step ${this.currentStepIndex + 1}: ${FOUR_IN_HAND_DATA.steps[this.currentStepIndex].title}`);
      }
    }

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

  /** Evaluates and blends the cloth shape at animation progress linearT (0.0 .. 1.0). */
  private evaluateFrame(linearT: number): void {
    const easeT = linearT * linearT * (3.0 - 2.0 * linearT);

    const isStep4To5 = (this.previousStepIndex === 3 && this.targetStepIndex === 4);
    const isStep5To4 = (this.previousStepIndex === 4 && this.targetStepIndex === 3);

    const isStep2To3 = (this.previousStepIndex === 1 && this.targetStepIndex === 2);
    const isStep3To2 = (this.previousStepIndex === 2 && this.targetStepIndex === 1);

    if ((isStep2To3 || isStep3To2) && this.step2to3MidCurve) {
      if (isStep2To3) {
        // Forward 2-phase transition:
        // Phase 1 (0.00 -> 0.50): Step 2 -> Wide Left Rear Waypoint (clears narrow tail)
        // Phase 2 (0.50 -> 1.00): Waypoint -> Step 3 (swings behind narrow tail to right)
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.stepCurves[1], this.step2to3MidCurve, subEase);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step2to3MidCurve, this.stepCurves[2], subEase);
        }
      } else {
        // Backward 2-phase transition
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.stepCurves[2], this.step2to3MidCurve, subEase);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step2to3MidCurve, this.stepCurves[1], subEase);
        }
      }
      this.curKnot = this.animStartKnot + (this.animTargetKnot - this.animStartKnot) * easeT;
    } else if ((isStep4To5 || isStep5To4) && this.step4to5RearCurve && this.step4to5UpCurve) {
      if (isStep4To5) {
        // Forward 3-phase transition:
        // Phase 1 (0.00 -> 0.33): Step 4 -> Rear Waypoint
        // Phase 2 (0.33 -> 0.67): Rear Waypoint -> Up Waypoint
        // Phase 3 (0.67 -> 1.00): Up Waypoint -> Step 5
        if (linearT < 0.333333) {
          const subT = linearT / 0.333333;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.stepCurves[3], this.step4to5RearCurve, subEase);
        } else if (linearT < 0.666667) {
          const subT = (linearT - 0.333333) / 0.333334;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step4to5RearCurve, this.step4to5UpCurve, subEase);
        } else {
          const subT = (linearT - 0.666667) / 0.333333;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step4to5UpCurve, this.stepCurves[4], subEase);
        }
      } else {
        // Backward 3-phase transition
        if (linearT < 0.333333) {
          const subT = linearT / 0.333333;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.stepCurves[4], this.step4to5UpCurve, subEase);
        } else if (linearT < 0.666667) {
          const subT = (linearT - 0.333333) / 0.333334;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step4to5UpCurve, this.step4to5RearCurve, subEase);
        } else {
          const subT = (linearT - 0.666667) / 0.333333;
          const subEase = subT * subT * (3.0 - 2.0 * subT);
          this.curCurve = this.interpolateCurves(this.step4to5RearCurve, this.stepCurves[3], subEase);
        }
      }
      this.curKnot = this.animStartKnot + (this.animTargetKnot - this.animStartKnot) * easeT;
    } else {
      this.curCurve = this.interpolateCurves(this.animStartCurve, this.animTargetCurve, easeT);
      this.curKnot = this.animStartKnot + (this.animTargetKnot - this.animStartKnot) * easeT;
    }

    // Apply the 0.5cm collision repulsion (smoothly disabled in final Step 7 so layers come tight together)
    this.applyClothClearance(this.curCurve, this.curKnot);
    this.rebuildAll(this.curCurve, this.curKnot);
  }

  /**
   * Prevents cloth from penetrating closer than 0.5 cm to other layers.
   * In Step 7 (knotScale -> 1.0), the threshold ramps down to 0 so all layers come snugly together.
   */
  private applyClothClearance(curve: Curve, knotScale: number): void {
    const maxThreshold = 0.5; // 0.5 cm minimum clearance as requested
    const threshold = maxThreshold * Math.max(0.0, 1.0 - knotScale * 1.25);
    if (threshold <= 0.01) return;

    const pts = curve.pts;
    const n = pts.length;
    const stripPts = this.strip.pts;
    const m = stripPts.length;

    // 1. Repel against the narrow tail / collar strip
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      for (let j = 0; j < m; j++) {
        const s = stripPts[j];
        const dy = Math.abs(p[1] - s[1]);
        if (dy > threshold * 2.0) continue;

        const dx = p[0] - s[0];
        const dz = p[2] - s[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < threshold * threshold && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = (threshold - dist) / dist;
          p[0] += dx * push * 0.5;
          p[1] += (p[1] - s[1]) * push * 0.5;
          p[2] += dz * push * 0.5;
        }
      }
    }

    // 2. Repel against other layers of the wide blade itself (self-collision between distinct wraps)
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      for (let j = i + 15; j < n; j++) {
        const q = pts[j];
        const dy = Math.abs(p[1] - q[1]);
        if (dy > threshold * 2.0) continue;

        const dx = p[0] - q[0];
        const dz = p[2] - q[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < threshold * threshold && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = ((threshold - dist) / dist) * 0.5;
          p[0] += dx * push;
          p[1] += (p[1] - q[1]) * push;
          p[2] += dz * push;

          q[0] -= dx * push;
          q[1] -= (p[1] - q[1]) * push;
          q[2] -= dz * push;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Public controls & Interactive Scrubber (Option 1)
  // ------------------------------------------------------------------

  public togglePause(): void {
    if (!this.isAnimating) {
      this.replayStep();
    }
    this.isPaused = !this.isPaused;
    console.log(`[FourInHandTutorial] ${this.isPaused ? "PAUSED" : "PLAYING"} at ${(this.currentT * 100).toFixed(0)}%`);
    this.updateTexts();
  }

  public scrub(delta: number): void {
    if (!this.isAnimating) {
      this.replayStep();
    }
    this.isPaused = true;
    this.animTimer = Math.max(0.0, Math.min(this.animDuration, this.animTimer + delta * this.animDuration));
    const linearT = Math.min(1.0, this.animTimer / this.animDuration);
    this.currentT = linearT;
    this.evaluateFrame(linearT);
    this.updateTexts();
    console.log(`[FourInHandTutorial] Scrubbed to ${(linearT * 100).toFixed(0)}% (t = ${linearT.toFixed(2)}s)`);
  }

  public goToStep(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.stepCurves.length) return;
    if (stepIndex === this.currentStepIndex && !this.isAnimating && !this.isPaused) return;

    this.isPaused = false;
    this.previousStepIndex = this.currentStepIndex;
    this.targetStepIndex = stepIndex;
    const isStep4To5 = (this.previousStepIndex === 3 && this.targetStepIndex === 4) || (this.previousStepIndex === 4 && this.targetStepIndex === 3);
    const isStep2To3 = (this.previousStepIndex === 1 && this.targetStepIndex === 2) || (this.previousStepIndex === 2 && this.targetStepIndex === 1);
    this.animDuration = isStep4To5 ? 2.4 : (isStep2To3 ? 2.2 : this.ANIM_DURATION);
    this.animStartCurve = this.cloneCurve(this.curCurve);
    this.animTargetCurve = this.cloneCurve(this.stepCurves[stepIndex]);
    this.animStartKnot = this.curKnot;
    this.animTargetKnot = this.stepKnots[stepIndex];
    this.animTimer = 0.0;
    this.isAnimating = true;
    console.log(`[FourInHandTutorial] Transitioning to Step ${stepIndex + 1}: ${FOUR_IN_HAND_DATA.steps[stepIndex].title}`);
    this.updateTexts();
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
    const isStep4To5 = (this.previousStepIndex === 3 && this.currentStepIndex === 4) || (this.previousStepIndex === 4 && this.currentStepIndex === 3);
    const isStep2To3 = (this.previousStepIndex === 1 && this.currentStepIndex === 2) || (this.previousStepIndex === 2 && this.currentStepIndex === 1);
    this.animDuration = isStep4To5 ? 2.4 : (isStep2To3 ? 2.2 : this.ANIM_DURATION);
    this.animStartCurve = this.cloneCurve(this.stepCurves[this.previousStepIndex]);
    this.animTargetCurve = this.cloneCurve(this.stepCurves[this.currentStepIndex]);
    this.animStartKnot = this.stepKnots[this.previousStepIndex];
    this.animTargetKnot = this.stepKnots[this.currentStepIndex];
    this.targetStepIndex = this.currentStepIndex;
    this.animTimer = 0.0;
    this.isAnimating = true;
    this.updateTexts();
  }

  public startOver(): void {
    this.isPaused = false;
    this.currentStepIndex = 0;
    this.targetStepIndex = 0;
    this.previousStepIndex = 0;
    this.isAnimating = false;
    this.curCurve = this.cloneCurve(this.stepCurves[0]);
    this.curKnot = this.stepKnots[0];
    this.rebuildAll(this.curCurve, this.curKnot);
    this.updateTexts();
  }

  public triggerRotation(): void {
    if (this.isRotating) return;
    this.isRotating = true;
    this.rotationProgress = 0.0;
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
    return this.stepCurves ? this.stepCurves.length : 7;
  }

  private formatStepText(header: string, body?: string, maxLineLen: number = 42): string {
    const headerLines = header.trim().split("\n");
    const lines: string[] = [];
    for (const h of headerLines) {
      if (h.trim().length > 0) lines.push(h.trim());
    }

    if (body && body.trim().length > 0) {
      const bodyLines = body.trim().split("\n");
      for (const bl of bodyLines) {
        const words = bl.trim().split(/\s+/);
        let curLine = "";
        for (const w of words) {
          if (curLine.length === 0) {
            curLine = w;
          } else if (curLine.length + 1 + w.length <= maxLineLen) {
            curLine += " " + w;
          } else {
            lines.push(curLine);
            curLine = w;
          }
        }
        if (curLine.length > 0) {
          lines.push(curLine);
        }
      }
    }
    return lines.join("\n");
  }

  public updateTexts(): void {
    const step = FOUR_IN_HAND_DATA.steps[this.targetStepIndex];
    if (!step) return;

    if (this.titleTextObject) {
      const titleComp = (this.titleTextObject.getComponent("Component.Text3D") as any) ||
                        (this.titleTextObject.getComponent("Component.Text") as any);
      if (titleComp) {
        titleComp.text = "Four-in-Hand Knot";
      }
    }

    if (this.captionTextObject) {
      const captionComp = (this.captionTextObject.getComponent("Component.Text3D") as any) ||
                          (this.captionTextObject.getComponent("Component.Text") as any);
      if (captionComp) {
        if (this.isAnimating && this.isPaused) {
          const pct = Math.round(this.currentT * 100);
          captionComp.text = `[PAUSED @ ${pct}% | t = ${this.currentT.toFixed(2)}s]\nStep ${this.previousStepIndex + 1} -> Step ${this.targetStepIndex + 1}: ${step.title}\nKeys: [J] -5% | [L] +5% | [K] Play/Pause`;
        } else {
          captionComp.text = "Step " + step.stepNumber + ": " + step.title + "\n" + step.caption;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Mesh building
  // ------------------------------------------------------------------

  private newBuilder(): MeshBuilder {
    const b = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ]);
    b.topology = MeshTopology.Triangles;
    b.indexType = MeshIndexType.UInt16;
    return b;
  }

  /** Model space (cm) -> scene space: centred and scaled. */
  private tp(p: V3): V3 {
    const s = this.modelScale;
    return [(p[0] - this.CENTER_X) * s, (p[1] - this.modelCenterY) * s, p[2] * s];
  }

  public rebuildAll(blade: Curve, knotScale: number): void {
    try {
      const frontBuilder = this.newBuilder();
      const backBuilder = this.newBuilder();

      this.extrude(frontBuilder, backBuilder, this.strip, this.stripWidths);
      this.extrude(frontBuilder, backBuilder, blade, this.bladeWidths);
      this.addKnot(frontBuilder, knotScale);

      this.frontRmv.mesh = frontBuilder.getMesh();
      if (this.navyMaterial) {
        this.frontRmv.mainMaterial = this.navyMaterial;
      }
      frontBuilder.updateMesh();

      this.backRmv.mesh = backBuilder.getMesh();
      if (this.silverMaterial) {
        this.backRmv.mainMaterial = this.silverMaterial;
      }
      backBuilder.updateMesh();
    } catch (e) {
      console.error("[FourInHandTutorial] rebuildAll exception: " + e);
    }
  }

  /** Surface normal for the cloth: the hint, flattened so it is perpendicular to the direction of travel. */
  private frameNormal(T: V3, hint: V3, prevN?: V3 | null): V3 {
    const tries: V3[] = [hint];
    if (prevN) {
      tries.push(prevN);
    }
    tries.push([0, 0, 1], [1, 0, 0]);
    for (let i = 0; i < tries.length; i++) {
      const hv = tries[i];
      const d = this.dot(hv, T);
      const v: V3 = [hv[0] - T[0] * d, hv[1] - T[1] * d, hv[2] - T[2] * d];
      const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (l > 1e-3) {
        return [v[0] / l, v[1] / l, v[2] / l];
      }
    }
    return [0, 0, 1];
  }

  /**
   * Flat ribbon with a navy outside (front mesh) and a red lining (back mesh).
   * Vertex pairs: even = left edge, odd = right edge.
   */
  private extrude(fb: MeshBuilder, bb: MeshBuilder, curve: Curve, widths: number[]): void {
    const n = curve.pts.length;
    if (n < 2) return;

    const h = this.HALF_THICKNESS;
    const f0 = fb.getVerticesCount();
    const b0 = bb.getVerticesCount();
    let prevN: V3 | null = null;

    for (let i = 0; i < n; i++) {
      const a = curve.pts[Math.max(0, i - 1)];
      const c = curve.pts[Math.min(n - 1, i + 1)];
      const T = this.norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);

      const N = this.frameNormal(T, curve.faces[i], prevN);
      prevN = N;

      const B = this.cross(T, N);
      const w = widths[i] * 0.5;
      const p = curve.pts[i];

      const lf = this.tp([p[0] - B[0] * w + N[0] * h, p[1] - B[1] * w + N[1] * h, p[2] - B[2] * w + N[2] * h]);
      const rf = this.tp([p[0] + B[0] * w + N[0] * h, p[1] + B[1] * w + N[1] * h, p[2] + B[2] * w + N[2] * h]);
      const lb = this.tp([p[0] - B[0] * w - N[0] * h, p[1] - B[1] * w - N[1] * h, p[2] - B[2] * w - N[2] * h]);
      const rb = this.tp([p[0] + B[0] * w - N[0] * h, p[1] + B[1] * w - N[1] * h, p[2] + B[2] * w - N[2] * h]);

      const dn = this.dot(N, this.LIGHT);
      const shadeF = 0.45 + 0.55 * Math.max(0, dn);
      const shadeB = 0.45 + 0.55 * Math.max(0, -dn);

      fb.appendVerticesInterleaved([
        lf[0], lf[1], lf[2], N[0], N[1], N[2], this.NAVY[0] * shadeF, this.NAVY[1] * shadeF, this.NAVY[2] * shadeF, 1.0,
        rf[0], rf[1], rf[2], N[0], N[1], N[2], this.NAVY[0] * shadeF, this.NAVY[1] * shadeF, this.NAVY[2] * shadeF, 1.0,
      ]);
      bb.appendVerticesInterleaved([
        lb[0], lb[1], lb[2], -N[0], -N[1], -N[2], this.LINING[0] * shadeB, this.LINING[1] * shadeB, this.LINING[2] * shadeB, 1.0,
        rb[0], rb[1], rb[2], -N[0], -N[1], -N[2], this.LINING[0] * shadeB, this.LINING[1] * shadeB, this.LINING[2] * shadeB, 1.0,
      ]);
    }

    for (let i = 0; i < n - 1; i++) {
      const f = f0 + i * 2;
      const g = f0 + (i + 1) * 2;
      fb.appendIndices([f, f + 1, g + 1, f, g + 1, g]);

      const b = b0 + i * 2;
      const c2 = b0 + (i + 1) * 2;
      bb.appendIndices([b, c2 + 1, b + 1, b, c2, c2 + 1]);
    }
  }

  /** The finished knot: a rounded, slightly tapered barrel that grows over the bundle in the last step. */
  private addKnot(fb: MeshBuilder, scale: number): void {
    if (scale < 0.03) return;

    const cx = 0.7;
    const cy = 1.4;
    const cz = 0.4;
    const SEGS = 14;
    const rings = [
      { dy: 3.6, rx: 2.5, rz: 1.6 },
      { dy: 1.2, rx: 2.9, rz: 1.9 },
      { dy: -1.6, rx: 2.5, rz: 1.7 },
      { dy: -3.6, rx: 1.8, rz: 1.2 },
    ];

    const start = fb.getVerticesCount();

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      for (let k = 0; k < SEGS; k++) {
        const ang = (k * 2.0 * Math.PI) / SEGS;
        const s = Math.sin(ang);
        const c = Math.cos(ang);

        // Small dimple on the front of the second ring, like a real knot
        let zOff = 0;
        if (r === 1 && c > 0.6) {
          const q = (c - 0.6) / 0.4;
          zOff = -0.5 * q * q;
        }

        const pos = this.tp([
          cx + ring.rx * s * scale,
          cy + ring.dy * scale,
          cz + (ring.rz * c + zOff) * scale,
        ]);
        const nrm = this.norm([s, 0.12, c]);
        const shade = 0.4 + 0.6 * Math.max(0, this.dot(nrm, this.LIGHT));
        fb.appendVerticesInterleaved([
          pos[0], pos[1], pos[2], nrm[0], nrm[1], nrm[2],
          this.NAVY[0] * shade, this.NAVY[1] * shade, this.NAVY[2] * shade, 1.0,
        ]);
      }
    }

    const topC = start + rings.length * SEGS;
    const botC = topC + 1;
    const tp = this.tp([cx, cy + 3.9 * scale, cz]);
    const bp = this.tp([cx, cy - 3.9 * scale, cz]);
    const capShadeTop = 0.4 + 0.6 * Math.max(0, this.LIGHT[1]);
    fb.appendVerticesInterleaved([
      tp[0], tp[1], tp[2], 0, 1, 0, this.NAVY[0] * capShadeTop, this.NAVY[1] * capShadeTop, this.NAVY[2] * capShadeTop, 1.0,
      bp[0], bp[1], bp[2], 0, -1, 0, this.NAVY[0] * 0.4, this.NAVY[1] * 0.4, this.NAVY[2] * 0.4, 1.0,
    ]);

    // Both windings, so it looks right whether or not the material culls back faces.
    for (let r = 0; r < rings.length - 1; r++) {
      for (let k = 0; k < SEGS; k++) {
        const kn = (k + 1) % SEGS;
        const a = start + r * SEGS + k;
        const b = start + r * SEGS + kn;
        const c = start + (r + 1) * SEGS + k;
        const d = start + (r + 1) * SEGS + kn;
        fb.appendIndices([a, c, d, a, d, b, a, d, c, a, b, d]);
      }
    }
    for (let k = 0; k < SEGS; k++) {
      const kn = (k + 1) % SEGS;
      const t0 = start + k;
      const t1 = start + kn;
      fb.appendIndices([topC, t0, t1, topC, t1, t0]);
      const l0 = start + (rings.length - 1) * SEGS + k;
      const l1 = start + (rings.length - 1) * SEGS + kn;
      fb.appendIndices([botC, l0, l1, botC, l1, l0]);
    }
  }
}
