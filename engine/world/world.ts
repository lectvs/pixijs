/// <reference path="../worldObject/sprite/sprite.ts" />
/// <reference path="../worldObject/worldObject.ts" />

namespace World {
    export type Config = {
        layers?: World.LayerConfig[];
        effects?: Effects.Config;
        mask?: Mask.WorldMaskConfig;

        camera?: Camera.Config;

        backgroundColor?: number;
        backgroundAlpha?: number;

        width?: number;
        height?: number;
        scaleX?: number;
        scaleY?: number;

        physicsGroups?: Dict<World.PhysicsGroupConfig>;
        collisions?: CollisionConfig[];
        collisionIterations?: number;
        useRaycastDisplacementThreshold?: number;
        maxDistancePerCollisionStep?: number;
        minDistanceIgnoreCollisionStepCalculation?: number;
        defaultZBehavior?: WorldObject.ZBehavior;

        volume?: number;
        globalSoundHumanizeFactor?: number;

        timescale?: number;
        allowPause?: boolean;
        hooks?: HooksConfig<Hooks>;
        data?: any;
    }

    export type CollisionConfig = {
        move: string;
        from: string;
        callback?: Physics.CollisionCallback;
        collisionMode?: Physics.CollisionMode;
    }

    export type LayerConfig = {
        name: string;
        sortKey?: (worldObject: WorldObject) => number;
        reverseSort?: boolean;
        effects?: Effects.Config;
        mask?: Mask.WorldMaskConfig;
    }

    export type PhysicsGroupConfig = {
        immovable?: boolean;
    }

    export type PlaySoundConfig = {
        volume?: number;
        speed?: number;
        humanized?: boolean;
        limit?: number;
    }

    // To add a new hook, simply add an entry here and call World.hookManager.executeHooks() at the appropriate location(s).
    export type Hooks = {
        onTransitioned: { params: (this: World) => void };
        onUpdate: { params: (this: World) => void };
        onWorldObjectAdded: { params: (this: World, worldObject: WorldObject) => void };
        onWorldObjectRemoved: { params: (this: World, worldObject: WorldObject) => void };
    }
}

class World {
    width: number;
    height: number;
    worldObjects: WorldObject[];
    time: number;
    timeScale: number;
    data: any;

    scaleX: number;
    scaleY: number;

    physicsGroups: Dict<World.PhysicsGroup>;
    collisions: World.CollisionConfig[];
    collisionIterations: number;
    useRaycastDisplacementThreshold: number;
    maxDistancePerCollisionStep: number;
    minDistanceIgnoreCollisionStepCalculation: number;
    defaultZBehavior: WorldObject.ZBehavior;

    layers: World.Layer[];
    effects: Effects;
    mask?: Mask.WorldMaskConfig;

    backgroundColor: number;
    backgroundAlpha: number;

    camera: Camera;
    private worldTexture: Texture;
    private layerTexture: Texture;

    protected scriptManager: ScriptManager;
    soundManager: SoundManager;

    select: WorldSelecter;
    
    get delta() {
        if (global.skippingCutscene) return Theater.SKIP_CUTSCENE_DELTA;
        return global.game.delta * this.timeScale;
    }

    volume: number;
    allowSounds: boolean;
    globalSoundHumanizeFactor: number;

    allowPause: boolean;

    protected hookManager: HookManager<World.Hooks>;

    private mouseBounds: CircleBounds;

