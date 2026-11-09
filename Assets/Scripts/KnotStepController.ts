import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

/**
 * KnotStepController.ts
 *
 * Controls 3D world-anchored buttons for Knot & Tie tutorials:
 * - Previous Step, Replay Step, Next Step (main row under rope/tie)
 * - Start Over and Turn (360 rotation) off to the side
 * - Automatically routes interactions to the currently active tutorial
 * - Manages enable/disable button states
 * - Supports SIK 3D Hand pinch/poke + screen tap fallback
 */

@component
export class KnotStepController extends BaseScriptComponent {
  @input
  @allowUndefined
  knotTutorialObject?: SceneObject;

  @input
  @allowUndefined
  prevButton?: SceneObject;

  @input
  @allowUndefined
  replayButton?: SceneObject;

  @input
  @allowUndefined
  nextButton?: SceneObject;

  @input
  @allowUndefined
  startOverButton?: SceneObject;

  @input
  @allowUndefined
  turnButton?: SceneObject;

  @input
  @allowUndefined
  planeMesh?: RenderMesh;

  @input
  @allowUndefined
  iconMaterial?: Material;

  @input
  @allowUndefined
  prevIconTex?: Texture;

  @input
  @allowUndefined
  nextIconTex?: Texture;

  @input
  @allowUndefined
  replayIconTex?: Texture;

  @input
  @allowUndefined
  restartIconTex?: Texture;

  @input
  @allowUndefined
  turnIconTex?: Texture;

  @input
  @allowUndefined
  captionTextObject?: SceneObject;

  @input
  @allowUndefined
  titleTextObject?: SceneObject;

  private activeTutorial: any = null;
  public mainMenuController: any = null;

  // Voice Command System (AsrModule)
  private asrModule: any = null;
  private isListening: boolean = false;
  private lastVoiceCommandTime: number = 0;
  private voiceBadgeObj?: SceneObject;
  private voiceTextComp?: any;
  private voiceBadgeMat?: Material;
  private voiceResetDelay?: DelayedCallbackEvent;

