namespace SlopeBounds {
    export type Direction = 'upleft' | 'upright' | 'downleft' | 'downright';
}

class SlopeBounds implements Bounds {
    private parent: PhysicsWorldObject;

    x: number;
    y: number;
    width: number;
    height: number;
    direction: SlopeBounds.Direction;

    private boundingBox: Rectangle;

    constructor(x: number, y: number, width: number, height: number, direction: SlopeBounds.Direction, parent?: PhysicsWorldObject) {
        this.parent = parent;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.direction = direction;
        this.boundingBox = new Rectangle(0, 0, 0, 0);
    }

    clone(): SlopeBounds {
        return new SlopeBounds(this.x, this.y, this.width, this.height, this.direction, this.parent);
    }

    getBoundingBox(x?: number, y?: number) {
        x = x ?? (this.parent ? this.parent.x : 0);
        y = y ?? (this.parent ? this.parent.y : 0);

        this.boundingBox.x = x + this.x;
        this.boundingBox.y = y + this.y;
        this.boundingBox.width = this.width;
        this.boundingBox.height = this.height;
        return this.boundingBox;
    }

    getDisplacementCollision(other: Bounds): Bounds.DisplacementCollision {
        if (other instanceof RectBounds) return Bounds.Collision.getDisplacementCollisionSlopeRect(this, other);
        if (other instanceof CircleBounds) return Bounds.Collision.getDisplacementCollisionSlopeCircle(this, other);
        if (other instanceof NullBounds) return undefined;
        error("No collision supported between these bounds", this, other);
        return undefined;
    }

    getRaycastCollision(dx: number, dy: number, other: Bounds, otherdx: number, otherdy: number): Bounds.RaycastCollision {
        if (other instanceof RectBounds) return Bounds.Collision.getRaycastCollisionSlopeRect(this, dx, dy, other, otherdx, otherdy);
        if (other instanceof CircleBounds) return Bounds.Collision.getRaycastCollisionSlopeCircle(this, dx, dy, other, otherdx, otherdy);
        if (other instanceof NullBounds) return undefined;
        error("No collision supported between these bounds", this, other);
        return undefined;
    }

    isOverlapping(other: Bounds) {
        if (other instanceof RectBounds) return Bounds.Collision.isOverlappingRectSlope(other, this);
        if (other instanceof CircleBounds) return Bounds.Collision.isOverlappingCircleSlope(other, this);
        if (other instanceof NullBounds) return undefined;
        error("No overlap supported between these bounds", this, other);
        return false;
    }

    raycast(x: number, y: number, dx: number, dy: number) {
        let box = this.getBoundingBox();

        let top_t = Infinity;
        let bottom_t = Infinity;
        let left_t = Infinity;
        let right_t = Infinity;

        let slash_t = Infinity;
        let backslash_t = Infinity;

        if (dy !== 0) {
            top_t = (box.top - y) / dy;
            if (x + dx*top_t < box.left || x + dx*top_t > box.right) top_t = Infinity;
            bottom_t = (box.bottom - y) / dy;
            if (x + dx*bottom_t < box.left || x + dx*bottom_t > box.right) bottom_t = Infinity;
        }

        if (dx !== 0) {
            left_t = (box.left - x) / dx;
            if (y + dy*left_t < box.top || y + dy*left_t > box.bottom) left_t = Infinity;
            right_t = (box.right - x) / dx;
            if (y + dy*right_t < box.top || y + dy*right_t > box.bottom) right_t = Infinity;
        }

        if (dx*box.height + dy*box.width !== 0) {
            slash_t = ((box.left - x) * box.height + (box.bottom - y) * box.width) / (dx*box.height + dy*box.width);
            if (x + dx*slash_t < box.left || x + dx*slash_t > box.right) slash_t = Infinity;
        }

        if (dx*box.height - dy*box.width !== 0) {
            backslash_t = ((box.left - x) * box.height - (box.top - y) * box.width) / (dx*box.height - dy*box.width);
            if (x + dx*backslash_t < box.left || x + dx*backslash_t > box.right) backslash_t = Infinity;
        }

        let t1: number, t2: number, t3: number;

        if (this.direction === 'upleft') {
            t1 = right_t;
            t2 = bottom_t;
            t3 = slash_t;
        } else if (this.direction === 'upright') {
            t1 = left_t;
            t2 = bottom_t;
            t3 = backslash_t;
        } else if (this.direction === 'downright') {
            t1 = left_t;
            t2 = top_t;
            t3 = slash_t;
        } else {
            t1 = right_t;
            t2 = top_t;
            t3 = backslash_t;
        }

        let small_t12 = Math.min(t1, t2);
        let large_t12 = Math.max(t1, t2);
        let t12 = small_t12 >= 0 ? small_t12 : large_t12;

        let small_t = Math.min(t12, t3);
        let large_t = Math.max(t12, t3);
        let t = small_t >= 0 ? small_t : large_t;
        if (t < 0) return Infinity;

        return t;
    }
}
