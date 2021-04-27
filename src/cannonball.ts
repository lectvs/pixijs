class Cannonball extends Sprite {
    private readonly DRAG = 200;

    constructor(x: number, y: number, v: Pt) {
        super({
            x: x, y: y,
            texture: 'cannonball',
            layer: 'entities',
            physicsGroup: 'cannonballs',
            bounds: new CircleBounds(0, 0, 4),
            v: v,
            gravityy: 400,
        });
    }

    update() {
        if (this.v.x > 0) this.v.x = Math.max(this.v.x - this.DRAG*this.delta, 0);
        if (this.v.x < 0) this.v.x = Math.min(this.v.x + this.DRAG*this.delta, 0);
        super.update();
    }

    kill(d: Pt = { x: 0, y: 0 }) {
        Puff.puffDirection(this.world, this.x + d.x*5, this.y + d.y*5, 10, { h: -d.x, v: -d.y }, 50, 50);
        this.world.playSound('thwomphit')
        super.kill();
    }

    onCollide(collision: Physics.CollisionInfo) {
        super.onCollide(collision);
        this.kill(V.withMagnitude({ x: collision.self.vx, y: collision.self.vy }, 1));
    }
}