    constructor(config: World.Config = {}) {        
        this.scriptManager = new ScriptManager();
        this.soundManager = new SoundManager();

        this.select = new WorldSelecter(this);

        this.volume = config.volume ?? 1;
        this.allowSounds = true;
        this.globalSoundHumanizeFactor = config.globalSoundHumanizeFactor ?? 0;

        this.width = config.width ?? global.gameWidth;
        this.height = config.height ?? global.gameHeight;
        this.time = 0;
        this.timeScale = config.timescale ?? 1;
        this.allowPause = config.allowPause ?? true;
        this.data = config.data ? O.deepClone(config.data) : {};

        this.scaleX = config.scaleX ?? 1;
        this.scaleY = config.scaleY ?? 1;

        this.physicsGroups = this.createPhysicsGroups(config.physicsGroups);
        this.collisions = config.collisions ?? [];
        this.collisionIterations = config.collisionIterations ?? 1;
        this.useRaycastDisplacementThreshold = config.useRaycastDisplacementThreshold ?? 1;
        this.maxDistancePerCollisionStep = config.maxDistancePerCollisionStep ?? Infinity;
        this.minDistanceIgnoreCollisionStepCalculation = config.minDistanceIgnoreCollisionStepCalculation ?? Infinity;
        this.defaultZBehavior = config.defaultZBehavior ?? 'noop';

        this.worldObjects = [];
        this.layers = this.createLayers(config.layers);
        this.effects = new Effects(config.effects);
        this.mask = config.mask;

        this.backgroundColor = config.backgroundColor ?? global.backgroundColor;
        this.backgroundAlpha = config.backgroundAlpha ?? 1;

        this.worldTexture = new BasicTexture(this.width, this.height, 'World.worldTexture');
        this.layerTexture = new BasicTexture(this.width, this.height, 'World.layerTexture');

        this.camera = new Camera(config.camera ?? {}, this);

        this.mouseBounds = new CircleBounds(0, 0, 0);

        this.hookManager = new HookManager({
            binder: fn => fn.bind(this),
            hooks: config.hooks,
        });
    }

    onTransitioned() {
        this.hookManager.executeHooks('onTransitioned');
    }

    update() {
        this.updateScriptManager();

        for (let worldObject of this.worldObjects) {
            worldObject.setIsInsideWorldBoundsBufferThisFrame();
            if (worldObject.isActive() && worldObject._isInsideWorldBoundsBufferThisFrame) {
                worldObject.preUpdate();
            }
        }

        for (let worldObject of this.worldObjects) {
            if (worldObject.isActive() && worldObject._isInsideWorldBoundsBufferThisFrame) {
                worldObject.update();
            }
        }

        this.handleCollisions();

        for (let worldObject of this.worldObjects) {
            if (worldObject.isActive() && worldObject._isInsideWorldBoundsBufferThisFrame) {
                worldObject.visualUpdate();
            }
        }

        for (let worldObject of this.worldObjects) {
            if (worldObject.isActive() && worldObject._isInsideWorldBoundsBufferThisFrame) {
                worldObject.postUpdate();
            }
        }

        this.removeDeadWorldObjects();

        this.hookManager.executeHooks('onUpdate');

        this.camera.update();

        for (let layer of this.layers) {
            layer.effects.updateEffects(this.delta);
        }
        this.effects.updateEffects(this.delta);

        this.soundManager.volume = this.volume * global.game.volume * Options.sfxVolume;
        this.soundManager.update(this.delta);

        this.time += this.delta;
    }

    protected updateScriptManager() {
        this.scriptManager.update(this.delta);
    }

    render(screen: Texture, x: number, y: number) {
        this.worldTexture.clear();

        // Render background color.
        Draw.rectangle(this.worldTexture, 0, 0, this.width, this.height, { fill: { color: this.backgroundColor, alpha: this.backgroundAlpha }});

        for (let layer of this.layers) {
            if (layer.shouldRenderToOwnLayer) {
                this.layerTexture.clear();
                this.renderLayerToTexture(layer, this.layerTexture);
                this.layerTexture.renderTo(this.worldTexture, {
                    filters: layer.effects.getFilterList(),
                    mask: Mask.getTextureMaskForWorld(layer.mask),
                });
            } else {
                this.renderLayerToTexture(layer, this.worldTexture);
            }
        }

        // Apply world effects.
        this.worldTexture.renderTo(screen, {
            x: x, y: y,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            filters: this.effects.getFilterList(),
            mask: Mask.getTextureMaskForWorld(this.mask),
        });
    }

