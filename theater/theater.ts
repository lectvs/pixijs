/// <reference path="./transition.ts"/>
/// <reference path="../world/world.ts"/>

namespace Theater {
    export type Config = {
        stageToLoad: () => World;
        dialogBox: Factory<DialogBox>;
        autoPlayScript?: () => IterableIterator<any>;
    }
}

class Theater extends World {
    dialogBox: DialogBox;
    
    cutsceneManager: CutsceneManager;
    stageManager: StageManager;
    slideManager: SlideManager;

    get currentWorld() { return this.stageManager ? this.stageManager.currentWorld : undefined; }
    get isCutscenePlaying() { return this.cutsceneManager ? this.cutsceneManager.isCutscenePlaying : false; }
    get slides() { return this.slideManager ? this.slideManager.slides : []; }

    endOfFrameQueue: (() => any)[];

    isSkippingCutscene: boolean;
    
    constructor(config: Theater.Config) {
        super({
            layers: [
                { name: Theater.LAYER_WORLD },
                { name: Theater.LAYER_TRANSITION },
                { name: Theater.LAYER_SLIDES },
                { name: Theater.LAYER_DIALOG },
            ]
        });

        this.loadDialogBox(config.dialogBox);

        this.cutsceneManager = new CutsceneManager(this);
        this.stageManager = new StageManager(this);
        this.slideManager = new SlideManager(this);

        this.endOfFrameQueue = [];

        this.isSkippingCutscene = false;

        this.loadStage(config.stageToLoad, new Transitions.Instant());

        if (Debug.AUTOPLAY && config.autoPlayScript) {
            this.runScript(config.autoPlayScript);
        }
    }

    update() {
        this.cutsceneManager.update();

        super.update();
        while (!_.isEmpty(this.endOfFrameQueue)) {
            this.endOfFrameQueue.shift()();
        }
    }

    addSlide(slide: Slide) {
        return this.slideManager.addSlide(slide);
    }

    clearSlides(exceptLast: number = 0) {
        this.slideManager.clearSlides(exceptLast);
    }

    loadStage(stage: () => World, transition: Transition = new Transitions.Instant()) {
        this.runAtEndOfFrame(() => this.stageManager.internalLoadStage(stage, transition));
    }

    playCutscene(cutscene: Cutscene) {
        this.cutsceneManager.playCutscene(cutscene);
    }

    playCutsceneIfNotSeen(cutscene: Cutscene) {
        this.cutsceneManager.playCutsceneIfNotSeen(cutscene);
    }

    runAtEndOfFrame(fn: () => any) {
        this.endOfFrameQueue.push(fn);
    }

    // Rapidly update theater until cutscene is completed.
    skipCurrentCutscene() {
        if (this.cutsceneManager.canSkipCurrentCutscene()) {
            let currentCutscene = this.cutsceneManager.current;
            let cutsceneFinished = () => !this.cutsceneManager.current || this.cutsceneManager.current !== currentCutscene;

            this.isSkippingCutscene = true;
            let iters = 0;
            while (iters < Theater.SKIP_CUTSCENE_MAX_FRAMES && !cutsceneFinished()) {
                this.update();
                iters++;
            }
            this.isSkippingCutscene = false;

            if (iters >= Theater.SKIP_CUTSCENE_MAX_FRAMES) {
                error('Cutscene skip exceeded max frames!');
            }
        }
    }

    onStageLoad() {
        this.cutsceneManager.onStageLoad();
    }
    
    private loadDialogBox(factory: Factory<DialogBox>) {
        this.dialogBox = this.addWorldObject(factory());
        this.dialogBox.setVisible(false);
        World.Actions.setLayer(this.dialogBox, Theater.LAYER_DIALOG);
    }

    static readonly LAYER_WORLD = 'world';
    static readonly LAYER_TRANSITION = 'transition';
    static readonly LAYER_SLIDES = 'slides';
    static readonly LAYER_DIALOG = 'dialog';

    static readonly SKIP_CUTSCENE_DELTA = 0.1;
    static readonly SKIP_CUTSCENE_MAX_FRAMES = 10000;
}

namespace Theater {
    export class WorldAsWorldObject extends WorldObject {
        containedWorld: World;

        constructor(containedWorld: World) {
            super();
            this.containedWorld = containedWorld;
        }

        update() {
            super.update();
            this.containedWorld.update();
        }

        render(texture: Texture, x: number, y: number) {
            this.containedWorld.render(texture);
            super.render(texture, x, y);
        }
    }
}