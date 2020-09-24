/// <reference path="../worldObject/sprite/sprite.ts" />
/// <reference path="../worldObject/worldObject.ts" />

namespace World {
    export type Config = {
        parent?: World.Config;
        constructor?: any;

        physicsGroups?: Dict<World.PhysicsGroupConfig>;
        collisions?: CollisionConfig2[];
        collisionIterations?: number;
        useRaycastDisplacementThreshold?: number;

        layers?: World.LayerConfig[];

        camera?: Camera.Config;

        width?: number;
        height?: number;

        backgroundColor?: number;
        backgroundAlpha?: number;

        entryPoints?: Dict<Pt>;
        worldObjects?: WorldObject.Config[];

        volume?: number;
    }

    export type CollisionConfig2 = {
        group1: string;
        group2: string;
        callback?: Physics.CollisionCallback;
        transferMomentum?: boolean;
    }

    export type LayerConfig = {
        name: string;
        sortKey?: (worldObject: WorldObject) => number;
        reverseSort?: boolean;
        effects?: Effects.Config;
    }

    export type PhysicsGroupConfig = {
        immovable?: boolean;
    }

    export type EntryPoint = string | Pt;
}

class World {
    width: number;
    height: number;
    entryPoints: Dict<Pt>;
    worldObjects: WorldObject[];

    physicsGroups: Dict<World.PhysicsGroup>;
    collisions: World.CollisionConfig2[];
    collisionIterations: number;
    useRaycastDisplacementThreshold: number;

    worldObjectsByName: Dict<WorldObject[]>;
    layers: World.Layer[];

    backgroundColor: number;
    backgroundAlpha: number;

    camera: Camera;
    private screen: Texture;
    private layerTexture: Texture;

    protected scriptManager: ScriptManager;
    protected soundManager: SoundManager;

    select: WorldSelecter;
    
    get delta() { return global.game.delta; }

    volume: number;

    constructor(config: World.Config, defaults?: World.Config) {
        config = WorldObject.resolveConfig<World.Config>(config, defaults);
        
        this.scriptManager = new ScriptManager();
        this.soundManager = new SoundManager();

        this.select = new WorldSelecter(this);

        this.volume = config.volume ?? 1;

        this.width = config.width ?? global.gameWidth;
        this.height = config.height ?? global.gameHeight;
        this.worldObjects = [];

        this.physicsGroups = this.createPhysicsGroups(config.physicsGroups);
        this.collisions = config.collisions ?? [];
        this.collisionIterations = config.collisionIterations ?? 1;
        this.useRaycastDisplacementThreshold = config.useRaycastDisplacementThreshold ?? 1;

        this.worldObjectsByName = {};
        this.layers = this.createLayers(config.layers);

        this.backgroundColor = config.backgroundColor ?? global.backgroundColor;
        this.backgroundAlpha = config.backgroundAlpha ?? 1;

        this.screen = new BasicTexture(this.width, this.height);
        this.layerTexture = new BasicTexture(this.width, this.height);

        this.entryPoints = config.entryPoints ?? {};

        for (let worldObjectConfig of config.worldObjects || []) {
            World.Actions.addWorldObjectToWorld(WorldObject.fromConfig(worldObjectConfig), this);
        }

        this.camera = new Camera(config.camera ?? {}, this);
    }

    update() {
        this.updateScriptManager();
        
        global.metrics.startSpan('preUpdate');
        for (let worldObject of this.worldObjects) {
            if (worldObject.active) {
                global.metrics.startSpan(worldObject);
                worldObject.preUpdate();
                global.metrics.endSpan(worldObject);
            }
        }
        global.metrics.endSpan('preUpdate');

        global.metrics.startSpan('update');
        for (let worldObject of this.worldObjects) {
            if (worldObject.active) {
                global.metrics.startSpan(worldObject);
                worldObject.update();
                global.metrics.endSpan(worldObject);
            }
        }
        global.metrics.endSpan('update');

        global.metrics.startSpan('handleCollisions');
        this.handleCollisions();
        global.metrics.endSpan('handleCollisions');

        global.metrics.startSpan('postUpdate');
        for (let worldObject of this.worldObjects) {
            if (worldObject.active) {
                global.metrics.startSpan(worldObject);
                worldObject.postUpdate();
                global.metrics.endSpan(worldObject);
            }
        }
        global.metrics.endSpan('postUpdate');

        this.removeDeadWorldObjects();

        this.camera.update(this);

        this.soundManager.volume = this.volume * global.game.volume;
        this.soundManager.update(this.delta);
    }