    renderLayerToTexture(layer: World.Layer, texture: Texture) {
        layer.sort();

        for (let worldObject of layer.worldObjects) {
            if (worldObject.isVisible() && worldObject.isOnScreen()) {
                worldObject.render(texture, worldObject.getRenderScreenX(), worldObject.getRenderScreenY());
            }
        }
    }

    addHook<T extends keyof World.Hooks>(name: T, fn: World.Hooks[T]['params']) {
        this.hookManager.addHook(name, fn);
    }

    addWorldObject<T extends WorldObject>(obj: T): T {
        return World.Actions.addWorldObjectToWorld(obj, this);
    }
    
    addWorldObjects<T extends WorldObject>(objs: T[]): T[] {
        return World.Actions.addWorldObjectsToWorld(objs, this);
    }

    getDeadWorldObjects() {
        return this.worldObjects.filter(obj => !obj.alive);
    }

    getLayerByName(name: string | undefined) {
        for (let layer of this.layers) {
            if (layer.name === name) return layer;
        }
        return undefined;
    }

    getPhysicsGroupByName(name: string | undefined) {
        if (!name) return undefined;
        return this.physicsGroups[name];
    }

    getPhysicsGroupsThatCollideWith(physicsGroup: string) {
        let result: string[] = [];
        for (let collision of this.collisions) {
            if (collision.move === physicsGroup) {
                result.push(collision.from);
            } else if (collision.from === physicsGroup) {
                result.push(collision.move);
            }
        }
        return A.removeDuplicates(result);
    }

    getWorldMouseX() {
        return Math.floor(Input.mouseX / this.scaleX + this.camera.worldOffsetX);
    }

    getWorldMouseY() {
        return Math.floor(Input.mouseY / this.scaleY + this.camera.worldOffsetY);
    }

    /**
     * @deprecated Use getWorldMouseBounds instead
     */
    getWorldMousePosition() {
        return new Vector2(this.getWorldMouseX(), this.getWorldMouseY());
    }

    getWorldMouseBounds() {
        this.mouseBounds.x = this.getWorldMouseX();
        this.mouseBounds.y = this.getWorldMouseY();

        let scale = (this.scaleX + this.scaleY)/2;
        this.mouseBounds.radius = Input.mouseRadius / scale;
        
        return this.mouseBounds;
    }

    getWorldMouseSpeed() {
        if (this.delta === 0) return 0;
        let lastMouseX = Math.floor(Input.lastMouseX / this.scaleX + this.camera.worldOffsetX);
        let lastMouseY = Math.floor(Input.lastMouseY / this.scaleY + this.camera.worldOffsetY);
        return M.distance(this.getWorldMouseX(), this.getWorldMouseY(), lastMouseX, lastMouseY) / this.delta;
    }

    handleCollisions() {
        if (A.isEmpty(this.collisions)) return;

        Physics.resolveCollisions(this);
    }

    /**
     * By default, sounds are:
     *   - Humanized (if set globally and sound duration less than 1 second)
     */
    playSound(key: string, config?: World.PlaySoundConfig) {
        if (global.theater?.isSkippingCutscene || !this.allowSounds) return new Sound(key);
        
        let limit = config?.limit ?? Infinity;

        // Check limit
        if (this.soundManager.getSoundsByKey(key).length >= limit) {
            return new Sound(key);
        }

        let sound = this.soundManager.playSound(key);

        sound.volume = config?.volume ?? 1;
        sound.speed = config?.speed ?? 1;

        let humanized = (config?.humanized ?? true) && sound.duration < 1;
        if (humanized && this.globalSoundHumanizeFactor > 0) {
            sound.humanize(this.globalSoundHumanizeFactor);
        }
        return sound;
    }

    removeHook(hook: Hook) {
        this.hookManager.removeHook(hook);
    }
    
