namespace PuffSystem {
    export type PuffConfig = {
        p?: Vector2;
        v: Vector2;
        maxLife: number;
        radius: number;
        color: number;
        alpha?: number;

        finalRadius?: number;
        finalColor?: number;
        finalAlpha?: number;
    }

    export type Puff = {
        x: number;
        y: number;
        vx: number;
        vy: number;
        t: number;
        maxLife: number;
        initialRadius: number;
        finalRadius: number;
        initialColor: number;
        finalColor: number;
        initialAlpha: number;
        finalAlpha: number;
    }
}

class PuffSystem extends WorldObject {
    protected puffs: PuffSystem.Puff[] = [];
    private sprites: PIXI.Sprite[] = [];
    private container: PIXI.Container;

    constructor(config: WorldObject.Config<PuffSystem>) {
        super(config);
        this.container = new PIXI.Container();
    }

    override update() {
        super.update();

        for (let i = this.puffs.length-1; i >= 0; i--) {
            let puff = this.puffs[i];
            puff.x += puff.vx * this.delta;
            puff.y += puff.vy * this.delta;
            
            puff.t += this.delta;
            if (this.puffs[i].t > this.puffs[i].maxLife) {
                this.puffs.splice(i, 1);
            }
        }
    }

    override compile(x: number, y: number): CompileResult {
        let result: CompileResult[] = this.puffs.map((puff, i) => {
            let progress = puff.t / puff.maxLife;

            let radius = M.lerp(progress, puff.initialRadius, puff.finalRadius);
            let color = Color.lerpColorByLch(progress, puff.initialColor, puff.finalColor);
            let alpha = M.lerp(progress, puff.initialAlpha, puff.finalAlpha);

            this.sprites[i].x = x - this.x + puff.x;
            this.sprites[i].y = y - this.y + puff.y;
            this.sprites[i].scale.set(radius/16);
            this.sprites[i].tint = color;
            this.sprites[i].alpha = alpha;

            return this.sprites[i];
        });

        let superCompile = super.compile(x, y);
        if (superCompile) {
            result.push(superCompile);
        }

        diffCompile(this.container, result);

        return this.container;
    }

    protected addPuff(config: PuffSystem.PuffConfig) {
        this.puffs.push({
            x: this.x + (config.p?.x ?? 0),
            y: this.y + (config.p?.y ?? 0),
            vx: config.v.x,
            vy: config.v.y,
            t: 0,
            maxLife: config.maxLife,
            initialRadius: config.radius,
            finalRadius: config.finalRadius ?? config.radius,
            initialColor: config.color,
            finalColor: config.finalColor ?? config.color,
            initialAlpha: config.alpha ?? 1,
            finalAlpha: config.finalAlpha ?? config.alpha ?? 1,
        });

        if (this.sprites.length < this.puffs.length) {
            this.sprites.push(new PIXI.Sprite(PuffSystem.PUFF_TEXTURE.get()));
        }
    }

    private static PUFF_TEXTURE = new LazyValue(() => {
        let texture = newPixiRenderTexture(32, 32, 'PuffSystem.PUFF_TEXTURE');
        let graphics = Graphics.circle(8, 8, 16, { fill: { color: 0xFFFFFF }});
        renderToRenderTexture(graphics, texture);
        graphics.destroy();
        return texture;
    });
}