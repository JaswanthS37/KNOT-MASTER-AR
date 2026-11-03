import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";

/**
 * KnotStepController.ts
 *
 * Handles user interaction to advance through the knot tutorial steps.
 * Supports:
 *   1. SIK 3D Hand Pinch / Poke on the floating button (for SPECS AR glasses).
 *   2. Direct window tap/click fallback (for fast desktop preview testing).
 */
@component
export class KnotStepController extends BaseScriptComponent {
  @input
  @hint("Drag the SceneObject with the OverhandKnotTutorial script")
  knotTutorialObject!: SceneObject;

  @input
  @hint("Drag the 3D button SceneObject (e.g. NextButton)")
  @allowUndefined
  buttonObject?: SceneObject;

  @input
  @hint("Optional Text or Text3D object for the step description")
  @allowUndefined
  stepTextObject?: SceneObject;

  private tutorial: any = null;
  private currentStepIndex: number = 0;
  private buttonInteractable: Interactable | null = null;

  private readonly STEP_TITLES = [
    "Step 0: Floating Rope",
    "Step 1: Form a Loop",
    "Step 2: Pass End Through",
    "Step 3: Pull Tight (Done!)"
  ];

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  private onStart(): void {
    this.findTutorial();
    this.setupButtonInteraction();

    // Also support global tap for instant testing in preview
    this.createEvent("TapEvent").bind(() => {
      this.triggerNextStep();
    });

    this.updateText();
    console.log("[KnotStepController] Initialized. Current: " + this.STEP_TITLES[0]);
  }

  private findTutorial(): void {
    if (!this.knotTutorialObject) {
      console.warn("[KnotStepController] knotTutorialObject is not assigned.");
      return;
    }
    const scripts = this.knotTutorialObject.getComponents("Component.ScriptComponent");
    for (const sc of scripts) {
      const script = sc as any;
      if (script && typeof script.advanceStep === "function") {
        this.tutorial = script;
        break;
      }
    }
  }

  private setupButtonInteraction(): void {
    if (!this.buttonObject) {
      return;
    }

    // Ensure button has a ColliderComponent so SIK can detect hits
    let collider = this.buttonObject.getComponent("Component.ColliderComponent");
    if (!collider) {
      collider = this.buttonObject.createComponent("Component.ColliderComponent");
    }

    // Ensure button has SIK Interactable component
    let interactable = this.buttonObject.getComponent(Interactable.getTypeName()) as Interactable;
    if (!interactable) {
      interactable = this.buttonObject.createComponent(Interactable.getTypeName()) as Interactable;
    }

    this.buttonInteractable = interactable;

    if (this.buttonInteractable) {
      // Trigger when pinch/poke activates
      this.buttonInteractable.onTriggerEnd.add(() => {
        console.log("[KnotStepController] Button pinched/triggered by hand!");
        this.animateButtonPress();
        this.triggerNextStep();
      });
      console.log("[KnotStepController] SIK Interactable attached to button.");
    }
  }

  private animateButtonPress(): void {
    if (!this.buttonObject) return;
    const trans = this.buttonObject.getTransform();
    const origScale = trans.getLocalScale();
    trans.setLocalScale(origScale.uniformScale(0.85));

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      trans.setLocalScale(origScale);
    });
    delay.reset(0.12);
  }

  public triggerNextStep(): void {
    if (!this.tutorial) {
      this.findTutorial();
    }
    if (!this.tutorial) {
      console.error("[KnotStepController] OverhandKnotTutorial component not found.");
      return;
    }

    if (this.currentStepIndex < 3) {
      this.currentStepIndex++;
      this.tutorial.advanceStep();
      this.updateText();
      console.log("[KnotStepController] -> Advanced to: " + this.STEP_TITLES[this.currentStepIndex]);
    } else {
      console.log("[KnotStepController] Tutorial is already complete (Step 3).");
    }
  }

  private updateText(): void {
    if (!this.stepTextObject) return;
    const textComp = this.stepTextObject.getComponent("Component.Text") as any ||
                     this.stepTextObject.getComponent("Component.Text3D") as any;
    if (textComp) {
      textComp.text = this.STEP_TITLES[this.currentStepIndex];
    }
  }
}