    removeWorldObject<T extends WorldObject>(obj: T | string | undefined): T | undefined {
        if (!obj) return undefined;
        if (St.isString(obj)) {
            obj = this.select.name<T>(obj);
            if (!obj) return undefined;
        }
        if (!obj.world) return undefined;
        if (obj.world !== this) {
            console.error(`Cannot remove object ${obj.name} from world because it does not exist in the world. World:`, this);
            return undefined;
        }
        return World.Actions.removeWorldObjectFromWorld(obj);
    }
    
    removeWorldObjects<T extends WorldObject>(objs: ReadonlyArray<T | string>): T[] {
        if (A.isEmpty(objs)) return [];
        return objs.map(obj => this.removeWorldObject(obj)).filter(obj => obj) as T[];
    }

    runScript(script: Script | Script.Function, name?: string) {
        return this.scriptManager.runScript(script, name);
    }

    stopScriptByName(name: string) {
        this.scriptManager.stopScriptByName(name);
    }

    takeSnapshot() {
        let screen = new BasicTexture(this.width * this.scaleX, this.height * this.scaleY, 'World.takeSnapshot', false);
        this.render(screen, 0, 0);
        return screen;
    }

    private createLayers(layers: World.LayerConfig[] | undefined) {
        if (A.isEmpty(layers)) layers = [];

        layers.push({ name: World.DEFAULT_LAYER });

        let result: World.Layer[] = [];
        for (let layer of layers) {
            O.defaults(layer, {
                reverseSort: false,
            });
            result.push(new World.Layer(layer.name, layer));
        }

        return result;
    }

    private createPhysicsGroups(physicsGroups: Dict<World.PhysicsGroupConfig> | undefined) {
        if (O.isEmpty(physicsGroups)) return {};

        let result: Dict<World.PhysicsGroup> = {};
        for (let name in physicsGroups) {
            result[name] = new World.PhysicsGroup(name, physicsGroups[name]);
        }
        return result;
    }

    private removeDeadWorldObjects() {
        this.removeWorldObjects(this.getDeadWorldObjects());
    }

    private removeFromAllLayers(obj: WorldObject) {
        for (let layer of this.layers) {
            A.removeAll(layer.worldObjects, obj);
        }
    }

    private removeFromAllPhysicsGroups(obj: WorldObject) {
        for (let name in this.physicsGroups) {
            A.removeAll(this.physicsGroups[name].worldObjects, obj);
        }
    }

    // For use with World.Actions.addWorldObjectToWorld
    zinternal_addWorldObjectToWorldWorld(obj: WorldObject) {
        this.worldObjects.push(obj);

        if (obj.layer) {
            World.Actions.setLayer(obj, obj.layer);
        } else {
            World.Actions.setLayer(obj, World.DEFAULT_LAYER);
        }

        if (obj instanceof PhysicsWorldObject && obj.physicsGroup) {
            World.Actions.setPhysicsGroup(obj, obj.physicsGroup);
        }

        this.hookManager.executeHooks('onWorldObjectAdded', obj);
    }

    // For use with World.Actions.removeWorldObjectFromWorld
    zinternal_removeWorldObjectFromWorldWorld(obj: WorldObject) {
        this.hookManager.executeHooks('onWorldObjectRemoved', obj);

        this.removeFromAllLayers(obj);
        this.removeFromAllPhysicsGroups(obj);
        A.removeAll(this.worldObjects, obj);
    }

    // For use with World.Actions.setLayer
    zinternal_setLayerWorld(obj: WorldObject, layerName: string | undefined) {
        this.removeFromAllLayers(obj);

        for (let layer of this.layers) {
            if (layer.name === layerName) {
                layer.worldObjects.push(obj);
                return;
            }
        }
    }

    // For use with World.Actions.setPhysicsGroup
    zinternal_setPhysicsGroupWorld(obj: PhysicsWorldObject, physicsGroupName: string | undefined) {
        this.removeFromAllPhysicsGroups(obj);
        if (!St.isEmpty(physicsGroupName)) {
            this.getPhysicsGroupByName(physicsGroupName)?.worldObjects?.push(obj);
        }
    }