  // Step Progress Bar (Vertical Tube on the Right Side)
  private progressBarRoot?: SceneObject;
  private trackTubeObj?: SceneObject;
  private fillTubeObj?: SceneObject;
  private fillTransform?: Transform;
  private fillMaterial?: Material;
  private badgeTextObj?: SceneObject;
  private badgeTextComp?: any;
  private dividerRings: SceneObject[] = [];
  private currentProgress: number = 0.0;
  private targetProgress: number = 0.0;
  private readonly lightGreenColor: vec4 = new vec4(0.52, 0.95, 0.62, 0.95);
  private readonly darkGreenColor: vec4 = new vec4(0.08, 0.65, 0.22, 1.0);
  private cylinderMeshCache: { [key: string]: RenderMesh } = {};

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initController());
    this.createEvent("OnDestroyEvent").bind(() => this.stopVoiceControl());
    this.createEvent("UpdateEvent").bind((e: UpdateEvent) => this.onUpdate(e));
  }

  private onUpdate(e: UpdateEvent): void {
    const dt = e.getDeltaTime();
    this.updateProgressBarAnimation(dt);
  }

  private initController(): void {
    this.findDefaultTutorial();

    // Wire buttons
    this.setupButton(this.prevButton, () => this.onPrevPressed());
    this.setupButton(this.replayButton, () => this.onReplayPressed());
    this.setupButton(this.nextButton, () => this.onNextPressed());
    this.setupButton(this.startOverButton, () => this.onStartOverPressed());
    this.setupButton(this.turnButton, () => this.onTurnPressed());

    // Load flat Plane mesh, transparent icon material, and icon textures
    try {
      this.getOrCreatePlaneMesh();
      if (!this.iconMaterial) this.iconMaterial = requireAsset("../Materials/IconMaterial.mat") as Material;
      if (!this.prevIconTex) this.prevIconTex = requireAsset("../Icons/chevron-left-bold.png") as Texture;
      if (!this.nextIconTex) this.nextIconTex = requireAsset("../Icons/chevron-right-bold.png") as Texture;
      if (!this.replayIconTex) this.replayIconTex = requireAsset("../Icons/repeat.png") as Texture;
      if (!this.restartIconTex) this.restartIconTex = requireAsset("../Icons/restart-alt.png") as Texture;
      if (!this.turnIconTex) this.turnIconTex = requireAsset("../Icons/360.png") as Texture;
    } catch (e) {
      console.log(`[KnotStepController] Icon asset load note: ${e}`);
    }

    // Attach flat 2D single-sided Plane icons beside existing labels
    this.setupButtonIcon(this.prevButton, this.prevIconTex, 0.12);
    this.setupButtonIcon(this.replayButton, this.replayIconTex, 0.12);
    this.setupButtonIcon(this.nextButton, this.nextIconTex, 0.12);
    this.setupButtonIcon(this.startOverButton, this.restartIconTex, 0.13);
    this.setupButtonIcon(this.turnButton, this.turnIconTex, 0.13);

    // Screen tap fallback is handled by MainMenuController with spatial regions

    this.updateButtonStates();

    // Keep Title styled with visionOS frosted glass card, and ensure Step text has no backing card
    this.removeTextGlassCard(this.captionTextObject);
    this.setupTextGlassCard(this.titleTextObject, 10.5, 2.6);

    // Initialize Hands-Free Voice Control & Status HUD Badge
    this.setupVoiceBadge();
    this.startVoiceControl();

    // Initialize Vertical Step Progress Bar on the Right Side
    this.setupProgressBar();
    this.onTutorialChanged();

    if (this.titleTextObject) {
      const wp = this.titleTextObject.getTransform().getWorldPosition();
      const lp = this.titleTextObject.getTransform().getLocalPosition();
      console.log(`[titleTextObject] wp=(${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}, ${wp.z.toFixed(1)}) lp=(${lp.x.toFixed(1)}, ${lp.y.toFixed(1)}, ${lp.z.toFixed(1)})`);
    }
    if (this.turnButton) {
      const wp = this.turnButton.getTransform().getWorldPosition();
      const lp = this.turnButton.getTransform().getLocalPosition();
      console.log(`[turnButton] wp=(${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}, ${wp.z.toFixed(1)}) lp=(${lp.x.toFixed(1)}, ${lp.y.toFixed(1)}, ${lp.z.toFixed(1)})`);
    }

    console.log("[KnotStepController] All 3D World Controls & Voice Commands initialized successfully.");
  }

  public setActiveTutorial(tut: any): void {
    this.activeTutorial = tut;
    if (this.activeTutorial) {
      if (this.captionTextObject) this.activeTutorial.captionTextObject = this.captionTextObject;
      if (this.titleTextObject) this.activeTutorial.titleTextObject = this.titleTextObject;
      if (typeof this.activeTutorial.updateTexts === "function") {
        this.activeTutorial.updateTexts();
      }
    }
    this.removeTextGlassCard(this.captionTextObject);
    this.setupTextGlassCard(this.titleTextObject, 10.5, 2.6);
    this.setupVoiceBadge();
    this.updateButtonStates();
    this.setupProgressBar();
    this.onTutorialChanged();
  }

  private findDefaultTutorial(): void {
    if (this.activeTutorial) return;
    if (!this.knotTutorialObject) return;

    const scripts = this.knotTutorialObject.getComponents("Component.ScriptComponent");
    for (const sc of scripts) {
      const s = sc as any;
      if (s && typeof s.nextStep === "function") {
        this.setActiveTutorial(s);
        break;
      }
    }
  }

  private setupButton(btnObj?: SceneObject, onClick?: () => void): void {
    if (!btnObj || !onClick) return;

    // Apply smooth rounded squircle button mesh & visionOS frosted glass styling
    const rmv = btnObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv) {
      const roundedMesh = this.getOrCreateRoundedButtonMesh();
      if (roundedMesh) {
        rmv.mesh = roundedMesh;
      }
      if (rmv.mainMaterial) {
        const pass = rmv.mainMaterial.mainPass;
        if (pass) {
          pass.baseColor = new vec4(0.12, 0.14, 0.18, 0.65);
          pass.roughness = 0.28;
          pass.metallic = 0.05;
          pass.blendMode = BlendMode.PremultipliedAlphaAuto;
          pass.depthWrite = false;
          pass.depthTest = true;
          pass.twoSided = true;
          try {
            if (!pass.baseTex) {
              pass.baseTex = requireAsset("../Materials/Base.png") as Texture;
            }
          } catch (e) {}
        }
      }
    }

    let col = btnObj.getComponent("Component.ColliderComponent") as ColliderComponent;
    if (!col) col = btnObj.createComponent("Component.ColliderComponent") as ColliderComponent;

    // Attach SIK Interactable for 3D hand pinch and poke
    try {
      const anyObj = btnObj as any;
      let interactable = anyObj.getComponent(Interactable.getTypeName()) as Interactable;
      if (!interactable) {
        interactable = btnObj.createComponent(Interactable.getTypeName()) as Interactable;
      }
      if (interactable && interactable.onTriggerEnd) {
        this.createEvent("OnStartEvent").bind(() => {
          interactable.onTriggerEnd.add(() => {
            this.animateButtonBounce(btnObj);
            onClick();
          });
        });
      }
    } catch (e) {
      console.log(`[KnotStepController] SIK interactable bind note: ${e}`);
    }
  }

  public handleScreenTap(cam: Camera | null, tapPos: vec2): boolean {
    // 1. Turn 360 button (right of Next)
    if (this.isTapOnButton(cam, this.turnButton, tapPos, { minX: 0.44, maxX: 0.57, minY: 0.75, maxY: 0.92 })) {
      this.animateButtonBounce(this.turnButton!);
      this.onTurnPressed();
      return true;
    }

    // 2. Start Over / Restart button (far left)
    if (this.isTapOnButton(cam, this.startOverButton, tapPos, { minX: 0.00, maxX: 0.13, minY: 0.75, maxY: 0.92 })) {
      this.animateButtonBounce(this.startOverButton!);
      this.onStartOverPressed();
      return true;
    }

    // 3. Next button (right of Replay)
    if (this.isTapOnButton(cam, this.nextButton, tapPos, { minX: 0.34, maxX: 0.45, minY: 0.75, maxY: 0.92 })) {
      this.animateButtonBounce(this.nextButton!);
      this.onNextPressed();
      return true;
    }

    // 4. Previous button (left of Replay)
    if (this.isTapOnButton(cam, this.prevButton, tapPos, { minX: 0.11, maxX: 0.23, minY: 0.75, maxY: 0.92 })) {
      this.animateButtonBounce(this.prevButton!);
      this.onPrevPressed();
      return true;
    }

    // 5. Replay button (center under tie)
    if (this.isTapOnButton(cam, this.replayButton, tapPos, { minX: 0.22, maxX: 0.35, minY: 0.75, maxY: 0.92 })) {
      this.animateButtonBounce(this.replayButton!);
      this.onReplayPressed();
      return true;
    }

    return false;
  }

  private isTapOnButton(
    cam: Camera | null,
    btn: SceneObject | undefined,
    tap: vec2,
    fallback: { minX: number; maxX: number; minY: number; maxY: number }
  ): boolean {
    if (!btn || !btn.enabled) return false;

    if (cam && typeof cam.worldSpaceToScreenSpace === "function") {
      try {
        const trans = btn.getTransform();
        const pos = trans.getWorldPosition();
        const scale = trans.getWorldScale();
        const hw = scale.x * 0.5 * 1.35;
        const hh = scale.y * 0.5 * 1.50;

        const p1 = cam.worldSpaceToScreenSpace(new vec3(pos.x - hw, pos.y - hh, pos.z));
        const p2 = cam.worldSpaceToScreenSpace(new vec3(pos.x + hw, pos.y - hh, pos.z));
        const p3 = cam.worldSpaceToScreenSpace(new vec3(pos.x + hw, pos.y + hh, pos.z));
        const p4 = cam.worldSpaceToScreenSpace(new vec3(pos.x - hw, pos.y + hh, pos.z));

        let minX = Math.min(p1.x, p2.x, p3.x, p4.x) - 0.015;
        let maxX = Math.max(p1.x, p2.x, p3.x, p4.x) + 0.015;
        let minY = Math.min(p1.y, p2.y, p3.y, p4.y) - 0.025;
        let maxY = Math.max(p1.y, p2.y, p3.y, p4.y) + 0.045;

        if (!isNaN(minX) && !isNaN(maxX) && maxX > minX) {
          const hit = tap.x >= minX && tap.x <= maxX && tap.y >= minY && tap.y <= maxY;
          console.log(`[KnotStepController] test ${btn.name}: tap=(${tap.x.toFixed(3)}, ${tap.y.toFixed(3)}) vs proj bounds X[${minX.toFixed(3)}..${maxX.toFixed(3)}], Y[${minY.toFixed(3)}..${maxY.toFixed(3)}] -> ${hit}`);
          return hit;
        }
      } catch (e) {
        console.log(`[KnotStepController] proj error: ${e}`);
      }
    }

    const hitFb = tap.x >= fallback.minX && tap.x <= fallback.maxX && tap.y >= fallback.minY && tap.y <= fallback.maxY;
    console.log(`[KnotStepController] test ${btn ? btn.name : 'null'} (fallback): tap=(${tap.x.toFixed(3)}, ${tap.y.toFixed(3)}) vs FB X[${fallback.minX.toFixed(3)}..${fallback.maxX.toFixed(3)}], Y[${fallback.minY.toFixed(3)}..${fallback.maxY.toFixed(3)}] -> ${hitFb}`);
    return hitFb;
  }

  private animateButtonBounce(obj: SceneObject): void {
    const trans = obj.getTransform();
    const origScale = trans.getLocalScale();
    trans.setLocalScale(origScale.uniformScale(0.88));

    // Tactile glass glow on press
    const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
      rmv.mainMaterial.mainPass.baseColor = new vec4(0.24, 0.28, 0.36, 0.85);
    }

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      trans.setLocalScale(origScale);
      if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
        rmv.mainMaterial.mainPass.baseColor = new vec4(0.12, 0.14, 0.18, 0.65);
      }
    });
    delay.reset(0.12);
  }

  public onNextPressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (!this.activeTutorial) return;

    if (!this.activeTutorial.isAtLastStep()) {
      this.activeTutorial.nextStep();
      this.updateButtonStates();
    }
  }

  public onPrevPressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (!this.activeTutorial) return;

    if (!this.activeTutorial.isAtFirstStep()) {
      this.activeTutorial.previousStep();
      this.updateButtonStates();
    }
  }

  public onPausePressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (this.activeTutorial && typeof this.activeTutorial.togglePause === "function") {
      this.activeTutorial.togglePause();
    }
  }

  public onScrub(delta: number): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (this.activeTutorial && typeof this.activeTutorial.scrub === "function") {
      this.activeTutorial.scrub(delta);
    }
  }

  public onReplayPressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (this.activeTutorial) {
      this.activeTutorial.replayStep();
    }
  }

  public onStartOverPressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (this.activeTutorial) {
      this.activeTutorial.startOver();
      this.updateButtonStates();
    }
  }

  public onTurnPressed(): void {
    if (!this.activeTutorial) this.findDefaultTutorial();
    if (this.activeTutorial) {
      this.activeTutorial.triggerRotation();
    }
  }

  public updateButtonStates(): void {
    if (!this.activeTutorial) return;

    const isFirst = this.activeTutorial.isAtFirstStep();
    const isLast = this.activeTutorial.isAtLastStep();

    if (this.prevButton) {
      this.setButtonVisualState(this.prevButton, !isFirst);
    }
    if (this.nextButton) {
      this.setButtonVisualState(this.nextButton, !isLast);
    }
    this.refreshProgressBarTarget();
  }

  // ------------------------------------------------------------------
  // Voice Command System (AsrModule)
  // ------------------------------------------------------------------

  private setupVoiceBadge(): void {
    if (this.voiceBadgeObj) return;

    try {
      // 1. Check if pre-configured VoiceBadgeText exists in TutorialContainer
      if (this.titleTextObject && this.titleTextObject.getParent()) {
        const parent = this.titleTextObject.getParent();
        const count = parent.getChildrenCount();
        for (let i = 0; i < count; i++) {
          const c = parent.getChild(i);
          if (c.name === "VoiceBadgeText") {
            this.voiceBadgeObj = c;
            break;
          }
        }
      }

      if (this.voiceBadgeObj) {
        const trans = this.voiceBadgeObj.getTransform();
        trans.setWorldPosition(new vec3(0.0, -12.0, -58.0));

        this.voiceTextComp = this.voiceBadgeObj.getComponent("Component.Text3D") as any;
        if (this.voiceTextComp) {
          this.voiceTextComp.text = 'Voice: "Next" | "Previous" | "Replay" | "Restart"';
        }
        this.setupTextGlassCard(this.voiceBadgeObj, 14.5, 1.4, 13.0);

        // Find its GlassPlate child to control highlight color
        const childCount = this.voiceBadgeObj.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
          const ch = this.voiceBadgeObj.getChild(i);
          if (ch.name === "GlassPlate") {
            const rmv = ch.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
            if (rmv && rmv.mainMaterial) {
              this.voiceBadgeMat = rmv.mainMaterial;
            }
            break;
          }
        }
        console.log("[KnotStepController] Voice Status Badge attached to pre-configured SceneObject.");
        return;
      }
    } catch (e) {
      console.log(`[KnotStepController] Voice badge setup note: ${e}`);
    }
  }

  private startVoiceControl(): void {
    try {
      this.asrModule = require("LensStudio:AsrModule");
      if (!this.asrModule) {
        console.log("[KnotStepController] AsrModule not found via require.");
        return;
      }

      const options = AsrModule.AsrTranscriptionOptions.create();
      options.silenceUntilTerminationMs = 600;
      options.mode = AsrModule.AsrMode.Balanced;

      options.onTranscriptionUpdateEvent.add((eventArgs: AsrModule.TranscriptionUpdateEvent) => {
        if (!eventArgs || !eventArgs.text) return;
        this.processVoiceCommand(eventArgs.text, eventArgs.isFinal);
      });

      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        console.log(`[KnotStepController] ASR error code: ${code}`);
      });

      this.asrModule.startTranscribing(options);
      this.isListening = true;
      console.log("[KnotStepController] Hands-free ASR Voice Control active: 'Next', 'Previous', 'Replay', 'Restart'.");
    } catch (e) {
      console.log(`[KnotStepController] ASR initialization note: ${e}`);
    }
  }

  private stopVoiceControl(): void {
    if (this.asrModule && this.isListening) {
      try {
        this.asrModule.stopTranscribing();
        this.isListening = false;
      } catch (e) {
        console.log(`[KnotStepController] ASR stop note: ${e}`);
      }
    }
  }

  public processVoiceCommand(rawText: string, isFinal: boolean): void {
    const now = getTime();
    if (now - this.lastVoiceCommandTime < 0.9) {
      // Cooldown to prevent duplicate triggers during word completion
      return;
    }

    const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    if (clean.length === 0) return;
    const words = clean.split(/\s+/);

    // 1] Next
    if (
      clean.indexOf("next") >= 0 ||
      clean.indexOf("continue") >= 0 ||
      clean.indexOf("forward") >= 0 ||
      clean.indexOf("go next") >= 0 ||
      clean.indexOf("proceed") >= 0
    ) {
      this.lastVoiceCommandTime = now;
      console.log(`[KnotStepController] Voice Command recognized: "Next" from "${rawText}"`);
      this.triggerVoiceFeedback("Next", this.nextButton);
      this.onNextPressed();
      return;
    }

    // 2] Previous
    if (
      clean.indexOf("previous") >= 0 ||
      clean.indexOf("prev") >= 0 ||
      clean.indexOf("go back") >= 0 ||
      words.indexOf("back") >= 0 ||
      clean.indexOf("last step") >= 0
    ) {
      this.lastVoiceCommandTime = now;
      console.log(`[KnotStepController] Voice Command recognized: "Previous" from "${rawText}"`);
      this.triggerVoiceFeedback("Previous", this.prevButton);
      this.onPrevPressed();
      return;
    }

    // 3] Replay
    if (
      clean.indexOf("replay") >= 0 ||
      clean.indexOf("repeat") >= 0 ||
      clean.indexOf("play again") >= 0 ||
      clean.indexOf("once more") >= 0 ||
      words.indexOf("again") >= 0
    ) {
      this.lastVoiceCommandTime = now;
      console.log(`[KnotStepController] Voice Command recognized: "Replay" from "${rawText}"`);
      this.triggerVoiceFeedback("Replay", this.replayButton);
      this.onReplayPressed();
      return;
    }

    // 4] Restart
    if (
      clean.indexOf("restart") >= 0 ||
      clean.indexOf("start over") >= 0 ||
      clean.indexOf("startover") >= 0 ||
      clean.indexOf("begin again") >= 0 ||
      clean.indexOf("reset") >= 0
    ) {
      this.lastVoiceCommandTime = now;
      console.log(`[KnotStepController] Voice Command recognized: "Restart" from "${rawText}"`);
      this.triggerVoiceFeedback("Restart", this.startOverButton);
      this.onStartOverPressed();
      return;
    }

    // Bonus: Turn 360
    if (
      clean.indexOf("turn") >= 0 ||
      clean.indexOf("rotate") >= 0 ||
      clean.indexOf("spin") >= 0 ||
      clean.indexOf("360") >= 0
    ) {
      this.lastVoiceCommandTime = now;
      console.log(`[KnotStepController] Voice Command recognized: "Turn 360" from "${rawText}"`);
      this.triggerVoiceFeedback("Turn 360", this.turnButton);
      this.onTurnPressed();
      return;
    }

    // Bonus: Menu / Home
    if (
      clean.indexOf("menu") >= 0 ||
      clean.indexOf("main menu") >= 0 ||
      clean.indexOf("home") >= 0
    ) {
      if (this.mainMenuController && typeof this.mainMenuController.showMainMenu === "function") {
        this.lastVoiceCommandTime = now;
        console.log(`[KnotStepController] Voice Command recognized: "Menu" from "${rawText}"`);
        this.triggerVoiceFeedback("Main Menu");
        this.mainMenuController.showMainMenu();
        return;
      }
    }
  }

  public triggerVoiceFeedback(commandName: string, buttonObj?: SceneObject): void {
    if (buttonObj) {
      this.animateButtonBounce(buttonObj);
    }

    if (this.voiceTextComp) {
      this.voiceTextComp.text = `Heard: "${commandName}"`;
    }

    if (this.voiceBadgeMat && this.voiceBadgeMat.mainPass) {
      this.voiceBadgeMat.mainPass.baseColor = new vec4(0.08, 0.35, 0.22, 0.88);
    }

    if (this.voiceResetDelay) {
      this.voiceResetDelay.cancel();
    }
    this.voiceResetDelay = this.createEvent("DelayedCallbackEvent");
    this.voiceResetDelay.bind(() => {
      if (this.voiceTextComp) {
        this.voiceTextComp.text = 'Voice: "Next" | "Previous" | "Replay" | "Restart"';
      }
      if (this.voiceBadgeMat && this.voiceBadgeMat.mainPass) {
        this.voiceBadgeMat.mainPass.baseColor = new vec4(0.08, 0.12, 0.18, 0.65);
      }
    });
    this.voiceResetDelay.reset(1.6);
  }

  private getOrCreatePlaneMesh(): RenderMesh | null {
    if (this.planeMesh) return this.planeMesh;
    try {
      this.planeMesh = requireAsset("../Plane.mesh") as RenderMesh;
      if (this.planeMesh) return this.planeMesh;
    } catch (e) {}

    // Fallback: build a single-sided 1.0x1.0 XY flat quad with MeshBuilder
    try {
      const b = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
      ]);
      b.topology = MeshTopology.Triangles;
      b.indexType = MeshIndexType.UInt16;
      b.appendVerticesInterleaved([
        -0.5, -0.5, 0.0,   0.0, 0.0, 1.0,   0.0, 0.0,
         0.5, -0.5, 0.0,   0.0, 0.0, 1.0,   1.0, 0.0,
         0.5,  0.5, 0.0,   0.0, 0.0, 1.0,   1.0, 1.0,
        -0.5,  0.5, 0.0,   0.0, 0.0, 1.0,   0.0, 1.0,
      ]);
      b.appendIndices([0, 1, 2,  0, 2, 3]);
      b.updateMesh();
      this.planeMesh = b.getMesh();
      return this.planeMesh;
    } catch (e) {
      console.log(`[KnotStepController] Quad mesh fallback note: ${e}`);
    }
    return null;
  }

  private roundedButtonMesh: RenderMesh | null = null;

  private getOrCreateRoundedButtonMesh(): RenderMesh | null {
    if (this.roundedButtonMesh) return this.roundedButtonMesh;

    try {
      const b = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
      ]);
      b.topology = MeshTopology.Triangles;
      b.indexType = MeshIndexType.UInt16;

      // Aspect-ratio-corrected corner arcs for button scale ~4.6 x 2.5
      // so corners in 3D world space are smooth, circular visionOS squircle arcs:
      const rx = 0.14;
      const ry = 0.25;
      const cx = 0.5 - rx;
      const cy = 0.5 - ry;

      // Inset for front flat face bevel:
      const bx = 0.03;
      const by = 0.05;

      const zFront = 0.35;
      const zBevel = 0.22;
      const zBack = -0.35;

      const K = 6;
      const M = 4 * K; // 24 perimeter segments

      const px: number[] = [];
      const py: number[] = [];
      const qx: number[] = [];
      const qy: number[] = [];
      const nx: number[] = [];
      const ny: number[] = [];

      for (let c = 0; c < 4; c++) {
        let centerBoxX = cx;
        let centerBoxY = cy;
        let startAngle = 0;
        if (c === 0) {
          centerBoxX = cx; centerBoxY = cy; startAngle = 0;
        } else if (c === 1) {
          centerBoxX = -cx; centerBoxY = cy; startAngle = Math.PI / 2;
        } else if (c === 2) {
          centerBoxX = -cx; centerBoxY = -cy; startAngle = Math.PI;
        } else {
          centerBoxX = cx; centerBoxY = -cy; startAngle = (3 * Math.PI) / 2;
        }

        for (let s = 0; s < K; s++) {
          const angle = startAngle + (s / K) * (Math.PI / 2);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          nx.push(cosA);
          ny.push(sinA);
          px.push(centerBoxX + rx * cosA);
          py.push(centerBoxY + ry * sinA);
          qx.push(centerBoxX + (rx - bx) * cosA);
          qy.push(centerBoxY + (ry - by) * sinA);
        }
      }

      // Build interleaved vertex array: [x, y, z,  nx, ny, nz,  u, v]
      const verts: number[] = [];

      // 0: Front Center
      verts.push(0.0, 0.0, zFront,  0.0, 0.0, 1.0,  0.5, 0.5);

      // 1 .. M: Inner Front Perimeter (flat face)
      for (let i = 0; i < M; i++) {
        verts.push(qx[i], qy[i], zFront,  0.0, 0.0, 1.0,  qx[i] + 0.5, qy[i] + 0.5);
      }

      // M+1 .. 2M: Outer Front Bevel Rim (smoothed light-catching rim)
      for (let i = 0; i < M; i++) {
        const len = Math.sqrt(nx[i] * nx[i] * 0.25 + ny[i] * ny[i] * 0.25 + 0.707 * 0.707);
        verts.push(
          px[i], py[i], zBevel,
          (nx[i] * 0.5) / len, (ny[i] * 0.5) / len, 0.707 / len,
          px[i] + 0.5, py[i] + 0.5
        );
      }

      // 2M+1 .. 3M: Outer Back Rim
      for (let i = 0; i < M; i++) {
        verts.push(px[i], py[i], zBack,  nx[i], ny[i], 0.0,  px[i] + 0.5, py[i] + 0.5);
      }

      // 3M+1: Back Center
      verts.push(0.0, 0.0, zBack,  0.0, 0.0, -1.0,  0.5, 0.5);

      b.appendVerticesInterleaved(verts);

      // Indices
      const indices: number[] = [];

      // 1. Front Face Fan
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        indices.push(0, 1 + i, 1 + next);
      }

      // 2. Front Bevel Strip
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        const i0 = 1 + i;
        const i1 = 1 + next;
        const o0 = M + 1 + i;
        const o1 = M + 1 + next;
        indices.push(i0, o0, o1,  i0, o1, i1);
      }

      // 3. Side Wall Strip
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        const f0 = M + 1 + i;
        const f1 = M + 1 + next;
        const b0 = 2 * M + 1 + i;
        const b1 = 2 * M + 1 + next;
        indices.push(f0, b0, b1,  f0, b1, f1);
      }

      // 4. Back Face Fan
      const backCenterIdx = 3 * M + 1;
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        indices.push(backCenterIdx, 2 * M + 1 + next, 2 * M + 1 + i);
      }

      b.appendIndices(indices);
      b.updateMesh();
      this.roundedButtonMesh = b.getMesh();
      return this.roundedButtonMesh;
    } catch (e) {
      console.log(`[KnotStepController] Rounded button mesh error: ${e}`);
    }
    return null;
  }

  private hudCardMesh: RenderMesh | null = null;
  private glassMaterial?: Material;

  private getOrCreateHUDCardMesh(): RenderMesh | null {
    if (this.hudCardMesh) return this.hudCardMesh;
    try {
      const b = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
      ]);
      b.topology = MeshTopology.Triangles;
      b.indexType = MeshIndexType.UInt16;

      // Aspect-ratio-corrected squircle for HUD card (~28 x 7.5 x 0.6)
      const rx = 0.08;
      const ry = 0.24;
      const cx = 0.5 - rx;
      const cy = 0.5 - ry;

      const bx = 0.02;
      const by = 0.05;

      const zFront = 0.35;
      const zBevel = 0.22;
      const zBack = -0.35;

      const K = 6;
      const M = 4 * K;

      const px: number[] = [];
      const py: number[] = [];
      const qx: number[] = [];
      const qy: number[] = [];
      const nx: number[] = [];
      const ny: number[] = [];

      for (let c = 0; c < 4; c++) {
        let centerBoxX = cx;
        let centerBoxY = cy;
        let startAngle = 0;
        if (c === 0) {
          centerBoxX = cx; centerBoxY = cy; startAngle = 0;
        } else if (c === 1) {
          centerBoxX = -cx; centerBoxY = cy; startAngle = Math.PI / 2;
        } else if (c === 2) {
          centerBoxX = -cx; centerBoxY = -cy; startAngle = Math.PI;
        } else {
          centerBoxX = cx; centerBoxY = -cy; startAngle = (3 * Math.PI) / 2;
        }

        for (let s = 0; s < K; s++) {
          const angle = startAngle + (s / K) * (Math.PI / 2);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          nx.push(cosA);
          ny.push(sinA);
          px.push(centerBoxX + rx * cosA);
          py.push(centerBoxY + ry * sinA);
          qx.push(centerBoxX + (rx - bx) * cosA);
          qy.push(centerBoxY + (ry - by) * sinA);
        }
      }

      const verts: number[] = [];
      verts.push(0.0, 0.0, zFront,  0.0, 0.0, 1.0,  0.5, 0.5);

      for (let i = 0; i < M; i++) {
        verts.push(qx[i], qy[i], zFront,  0.0, 0.0, 1.0,  qx[i] + 0.5, qy[i] + 0.5);
      }

      for (let i = 0; i < M; i++) {
        const len = Math.sqrt(nx[i] * nx[i] * 0.25 + ny[i] * ny[i] * 0.25 + 0.707 * 0.707);
        verts.push(
          px[i], py[i], zBevel,
          (nx[i] * 0.5) / len, (ny[i] * 0.5) / len, 0.707 / len,
          px[i] + 0.5, py[i] + 0.5
        );
      }

      for (let i = 0; i < M; i++) {
        verts.push(px[i], py[i], zBack,  nx[i], ny[i], 0.0,  px[i] + 0.5, py[i] + 0.5);
      }

      verts.push(0.0, 0.0, zBack,  0.0, 0.0, -1.0,  0.5, 0.5);

      b.appendVerticesInterleaved(verts);

      const indices: number[] = [];
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        indices.push(0, 1 + i, 1 + next);
      }
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        const i0 = 1 + i;
        const i1 = 1 + next;
        const o0 = M + 1 + i;
        const o1 = M + 1 + next;
        indices.push(i0, o0, o1,  i0, o1, i1);
      }
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        const f0 = M + 1 + i;
        const f1 = M + 1 + next;
        const b0 = 2 * M + 1 + i;
        const b1 = 2 * M + 1 + next;
        indices.push(f0, b0, b1,  f0, b1, f1);
      }
      const backCenterIdx = 3 * M + 1;
      for (let i = 0; i < M; i++) {
        const next = (i + 1) % M;
        indices.push(backCenterIdx, 2 * M + 1 + next, 2 * M + 1 + i);
      }

      b.appendIndices(indices);
      b.updateMesh();
      this.hudCardMesh = b.getMesh();
      return this.hudCardMesh;
    } catch (e) {
      console.log(`[KnotStepController] HUD card mesh error: ${e}`);
    }
    return null;
  }

  private removeTextGlassCard(textObj?: SceneObject): void {
    if (!textObj) return;

    // Ensure pure crisp typography without chunky extrusion
    const textComp = textObj.getComponent("Component.Text3D") as any;
    if (textComp) {
      if (typeof textComp.extrusionDepth !== "undefined") {
        textComp.extrusionDepth = 0.08;
      }
      if (typeof textComp.fontSize !== "undefined") {
        textComp.fontSize = 36.0;
      } else if (typeof textComp.size !== "undefined") {
        textComp.size = 36.0;
      }
    }

    const count = textObj.getChildrenCount();
    for (let i = count - 1; i >= 0; i--) {
      const child = textObj.getChild(i);
      if (child.name === "GlassPlate") {
        child.destroy();
      }
    }
  }

  private setupTextGlassCard(textObj?: SceneObject, cardWidth: number = 10.5, cardHeight: number = 2.6, customFontSize?: number): void {
    if (!textObj) return;

    // Refine Text3D typography
    const textComp = textObj.getComponent("Component.Text3D") as any;
    let titleLen = 12;
    if (textComp) {
      if (customFontSize !== undefined) {
        if (typeof textComp.extrusionDepth !== "undefined") {
          textComp.extrusionDepth = 0.08;
        }
        if (typeof textComp.fontSize !== "undefined") {
          textComp.fontSize = customFontSize;
        } else if (typeof textComp.size !== "undefined") {
          textComp.size = customFontSize;
        }
      } else {
        if (typeof textComp.extrusionDepth !== "undefined") {
          textComp.extrusionDepth = 0.00;
        }
        if (typeof textComp.fontSize !== "undefined") {
          textComp.fontSize = 37.0;
        } else if (typeof textComp.size !== "undefined") {
          textComp.size = 37.0;
        }
        if (typeof textComp.letterSpacing !== "undefined") {
          textComp.letterSpacing = 0.07;
        }
      }
      if (textComp.text) {
        titleLen = textComp.text.length;
      }
    }

    let w = cardWidth;
    let h = cardHeight;
    if (customFontSize === undefined) {
      if (titleLen > 14) {
        w = 11.8; // Four-in-Hand Knot
      } else {
        w = 10.2; // Overhand Knot / Bowline Knot
      }
      h = 2.6;
    }

    // Attach or find child GlassPlate
    let plateObj: SceneObject | null = null;
    const count = textObj.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const child = textObj.getChild(i);
      if (child.name === "GlassPlate") {
        plateObj = child;
        break;
      }
    }

    if (!plateObj) {
      plateObj = global.scene.createSceneObject("GlassPlate");
      plateObj.setParent(textObj);
    }

    const plateTrans = plateObj.getTransform();
    plateTrans.setLocalPosition(new vec3(0.0, 0.0, -0.45));
    plateTrans.setLocalScale(new vec3(w, h, 0.6));
    plateTrans.setLocalRotation(quat.quatIdentity());

    let rmv = plateObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (!rmv) {
      rmv = plateObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    }

    const cardMesh = this.getOrCreateHUDCardMesh();
    if (cardMesh) {
      rmv.mesh = cardMesh;
    }

    if (!this.glassMaterial) {
      try {
        this.glassMaterial = requireAsset("../Materials/ButtonMat.mat") as Material;
      } catch (e) {}
    }

    if (this.glassMaterial) {
      const mat = this.glassMaterial.clone();
      const pass = mat.mainPass;
      if (pass) {
        pass.baseColor = new vec4(0.10, 0.12, 0.15, 0.62);
        pass.roughness = 0.28;
        pass.metallic = 0.05;
        pass.blendMode = BlendMode.PremultipliedAlphaAuto;
        pass.depthWrite = false;
        pass.depthTest = true;
        pass.twoSided = true;
        try {
          if (!pass.baseTex) {
            pass.baseTex = requireAsset("../Materials/Base.png") as Texture;
          }
        } catch (e) {}
      }
      rmv.clearMaterials();
      rmv.addMaterial(mat);
    }
  }

  private setupButtonIcon(
    btnObj?: SceneObject,
    tex?: Texture,
    textOffset: number = 0.12,
    fontSize?: number
  ): void {
    if (!btnObj) return;

    let iconObj: SceneObject | null = null;
    let labelObj: SceneObject | null = null;

    const count = btnObj.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const child = btnObj.getChild(i);
      const nameLower = child.name.toLowerCase();
      if (nameLower.indexOf("icon") >= 0) {
        iconObj = child;
      } else if (nameLower.indexOf("label") >= 0 || child.getComponent("Component.Text3D")) {
        labelObj = child;
      }
    }

    if (!iconObj) {
      iconObj = global.scene.createSceneObject("Icon");
      iconObj.setParent(btnObj);
    }

    // Set Transform: flat 2D single-sided Plane on the front surface of the 3D button
    const iconTrans = iconObj.getTransform();
    iconTrans.setLocalPosition(new vec3(-0.25, 0.0, 0.65));
    // Sized to a square flat plane (button local scale is ~4.6 x 2.5)
    iconTrans.setLocalScale(new vec3(0.28, 0.52, 1.0));
    iconTrans.setLocalRotation(quat.quatIdentity());

    // Setup RenderMeshVisual
    let iconRmv = iconObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (!iconRmv) {
      iconRmv = iconObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    }

    // Assign single-sided flat Plane mesh (NOT 6-sided Box!)
    const mesh = this.getOrCreatePlaneMesh();
    if (mesh) {
      iconRmv.mesh = mesh;
    }

    // Setup transparent icon material
    if (tex && this.iconMaterial) {
      const mat = this.iconMaterial.clone();
      mat.mainPass.baseTex = tex;
      mat.mainPass.baseColor = new vec4(1, 1, 1, 1);
      mat.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
      mat.mainPass.depthWrite = false;
      mat.mainPass.depthTest = true;
      mat.mainPass.twoSided = true;
      iconRmv.clearMaterials();
      iconRmv.addMaterial(mat);
    }

    // Shift Label text slightly right so both icon and text are cleanly visible side-by-side
    if (labelObj) {
      const labelTrans = labelObj.getTransform();
      const curPos = labelTrans.getLocalPosition();
      labelTrans.setLocalPosition(new vec3(textOffset, curPos.y, curPos.z > 0 ? curPos.z : 0.65));

      if (fontSize !== undefined) {
        const textComp = labelObj.getComponent("Component.Text3D") as any;
        if (textComp) {
          if (typeof textComp.fontSize !== "undefined") {
            textComp.fontSize = fontSize;
          } else if (typeof textComp.size !== "undefined") {
            textComp.size = fontSize;
          }
        }
      }
    }
  }

  private setButtonVisualState(btn: SceneObject, enabled: boolean): void {
    const rmv = btn.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv && rmv.mainMaterial) {
      const pass = rmv.mainMaterial.mainPass;
      if (pass && pass.baseColor) {
        pass.baseColor = enabled
          ? new vec4(0.12, 0.14, 0.18, 0.65)
          : new vec4(0.08, 0.09, 0.11, 0.40);
      }
    }
    // Keep icons always 100% bright white
    const count = btn.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const child = btn.getChild(i);
      if (child.name.toLowerCase().indexOf("icon") >= 0) {
        const iconRmv = child.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (iconRmv && iconRmv.mainMaterial) {
          const p = iconRmv.mainMaterial.mainPass;
          if (p && p.baseColor) {
            p.baseColor = new vec4(1, 1, 1, 1);
          }
        }
      }
    }
  }


  // ------------------------------------------------------------------
  // Step Progress Bar Implementation (Vertical Tube on the Right Side)
  // ------------------------------------------------------------------

  public onTutorialChanged(): void {
    this.rebuildDividerRings();
    this.refreshProgressBarTarget(true);
  }

  public refreshProgressBarTarget(immediate: boolean = false): void {
    const totalSteps = this.getTotalStepsForTutorial();
    const curStep = this.getCurrentStepForTutorial();
    this.targetProgress = Math.min(1.0, Math.max(0.0, (curStep + 1) / totalSteps));

    if (immediate) {
      this.currentProgress = this.targetProgress;
      this.updateProgressBarAnimation(0.01);
    }
  }

  public getCurrentStepForTutorial(): number {
    if (!this.activeTutorial) return 0;
    if (typeof this.activeTutorial.getTargetStep === "function") {
      return this.activeTutorial.getTargetStep();
    }
    if (typeof this.activeTutorial.getCurrentStep === "function") {
      return this.activeTutorial.getCurrentStep();
    }
    if (this.activeTutorial.targetStepIndex !== undefined) {
      return this.activeTutorial.targetStepIndex;
    }
    if (this.activeTutorial.currentStepIndex !== undefined) {
      return this.activeTutorial.currentStepIndex;
    }
    return 0;
  }

  public getTotalStepsForTutorial(): number {
    if (!this.activeTutorial) return 1;
    if (typeof this.activeTutorial.getTotalSteps === "function") {
      return this.activeTutorial.getTotalSteps();
    }
    if (typeof this.activeTutorial.getStepCount === "function") {
      return this.activeTutorial.getStepCount();
    }
    if (this.activeTutorial.stepCurves && Array.isArray(this.activeTutorial.stepCurves)) {
      return this.activeTutorial.stepCurves.length;
    }
    return 1;
  }

  private setupProgressBar(): void {
    if (this.progressBarRoot) return;

    try {
      let parentObj: SceneObject | null = null;
      if (this.titleTextObject && this.titleTextObject.getParent()) {
        parentObj = this.titleTextObject.getParent();
      } else if (this.knotTutorialObject) {
        parentObj = this.knotTutorialObject;
      }

      this.progressBarRoot = global.scene.createSceneObject("StepProgressBar");
      if (parentObj) {
        this.progressBarRoot.setParent(parentObj);
      }

      const trans = this.progressBarRoot.getTransform();
      // Right side of viewport: X = 13.8 cm, Y = 0.0 cm, Z = -59.0 cm
      trans.setWorldPosition(new vec3(11.8, 0.0, -59.0));
      trans.setWorldRotation(quat.quatIdentity());
      trans.setWorldScale(new vec3(1.0, 1.0, 1.0));

      const tubeHeight = 17.0;
      const halfHeight = tubeHeight * 0.5; // 8.5 cm

      // 1. Outer Translucent Frosted Glass Track Tube (R = 0.55 cm, H = 17.0 cm)
      this.trackTubeObj = global.scene.createSceneObject("TrackTube");
      this.trackTubeObj.setParent(this.progressBarRoot);
      const trackTrans = this.trackTubeObj.getTransform();
      trackTrans.setLocalPosition(new vec3(0.0, -halfHeight, 0.0));
      trackTrans.setLocalRotation(quat.quatIdentity());
      trackTrans.setLocalScale(new vec3(1.0, 1.0, 1.0));

      let trackRmv = this.trackTubeObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      trackRmv.mesh = this.getOrCreateCylinderMesh(0.60, tubeHeight, 24);

      if (!this.glassMaterial) {
        try {
          this.glassMaterial = requireAsset("../Materials/ButtonMat.mat") as Material;
        } catch (e) {}
      }

      if (this.glassMaterial) {
        const trackMat = this.glassMaterial.clone();
        if (trackMat && trackMat.mainPass) {
          trackMat.mainPass.baseColor = new vec4(0.12, 0.16, 0.22, 0.38);
          trackMat.mainPass.roughness = 0.25;
          trackMat.mainPass.metallic = 0.08;
          trackMat.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
          trackMat.mainPass.depthWrite = false;
          trackMat.mainPass.depthTest = true;
          trackMat.mainPass.twoSided = true;
        }
        trackRmv.clearMaterials();
        trackRmv.addMaterial(trackMat);
      }

      // 2. Sleek Endcaps at bottom and top
      this.createEndcap("BottomCap", new vec3(0.0, -halfHeight - 0.35, 0.0), 0.68, 0.35);
      this.createEndcap("TopCap", new vec3(0.0, halfHeight, 0.0), 0.68, 0.35);

      // 3. Inner Fill Tube (R = 0.42 cm, Unit Height 1.0 cm, scaled dynamically by fillTransform)
      this.fillTubeObj = global.scene.createSceneObject("FillTube");
      this.fillTubeObj.setParent(this.progressBarRoot);
      this.fillTransform = this.fillTubeObj.getTransform();
      this.fillTransform.setLocalPosition(new vec3(0.0, -halfHeight, 0.0));
      this.fillTransform.setLocalRotation(quat.quatIdentity());
      this.fillTransform.setLocalScale(new vec3(1.0, 0.01, 1.0));

      let fillRmv = this.fillTubeObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      fillRmv.mesh = this.getOrCreateCylinderMesh(0.46, 1.0, 24);

      if (this.glassMaterial) {
        this.fillMaterial = this.glassMaterial.clone();
        if (this.fillMaterial && this.fillMaterial.mainPass) {
          this.fillMaterial.mainPass.baseColor = this.lightGreenColor;
          this.fillMaterial.mainPass.roughness = 0.15;
          this.fillMaterial.mainPass.metallic = 0.0;
          this.fillMaterial.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
          this.fillMaterial.mainPass.depthWrite = true;
          this.fillMaterial.mainPass.depthTest = true;
          this.fillMaterial.mainPass.twoSided = true;
        }
        fillRmv.clearMaterials();
        fillRmv.addMaterial(this.fillMaterial);
      }

      // 4. Step Badge Text (Positioned just above tube top at Y = +9.8)
      this.badgeTextObj = global.scene.createSceneObject("StepBadgeText");
      this.badgeTextObj.setParent(this.progressBarRoot);
      const badgeTrans = this.badgeTextObj.getTransform();
      badgeTrans.setLocalPosition(new vec3(0.0, halfHeight + 1.25, 0.2));
      badgeTrans.setLocalRotation(quat.quatIdentity());
      badgeTrans.setLocalScale(new vec3(1.0, 1.0, 1.0));

      this.badgeTextComp = this.badgeTextObj.createComponent("Component.Text3D") as any;
      if (this.badgeTextComp) {
        this.badgeTextComp.text = "Step 1/6";
        if (typeof this.badgeTextComp.size !== "undefined") {
          this.badgeTextComp.size = 20;
        } else if (typeof this.badgeTextComp.fontSize !== "undefined") {
          this.badgeTextComp.fontSize = 20;
        }
        if (this.titleTextObject) {
          const tComp = this.titleTextObject.getComponent("Component.Text3D") as any;
          if (tComp) {
            if (tComp.font) this.badgeTextComp.font = tComp.font;
            if (tComp.mainMaterial) {
              const textMat = tComp.mainMaterial.clone();
              if (textMat && textMat.mainPass) {
                textMat.mainPass.baseColor = this.lightGreenColor;
              }
              this.badgeTextComp.clearMaterials();
              this.badgeTextComp.addMaterial(textMat);
            }
          }
        }
      }
      this.setupTextGlassCard(this.badgeTextObj, 4.4, 1.45, 21.0);

      // 5. Build Divider Rings for current tutorial
      this.rebuildDividerRings();

      console.log("[KnotStepController] Vertical Step Progress Bar initialized at right side.");
    } catch (e) {
      console.log(`[KnotStepController] Error setting up progress bar: ${e}`);
    }
  }

  private createEndcap(name: string, pos: vec3, radius: number, height: number): void {
    if (!this.progressBarRoot) return;
    const capObj = global.scene.createSceneObject(name);
    capObj.setParent(this.progressBarRoot);
    capObj.getTransform().setLocalPosition(pos);
    let rmv = capObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = this.getOrCreateCylinderMesh(radius, height, 24);

    if (this.glassMaterial) {
      const capMat = this.glassMaterial.clone();
      if (capMat && capMat.mainPass) {
        capMat.mainPass.baseColor = new vec4(0.20, 0.24, 0.32, 0.85);
        capMat.mainPass.roughness = 0.30;
        capMat.mainPass.metallic = 0.40;
        capMat.mainPass.blendMode = BlendMode.PremultipliedAlphaAuto;
        capMat.mainPass.depthWrite = true;
        capMat.mainPass.depthTest = true;
      }
      rmv.clearMaterials();
      rmv.addMaterial(capMat);
    }
  }

  private rebuildDividerRings(): void {
    // User requested no partitions within the tube: smooth continuous tube
    for (const r of this.dividerRings) {
      if (r) r.destroy();
    }
    this.dividerRings = [];
  }

  private updateProgressBarAnimation(dt: number): void {
    if (!this.fillTransform || !this.fillMaterial || !this.activeTutorial) return;

    const totalSteps = this.getTotalStepsForTutorial();
    const curStep = this.getCurrentStepForTutorial();
    this.targetProgress = Math.min(1.0, Math.max(0.0, (curStep + 1) / totalSteps));

    // Smooth lerp: "slowly progresses up for each step"
    const fillSpeed = 4.0;
    const step = Math.min(1.0, dt * fillSpeed);
    this.currentProgress += (this.targetProgress - this.currentProgress) * step;

    // Update vertical height: from 0 up to 17.0 cm
    const tubeHeight = 17.0;
    const currentHeight = Math.max(0.01, tubeHeight * this.currentProgress);
    this.fillTransform.setLocalScale(new vec3(1.0, currentHeight, 1.0));

    const isFinalStep = curStep === totalSteps - 1;
    const pass = this.fillMaterial.mainPass;

    if (isFinalStep) {
      // At final step, as it completes, turn into a darker shade of green!
      const startRatio = (totalSteps - 1) / totalSteps;
      const t = Math.min(1.0, Math.max(0.0, (this.currentProgress - startRatio) / Math.max(0.001, 1.0 - startRatio)));

      // Color lerp from light green to darker shade of green
      const r = this.lightGreenColor.x + (this.darkGreenColor.x - this.lightGreenColor.x) * t;
      const g = this.lightGreenColor.y + (this.darkGreenColor.y - this.lightGreenColor.y) * t;
      const b = this.lightGreenColor.z + (this.darkGreenColor.z - this.lightGreenColor.z) * t;
      const a = this.lightGreenColor.w + (this.darkGreenColor.w - this.lightGreenColor.w) * t;
      if (pass) pass.baseColor = new vec4(r, g, b, a);

      if (this.badgeTextComp) {
        if (t > 0.85) {
          this.badgeTextComp.text = `${totalSteps}/${totalSteps} Done! ✓`;
          if (this.badgeTextComp.mainMaterial && this.badgeTextComp.mainMaterial.mainPass) {
            this.badgeTextComp.mainMaterial.mainPass.baseColor = this.darkGreenColor;
          }
        } else {
          this.badgeTextComp.text = `Step ${curStep + 1}/${totalSteps}`;
          if (this.badgeTextComp.mainMaterial && this.badgeTextComp.mainMaterial.mainPass) {
            this.badgeTextComp.mainMaterial.mainPass.baseColor = this.lightGreenColor;
          }
        }
      }
    } else {
      // Intermediate steps: light green
      if (pass) pass.baseColor = this.lightGreenColor;
      if (this.badgeTextComp) {
        this.badgeTextComp.text = `Step ${curStep + 1}/${totalSteps}`;
        if (this.badgeTextComp.mainMaterial && this.badgeTextComp.mainMaterial.mainPass) {
          this.badgeTextComp.mainMaterial.mainPass.baseColor = this.lightGreenColor;
        }
      }
    }
  }

  private getOrCreateCylinderMesh(radius: number, height: number, radialSegments: number = 24): RenderMesh {
    const key = `${radius.toFixed(3)}_${height.toFixed(3)}_${radialSegments}`;
    if (this.cylinderMeshCache[key]) return this.cylinderMeshCache[key];

    const b = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
    ]);
    b.topology = MeshTopology.Triangles;
    b.indexType = MeshIndexType.UInt16;

    const verts: number[] = [];
    const indices: number[] = [];

    // Cylinder side quads: bottom rim at y=0, top rim at y=height
    for (let s = 0; s <= radialSegments; s++) {
      const u = s / radialSegments;
      const theta = u * Math.PI * 2.0;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const x = cosT * radius;
      const z = sinT * radius;

      // Bottom vertex
      verts.push(x, 0.0, z,  cosT, 0.0, sinT,  u, 0.0);
      // Top vertex
      verts.push(x, height, z,  cosT, 0.0, sinT,  u, 1.0);
    }

    const stride = 2;
    for (let s = 0; s < radialSegments; s++) {
      const b0 = s * stride;
      const t0 = s * stride + 1;
      const b1 = (s + 1) * stride;
      const t1 = (s + 1) * stride + 1;
      indices.push(b0, b1, t1);
      indices.push(b0, t1, t0);
    }

    // Bottom cap
    const bCenterIdx = verts.length / 8;
    verts.push(0.0, 0.0, 0.0,  0.0, -1.0, 0.0,  0.5, 0.5);
    const bRimStart = verts.length / 8;
    for (let s = 0; s <= radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2.0;
      verts.push(Math.cos(theta) * radius, 0.0, Math.sin(theta) * radius,  0.0, -1.0, 0.0,  0.5, 0.5);
    }
    for (let s = 0; s < radialSegments; s++) {
      indices.push(bCenterIdx, bRimStart + s + 1, bRimStart + s);
    }

    // Top cap
    const tCenterIdx = verts.length / 8;
    verts.push(0.0, height, 0.0,  0.0, 1.0, 0.0,  0.5, 0.5);
    const tRimStart = verts.length / 8;
    for (let s = 0; s <= radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2.0;
      verts.push(Math.cos(theta) * radius, height, Math.sin(theta) * radius,  0.0, 1.0, 0.0,  0.5, 0.5);
    }
    for (let s = 0; s < radialSegments; s++) {
      indices.push(tCenterIdx, tRimStart + s, tRimStart + s + 1);
    }

    b.appendVerticesInterleaved(verts);
    b.appendIndices(indices);
    b.updateMesh();

    const mesh = b.getMesh();
    this.cylinderMeshCache[key] = mesh;
    return mesh;
  }
}