    protected updateScriptManager() {
        this.scriptManager.update(this.delta);
    }

    render(screen: Texture) {
        // Render background color.
        Draw.brush.color = this.backgroundColor;
        Draw.brush.alpha = this.backgroundAlpha;
        Draw.fill(this.screen);

        for (let worldObject of this.worldObjects) {
            if (worldObject.visible) {
                worldObject.preRender();
            }
        }

        for (let layer of this.layers) {
            this.layerTexture.clear();
            this.renderLayer(layer, this.layerTexture, this.screen);
        }

        for (let worldObject of this.worldObjects) {
            if (worldObject.visible) {
                worldObject.postRender();
            }
        }

        this.screen.renderTo(screen);
    }

    renderLayer(layer: World.Layer, layerTexture: Texture, screen: Texture) {
        layer.sort();
        for (let worldObject of layer.worldObjects) {
            if (worldObject.visible) {
                global.metrics.startSpan(worldObject);
                worldObject.render(layerTexture);
                global.metrics.endSpan(worldObject);
            }
        }
        layerTexture.renderTo(screen, {
            filters: layer.effects.getFilterList()
        });
    }

    addWorldObject<T extends WorldObject>(obj: T | WorldObject.Config): T {
        let worldObject: T = obj instanceof WorldObject ? obj : WorldObject.fromConfig<T>(obj);
        return World.Actions.addWorldObjectToWorld(worldObject, this);
    }
    
    addWorldObjects<T extends WorldObject>(objs: (T | WorldObject)[]): T[] {
        let worldObjects: T[] = _.isEmpty(objs) ? [] : objs.map(obj => obj instanceof WorldObject ? <T>obj : WorldObject.fromConfig<T>(obj));
        return World.Actions.addWorldObjectsToWorld(worldObjects, this);
    }

    getDeadWorldObjects() {
        return this.worldObjects.filter(obj => !obj.alive);
    }

    getEntryPoint(entryPointKey: string) {
        if (!this.entryPoints || !this.entryPoints[entryPointKey]) {
            error(`World does not have an entry point named '${entryPointKey}':`, this);
            return undefined;
        }
        return this.entryPoints[entryPointKey];
    }

    getLayerByName(name: string) {
        for (let layer of this.layers) {
            if (layer.name === name) return layer;
        }
        return undefined;
    }

    getPhysicsGroupByName(name: string) {
        return this.physicsGroups[name];
    }

    getPhysicsGroupsThatCollideWith(physicsGroup: string) {
        let result: string[] = [];
        for (let collision of this.collisions) {
            if (collision.group1 === physicsGroup) {
                result.push(collision.group2);
            } else if (collision.group2 === physicsGroup) {
                result.push(collision.group1);
            }
        }
        return A.removeDuplicates(result);
    }

    getWorldMouseX() {
        return Input.mouseX + Math.floor(this.camera.worldOffsetX);
    }

    getWorldMouseY() {
        return Input.mouseY + Math.floor(this.camera.worldOffsetY);
    }

    getWorldMousePosition(): Pt {
        return { x: this.getWorldMouseX(), y: this.getWorldMouseY() };
    }

    handleCollisions() {
        if (_.isEmpty(this.collisions)) return;

        Physics.resolveCollisions(this);
    }

    hasWorldObject(obj: string | WorldObject) {
        if (_.isString(obj)) {
            return !_.isEmpty(this.worldObjectsByName[obj]);
        }
        return _.contains(this.worldObjects, obj);
    }

    playSound(key: string) {
        return this.soundManager.playSound(key);
    }
    
    removeWorldObject<T extends WorldObject>(obj: T | string): T {
        if (!obj) return undefined;
        if (_.isString(obj)) {
            obj = this.select.name<T>(obj);
            if (!obj) return;
        }
        if (obj.world !== this) {
            error(`Cannot remove object ${obj.name} from world because it does not exist in the world. World:`, this);
            return undefined;
        }
        return World.Actions.removeWorldObjectFromWorld(obj);
    }
    
