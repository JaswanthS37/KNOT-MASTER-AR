import { OVERHAND_KNOT_DATA, OVERHAND_WAYPOINT_2_TO_3, OVERHAND_WAYPOINT_3_TO_4, KnotStep } from "../knots/OverhandKnotData";

/**
 * OverhandKnotTutorial.ts
 *
 * Core engine for the Overhand Knot SPECS AR tutorial.
 * - Loads knot steps from data
 * - Resamples each step to exactly 64 arc-length equidistant points
 * - Natural two-phase animation between Step 2 and Step 3 with loop contraction
 * - Dual-material two-tone rendering (Tan Hemp standing rope 80% / Crimson working end 20%)
 * - Full navigation: Next, Previous, Replay, Go to Step N, Start Over
 * - Y-axis 360 rotation for 3D inspection
 */

@component
export class OverhandKnotTutorial extends BaseScriptComponent {
  @input
  @allowUndefined
  material?: Material;

  @input
  @allowUndefined
  hempMaterial?: Material;

  @input
  @allowUndefined
  crimsonMaterial?: Material;

  // Text references
  @input
  @allowUndefined
  captionTextObject?: SceneObject;

  @input
  @allowUndefined
  titleTextObject?: SceneObject;

  // Geometry configuration
  private readonly ROPE_RADIUS = 0.75; // cm
  private readonly RADIAL_SEGMENTS = 16;
  public readonly POINT_COUNT = 64; // exactly 64 points per step
  private readonly TRANSITION_INDEX = 51; // 80% standing rope (0..51), 20% working end (51..63)

  // Animation parameters
  private readonly ANIM_DURATION = 1.2; // seconds per transition
  private animTimer = 1.2;
  private isAnimating = false;

  // Step state (0-indexed internally: 0 = Step 1, 1 = Step 2, 2 = Step 3, 3 = Step 4)
  private currentStepIndex = 0;
  private targetStepIndex = 0;
  private previousStepIndex = 0;

  // Resampled 64-point curves for each step
  private stepCurves: [number, number, number][][] = [];
  private waypoint2to3Curve: [number, number, number][] = [];
  private waypoint3to4Curve: [number, number, number][] = [];
  private animStartCurve: [number, number, number][] = [];
  private animTargetCurve: [number, number, number][] = [];
  private currentCurve: [number, number, number][] = [];

  // Rotation state
  private isRotating = false;
  private rotationProgress = 0.0;
  private readonly ROTATION_SPEED = 0.7; // ~1.4 seconds for 360 spin
  private initialYRotation = 0;

  // Dual-mesh visual components
  private standingRmv!: RenderMeshVisual;
  private workingRmv!: RenderMeshVisual;
  private workingChildObj?: SceneObject;

  onAwake(): void {
    // 1. Standing line RMV on main SceneObject
    this.standingRmv = this.sceneObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (!this.standingRmv) {
      this.standingRmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    }

    // 2. Working end RMV on child SceneObject 'OverhandWorkingEnd'
    let foundChild: SceneObject | null = null;
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) {
      const child = this.sceneObject.getChild(i);
      if (child.name === "OverhandWorkingEnd") {
        foundChild = child;
        break;
      }
    }

    if (foundChild) {
      this.workingChildObj = foundChild;
    } else {
      this.workingChildObj = global.scene.createSceneObject("OverhandWorkingEnd");
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

    // 3. Material assignment: Hemp for standing, Crimson for working
    if (this.hempMaterial) {
      this.standingRmv.mainMaterial = this.hempMaterial;
    } else if (this.material) {
      this.standingRmv.mainMaterial = this.material;
    }

    if (this.crimsonMaterial) {
      this.workingRmv.mainMaterial = this.crimsonMaterial;
    } else if (this.material) {
      this.workingRmv.mainMaterial = this.material;
    }

    // Resample all steps to exactly 64 points by arc length at load time
    this.loadAndResampleSteps();

    // Start at Step 1 (index 0)
    this.currentStepIndex = 0;
    this.targetStepIndex = 0;
    this.previousStepIndex = 0;
    this.currentCurve = this.cloneCurve(this.stepCurves[0]);
    this.rebuildDualMesh(this.currentCurve);

    // Register update loop for animations and rotations
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());

