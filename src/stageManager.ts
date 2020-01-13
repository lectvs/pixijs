class StageManager {
    stages: Dict<Stage>;

    currentStageName: string;
    currentWorld: World;

    private theater: Theater;
    private stageLoadQueue: { name: string, transition: Transition, entryPoint: Stage.EntryPoint };

    constructor(theater: Theater, stages: Dict<Stage>) {
        this.theater = theater;
        this.stages = stages;
        this.currentStageName = null;
        this.currentWorld = null;
        this.stageLoadQueue = null;
    }

    loadStage(name: string, transition: Transition, entryPoint: Stage.EntryPoint) {
        this.stageLoadQueue = { name, transition, entryPoint };
    }

    loadStageIfQueued() {
        if (!this.stageLoadQueue) return;

        let name = this.stageLoadQueue.name;
        let transition = this.stageLoadQueue.transition;
        let entryPoint = this.stageLoadQueue.entryPoint;
        this.stageLoadQueue = null;

        let oldWorld = this.currentWorld;
        let oldSnapshot = oldWorld.takeSnapshot();

        this.setStage(name, entryPoint);
        this.currentWorld.update(this.theater, 0.01);
        
        let newSnapshot = this.currentWorld.takeSnapshot();

        this.currentWorld.active = false;
        this.currentWorld.visible = false;

        // this is outside the script to avoid 1-frame flicker
        let transitionObj = new Transition.Obj(oldSnapshot, newSnapshot, transition);
        World.Actions.setLayer(transitionObj, Theater.LAYER_TRANSITION);
        World.Actions.addWorldObjectToWorld(transitionObj, this.theater);

        let stageManager = this;
        this.theater.runScript(function* () {
            while (!transitionObj.done) {
                yield;
            }

            World.Actions.removeWorldObjectFromWorld(transitionObj)
            stageManager.currentWorld.active = true;
            stageManager.currentWorld.visible = true;

            stageManager.theater.onStageLoad();
        });
    }

    setStage(name: string, entryPoint: Stage.EntryPoint) {
        if (!this.stages[name]) {
            debug(`Stage '${name}' does not exist in world.`);
            return;
        }

        let stage = Stage.resolveStageConfig(this.stages[name]);

        // Remove old stuff
        if (this.currentWorld) {
            World.Actions.removeWorldObjectFromWorld(this.currentWorld);
        }
        this.theater.interactionManager.reset();

        // Create new stuff
        this.currentStageName = name;
        this.currentWorld = this.newWorldFromStage(stage);
        this.addPartyToWorld(this.theater.party, this.theater.currentWorld, stage, entryPoint);
        World.Actions.setLayer(this.currentWorld, Theater.LAYER_WORLD);
        World.Actions.addWorldObjectToWorld(this.currentWorld, this.theater);
    }

    private newWorldFromStage(stage: Stage) {
        let world = new World(stage);

        if (stage.worldObjects) {
            for (let worldObject of stage.worldObjects) {
                this.addWorldObjectFromStageConfig(world, worldObject);
            }
        }

        return world;
    }

    private addPartyToWorld(party: Party, world: World, stage: Stage, entryPoint: Stage.EntryPoint) {
        // Resolve entry point.
        if (_.isString(entryPoint)) {
            entryPoint = Stage.getEntryPoint(stage, entryPoint);
        }
        for (let member of party.activeMembers) {
            party.addMemberToWorld(member, world);
            let memberObj = party.members[member].worldObject;
            memberObj.x = entryPoint.x;
            memberObj.y = entryPoint.y;
        }
    }

    private addWorldObjectFromStageConfig(world: World, worldObject: SomeWorldObjectConfig) {
        worldObject = Stage.resolveWorldObjectConfig(worldObject);
        if (!worldObject.constructor) return null;

        let config = <SomeWorldObjectConfig> worldObject;
        _.defaults(config, {
            layer: World.DEFAULT_LAYER,
        });

        let obj: WorldObject = new config.constructor(config);
        World.Actions.setName(obj, config.name);
        World.Actions.setLayer(obj, config.layer);
        if (obj instanceof PhysicsWorldObject) {
            World.Actions.setPhysicsGroup(obj, config.physicsGroup);
        }
        World.Actions.addWorldObjectToWorld(obj, world);

        return obj;
    }
}