    removeWorldObjects<T extends WorldObject>(objs: ReadonlyArray<T | string>): T[] {
        if (_.isEmpty(objs)) return [];
        return objs.map(obj => this.removeWorldObject(obj)).filter(obj => obj);
    }

    runScript(script: Script | Script.Function) {
        return this.scriptManager.runScript(script);
    }

    takeSnapshot() {
        let screen = new BasicTexture(this.camera.width, this.camera.height);
        this.render(screen);
        return screen;
    }

    private createLayers(layers: World.LayerConfig[]) {
        if (_.isEmpty(layers)) layers = [];

        layers.push({ name: World.DEFAULT_LAYER });

        let result: World.Layer[] = [];
        for (let layer of layers) {
            _.defaults(layer, {
                reverseSort: false,
            });
            result.push(new World.Layer(layer.name, layer, this.width, this.height));
        }

        return result;
    }

    private createPhysicsGroups(physicsGroups: Dict<World.PhysicsGroupConfig>) {
        if (_.isEmpty(physicsGroups)) return {};

        let result: Dict<World.PhysicsGroup> = {};
        for (let name in physicsGroups) {
            _.defaults(physicsGroups[name], {
                collidesWith: [],
            });
            result[name] = new World.PhysicsGroup(name, physicsGroups[name]);
        }
        return result;
    }
    
    private removeDeadWorldObjects() {
        this.removeWorldObjects(this.getDeadWorldObjects());
    }

    // For use with World.Actions.addWorldObjectToWorld
    private internalAddWorldObjectToWorldWorld(obj: WorldObject) {
        this.worldObjects.push(obj);

        if (obj.name) {
            World.Actions.setName(obj, obj.name);
        }

        if (obj.layer) {
            World.Actions.setLayer(obj, obj.layer);
        } else {
            World.Actions.setLayer(obj, World.DEFAULT_LAYER);
        }

        if (obj instanceof PhysicsWorldObject && obj.physicsGroup) {
            World.Actions.setPhysicsGroup(obj, obj.physicsGroup);
        }
    }

    // For use with World.Actions.removeWorldObjectFromWorld
    private internalRemoveWorldObjectFromWorldWorld(obj: WorldObject) {
        this.removeName(obj);
        this.removeFromAllLayers(obj);
        this.removeFromAllPhysicsGroups(obj);
        A.removeAll(this.worldObjects, obj);
    }

    // For use with World.Actions.setName
    private internalSetNameWorld(obj: WorldObject, name: string) {
        this.removeName(obj);
        if (!_.isEmpty(name)) {
            if (!(name in this.worldObjectsByName)) {
                this.worldObjectsByName[name] = [];
            }
            this.worldObjectsByName[name].push(obj);
        }
    }

    // For use with World.Actions.setLayer
    private internalSetLayerWorld(obj: WorldObject, layerName: string) {
        this.removeFromAllLayers(obj);

        for (let layer of this.layers) {
            if (layer.name === layerName) {
                layer.worldObjects.push(obj);
                return;
            }
        }
    }

    // For use with World.Actions.setPhysicsGroup
    private internalSetPhysicsGroupWorld(obj: PhysicsWorldObject, physicsGroupName: string) {
        this.removeFromAllPhysicsGroups(obj);
        if (!_.isEmpty(physicsGroupName)) {
            this.getPhysicsGroupByName(physicsGroupName).worldObjects.push(obj);
        }
    }

    // For use with World.Actions.addChildToParent
    private internalAddChildToParentWorld(child: WorldObject, obj: WorldObject) {
        if (child.world !== this) {
            World.Actions.addWorldObjectToWorld(child, this);
        }
    }

    // For use with World.Actions.removeChildFromParent
    private internalRemoveChildFromParentWorld(child: WorldObject) {
        
    }

    private removeName(obj: WorldObject) {
        for (let name in this.worldObjectsByName) {
            A.removeAll(this.worldObjectsByName[name], obj);
            if (_.isEmpty(this.worldObjectsByName[name])) {
                delete this.worldObjectsByName[name];
            }
        }
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

    static DEFAULT_LAYER: string = 'default';
}

namespace World {
    export class Layer {
        name: string;
        worldObjects: WorldObject[];
        sortKey: (worldObject: WorldObject) => number;
        reverseSort: boolean;

        effects: Effects;
        