    this.createEvent("OnStartEvent").bind(() => {
      this.updateTexts();
      console.log(`[OverhandKnotTutorial] Initialized with ${this.stepCurves.length} resampled steps (64 pts each).`);
    });
  }

  /**
   * Resamples all steps from knot data to exactly 64 arc-length points.
   */
  private loadAndResampleSteps(): void {
    this.stepCurves = [];
    const steps = OVERHAND_KNOT_DATA.steps;

    for (let i = 0; i < steps.length; i++) {
      const rawPoints = steps[i].points;
      const resampled = this.resampleByArcLength(rawPoints, this.POINT_COUNT);
      this.stepCurves.push(resampled);
    }

    // Resample waypoint for Step 2 -> Step 3
    this.waypoint2to3Curve = this.resampleByArcLength(OVERHAND_WAYPOINT_2_TO_3, this.POINT_COUNT);

    // Resample waypoint for Step 3 -> Step 4 tightening
    this.waypoint3to4Curve = this.resampleByArcLength(OVERHAND_WAYPOINT_3_TO_4, this.POINT_COUNT);
  }

  /**
   * Resamples an arbitrary 3D polyline into N equidistant points by arc length.
   */
  public resampleByArcLength(
    points: [number, number, number][],
    targetCount: number
  ): [number, number, number][] {
    if (points.length < 2) return points;

    const cumDist: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const dz = p1[2] - p0[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      cumDist.push(cumDist[i - 1] + (d > 1e-6 ? d : 1e-6));
    }

    const totalLength = cumDist[cumDist.length - 1];
    const resampled: [number, number, number][] = [];

    for (let j = 0; j < targetCount; j++) {
      const targetDist = (j / (targetCount - 1)) * totalLength;

      let segIdx = 0;
      while (segIdx < cumDist.length - 2 && cumDist[segIdx + 1] < targetDist) {
        segIdx++;
      }

      const segLen = cumDist[segIdx + 1] - cumDist[segIdx];
      const frac = segLen > 1e-6 ? (targetDist - cumDist[segIdx]) / segLen : 0;

      const p0 = points[segIdx];
      const p1 = points[segIdx + 1];

      resampled.push([
        p0[0] + (p1[0] - p0[0]) * frac,
        p0[1] + (p1[1] - p0[1]) * frac,
        p0[2] + (p1[2] - p0[2]) * frac,
      ]);
    }

    return resampled;
  }

  private onUpdate(): void {
    const dt = getDeltaTime();

    // 1. Step Shape Interpolation Animation (1.2s smooth ease in/out)
    if (this.isAnimating) {
      this.animTimer += dt;
      const linearT = Math.min(1.0, this.animTimer / this.ANIM_DURATION);

      // Check if transitioning between Step 2 (index 1) and Step 3 (index 2)
      const is2to3 = (this.previousStepIndex === 1 && this.targetStepIndex === 2);
      const is3to2 = (this.previousStepIndex === 2 && this.targetStepIndex === 1);

      // Check if transitioning between Step 3 (index 2) and Step 4 (index 3)
      const is3to4 = (this.previousStepIndex === 2 && this.targetStepIndex === 3);
      const is4to3 = (this.previousStepIndex === 3 && this.targetStepIndex === 2);

      if (is2to3) {
        // Two-phase motion:
        // First half (t in [0, 0.5]): Step 2 -> Waypoint (tail swings down & behind into -Z)
        // Second half (t in [0.5, 1.0]): Waypoint -> Step 3 (tail feeds forward through loop center)
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.stepCurves[1], this.waypoint2to3Curve, easeT);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.waypoint2to3Curve, this.stepCurves[2], easeT);
        }
      } else if (is3to2) {
        // Reverse two-phase motion
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.stepCurves[2], this.waypoint2to3Curve, easeT);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.waypoint2to3Curve, this.stepCurves[1], easeT);
        }
      } else if (is3to4) {
        // Two-phase cinch:
        // First half (t in [0, 0.5]): Step 3 -> Waypoint (working end stays threaded through loop window while loop contracts)
        // Second half (t in [0.5, 1.0]): Waypoint -> Step 4 (cinch tightens shut into snug knot as ends pull taut)
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.stepCurves[2], this.waypoint3to4Curve, easeT);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.waypoint3to4Curve, this.stepCurves[3], easeT);
        }
      } else if (is4to3) {
        // Reverse two-phase cinch
        if (linearT < 0.5) {
          const subT = linearT / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.stepCurves[3], this.waypoint3to4Curve, easeT);
        } else {
          const subT = (linearT - 0.5) / 0.5;
          const easeT = subT * subT * (3.0 - 2.0 * subT);
          this.currentCurve = this.interpolateCurves(this.waypoint3to4Curve, this.stepCurves[2], easeT);
        }
      } else {
        // Standard smoothstep ease in-out
        const easeT = linearT * linearT * (3.0 - 2.0 * linearT);
        this.currentCurve = this.interpolateCurves(this.animStartCurve, this.animTargetCurve, easeT);
      }

      this.rebuildDualMesh(this.currentCurve);

      if (linearT >= 1.0) {
        this.isAnimating = false;
        this.currentStepIndex = this.targetStepIndex;
        this.currentCurve = this.cloneCurve(this.stepCurves[this.currentStepIndex]);
        this.rebuildDualMesh(this.currentCurve);
        this.updateTexts();
        console.log(`[OverhandKnotTutorial] Completed transition to Step ${this.currentStepIndex + 1}.`);
      }
    }

    // 2. 360-degree vertical rotation spin
    if (this.isRotating) {
      this.rotationProgress += dt * this.ROTATION_SPEED;
      const angleDeg = this.rotationProgress * 360.0;
      const trans = this.sceneObject.getTransform();
      trans.setWorldRotation(quat.fromEulerVec(new vec3(0, (this.initialYRotation + angleDeg) * (Math.PI / 180.0), 0)));

      if (this.rotationProgress >= 1.0) {
        this.isRotating = false;
        trans.setWorldRotation(quat.fromEulerVec(new vec3(0, this.initialYRotation * (Math.PI / 180.0), 0)));
        console.log("[OverhandKnotTutorial] 360-degree rotation finished.");
      }
    }
  }

  /**
   * Smoothly interpolate between two 64-point curves.
   */
  private interpolateCurves(
    a: [number, number, number][],
    b: [number, number, number][],
    t: number
  ): [number, number, number][] {
    const out: [number, number, number][] = [];
    const count = Math.min(a.length, b.length);
    for (let i = 0; i < count; i++) {
      out.push([
        a[i][0] + (b[i][0] - a[i][0]) * t,
        a[i][1] + (b[i][1] - a[i][1]) * t,
        a[i][2] + (b[i][2] - a[i][2]) * t,
      ]);
    }
    return out;
  }

  private cloneCurve(curve: [number, number, number][]): [number, number, number][] {
    return curve.map((p) => [p[0], p[1], p[2]]);
  }

  // --- Public Control Methods ---

  public goToStep(stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= this.stepCurves.length) return;
    if (stepIndex === this.currentStepIndex && !this.isAnimating) return;

    this.previousStepIndex = this.currentStepIndex;
    this.targetStepIndex = stepIndex;
    this.animStartCurve = this.cloneCurve(this.currentCurve);
    this.animTargetCurve = this.cloneCurve(this.stepCurves[stepIndex]);
    this.animTimer = 0.0;
    this.isAnimating = true;

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
    this.animStartCurve = this.cloneCurve(this.stepCurves[this.previousStepIndex]);
    this.animTargetCurve = this.cloneCurve(this.stepCurves[this.currentStepIndex]);
    this.targetStepIndex = this.currentStepIndex;
    this.animTimer = 0.0;
    this.isAnimating = true;
    console.log(`[OverhandKnotTutorial] Replaying Step ${this.currentStepIndex + 1} from Step ${this.previousStepIndex + 1}.`);
  }

  public startOver(): void {
    this.goToStep(0);
  }

  public triggerRotation(): void {
    if (this.isRotating) return;
    this.isRotating = true;
    this.rotationProgress = 0.0;
    this.initialYRotation = 0;
    console.log("[OverhandKnotTutorial] Starting 360-degree rotation.");
  }

  public getCurrentStep(): number {
    return this.currentStepIndex;
  }

  public getTargetStep(): number {
    return this.targetStepIndex !== undefined ? this.targetStepIndex : this.currentStepIndex;
  }

  public getStepCount(): number {
    return this.stepCurves.length;
  }

  public getTotalSteps(): number {
    return this.stepCurves.length;
  }

  public isAtFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  public isAtLastStep(): boolean {
    return this.currentStepIndex === this.stepCurves.length - 1;
  }

  private updateTexts(): void {
    const step = OVERHAND_KNOT_DATA.steps[this.targetStepIndex];
    if (!step) return;

    if (this.titleTextObject) {
      const titleComp = this.titleTextObject.getComponent("Component.Text3D") as any ||
                        this.titleTextObject.getComponent("Component.Text") as any;
      if (titleComp) {
        titleComp.text = "Overhand Knot";
      }
    }

    if (this.captionTextObject) {
      const captionComp = this.captionTextObject.getComponent("Component.Text3D") as any ||
                          this.captionTextObject.getComponent("Component.Text") as any;
      if (captionComp) {
        captionComp.text = `Step ${step.stepNumber}: ${step.title}\n${step.caption}`;
      }
    }
  }

  /**
   * Rebuilds both tube meshes (Standing rope + Working end).
   */
  public rebuildDualMesh(curve: [number, number, number][]): void {
    const N = curve.length;
    if (N < 2) return;

    // Segment 1: Standing rope (points 0..TRANSITION_INDEX)
    const standingCurve = curve.slice(0, this.TRANSITION_INDEX + 1);
    const standingBuilder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    standingBuilder.topology = MeshTopology.Triangles;
    standingBuilder.indexType = MeshIndexType.UInt16;
    this.buildTubeWithCaps(standingBuilder, standingCurve, this.ROPE_RADIUS, this.RADIAL_SEGMENTS, true, false);
    standingBuilder.updateMesh();
    this.standingRmv.mesh = standingBuilder.getMesh();
    if (this.hempMaterial) {
      this.standingRmv.mainMaterial = this.hempMaterial;
    }

    // Segment 2: Working end (points TRANSITION_INDEX..N-1)
    const workingCurve = curve.slice(this.TRANSITION_INDEX);
    const workingBuilder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    workingBuilder.topology = MeshTopology.Triangles;
    workingBuilder.indexType = MeshIndexType.UInt16;
    this.buildTubeWithCaps(workingBuilder, workingCurve, this.ROPE_RADIUS, this.RADIAL_SEGMENTS, false, true);
    workingBuilder.updateMesh();
    this.workingRmv.mesh = workingBuilder.getMesh();
    if (this.crimsonMaterial) {
      this.workingRmv.mainMaterial = this.crimsonMaterial;
    }
  }

  private buildTubeWithCaps(
    builder: MeshBuilder,
    curve: [number, number, number][],
    radius: number,
    radialSegments: number,
    capStart: boolean,
    capEnd: boolean
  ): void {
    const N = curve.length;
    const R = radialSegments + 1;

    // Tangents along polyline
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

    // Parallel transport frames to eliminate unwanted twisting
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

    // Vertices
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

    // Indices
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

    // Start cap
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

    // End cap
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
  }
}
