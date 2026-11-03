import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { OverhandKnotTutorial } from "./OverhandKnotTutorial";

/**
 * MainMenuController.ts
 *
 * Manages spatial AR transitions between the Main Menu and active knot tutorials.
 * Preserves all existing knot tutorials while providing 3D selection cards.
 * Supports SIK 3D Hand pinch/poke + desktop preview tap/click fallback.
 */

@component
export class MainMenuController extends BaseScriptComponent {
  @input
  mainMenuContainer!: SceneObject;

  @input
  tutorialContainer!: SceneObject;

  @input
  @allowUndefined
  overhandCardButton?: SceneObject;

  @input
  @allowUndefined
  fourInHandCardButton?: SceneObject;

  @input
  @allowUndefined
  backToMenuButton?: SceneObject;

  @input
  @allowUndefined
  knotTutorial?: OverhandKnotTutorial;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initMenu());
  }

  private initMenu(): void {
    // SIK Hand Interaction bindings
    this.setupInteractable(this.overhandCardButton, () => {
      console.log("[MainMenuController] Overhand Knot selected via SIK.");
      this.launchKnotTutorial("overhand");
    });

    this.setupInteractable(this.fourInHandCardButton, () => {
      console.log("[MainMenuController] Four-in-Hand selected via SIK.");
      this.launchKnotTutorial("four-in-hand");
    });

    this.setupInteractable(this.backToMenuButton, () => {
      console.log("[MainMenuController] Returning to Main Menu via SIK.");
      this.showMainMenu();
    });

    // Desktop Preview Tap Fallback
    this.createEvent("TouchEndEvent").bind((event) => {
      const pos = event.getTouchPosition();

      // If in Main Menu
      if (this.mainMenuContainer && this.mainMenuContainer.enabled) {
        if (pos.x < 0.5) {
          console.log("[MainMenuController] Preview tap on Overhand Knot card.");
          this.launchKnotTutorial("overhand");
        } else {
          console.log("[MainMenuController] Preview tap on Four-in-Hand card.");
          this.launchKnotTutorial("four-in-hand");
        }
      } else if (this.tutorialContainer && this.tutorialContainer.enabled) {
        // If in Tutorial, tap top-left area to return to menu
        if (pos.x < 0.25 && pos.y < 0.25) {
          console.log("[MainMenuController] Preview tap on Back to Menu.");
          this.showMainMenu();
        }
      }
    });

    // Start on Main Menu by default
    this.showMainMenu();
    console.log("[MainMenuController] Main Menu Initialized.");
  }

  private setupInteractable(btn?: SceneObject, onClick?: () => void): void {
    if (!btn || !onClick) return;

    let col = btn.getComponent("Component.ColliderComponent");
    if (!col) col = btn.createComponent("Component.ColliderComponent");

    let interactable = btn.getComponent(Interactable.getTypeName()) as Interactable;
    if (!interactable) {
      interactable = btn.createComponent(Interactable.getTypeName()) as Interactable;
    }

    if (interactable) {
      interactable.onTriggerEnd.add(() => {
        this.bounce(btn);
        onClick();
      });
    }
  }

  private bounce(obj: SceneObject): void {
    const trans = obj.getTransform();
    const orig = trans.getLocalScale();
    trans.setLocalScale(orig.uniformScale(0.88));

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => trans.setLocalScale(orig));
    delay.reset(0.12);
  }

  public showMainMenu(): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.enabled = true;
    }
    if (this.tutorialContainer) {
      this.tutorialContainer.enabled = false;
    }
  }

  public launchKnotTutorial(knotId: string): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.enabled = false;
    }
    if (this.tutorialContainer) {
      this.tutorialContainer.enabled = true;
    }

    if (knotId === "overhand" && this.knotTutorial) {
      this.knotTutorial.startOver();
    }
  }
}