        constructor(name: string, config: World.LayerConfig, width: number, height: number) {
            this.name = name;
            this.worldObjects = [];
            this.sortKey = config.sortKey;
            this.reverseSort = config.reverseSort;

            this.effects = new Effects(config.effects);
        }

        sort() {
            if (!this.sortKey) return;
            let r = this.reverseSort ? -1 : 1;
            this.worldObjects.sort((a, b) => r*(this.sortKey(a) - this.sortKey(b)));
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
         * Adds a WorldObject to the world. Returns the object added.
         */
        export function addWorldObjectToWorld<T extends WorldObject>(obj: T, world: World): T {
            if (!obj || !world) return obj;

            if (obj.world) {
                error(`Cannot add object ${obj.name} to world because it aleady exists in another world! You must remove object from previous world first. World:`, world, 'Previous world:', obj.world);
                return undefined;
            }

            /// @ts-ignore
            obj.internalAddWorldObjectToWorldWorldObject(world);
            /// @ts-ignore
            world.internalAddWorldObjectToWorldWorld(obj);

            World.Actions.addWorldObjectsToWorld(obj.children, world);

            obj.onAdd();
            return obj;
        }

        /**
         * Adds a list of WorldObjects to a world. Returns as a list the objects added successfully.
         */
        export function addWorldObjectsToWorld<T extends WorldObject>(objs: ReadonlyArray<T>, world: World): T[] {
            if (_.isEmpty(objs)) return [];
            return objs.filter(obj => addWorldObjectToWorld(obj, world));
        }

        /**
         * Removes a WorldObject from its containing world. Returns the object removed.
         */
        export function removeWorldObjectFromWorld<T extends WorldObject>(obj: T): T {
            if (!obj) return obj;

            if (!obj.world) {
                return obj;
            }

            let world = obj.world;

            obj.onRemove();

            /// @ts-ignore
            obj.internalRemoveWorldObjectFromWorldWorldObject(world);
            /// @ts-ignore
            world.internalRemoveWorldObjectFromWorldWorld(obj);
            
            World.Actions.removeWorldObjectsFromWorld(obj.children);

            /* No longer unlinking child from parent due to self-mutating iterator issue*/
            if (obj.parent) {
                World.Actions.removeChildFromParent(obj);
            }
            
            return obj;
        }

        /**
         * Removes a list of WorldObjects from their containing worlds. Returns as a list the objects successfully removed.
         */
        export function removeWorldObjectsFromWorld<T extends WorldObject>(objs: ReadonlyArray<T>): T[] {
            if (_.isEmpty(objs)) return [];
            return A.clone(objs).filter(obj => removeWorldObjectFromWorld(obj));
        }

        /**
         * Sets the name of a WorldObject. Returns the new name of the object.
         */
        export function setName(obj: WorldObject, name: string): string {
            if (!obj) return undefined;

            /// @ts-ignore
            obj.internalSetNameWorldObject(name);

            if (obj.world) {
                /// @ts-ignore
                obj.world.internalSetNameWorld(obj, name);
            }

            return obj.name;
        }

        /**
         * Sets the layer of a WorldObject. Returns the new layer name of the object.
         */
        export function setLayer(obj: WorldObject, layerName: string): string {
            if (!obj) return undefined;

            if (obj.world && !obj.world.getLayerByName(layerName)) {
                error(`Cannot set layer on object '${obj.name}' as no layer named ${layerName} exists in world!`, obj.world);
                return obj.layer;
            }

            /// @ts-ignore
            obj.internalSetLayerWorldObject(layerName);

            if (obj.world) {
                /// @ts-ignore
                obj.world.internalSetLayerWorld(obj, layerName);
            }

            return obj.layer;
        }

        /**
         * Sets the physics group of a WorldObject. Returns the new physics group name of the object.
         */
        export function setPhysicsGroup(obj: PhysicsWorldObject, physicsGroupName: string): string {
            if (!obj) return undefined;

            if (obj.world && !_.isEmpty(physicsGroupName) && !obj.world.getPhysicsGroupByName(physicsGroupName)) {
                error(`Cannot set physicsGroup on object '${obj.name}' as no physicsGroup named ${physicsGroupName} exists in world!`, obj.world);
                return obj.physicsGroup;
            }

            /// @ts-ignore
            obj.internalSetPhysicsGroupWorldObject(physicsGroupName);

            if (obj.world) {
                /// @ts-ignore
                obj.world.internalSetPhysicsGroupWorld(obj, physicsGroupName);
            }

            return obj.physicsGroup;
        }

        /**
         * Adds a WorldObject as a child to a parent. Returns the child object if successful.
         */
        export function addChildToParent<T extends WorldObject>(child: T, obj: WorldObject): T {
            if (!child || !obj) return child;

            if (child.parent) {
                error(`Cannot add child ${child.name} to parent ${obj.name} becase the child is already the child of another parent!`, child.parent);
                return undefined;
            }

            if (child.world && child.world !== obj.world) {
                error(`Cannot add child ${child.name} to parent ${obj.name} becase the child exists in a different world!`, child.world);
                return undefined;
            }

            let cyclicCheckParent = obj.parent;
            while (cyclicCheckParent) {
                if (cyclicCheckParent === child) {
                    error(`Cannot add child ${child.name} to parent ${obj.name} because this would result in a cyclic hierarchy`);
                    return undefined;
                }
                cyclicCheckParent = cyclicCheckParent.parent;
            }

            /// @ts-ignore
            child.internalAddChildToParentWorldObjectChild(obj);
            /// @ts-ignore
            obj.internalAddChildToParentWorldObjectParent(child);

            if (obj.world) {
                /// @ts-ignore
                obj.world.internalAddChildToParentWorld(child, obj);
            }

            return child;
        }

        /**
         * Adds a list of WorldObjects as children to a parent. Returns as a list the children successfully added.
         */
        export function addChildrenToParent<T extends WorldObject>(children: ReadonlyArray<T>, obj: WorldObject): T[] {
            if (_.isEmpty(children)) return [];
            return children.filter(child => addChildToParent(child, obj));
        }

        /**
         * Removes a child from its parent. Returns the child if successfully removed.
         */
        export function removeChildFromParent<T extends WorldObject>(child: T): T {
            if (!child) return child;

            if (!child.parent) {
                debug(`Tried to remove child ${child.name} from its parent, but its parent does not exist! Child:`, child);
                return child;
            }

            /// @ts-ignore
            child.parent.internalRemoveChildFromParentWorldObjectParent(child);
            /// @ts-ignore
            child.internalRemoveChildFromParentWorldObjectChild();

            if (child.world) {
                /// @ts-ignore
                child.world.internalRemoveChildFromParentWorld(child);
            }

            return child;
        }

        /**
         * Removes a list of children from their parents. Returns as a list the children successfully removed.
         */
        export function removeChildrenFromParent<T extends WorldObject>(children: ReadonlyArray<T>): T[] {
            if (_.isEmpty(children)) return [];
            return A.clone(children).filter(child => removeChildFromParent(child));
        }
    }
}

namespace World {
    export function fromConfig<T extends World>(config: World.Config): T {
        config = World.resolveConfig(config);

        let result = new config.constructor(config);
        if (result === config) result = new World(config);  // Default constructor to World

        return <T>result;
    }