    // For use with World.Actions.addChildToParent
    zinternal_addChildToParentWorld(child: WorldObject, obj: WorldObject) {
        if (child.world !== this) {
            World.Actions.addWorldObjectToWorld(child, this);
        }
    }

    // For use with World.Actions.removeChildFromParent
    zinternal_removeChildFromParentWorld(child: WorldObject) {
        
    }

    static DEFAULT_LAYER: string = 'default';
}

namespace World {
    export class Layer {
        name: string;
        worldObjects: WorldObject[];
        sortKey?: (worldObject: WorldObject) => number;
        reverseSort: boolean;

        effects: Effects;
        mask?: Mask.WorldMaskConfig;

        get shouldRenderToOwnLayer() {
            return this.effects.hasEffects() || !!this.mask;
        }
        
        constructor(name: string, config: World.LayerConfig) {
            this.name = name;
            this.worldObjects = [];
            this.sortKey = config.sortKey;
            this.reverseSort = config.reverseSort ?? false;

            this.effects = new Effects(config.effects);
            this.mask = config.mask;
        }

        sort() {
            if (!this.sortKey) return;
            let r = this.reverseSort ? -1 : 1;
            this.worldObjects.sort((a, b) => r*(this.sortKey!(a) - this.sortKey!(b)));
        }
    }

    export class PhysicsGroup {
        name: string;
        immovable: boolean;
        worldObjects: PhysicsWorldObject[];

        constructor(name: string, config: World.PhysicsGroupConfig) {
            this.name = name;
            this.immovable = config.immovable ?? false;
            this.worldObjects = [];
        }
    }

    export namespace Actions {
        /**
         * Adds a WorldObject to the world. Returns the object for chaining.
         */
        export function addWorldObjectToWorld<T extends WorldObject | undefined>(obj: T, world: World): T {
            if (!obj || !world) return obj;

            if (obj.world) {
                console.error(`Cannot add object ${obj.name} to world because it aleady exists in another world! You must remove object from previous world first. World:`, world, 'Previous world:', obj.world);
                return obj;
            }

            obj.zinternal_addWorldObjectToWorldWorldObject(world);
            world.zinternal_addWorldObjectToWorldWorld(obj);

            World.Actions.addWorldObjectsToWorld(obj.children, world);

            obj.onAdd();
            return obj;
        }

        /**
         * Adds a list of WorldObjects to a world. Returns as a list the objects added successfully.
         */
        export function addWorldObjectsToWorld<T extends WorldObject>(objs: ReadonlyArray<T>, world: World): T[] {
            if (A.isEmpty(objs)) return [];
            return objs.filter(obj => addWorldObjectToWorld(obj, world));
        }

        /**
         * Removes a WorldObject from its containing world. Returns the object for chaining.
         */
        export function removeWorldObjectFromWorld<T extends WorldObject | undefined>(obj: T, detachFromParent: boolean = true): T {
            if (!obj) return obj;

            if (!obj.world) {
                return obj;
            }

            obj.onRemove();

            let world = obj.world;

            obj.zinternal_removeWorldObjectFromWorldWorldObject(world);
            world.zinternal_removeWorldObjectFromWorldWorld(obj);
            
            World.Actions.removeWorldObjectsFromWorld(obj.children, false);

            if (detachFromParent && obj.parent) {
                World.Actions.detachChildFromParent(obj);
            }
            
            return obj;
        }

        /**
         * Removes a list of WorldObjects from their containing worlds. Returns a copy of the list of objs.
         */
        export function removeWorldObjectsFromWorld<T extends WorldObject | undefined>(objs: ReadonlyArray<T>, unlinkFromParent: boolean = true): T[] {
            if (A.isEmpty(objs)) return [];
            return A.clone(objs).filter(obj => removeWorldObjectFromWorld(obj, unlinkFromParent));
        }

