import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { OverhandKnotTutorial } from "./OverhandKnotTutorial";
import { FourInHandTutorial } from "./FourInHandTutorial";
import { BowlineKnotTutorial } from "./BowlineKnotTutorial";
import { KnotStepController } from "./KnotStepController";

/**
 * MainMenuController.ts
 *
 * Manages spatial AR transitions between:
 *   Level 1: Categories Menu ("Knots" vs "Ties")
 *   Level 2: Knot/Tie Sub-menus ("Overhand" & "Bowline" under Knots; "Four-in-Hand" under Ties)
 *   Active Tutorials: Overhand, Bowline, Four-in-Hand
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
  bowlineCardButton?: SceneObject;

  @input
  @allowUndefined
  fourInHandCardButton?: SceneObject;

  @input
  @allowUndefined
  backToMenuButton?: SceneObject;

  @input
  @allowUndefined
  menuTitleObject?: SceneObject;

  @input
  @allowUndefined
  menuSubtitleObject?: SceneObject;

  @input
  @allowUndefined
  planeMesh?: RenderMesh;

  @input
  @allowUndefined
  iconMaterial?: Material;

  @input
  @allowUndefined
  menuIconTex?: Texture;

  @input
  @allowUndefined
  knotRopeObject?: SceneObject;

  @input
  @allowUndefined
  bowlineRopeObject?: SceneObject;

  @input
  @allowUndefined
  fourInHandObject?: SceneObject;

  @input
  @allowUndefined
  knotTutorial?: OverhandKnotTutorial;

  @input
  @allowUndefined
  bowlineTutorial?: BowlineKnotTutorial;

  @input
  @allowUndefined
  fourInHandTutorial?: FourInHandTutorial;

  @input
  @allowUndefined
  stepController?: KnotStepController;

  @input
  @allowUndefined
  camera?: Camera;

  // Category navigation state
  private currentMenuState: "categories" | "knots" | "ties" = "categories";
  private lastSelectedCategory: "knots" | "ties" = "knots";

  // Category cards & sub-menu Back button
  private knotsCategoryCard?: SceneObject;
  private tiesCategoryCard?: SceneObject;
  private categoryBackButton?: SceneObject;

  private getCamera(): Camera | null {
    if (this.camera) return this.camera;
    try {
      const gScene = (global as any).scene;
      if (gScene) {
        const count = gScene.getRootObjectsCount();
        for (let i = 0; i < count; i++) {
          const root = gScene.getRootObject(i);
          const c = root.getComponent("Component.Camera") as Camera;
          if (c) {
            this.camera = c;
            return c;
          }
        }
      }
    } catch (e) {
      console.log(`[MainMenuController] Camera search note: ${e}`);
    }
    return null;
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
        const hw = scale.x * 0.5 * 1.25;
        const hh = scale.y * 0.5 * 1.25;

        const p1 = cam.worldSpaceToScreenSpace(new vec3(pos.x - hw, pos.y - hh, pos.z));
        const p2 = cam.worldSpaceToScreenSpace(new vec3(pos.x + hw, pos.y - hh, pos.z));
        const p3 = cam.worldSpaceToScreenSpace(new vec3(pos.x + hw, pos.y + hh, pos.z));
        const p4 = cam.worldSpaceToScreenSpace(new vec3(pos.x - hw, pos.y + hh, pos.z));

        const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
        const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
        const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

        if (!isNaN(minX) && !isNaN(maxX) && maxX > minX) {
          const hit = tap.x >= minX && tap.x <= maxX && tap.y >= minY && tap.y <= maxY;
          return hit;
        }
      } catch (e) {
        console.log(`[MainMenuController] proj error: ${e}`);
      }
    }

    const hitFb = tap.x >= fallback.minX && tap.x <= fallback.maxX && tap.y >= fallback.minY && tap.y <= fallback.maxY;
    return hitFb;
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.initMenu());
  }

  private initMenu(): void {
    // Auto-discover MenuTitle and MenuSubtitle if undefined
    if (!this.menuTitleObject && this.mainMenuContainer) {
      const count = this.mainMenuContainer.getChildrenCount();
      for (let i = 0; i < count; i++) {
        const c = this.mainMenuContainer.getChild(i);
        if (c.name.toLowerCase().indexOf("title") >= 0 && c.name.toLowerCase().indexOf("subtitle") < 0) {
          this.menuTitleObject = c;
          break;
        }
      }
    }
    if (!this.menuSubtitleObject && this.mainMenuContainer) {
      const count = this.mainMenuContainer.getChildrenCount();
      for (let i = 0; i < count; i++) {
        const c = this.mainMenuContainer.getChild(i);
        if (c.name.toLowerCase().indexOf("subtitle") >= 0) {
          this.menuSubtitleObject = c;
          break;
        }
      }
    }

    // Apply Apple Vision Pro frosted glass widget cards to Main Menu Title and Subtitle
    this.setupTextGlassCard(this.menuTitleObject, 26.0, 4.6);
    this.setupTextGlassCard(this.menuSubtitleObject, 25.0, 3.0);

    // Load flat Plane mesh, transparent icon material, and menu icon
    try {
      this.getOrCreatePlaneMesh();
      if (!this.iconMaterial) this.iconMaterial = requireAsset("../Materials/IconMaterial.mat") as Material;
      if (!this.menuIconTex) this.menuIconTex = requireAsset("../Icons/menu.png") as Texture;
    } catch (e) {
      console.log(`[MainMenuController] Icon asset load note: ${e}`);
    }

    // Update Four-in-Hand card text so it's clean and accurate
    if (this.fourInHandCardButton && this.fourInHandCardButton.getChildrenCount() > 0) {
      const child = this.fourInHandCardButton.getChild(0);
      const textComp = child ? (child.getComponent("Component.Text3D") as any) : null;
      if (textComp) {
        textComp.text = "Four-in-Hand\n\nNecktie  |  Level: Easy\n\nThe classic necktie knot.\nExploded view with layer gaps.\n\n[ Pinch to Learn ]";
      }
    }

    // SIK Hand Interaction bindings & squircle styling for tutorial cards
    this.setupMenuCard(this.overhandCardButton, () => {
      console.log("[MainMenuController] Overhand Knot selected.");
      this.launchKnotTutorial("overhand");
    });

    this.setupMenuCard(this.bowlineCardButton, () => {
      console.log("[MainMenuController] Bowline Knot selected.");
      this.launchKnotTutorial("bowline");
    });

    this.setupMenuCard(this.fourInHandCardButton, () => {
      console.log("[MainMenuController] Four-in-Hand selected.");
      this.launchKnotTutorial("four-in-hand");
    });

    // Create Category Cards (Level 1: Knots vs Ties)
    this.knotsCategoryCard = this.createCategoryCard(
      "Card_Knots",
      "Knots",
      "Ropework & Utility",
      "Overhand & Bowline Knots.\nHands-free 3D spatial tutorials.",
      -8.5,
      () => {
        console.log("[MainMenuController] Knots Category clicked.");
        this.showKnotsMenu();
      }
    );

    this.tiesCategoryCard = this.createCategoryCard(
      "Card_Ties",
      "Ties",
      "Formalwear & Fashion",
      "Four-in-Hand Necktie.\nExploded layered 3D tutorial.",
      8.5,
      () => {
        console.log("[MainMenuController] Ties Category clicked.");
        this.showTiesMenu();
      }
    );

    // Create Sub-Menu Back Button (returns from Knots or Ties sub-menu to Categories)
    this.categoryBackButton = this.createCategoryBackButton(() => {
      console.log("[MainMenuController] Category Back clicked.");
      this.showCategoriesMenu();
    });

    // Tutorial top-left Menu button: returns to Knots or Ties menu respectively!
    this.setupInteractable(this.backToMenuButton, () => {
      console.log(`[MainMenuController] Returning from tutorial to ${this.lastSelectedCategory} menu.`);
      if (this.lastSelectedCategory === "ties") {
        this.showTiesMenu();
      } else {
        this.showKnotsMenu();
      }
    });

    // Attach flat 2D single-sided Plane icon for Menu button (3 horizontal lines hamburger icon)
    this.setupButtonIcon(this.backToMenuButton, this.menuIconTex, 0.14);

    // Desktop Preview Tap Fallback - Exact projected screen regions
    const handleTap = (pos: vec2) => {
      const cam = this.getCamera();

      // If in Main Menu
      if (this.mainMenuContainer && this.mainMenuContainer.enabled) {
        if (this.currentMenuState === "categories") {
          if (this.isTapOnButton(cam, this.knotsCategoryCard, pos, { minX: 0.28, maxX: 0.50, minY: 0.35, maxY: 0.70 })) {
            this.bounce(this.knotsCategoryCard!);
            this.showKnotsMenu();
            return;
          }
          if (this.isTapOnButton(cam, this.tiesCategoryCard, pos, { minX: 0.50, maxX: 0.72, minY: 0.35, maxY: 0.70 })) {
            this.bounce(this.tiesCategoryCard!);
            this.showTiesMenu();
            return;
          }
        } else if (this.currentMenuState === "knots") {
          if (this.isTapOnButton(cam, this.categoryBackButton, pos, { minX: 0.04, maxX: 0.25, minY: 0.15, maxY: 0.35 })) {
            this.bounce(this.categoryBackButton!);
            this.showCategoriesMenu();
            return;
          }
          if (this.isTapOnButton(cam, this.overhandCardButton, pos, { minX: 0.28, maxX: 0.50, minY: 0.35, maxY: 0.70 })) {
            this.bounce(this.overhandCardButton!);
            this.launchKnotTutorial("overhand");
            return;
          }
          if (this.isTapOnButton(cam, this.bowlineCardButton, pos, { minX: 0.50, maxX: 0.72, minY: 0.35, maxY: 0.70 })) {
            this.bounce(this.bowlineCardButton!);
            this.launchKnotTutorial("bowline");
            return;
          }
        } else if (this.currentMenuState === "ties") {
          if (this.isTapOnButton(cam, this.categoryBackButton, pos, { minX: 0.04, maxX: 0.25, minY: 0.15, maxY: 0.35 })) {
            this.bounce(this.categoryBackButton!);
            this.showCategoriesMenu();
            return;
          }
          if (this.isTapOnButton(cam, this.fourInHandCardButton, pos, { minX: 0.40, maxX: 0.60, minY: 0.35, maxY: 0.70 })) {
            this.bounce(this.fourInHandCardButton!);
            this.launchKnotTutorial("four-in-hand");
            return;
          }
        }
      } else if (this.tutorialContainer && this.tutorialContainer.enabled) {
        // Back to Menu button in tutorial -> goes to Knots or Ties menu respectively
        if (this.isTapOnButton(cam, this.backToMenuButton, pos, { minX: 0.04, maxX: 0.25, minY: 0.15, maxY: 0.35 })) {
          this.bounce(this.backToMenuButton!);
          if (this.lastSelectedCategory === "ties") {
            this.showTiesMenu();
          } else {
            this.showKnotsMenu();
          }
          return;
        }

        // Delegate to stepController for bottom controls (Restart, Prev, Replay, Next, Turn)
        if (this.stepController) {
          const handled = this.stepController.handleScreenTap(cam, pos);
          if (handled) return;
        }
      }
    };

    this.createEvent("TapEvent").bind((event) => {
      handleTap(event.getTapPosition());
    });

    // Keyboard controls for rapid testing and navigation
    this.createEvent("KeyPressEvent").bind((event) => {
      const k = event.key;
      if (this.mainMenuContainer && this.mainMenuContainer.enabled) {
        if (this.currentMenuState === "categories") {
          if (k === Keys.One) {
            this.showKnotsMenu();
          } else if (k === Keys.Two) {
            this.showTiesMenu();
          }
        } else if (this.currentMenuState === "knots") {
          if (k === Keys.One) {
            this.launchKnotTutorial("overhand");
          } else if (k === Keys.Two) {
            this.launchKnotTutorial("bowline");
          } else if (k === Keys.Backspace || k === Keys.M) {
            this.showCategoriesMenu();
          }
        } else if (this.currentMenuState === "ties") {
          if (k === Keys.One || k === Keys.Three) {
            this.launchKnotTutorial("four-in-hand");
          } else if (k === Keys.Backspace || k === Keys.M) {
            this.showCategoriesMenu();
          }
        }
      } else if (this.tutorialContainer && this.tutorialContainer.enabled) {
        if (k === Keys.M) {
          if (this.lastSelectedCategory === "ties") {
            this.showTiesMenu();
          } else {
            this.showKnotsMenu();
          }
        } else if (k === Keys.One) {
          this.launchKnotTutorial("overhand");
        } else if (k === Keys.Two) {
          this.launchKnotTutorial("bowline");
        } else if (k === Keys.Three) {
          this.launchKnotTutorial("four-in-hand");
        } else if (this.stepController) {
          if (k === Keys.N || k === Keys.Right) {
            this.stepController.triggerVoiceFeedback("Next", this.stepController.nextButton);
            this.stepController.onNextPressed();
          } else if (k === Keys.P || k === Keys.Left) {
            this.stepController.triggerVoiceFeedback("Previous", this.stepController.prevButton);
            this.stepController.onPrevPressed();
          } else if (k === Keys.R) {
            this.stepController.triggerVoiceFeedback("Replay", this.stepController.replayButton);
            this.stepController.onReplayPressed();
          } else if (k === Keys.T) {
            this.stepController.triggerVoiceFeedback("Turn 360", this.stepController.turnButton);
            this.stepController.onTurnPressed();
          } else if (k === Keys.Space) {
            this.stepController.triggerVoiceFeedback("Restart", this.stepController.startOverButton);
            this.stepController.onStartOverPressed();
          } else if (k === Keys.K) {
            this.stepController.onPausePressed();
          } else if (k === Keys.J) {
            this.stepController.onScrub(-0.05);
          } else if (k === Keys.L) {
            this.stepController.onScrub(0.05);
          }
        }
      }
    });

    if (this.stepController) {
      (this.stepController as any).mainMenuController = this;
    }

    this.showCategoriesMenu();
    console.log("[MainMenuController] Main Menu Initialized with Categories hierarchy.");
  }

  private setMenuHeader(title: string, subtitle: string, titleWidth: number = 26.0, subtitleWidth: number = 25.0): void {
    if (this.menuTitleObject) {
      const textComp = (this.menuTitleObject.getComponent("Component.Text3D") as any) ||
                        (this.menuTitleObject.getComponent("Component.Text") as any);
      if (textComp) {
        textComp.text = title;
      }
      this.setupTextGlassCard(this.menuTitleObject, titleWidth, 4.6);
    }
    if (this.menuSubtitleObject) {
      const textComp = (this.menuSubtitleObject.getComponent("Component.Text3D") as any) ||
                        (this.menuSubtitleObject.getComponent("Component.Text") as any);
      if (textComp) {
        textComp.text = subtitle;
      }
      this.setupTextGlassCard(this.menuSubtitleObject, subtitleWidth, 3.0);
    }
  }

  public showCategoriesMenu(): void {
    this.currentMenuState = "categories";
    if (this.mainMenuContainer) this.mainMenuContainer.enabled = true;
    if (this.tutorialContainer) this.tutorialContainer.enabled = false;

    this.setMenuHeader("Knot Master AR", "Choose a Category", 26.0, 22.0);

    if (this.knotsCategoryCard) this.knotsCategoryCard.enabled = true;
    if (this.tiesCategoryCard) this.tiesCategoryCard.enabled = true;
    if (this.overhandCardButton) this.overhandCardButton.enabled = false;
    if (this.bowlineCardButton) this.bowlineCardButton.enabled = false;
    if (this.fourInHandCardButton) this.fourInHandCardButton.enabled = false;
    if (this.categoryBackButton) this.categoryBackButton.enabled = false;
  }

  public showKnotsMenu(): void {
    this.currentMenuState = "knots";
    if (this.mainMenuContainer) this.mainMenuContainer.enabled = true;
    if (this.tutorialContainer) this.tutorialContainer.enabled = false;

    this.setMenuHeader("Knots", "Choose a Knot Tutorial", 16.0, 22.0);

    if (this.knotsCategoryCard) this.knotsCategoryCard.enabled = false;
    if (this.tiesCategoryCard) this.tiesCategoryCard.enabled = false;
    if (this.overhandCardButton) {
      this.overhandCardButton.enabled = true;
      this.overhandCardButton.getTransform().setLocalPosition(new vec3(-8.5, -2.0, -60.0));
    }
    if (this.bowlineCardButton) {
      this.bowlineCardButton.enabled = true;
      this.bowlineCardButton.getTransform().setLocalPosition(new vec3(8.5, -2.0, -60.0));
    }
    if (this.fourInHandCardButton) this.fourInHandCardButton.enabled = false;
    if (this.categoryBackButton) this.categoryBackButton.enabled = true;
  }

  public showTiesMenu(): void {
    this.currentMenuState = "ties";
    if (this.mainMenuContainer) this.mainMenuContainer.enabled = true;
    if (this.tutorialContainer) this.tutorialContainer.enabled = false;

    this.setMenuHeader("Ties", "Choose a Necktie Tutorial", 16.0, 24.0);

    if (this.knotsCategoryCard) this.knotsCategoryCard.enabled = false;
    if (this.tiesCategoryCard) this.tiesCategoryCard.enabled = false;
    if (this.overhandCardButton) this.overhandCardButton.enabled = false;
    if (this.bowlineCardButton) this.bowlineCardButton.enabled = false;
    if (this.fourInHandCardButton) {
      this.fourInHandCardButton.enabled = true;
      this.fourInHandCardButton.getTransform().setLocalPosition(new vec3(0.0, -2.0, -60.0));
    }
    if (this.categoryBackButton) this.categoryBackButton.enabled = true;
  }

  public showMainMenu(): void {
    this.showCategoriesMenu();
  }

  public launchKnotTutorial(knotId: string): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.enabled = false;
    }
    if (this.tutorialContainer) {
      this.tutorialContainer.enabled = true;
    }

    if (knotId === "overhand" || knotId === "bowline") {
      this.lastSelectedCategory = "knots";
    } else if (knotId === "four-in-hand") {
      this.lastSelectedCategory = "ties";
    }

    if (knotId === "overhand") {
      if (this.knotRopeObject) this.knotRopeObject.enabled = true;
      if (this.fourInHandObject) this.fourInHandObject.enabled = false;
      if (this.bowlineRopeObject) this.bowlineRopeObject.enabled = false;
      if (this.stepController && this.knotTutorial) {
        this.stepController.setActiveTutorial(this.knotTutorial);
      }
      if (this.knotTutorial) this.knotTutorial.startOver();
    } else if (knotId === "bowline") {
      if (this.knotRopeObject) this.knotRopeObject.enabled = false;
      if (this.fourInHandObject) this.fourInHandObject.enabled = false;
      if (this.bowlineRopeObject) this.bowlineRopeObject.enabled = true;
      if (this.stepController && this.bowlineTutorial) {
        this.stepController.setActiveTutorial(this.bowlineTutorial);
      }
      if (this.bowlineTutorial) this.bowlineTutorial.startOver();
    } else if (knotId === "four-in-hand") {
      if (this.knotRopeObject) this.knotRopeObject.enabled = false;
      if (this.fourInHandObject) this.fourInHandObject.enabled = true;
      if (this.bowlineRopeObject) this.bowlineRopeObject.enabled = false;
      if (this.stepController && this.fourInHandTutorial) {
        this.stepController.setActiveTutorial(this.fourInHandTutorial);
      }
      if (this.fourInHandTutorial) this.fourInHandTutorial.startOver();
    }
  }

  private createCategoryCard(
    name: string,
    title: string,
    subtitle: string,
    desc: string,
    xPos: number,
    onClick: () => void
  ): SceneObject {
    const cardObj = global.scene.createSceneObject(name);
    cardObj.setParent(this.mainMenuContainer);

    const trans = cardObj.getTransform();
    trans.setLocalPosition(new vec3(xPos, -2.0, -60.0));
    trans.setLocalScale(new vec3(14.5, 16.5, 1.0));
    trans.setLocalRotation(quat.quatIdentity());

    let rmv = cardObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const cardMesh = this.getOrCreateMenuCardMesh();
    if (cardMesh) rmv.mesh = cardMesh;

    if (this.overhandCardButton) {
      const srcRmv = this.overhandCardButton.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (srcRmv && srcRmv.mainMaterial) {
        rmv.mainMaterial = srcRmv.mainMaterial.clone();
      }
    }

    const textObj = global.scene.createSceneObject(name + "_Text");
    textObj.setParent(cardObj);
    const textTrans = textObj.getTransform();
    textTrans.setLocalPosition(new vec3(0.0, 0.0, 1.2));
    textTrans.setLocalScale(new vec3(0.052, 0.052, 1.0));
    textTrans.setLocalRotation(quat.quatIdentity());

    const textComp = textObj.createComponent("Component.Text3D") as any;
    textComp.text = `${title}\n\n${subtitle}\n\n${desc}\n\n[ Pinch to Explore ]`;
    textComp.horizontalAlignment = HorizontalAlignment.Center;
    textComp.verticalAlignment = VerticalAlignment.Center;
    textComp.fontSize = 42.0;
    textComp.extrusionDepth = 0.00;

    if (this.overhandCardButton && this.overhandCardButton.getChildrenCount() > 0) {
      const srcText = this.overhandCardButton.getChild(0).getComponent("Component.Text3D") as any;
      if (srcText && srcText.mainMaterial) {
        textComp.mainMaterial = srcText.mainMaterial.clone();
      }
    }

    this.setupMenuCard(cardObj, onClick);
    return cardObj;
  }

  private createCategoryBackButton(onClick: () => void): SceneObject {
    const btnObj = global.scene.createSceneObject("CategoryBackButton");
    btnObj.setParent(this.mainMenuContainer);

    const trans = btnObj.getTransform();
    trans.setLocalPosition(new vec3(-11.5, 13.0, -60.0));
    trans.setLocalScale(new vec3(5.0, 2.4, 1.2));
    trans.setLocalRotation(quat.quatIdentity());

    let rmv = btnObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const btnMesh = this.getOrCreateRoundedButtonMesh();
    if (btnMesh) rmv.mesh = btnMesh;

    if (this.backToMenuButton) {
      const srcRmv = this.backToMenuButton.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      if (srcRmv && srcRmv.mainMaterial) {
        rmv.mainMaterial = srcRmv.mainMaterial.clone();
      }
    }

    const labelObj = global.scene.createSceneObject("CategoryBackLabel");
    labelObj.setParent(btnObj);
    const labelTrans = labelObj.getTransform();
    // Match the exact local scale and position of BackToMenuButton Label!
    labelTrans.setLocalPosition(new vec3(0.14, 0.0, 0.65));
    labelTrans.setLocalScale(new vec3(0.20, 0.416667, 0.833333));
    labelTrans.setLocalRotation(quat.quatIdentity());

    const textComp = labelObj.createComponent("Component.Text3D") as any;
    textComp.text = "Back";
    textComp.horizontalAlignment = HorizontalAlignment.Center;
    textComp.verticalAlignment = VerticalAlignment.Center;
    textComp.fontSize = 41.0;
    textComp.extrusionDepth = 0.00;

    if (this.backToMenuButton && this.backToMenuButton.getChildrenCount() > 0) {
      const srcLabel = this.backToMenuButton.getChild(0);
      const srcText = srcLabel ? (srcLabel.getComponent("Component.Text3D") as any) : null;
      if (srcText) {
        if (srcText.font) textComp.font = srcText.font;
        if (srcText.mainMaterial) {
          textComp.mainMaterial = srcText.mainMaterial.clone();
        }
      }
    }

    this.setupButtonIcon(btnObj, this.menuIconTex, 0.14, 41);
    this.setupInteractable(btnObj, onClick);
    return btnObj;
  }

  private setupInteractable(btn?: SceneObject, onClick?: () => void): void {
    if (!btn || !onClick) return;

    // Apply smooth rounded squircle button mesh & frosted glass styling
    const rmv = btn.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
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

    let col = btn.getComponent("Component.ColliderComponent") as ColliderComponent;
    if (!col) col = btn.createComponent("Component.ColliderComponent") as ColliderComponent;

    try {
      const anyObj = btn as any;
      let interactable = anyObj.getComponent(Interactable.getTypeName()) as Interactable;
      if (!interactable) {
        interactable = btn.createComponent(Interactable.getTypeName()) as Interactable;
      }
      if (interactable && interactable.onTriggerEnd) {
        this.createEvent("OnStartEvent").bind(() => {
          interactable.onTriggerEnd.add(() => {
            this.bounce(btn);
            onClick();
          });
        });
      }
    } catch (e) {
      console.log(`[MainMenuController] SIK interactable bind note: ${e}`);
    }
  }

  private bounce(obj: SceneObject): void {
    const trans = obj.getTransform();
    const orig = trans.getLocalScale();
    trans.setLocalScale(orig.uniformScale(0.88));

    // Tactile glass glow on press
    const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
      rmv.mainMaterial.mainPass.baseColor = new vec4(0.24, 0.28, 0.36, 0.85);
    }

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      trans.setLocalScale(orig);
      if (rmv && rmv.mainMaterial && rmv.mainMaterial.mainPass) {
        rmv.mainMaterial.mainPass.baseColor = new vec4(0.10, 0.12, 0.15, 0.62);
      }
    });
    delay.reset(0.12);
  }

  private setupMenuCard(card?: SceneObject, onClick?: () => void): void {
    if (!card || !onClick) return;

    const rmv = card.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rmv) {
      const cardMesh = this.getOrCreateMenuCardMesh();
      if (cardMesh) {
        rmv.mesh = cardMesh;
      }
      if (rmv.mainMaterial) {
        const pass = rmv.mainMaterial.mainPass;
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
      }
    }

    // Refine child CardText typography
    const count = card.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const child = card.getChild(i);
      const textComp = child.getComponent("Component.Text3D") as any;
      if (textComp) {
        if (typeof textComp.extrusionDepth !== "undefined") {
          textComp.extrusionDepth = 0.00;
        textComp.fontSize = 42.0;
        }
      }
    }

    let col = card.getComponent("Component.ColliderComponent") as ColliderComponent;
    if (!col) col = card.createComponent("Component.ColliderComponent") as ColliderComponent;

    try {
      const anyObj = card as any;
      let interactable = anyObj.getComponent(Interactable.getTypeName()) as Interactable;
      if (!interactable) {
        interactable = card.createComponent(Interactable.getTypeName()) as Interactable;
      }
      if (interactable && interactable.onTriggerEnd) {
        this.createEvent("OnStartEvent").bind(() => {
          interactable.onTriggerEnd.add(() => {
            this.bounce(card);
            onClick();
          });
        });
      }
    } catch (e) {
      console.log(`[MainMenuController] SIK card interactable bind note: ${e}`);
    }
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
      console.log(`[MainMenuController] Quad mesh fallback note: ${e}`);
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
      const rx = 0.14;
      const ry = 0.25;
      const cx = 0.5 - rx;
      const cy = 0.5 - ry;

      const bx = 0.03;
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
        indices.push(1 + i, M + 1 + i, M + 1 + next,  1 + i, M + 1 + next, 1 + next);
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
      this.roundedButtonMesh = b.getMesh();
      return this.roundedButtonMesh;
    } catch (e) {
      console.log(`[MainMenuController] Rounded button mesh error: ${e}`);
    }
    return null;
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

    const iconTrans = iconObj.getTransform();
    iconTrans.setLocalPosition(new vec3(-0.25, 0.0, 0.65));
    iconTrans.setLocalScale(new vec3(0.26, 0.54, 1.0));
    iconTrans.setLocalRotation(quat.quatIdentity());

    let iconRmv = iconObj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (!iconRmv) {
      iconRmv = iconObj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    }

    const mesh = this.getOrCreatePlaneMesh();
    if (mesh) {
      iconRmv.mesh = mesh;
    }

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
          if (textComp.text) {
            textComp.text = textComp.text.replace(/[←<]\s*/g, "").trim();
          }
        }
      } else {
        const textComp = labelObj.getComponent("Component.Text3D") as any;
        if (textComp && textComp.text) {
          textComp.text = textComp.text.replace(/[←<]\s*/g, "").trim();
        }
      }
    }
  }

  private menuCardMesh: RenderMesh | null = null;

  private getOrCreateMenuCardMesh(): RenderMesh | null {
    if (this.menuCardMesh) return this.menuCardMesh;

    try {
      const b = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
      ]);
      b.topology = MeshTopology.Triangles;
      b.indexType = MeshIndexType.UInt16;

      const rx = 0.095;
      const ry = 0.083;
      const cx = 0.5 - rx;
      const cy = 0.5 - ry;

      const bx = 0.02;
      const by = 0.0175;

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
        indices.push(1 + i, M + 1 + i, M + 1 + next,  1 + i, M + 1 + next, 1 + next);
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
      this.menuCardMesh = b.getMesh();
      return this.menuCardMesh;
    } catch (e) {
      console.log(`[MainMenuController] Menu card mesh error: ${e}`);
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
        indices.push(1 + i, M + 1 + i, M + 1 + next,  1 + i, M + 1 + next, 1 + next);
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
      console.log(`[MainMenuController] HUD card mesh error: ${e}`);
    }
    return null;
  }

  private setupTextGlassCard(textObj?: SceneObject, cardWidth: number = 26.0, cardHeight: number = 4.6): void {
    if (!textObj) return;

    const textComp = textObj.getComponent("Component.Text3D") as any;
    if (textComp) {
      if (typeof textComp.extrusionDepth !== "undefined") {
        textComp.extrusionDepth = 0.08;
      }
    }

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
    plateTrans.setLocalScale(new vec3(cardWidth, cardHeight, 0.6));
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
}