    export function resolveConfig<T extends World.Config>(config: T, ...parents: T[]): T {
        let result = resolveConfigParent(config);
        if (_.isEmpty(parents)) return <T>result;

        for (let parent of parents) {
            result.parent = parent;
            result = resolveConfig(result);
        }

        return <T>result;
    }

    function resolveConfigParent(config: WorldObject.Config): WorldObject.Config {
        if (!config.parent) return _.clone(config);

        let result = resolveConfig(config.parent);

        for (let key in config) {
            if (key === 'parent') continue;
            if (!result[key]) {
                result[key] = config[key];
            } else if (key === 'entryPoints') {
                result[key] = O.mergeObject(config[key], result[key]);
            } else if (key === 'worldObjects') {
                result[key] = A.mergeArray(config[key], result[key], (e: WorldObject.Config) => e.name,
                    (e: WorldObject.Config, into: WorldObject.Config) => {
                        e = resolveConfig(e);
                        e.parent = into;
                        return resolveConfig(e);
                    });
            } else if (key === 'layers') {
                // merge layerconfig objects to add effects, for example
                result[key] = A.mergeArray(config[key], result[key], (e: World.LayerConfig) => e.name,
                    (e: World.LayerConfig, into: World.LayerConfig) => {
                        return O.mergeObject(e, into);
                    });
            } else {
                result[key] = config[key];
            }
        }

        return result;
    }
}