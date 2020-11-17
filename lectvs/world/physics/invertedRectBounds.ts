class InvertedRectBounds implements Bounds {
    parent: Bounds.Parent;

    x: number;
    y: number;
    width: number;
    height: number;

    private boundingBox: Rectangle;

    constructor(x: number, y: number, width: number, height: number, parent?: Bounds.Parent) {
        this.parent = parent;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.boundingBox = new Rectangle(0, 0, 0, 0);
    }

    clone(): RectBounds {
        return new RectBounds(this.x, this.y, this.width, this.height, this.parent);
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
        if (other instanceof RectBounds) return Bounds.Collision.invertDisplacementCollision(Bounds.Collision.getDisplacementCollisionRectInvertedRect(other, this));
        if (other instanceof CircleBounds) return Bounds.Collision.invertDisplacementCollision(Bounds.Collision.getDisplacementCollisionCircleInvertedRect(other, this));
        if (other instanceof NullBounds) return undefined;
        error("No collision supported between these bounds", this, other);
        return undefined;
    }

    getRaycastCollision(dx: number, dy: number, other: Bounds, otherdx: number, otherdy: number): Bounds.RaycastCollision {
        if (other instanceof RectBounds) return Bounds.Collision.invertRaycastCollision(Bounds.Collision.getRaycastCollisionRectInvertedRect(other, otherdx, otherdy, this, dx, dy));
        if (other instanceof CircleBounds) return Bounds.Collision.invertRaycastCollision(Bounds.Collision.getRaycastCollisionCircleInvertedRect(other, otherdx, otherdy, this, dx, dy));
        if (other instanceof NullBounds) return undefined;
        error("No collision supported between these bounds", this, other);
        return undefined;
    }

    isOverlapping(other: Bounds) {
        if (other instanceof RectBounds) return Bounds.Collision.isOverlappingRectInvertedRect(other, this);
        if (other instanceof CircleBounds) return Bounds.Collision.isOverlappingCircleInvertedRect(other, this);
        if (other instanceof NullBounds) return undefined;
        error("No overlap supported between these bounds", this, other);
        return false;
    }

    raycast(x: number, y: number, dx: number, dy: number) {
        // let box = this.getBoundingBox();

        // let top_t = Infinity;
        // let bottom_t = Infinity;
        // let left_t = Infinity;
        // let right_t = Infinity;

        // if (dy !== 0) {
        //     top_t = (box.top - y) / dy;
        //     if (x + dx*top_t < box.left || x + dx*top_t > box.right) top_t = Infinity;
        //     bottom_t = (box.bottom - y) / dy;
        //     if (x + dx*bottom_t < box.left || x + dx*bottom_t > box.right) bottom_t = Infinity;
        // }

        // if (dx !== 0) {
        //     left_t = (box.left - x) / dx;
        //     if (y + dy*left_t < box.top || y + dy*left_t > box.bottom) left_t = Infinity;
        //     right_t = (box.right - x) / dx;
        //     if (y + dy*right_t < box.top || y + dy*right_t > box.bottom) right_t = Infinity;
        // }

        // let horiz_small_t = Math.min(left_t, right_t);
        // let horiz_large_t = Math.max(left_t, right_t);
        // let horiz_t = horiz_small_t >= 0 ? horiz_small_t : horiz_large_t;

        // let vert_small_t = Math.min(top_t, bottom_t);
        // let vert_large_t = Math.max(top_t, bottom_t);
        // let vert_t = vert_small_t >= 0 ? vert_small_t : vert_large_t;

        // let small_t = Math.min(horiz_t, vert_t);
        // let large_t = Math.max(horiz_t, vert_t);
        // let t = small_t >= 0 ? small_t : large_t;
        // if (t < 0) return Infinity;

        // return t;
        return Infinity;
    }
}