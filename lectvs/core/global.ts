/// <reference path="../metrics/fps.ts"/>
/// <reference path="../metrics/metrics.ts"/>

class global {
    static clearStacks() {
        this.scriptStack = [];
    }

    // Update options

    static get script() { return this.scriptStack[this.scriptStack.length-1]; };
    private static scriptStack: Script[] = [];
    static pushScript(script: Script) { this.scriptStack.push(script); }
    static popScript() { return this.scriptStack.pop(); }

    static get game() { return Main.game; }
    static get theater() { return this.game.theater; }
    static get world() { return this.theater ? this.theater.currentWorld : undefined; }

    static get renderer() { return Main.renderer; }
    static get soundManager() { return Main.soundManager; }
    static metrics: Metrics = new Metrics();
    static fpsCalculator: FPSCalculator = new FPSCalculator(1);

    static gameCodeName: string;
    static gameWidth: number;
    static gameHeight: number;
    static backgroundColor: number;
}