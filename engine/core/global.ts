/// <reference path="../metrics/fps.ts"/>

class global {
    static clearStacks() {
        this.scriptStack.clear();
    }

    // Update options

    static get script() { return this.scriptStack[this.scriptStack.length-1]; };
    private static scriptStack: Script[] = [];
    static pushScript(script: Script) { this.scriptStack.push(script); }
    static popScript() { return this.scriptStack.pop(); }

    static get game() { return Main.game; }
    static get stageManager() { return this.game.stageManager; }
    static get theater() { return this.game.gameTheater; }
    static get world() { return this.stageManager.getCurrentWorld(); }

    static get isSkippingCutscene() { return this.theater.isSkippingCutscene; }

    static get soundManager() { return Main.soundManager; }
    static fpsCalculator: FPSCalculator = new FPSCalculator(1);

    static gameWidth: number;
    static gameHeight: number;
    static backgroundColor: number;
    static upscale: number;
}

Object.defineProperty(window, 'W', {
    get: () => global.gameWidth,
});

Object.defineProperty(window, 'H', {
    get: () => global.gameHeight,
});
