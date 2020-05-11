/// <reference path="./worldObject.ts" />

namespace PhysicsWorldObject {
    export type Config = WorldObject.Config & {
        vx?: number;
        vy?: number;
        mass?: number;
        gravity?: Pt;
        bounce?: number;
        bounds?: Rect;
        immovable?: boolean;
        colliding?: boolean;

        debugBounds?: boolean;
        startSimulating?: boolean;
    }
}

class PhysicsWorldObject extends WorldObject {
    vx: number;
    vy: number;
    mass: number;
    gravity: Pt;
    bounce: number;
    bounds: Rect;
    immovable: boolean;
    colliding: boolean;

    debugBounds: boolean;
    simulating: boolean;

    // Used to store the position before simulated movement
    preMovementX: number;
    preMovementY: number;

    constructor(config: PhysicsWorldObject.Config, defaults?: PhysicsWorldObject.Config) {
        config = WorldObject.resolveConfig<PhysicsWorldObject.Config>(config, defaults);
        super(config);
        this.vx = O.getOrDefault(config.vx, 0);
        this.vy = O.getOrDefault(config.vy, 0);
        this.mass = O.getOrDefault(config.mass, 1);
        this.gravity = config.gravity || { x: 0, y: 0 };
        this.bounce = O.getOrDefault(config.bounce, 0);
        this.bounds = config.bounds || { x: 0, y: 0, width: 0, height: 0 };
        this.immovable = O.getOrDefault(config.immovable, false);
        this.colliding = O.getOrDefault(config.colliding, true);

        this.debugBounds = O.getOrDefault(config.debugBounds, false);
        this.simulating = O.getOrDefault(config.startSimulating, true);

        this.preMovementX = this.x;
        this.preMovementY = this.y;
    }

    update(delta: number) {
        super.update(delta);
        if (this.simulating) {
            this.simulate(delta);
        }
    }

    render(screen: Texture) {
        if (Debug.ALL_PHYSICS_BOUNDS || this.debugBounds) {
            let worldBounds = this.getWorldBounds();
            Draw.brush.color = 0x00FF00;
            Draw.brush.alpha = 1;
            Draw.rectangleOutline(screen, worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height);
        }
        super.render(screen);
    }

    onCollide(other: PhysicsWorldObject) {

    }

    applyGravity(delta: number) {
        this.vx += this.gravity.x * delta;
        this.vy += this.gravity.y * delta;
    }

    isOverlapping(other: PhysicsWorldObject) {
        this.bounds.x += this.x;
        this.bounds.y += this.y;
        other.bounds.x += other.x;
        other.bounds.y += other.y;
        let result = G.overlapRectangles(this.bounds, other.bounds);
        this.bounds.x -= this.x;
        this.bounds.y -= this.y;
        other.bounds.x -= other.x;
        other.bounds.y -= other.y;
        return result;
    }

    isOverlappingRect(rect: Rect) {
        this.bounds.x += this.x;
        this.bounds.y += this.y;
        let result = G.overlapRectangles(this.bounds, rect);
        this.bounds.x -= this.x;
        this.bounds.y -= this.y;
        return result;
    }

    getWorldBounds(newX: number = this.x, newY: number = this.y) {
        return new Rectangle(newX + this.bounds.x, newY + this.bounds.y, this.bounds.width, this.bounds.height);
    }

    move(delta: number) {
        this.preMovementX = this.x;
        this.preMovementY = this.y;
        this.x += this.vx * delta;
        this.y += this.vy * delta;
    }

    simulate(delta: number) {
        this.applyGravity(delta);
        this.move(delta);
    }
}