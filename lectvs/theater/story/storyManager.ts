class StoryManager {
    theater: Theater;
    storyboard: Storyboard;

    cutsceneManager: CutsceneManager;
    eventManager: StoryEventManager;
    storyConfig: StoryConfig;

    get currentNodeName() { return this.stateMachine.getCurrentStateName(); }
    get currentNode() { return this.getNodeByName(this.currentNodeName); }

    private stateMachine: StateMachine;

    constructor(theater: Theater, storyboard: Storyboard, storyboardPath: string[], events: StoryEvent.Map, storyConfig: StoryConfig.Config) {
        this.theater = theater;
        this.storyboard = storyboard;

        this.cutsceneManager = new CutsceneManager(theater, storyboard);
        this.eventManager = new StoryEventManager(theater, events);
        this.storyConfig = new StoryConfig(theater, storyConfig);

        this.stateMachine = new StateMachine();
        
        for (let storyNodeName in storyboard) {
            let storyNode = storyboard[storyNodeName];
            
            let state: StateMachine.State = {};

            if (storyNode.type === 'cutscene') {
                let cutsceneName = storyNodeName;
                state.callback = () => {
                    this.cutsceneManager.playCutscene(cutsceneName);
                }
                state.script = S.waitUntil(() => !this.cutsceneManager.isCutscenePlaying);
            } else if (storyNode.type === 'party') {
                let partyNode = storyNode;
                state.callback = () => {
                    this.updateParty(partyNode);
                }
            } else if (storyNode.type === 'config') {
                let config = storyNode.config;
                state.callback = () => {
                    this.storyConfig.updateConfig(config);
                    this.storyConfig.execute();
                }
            }
            
            state.transitions = storyNode.transitions.map(transition => {
                if (transition.type === 'instant') {
                    return <StateMachine.Transition>{
                        type: 'instant',
                        toState: transition.toNode,
                    };
                }

                if (transition.type === 'onCondition') {
                    return <StateMachine.Transition>{
                        type: 'condition',
                        condition: transition.condition,
                        toState: transition.toNode,
                    };
                }

                if (transition.type === 'onStage') {
                    return <StateMachine.Transition>{
                        type: 'condition',
                        condition: () => this.theater.currentStageName === transition.stage && !this.theater.stageManager.transitioning,
                        toState: transition.toNode,
                    };
                }

                if (transition.type === 'onInteract') {
                    return <StateMachine.Transition>{
                        type: 'condition',
                        condition: () => {
                            if (this.theater.interactionManager.interactRequested === transition.with) {
                                this.theater.interactionManager.consumeInteraction();
                                return true;
                            }
                            return false;
                        },
                        toState: transition.toNode,
                    };
                }

                error("Invalid transition type! Did you forget to add the transition to storyManager?");
                return undefined;
            });

            this.stateMachine.addState(storyNodeName, state);
        }

        let nodeToStartOn = this.fastForward(storyboardPath);
        this.stateMachine.setState(nodeToStartOn);
    }

    update(delta: number) {
        this.cutsceneManager.update(delta);
        this.stateMachine.update(delta);
    }

    onStageLoad() {
        this.cutsceneManager.onStageLoad();
        this.eventManager.onStageLoad();
        this.storyConfig.execute();
    }

    getCurrentInteractableObjects(stageName?: string) {
        return this.getInteractableObjectsForNode(this.currentNode, stageName);
    }

    private fastForward(path: string[]) {
        for (let i = 0; i < path.length-1; i++) {
            let node = this.getNodeByName(path[i]);
            if (!node) continue;
            if (node.type === 'cutscene') {
                this.cutsceneManager.fastForwardCutscene(path[i]);
            } else if (node.type === 'party') {
                this.updateParty(node);
            } else if (node.type === 'config') {
                this.storyConfig.updateConfig(node.config);
                this.storyConfig.execute();
            }
        }
        this.storyConfig.execute();
        return _.last(path);
    }

    private getInteractableObjectsForNode(node: Storyboard.Node, stageName?: string) {
        let result = new Set<string>();

        if (!node) return result;

        for (let transition of node.transitions) {
            if (transition.type !== 'onInteract') continue;
            if (stageName && transition.onStage && stageName === transition.onStage) continue;
            
            let toNode = this.getNodeByName(transition.toNode);
            if (toNode.type === 'cutscene' && !this.cutsceneManager.canPlayCutscene(transition.toNode)) continue;

            result.add(transition.with);
        }

        return result;
    }

    private getNodeByName(name: string) {
        if (!this.storyboard[name]) {
            error(`No storyboard node exists with name ${name}`);
        }
        return this.storyboard[name];
    }

    private updateParty(party: Storyboard.Nodes.Party) {
        if (party.setLeader !== undefined) {
            this.theater.partyManager.leader = party.setLeader;
        }

        if (!_.isEmpty(party.setMembersActive)) {
            for (let m of party.setMembersActive) {
                this.theater.partyManager.setMemberActive(m);
            }
        }

        if (!_.isEmpty(party.setMembersInactive)) {
            for (let m of party.setMembersInactive) {
                this.theater.partyManager.setMemberInactive(m);
            }
        }
    }
}