        /**
         * Sets the layer of a WorldObject. Returns the new layer name of the object.
         */
        export function setLayer(obj: WorldObject, layerName: string | undefined): string | undefined {
            if (!obj) return undefined;

            if (obj.world && !obj.world.getLayerByName(layerName)) {
                console.error(`Cannot set layer on object '${obj.name}' as no layer named ${layerName} exists in world!`, obj.world);
                setLayer(obj, World.DEFAULT_LAYER);
                return obj.layer;
            }

            obj.zinternal_setLayerWorldObject(layerName);

            if (obj.world) {
                obj.world.zinternal_setLayerWorld(obj, layerName);
            }

            return obj.layer;
        }

        /**
         * Sets the physics group of a WorldObject. Returns the new physics group name of the object.
         */
        export function setPhysicsGroup(obj: WorldObject, physicsGroupName: string | undefined): string | undefined {
            if (!obj) return undefined;

            if (obj.world && !St.isEmpty(physicsGroupName) && !obj.world.getPhysicsGroupByName(physicsGroupName)) {
                console.error(`Cannot set physicsGroup on object '${obj.name}' as no physicsGroup named ${physicsGroupName} exists in world`, obj.world);
                return obj.physicsGroup;
            }

            if (!(obj instanceof PhysicsWorldObject)) {
                console.error(`Cannot set physicsGroup on object because it is not a PhysicsWorldObject`, obj);
                return obj.physicsGroup;
            }

            obj.zinternal_setPhysicsGroupWorldObject(physicsGroupName);

            if (obj.world) {
                obj.world.zinternal_setPhysicsGroupWorld(obj, physicsGroupName);
            }

            return obj.physicsGroup;
        }

        /**
         * Adds a WorldObject as a child to a parent. Returns the child object for chaining.
         */
        export function addChildToParent<T extends WorldObject>(child: T, obj: WorldObject): T {
            if (!child || !obj) return child;

            if (child.parent) {
                console.error(`Cannot add child ${child.name} to parent ${obj.name} becase the child is already the child of another parent!`, child.parent);
                return child;
            }

            if (child.world && child.world !== obj.world) {
                console.error(`Cannot add child ${child.name} to parent ${obj.name} becase the child exists in a different world!`, child.world);
                return child;
            }

            let cyclicCheckParent = obj.parent;
            while (cyclicCheckParent) {
                if (cyclicCheckParent === child) {
                    console.error(`Cannot add child ${child.name} to parent ${obj.name} because this would result in a cyclic hierarchy`);
                    return child;
                }
                cyclicCheckParent = cyclicCheckParent.parent;
            }

            child.zinternal_addChildToParentWorldObjectChild(obj);
            obj.zinternal_addChildToParentWorldObjectParent(child);

            if (obj.world) {
                obj.world.zinternal_addChildToParentWorld(child, obj);
            }

            return child;
        }

        /**
         * Adds a list of WorldObjects as children to a parent. Returns a copy of the list of children.
         */
        export function addChildrenToParent<T extends WorldObject>(children: ReadonlyArray<T>, obj: WorldObject): T[] {
            if (A.isEmpty(children)) return [];
            return children.filter(child => addChildToParent(child, obj));
        }

        /**
         * Detaches a child from its parent. Returns the child for chaining.
         */
        export function detachChildFromParent<T extends WorldObject>(child: T): T {
            if (!child) return child;

            if (!child.parent) {
                debug(`Tried to remove child ${child.name} from its parent, but its parent does not exist! Child:`, child);
                return child;
            }

            child.parent.zinternal_removeChildFromParentWorldObjectParent(child);
            child.zinternal_removeChildFromParentWorldObjectChild();

            if (child.world) {
                child.world.zinternal_removeChildFromParentWorld(child);
            }

            return child;
        }

        /**
         * Detaches a list of children from their parents. Returns a copy of the list of children.
         */
        export function detachChildrenFromParent<T extends WorldObject>(children: ReadonlyArray<T>): T[] {
            if (A.isEmpty(children)) return [];
            return A.clone(children).filter(child => detachChildFromParent(child));
        }

