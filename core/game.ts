namespace Game {
    export type Config = {
        entryPointMenu: Factory<Menu>;
        pauseMenu: Factory<Menu>;
        theaterFactory: Factory<Theater>;
    }
}

class Game {
    menuSystem: MenuSystem;
    theater: Theater;

    private overlay: DebugOverlay;
    private isShowingOverlay: boolean;
    private fpsText: SpriteText;

    allowPauseWithPauseKey: boolean;

    private entryPointMenu: Factory<Menu>;
    private pauseMenu: Factory<Menu>;
    private theaterFactory: Factory<Theater>;

    soundManager: SoundManager;
    musicManager: MusicManager;
    get volume(): number { return Options.volume; };
    get currentMusicKey() { return this.musicManager ? this.musicManager.currentMusicKey : undefined; }

    get delta(): number { return Main.delta; }

    constructor(config: Game.Config) {
        this.entryPointMenu = config.entryPointMenu;
        this.pauseMenu = config.pauseMenu;
        this.theaterFactory = config.theaterFactory;

        this.soundManager = new SoundManager();
        this.musicManager = new MusicManager();

        this.menuSystem = new MenuSystem(this);

        this.overlay = new DebugOverlay();
        this.isShowingOverlay = true;
        this.allowPauseWithPauseKey = true;
        this.fpsText = new SpriteText({
            font: 'smallnumbers',
            style: { color: 0x00FF00 },
            effects: { outline: {} },
            anchor: Vector2.BOTTOM_RIGHT,
            justify: 'right',
        });
    }

    start() {
        this.loadMainMenu();
        if (Debug.SKIP_MAIN_MENU_STAGE) {
            this.startGame(Debug.SKIP_MAIN_MENU_STAGE);
        }
    }

    update() {
        this.updatePause();
        this.updateMetrics();

        if (this.menuSystem.inMenu) {
            global.metrics.startSpan('menu');
            this.menuSystem.update();
            global.metrics.endSpan('menu');
        } else {
            global.metrics.startSpan('theater');
            this.theater.isSkippingCutscene = false;  // Safeguard
            this.theater.update();
            global.metrics.endSpan('theater');
        }

        global.metrics.startSpan('debugOverlay');
        this.updateOverlay();
        global.metrics.endSpan('debugOverlay');

        global.metrics.startSpan('soundManager');
        this.soundManager.volume = this.volume * Options.sfxVolume;
        this.soundManager.update(this.delta);
        this.musicManager.baseVolume = this.volume * Options.musicVolume;
        this.musicManager.update(this.delta);
        global.metrics.endSpan('soundManager');
    }

    private updatePause() {
        if (!this.menuSystem.inMenu && this.allowPauseWithPauseKey && this.theater.canPause && Input.justDown(Input.GAME_PAUSE)) {
            Input.consume(Input.GAME_PAUSE);
            this.pauseGame();
        }
    }

    private updateMetrics() {
        if (Debug.DEBUG && Input.justDown(Input.DEBUG_SHOW_METRICS_MENU)) {
            global.game.menuSystem.loadMenu(() => new MetricsMenu());
        }
    }

    private updateOverlay() {
        if (Input.justDown(Input.DEBUG_TOGGLE_OVERLAY)) {
            this.isShowingOverlay = !this.isShowingOverlay;
        }

        if (this.isShowingOverlay && Debug.SHOW_OVERLAY) {
            this.overlay.setCurrentWorldToDebug(this.menuSystem.inMenu ? this.menuSystem.currentMenu : this.theater?.currentWorld);
            this.overlay.update();
        }
    }

    render(screen: Texture) {
        if (this.menuSystem.inMenu) {
            global.metrics.startSpan('menu');
            this.menuSystem.render(screen);
            global.metrics.endSpan('menu');

        } else {
            global.metrics.startSpan('theater');
            this.theater.render(screen);
            global.metrics.endSpan('theater');
        }

        if (this.isShowingOverlay && Debug.SHOW_OVERLAY) {
            global.metrics.startSpan('debugOverlay');
            this.overlay.render(screen);
            global.metrics.endSpan('debugOverlay');
        }

        // TODO: remove
        if (IS_MOBILE) {
            let fpsText = 'FPS\n' + global.fpsCalculator.fpsAvg.toFixed(0);
            this.fpsText.setText(fpsText);
            this.fpsText.render(screen, global.gameWidth - 1, global.gameHeight - 1);
        }


        if (Debug.SHOW_TOUCHES) {
            this.renderTouches(screen);
        }
    }

    loadMainMenu() {
        this.menuSystem.clear();
        this.menuSystem.loadMenu(this.entryPointMenu);
    }

    loadTheater(stageToLoad: () => World) {
        this.theater = this.theaterFactory();
        this.theater.loadStage(stageToLoad);
    }

    pauseGame() {
        this.menuSystem.loadMenu(this.pauseMenu);
    }

    pauseMusic(fadeTime: number = 0) {
        this.musicManager.pauseMusic(fadeTime);
    }

    playMusic(key: string, fadeTime: number = 0) {
        this.musicManager.playMusic(key, fadeTime);
    }

    playSound(key: string) {
        return this.soundManager.playSound(key);
    }

    startGame(stageToLoad: () => World) {
        this.loadTheater(stageToLoad);
        this.menuSystem.clear();
    }

    stopMusic(fadeTime: number = 0) {
        this.musicManager.stopMusic(fadeTime);
    }

    unpauseGame() {
        this.menuSystem.clear();
    }

    unpauseMusic() {
        this.musicManager.unpauseMusic();
    }

    private renderTouches(screen: Texture) {
        if (IS_MOBILE && Input.isKeyCodeDown(Input.MOUSE_KEYCODES[0])) {
            Draw.brush.color = 0xFF0000;
            Draw.brush.alpha = 1;
            Draw.brush.thickness = 1;
            Draw.circleOutline(screen, Input.mouseX, Input.mouseY, Input.mouseRadius, Draw.ALIGNMENT_INNER);
        }
    }
}