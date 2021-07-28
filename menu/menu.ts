/// <reference path="../world/world.ts" />

namespace Menu {
    export type MenuClass = new (menuSystem: MenuSystem) => Menu;
}

class Menu extends World {
    menuSystem: MenuSystem;

    constructor(menuSystem: MenuSystem, config: World.Config = {}) {
        super(config);
        this.menuSystem = menuSystem;
    }
}

class MetricsMenu extends Menu {
    private plot: MetricsPlot.Plot;

    constructor(menuSystem: MenuSystem) {
        super(menuSystem);

        this.backgroundColor = 0x000000;

        this.plot = global.metrics.plotLastRecording();
        
        let plotSprite = this.addWorldObject(new Sprite());
        plotSprite.setTexture(this.plot.texture);

        this.addWorldObject(new SpriteText({
            x: 0, y: global.gameHeight,
            name: 'graphxy',
            font: Debug.FONT,
            style: { color: 0x00FF00 },
            anchor: Vector2.BOTTOM_LEFT,
        }));
    }

    update() {
        super.update();

        if (Input.justDown(Input.GAME_CLOSE_MENU)) {
            Input.consume(Input.GAME_CLOSE_MENU);
            this.menuSystem.game.unpauseGame();
        }

        this.select.name<SpriteText>('graphxy')
                .setText(`${this.getPlotY().toFixed(2)} ms`);
    }

    private getPlotX() {
        return this.plot.graphBounds.left + Input.mouseX / global.gameWidth * (this.plot.graphBounds.right - this.plot.graphBounds.left);
    }

    private getPlotY() {
        return this.plot.graphBounds.bottom + (1 - Input.mouseY / global.gameHeight) * (this.plot.graphBounds.top - this.plot.graphBounds.bottom);
    }
}