        /**
         * Orders a WorldObject before another WorldObject so that it is rendered earlier.
         */
        export function orderWorldObjectBefore(obj: WorldObject, before: WorldObject) {
            if (!obj || !before) return;
            if (!obj.world || obj.world !== before.world) {
                console.error('Cannot reorder objects due to null or mismatched worlds:', obj, before);
                return;
            }

            let layer = obj.world.getLayerByName(obj.layer);

            if (layer && obj.layer === before.layer) {
                A.moveBefore(layer.worldObjects, obj, before);
            }
        }

        /**
         * Orders a WorldObject after another WorldObject so that it is rendered later.
         */
        export function orderWorldObjectAfter(obj: WorldObject, after: WorldObject) {
            if (!obj || !after) return;
            if (!obj.world || obj.world !== after.world) {
                console.error('Cannot reorder objects due to null or mismatched worlds:', obj, after);
                return;
            }

            let layer = obj.world.getLayerByName(obj.layer);

            if (layer && obj.layer === after.layer) {
                A.moveAfter(layer.worldObjects, obj, after);
            }
        }

        /**
         * Moves a WorldObject to the front of its layer so it is rendered later.
         */
        export function moveWorldObjectToFront(obj: WorldObject) {
            if (!obj) return;
            if (!obj.world) {
                console.error('Cannot move object since it is not in a world:', obj);
                return;
            }
            let layer = obj.world.getLayerByName(obj.layer);
            if (!layer) return;
            let layerObjects = layer.worldObjects;
            let i = layerObjects.indexOf(obj);
            if (i === layerObjects.length-1) return;
            layerObjects.push(layerObjects.splice(i, 1)[0]);
        }

        /**
         * Moves a WorldObject to the front of its layer so it is rendered earlier.
         */
         export function moveWorldObjectToBack(obj: WorldObject) {
            if (!obj) return;
            if (!obj.world) {
                console.error('Cannot move object since it is not in a world:', obj);
                return;
            }
            let layer = obj.world.getLayerByName(obj.layer);
            if (!layer) return;
            let layerObjects = layer.worldObjects;
            let i = layerObjects.indexOf(obj);
            if (i === 0) return;
            layerObjects.unshift(layerObjects.splice(i, 1)[0]);
        }

        /**
         * Shifts provided WorldObjects equally to balance them around a point.
         * @return the new bounds containing all of the objects
         */
        export function balanceWorldObjects(objs: ReadonlyArray<WorldObject>, aroundX: number, aroundY: number, anchor: Vector2 = Anchor.CENTER, deep: boolean = false) {
            if (A.isEmpty(objs)) return undefined;

            let bounds: Boundaries = {
                left: objs[0].x,
                right: objs[0].x,
                top: objs[0].y,
                bottom: objs[0].y,
            };

            for (let obj of objs) {
                expandWorldObjectBounds(bounds, obj, deep);
            }

            let anchorPoint = vec2(M.lerp(anchor.x, bounds.left, bounds.right), M.lerp(anchor.y, bounds.top, bounds.bottom));

            if (!isFinite(anchorPoint.x) || !isFinite(anchorPoint.y)) {
                console.error('Non-finite anchorPoint for balancing:', objs, anchorPoint);
            }

            for (let obj of objs) {
                obj.x += aroundX - anchorPoint.x;
                obj.y += aroundY - anchorPoint.y;
            }

            bounds.left += aroundX - anchorPoint.x;
            bounds.right += aroundX - anchorPoint.x;
            bounds.top += aroundY - anchorPoint.y;
            bounds.bottom += aroundY - anchorPoint.y;

            return bounds;
        }

        function expandWorldObjectBounds(bounds: Boundaries, obj: WorldObject, deep: boolean) {
            bounds.left = Math.min(bounds.left, obj.x);
            bounds.right = Math.max(bounds.right, obj.x);
            bounds.top = Math.min(bounds.top, obj.y);
            bounds.bottom = Math.max(bounds.bottom, obj.y);

            if (deep) {
                for (let child of obj.children) {
                    expandWorldObjectBounds(bounds, child, deep);
                }
            }
        }
    }
}