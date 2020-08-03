namespace Physics2 {
    const USE_RAYCAST_DISPLACEMENT_THRESHOLD = 4;

    export type Collision = {
        move: PhysicsWorldObject;
        from: PhysicsWorldObject;
    }

    export type RaycastCollision = Collision & {
        collision: Bounds.RaycastCollision;
    }

    export type DisplacementCollision = Collision & {
        collision: Bounds.DisplacementCollision;
    }

    export function resolveCollisions(world: World) {
        let iter = 0;
        while (iter < world.collisionIterations) {
            iter++;
            debug(`begin iter ${iter}`);

            let collisions = getRaycastCollisions(world)
                                .sort((a,b) => a.collision.t - b.collision.t);

            debug('collisions:', collisions);

            for (let collision of collisions) {
                resolveCollision(world, collision);
            }
            debug(`end iter ${iter}`);
        }
    }

    function resolveCollision(world: World, collision: RaycastCollision) {
        let raycastCollision: RaycastCollision = {
            move: collision.move,
            from: collision.from,
            collision: collision.move.bounds.getRaycastCollision(collision.move.x-collision.move.physicslastx, collision.move.y-collision.move.physicslasty, collision.from.bounds, collision.from.x-collision.from.physicslastx, collision.from.y-collision.from.physicslasty),
        };
        
        if (!raycastCollision.collision) return;

        let displacementCollision: DisplacementCollision = 
            (M.magnitude(raycastCollision.collision.displacementX, raycastCollision.collision.displacementY) <= USE_RAYCAST_DISPLACEMENT_THRESHOLD)
                ? {
                    move: collision.move,
                    from: collision.from,
                    collision: {
                        bounds1: collision.move.bounds,
                        bounds2: collision.from.bounds,
                        displacementX: collision.collision.displacementX,
                        displacementY: collision.collision.displacementY,
                    },
                }
                : {
                    move: collision.move,
                    from: collision.from,
                    collision: collision.move.bounds.getDisplacementCollision(collision.from.bounds),
                };

        if (!displacementCollision || !displacementCollision.collision) return;

        applyDisplacementForCollision(displacementCollision);
        applyMomentumTransferForCollision(world.delta, displacementCollision);
    }

    function getRaycastCollisions(world: World): RaycastCollision[] {
        let raycastCollisions: RaycastCollision[] = [];
        for (let moveGroup in world.collisions) {
            for (let collision of world.collisions[moveGroup]) {
                let fromGroup = collision.collidingPhysicsGroup;
                for (let move of world.physicsGroups[moveGroup].worldObjects) {
                    for (let from of world.physicsGroups[fromGroup].worldObjects) {
                        if (move === from) continue;
                        if (!G.overlapRectangles(move.bounds.getBoundingBox(), from.bounds.getBoundingBox())) continue;
                        raycastCollisions.push({
                            move, from,
                            collision: move.bounds.getRaycastCollision(move.x-move.physicslastx, move.y-move.physicslasty, from.bounds, from.x-from.physicslastx, from.y-from.physicslasty),
                        });
                    }
                }
            }
        }
        return raycastCollisions;
    }

    function applyDisplacementForCollision(collision: Physics2.DisplacementCollision) {
        if (collision.move.immovable && collision.from.immovable) return;

        if (collision.move.immovable) {
            collision.from.x -= collision.collision.displacementX;
            collision.from.y -= collision.collision.displacementY;
            return;
        }

        if (collision.from.immovable) {
            collision.move.x += collision.collision.displacementX;
            collision.move.y += collision.collision.displacementY;
            return;
        }

        let massFactor = (collision.move.mass + collision.from.mass === 0) ? 1 :
                            collision.from.mass / (collision.move.mass + collision.from.mass);

        collision.move.x += massFactor * collision.collision.displacementX;
        collision.move.y += massFactor * collision.collision.displacementY;
        collision.from.x -= (1-massFactor) * collision.collision.displacementX;
        collision.from.y -= (1-massFactor) * collision.collision.displacementY;
    }

    function applyMomentumTransferForCollision(delta: number, collision: Physics2.DisplacementCollision) {
        if (!collision.move.immovable) {
            let fromvx = (collision.from.x - collision.from.physicslastx)/delta;
            let fromvy = (collision.from.y - collision.from.physicslasty)/delta;
            collision.move.vx -= fromvx;
            collision.move.vy -= fromvy;
            zeroVelocityAgainstDisplacement(collision.move, collision.collision.displacementX, collision.collision.displacementY);
            collision.move.vx += fromvx;
            collision.move.vy += fromvy;
        }

        if (!collision.from.immovable) {
            let movevx = (collision.move.x - collision.move.physicslastx)/delta;
            let movevy = (collision.move.y - collision.move.physicslasty)/delta;
            collision.move.vx -= movevx;
            collision.move.vy -= movevy;
            zeroVelocityAgainstDisplacement(collision.from, -collision.collision.displacementX, -collision.collision.displacementY);
            collision.move.vx += movevx;
            collision.move.vy += movevy;
        }
    }

    function zeroVelocityAgainstDisplacement(obj: PhysicsWorldObject, dx: number, dy: number) {
        let dot = obj.vx * dx + obj.vy * dy;
        if (dot >= 0) return;

        let factor = dot / M.magnitudeSq(dx, dy);
        obj.vx -= factor * dx;
        obj.vy -= factor * dy;
    }
}