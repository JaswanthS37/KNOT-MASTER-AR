import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { OverhandKnotTutorial } from "./OverhandKnotTutorial";

/**
 * KnotStepController.ts
 *
 * Controls 3D world-anchored buttons for the Overhand Knot tutorial:
 * - Previous Step, Replay Step, Next Step (main row under rope)
 * - Start Over and Turn (360 rotation) off to the side
 * - Automatically enables/disables Previous on step 1 and Next on last step
 * - Supports both SIK 3D Hand pinch/poke and screen tap fallback
 */

@component
export class KnotStepController extends BaseScriptComponent {
  @input
  knotTutorialObject!: SceneObject;

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
  captionTextObject?: SceneObject;

  @input
  @allowUndefined
  titleTextObject?: SceneObject;

  private tutorial: OverhandKnotTutorial | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initController());
  }

  private initController(): void {
    this.findTutorial();

    // Wire buttons
    this.setupButton(this.prevButton, () => this.onPrevPressed());
    this.setupButton(this.replayButton, () => this.onReplayPressed());
    this.setupButton(this.nextButton, () => this.onNextPressed());
    this.setupButton(this.startOverButton, () => this.onStartOverPressed());
    this.setupButton(this.turnButton, () => this.onTurnPressed());

    // Screen tap/touch fallback for rapid testing in preview
    this.createEvent("TapEvent").bind(() => {
      console.log("[KnotStepController] TapEvent fired");
      this.onNextPressed();
    });

    this.createEvent("TouchEndEvent").bind(() => {
      console.log("[KnotStepController] TouchEndEvent fired");
      this.onNextPressed();
    });

    // Wire text objects to tutorial
    if (this.tutorial) {
      if (this.captionTextObject) this.tutorial.captionTextObject = this.captionTextObject;
      if (this.titleTextObject) this.tutorial.titleTextObject = this.titleTextObject;
    }

    this.updateButtonStates();
    console.log("[KnotStepController] All 3D World Controls initialized successfully.");
  }

  private findTutorial(): void {
    if (!this.knotTutorialObject) {
      console.warn("[KnotStepController] knotTutorialObject not assigned.");
      return;
    }
    const scripts = this.knotTutorialObject.getComponents("Component.ScriptComponent");
    for (const sc of scripts) {
      const s = sc as any;
      if (s && typeof s.nextStep === "function") {
        this.tutorial = s as OverhandKnotTutorial;
        break;
      }
    }
  }

  private setupButton(btnObj?: SceneObject, onClick?: () => void): void {
    if (!btnObj || !onClick) return;

    let collider = btnObj.getComponent("Component.ColliderComponent");
    if (!collider) {
      collider = btnObj.createComponent("Component.ColliderComponent");
    }

    let interactable = btnObj.getComponent(Interactable.getTypeName()) as Interactable;
    if (!interactable) {
      interactable = btnObj.createComponent(Interactable.getTypeName()) as Interactable;
    }

    if (interactable) {
      interactable.onTriggerEnd.add(() => {
        this.animateButtonBounce(btnObj);
        onClick();
      });
    }
  }

  private animateButtonBounce(obj: SceneObject): void {
    const trans = obj.getTransform();
    const origScale = trans.getLocalScale();
    trans.setLocalScale(origScale.uniformScale(0.85));

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      trans.setLocalScale(origScale);
    });
    delay.reset(0.12);
  }

  public onNextPressed(): void {
    if (!this.tutorial) this.findTutorial();
    if (!this.tutorial) {
      console.error("[KnotStepController] Tutorial reference not found");
      return;
    }

    if (!this.tutorial.isAtLastStep()) {
      console.log("[KnotStepController] Advancing to next step...");
      this.tutorial.nextStep();
      this.updateButtonStates();
    } else {
      console.log("[KnotStepController] Already on final step.");
    }
  }

  public onPrevPressed(): void {
    if (!this.tutorial) this.findTutorial();
    if (!this.tutorial) return;

    if (!this.tutorial.isAtFirstStep()) {
      console.log("[KnotStepController] Returning to previous step...");
      this.tutorial.previousStep();
      this.updateButtonStates();
    } else {
      console.log("[KnotStepController] Already on step 1.");
    }
  }

  public onReplayPressed(): void {
    if (!this.tutorial) this.findTutorial();
    if (this.tutorial) {
      console.log("[KnotStepController] Replaying current step...");
      this.tutorial.replayStep();
    }
  }

  public onStartOverPressed(): void {
    if (!this.tutorial) this.findTutorial();
    if (this.tutorial) {
      console.log("[KnotStepController] Starting over from Step 1...");
      this.tutorial.startOver();
      this.updateButtonStates();
    }
  }

  public onTurnPressed(): void {
    if (!this.tutorial) this.findTutorial();
    if (this.tutorial) {
      console.log("[KnotStepController] Triggering 360 rotation...");
      this.tutorial.triggerRotation();
    }
  }

  public updateButtonStates(): void {
    if (!this.tutorial) return;

    const isFirst = this.tutorial.isAtFirstStep();
    const isLast = this.tutorial.isAtLastStep();

    if (this.prevButton) {
      this.setButtonVisualState(this.prevButton, !isFirst);
    }
    if (this.nextButton) {
      this.setButtonVisualState(this.nextButton, !isLast);
    }
  }

  private setButtonVisualState(btn: SceneObject, enabled: boolean): void {
    const rmv = btn.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv && rmv.mainMaterial) {
      const pass = rmv.mainMaterial.mainPass;
      if (pass && pass.baseColor) {
        pass.baseColor = enabled
          ? new vec4(0.2, 0.65, 0.95, 0.9)
          : new vec4(0.3, 0.35, 0.4, 0.4);
      }
    }
  }
}
