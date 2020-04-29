
namespace StateMachine {
    export type State = {
        callback?: () => any;
        script?: Script.Function;
        transitions?: Transition[];
    }

    export type Transition = (Transitions.Instant) & {
        toState: string;
    }

    namespace Transitions {
        export type Instant = {
            type: 'instant';
        }
    }
}

class StateMachine {
    private states: Dict<StateMachine.State>;
    private currentState: StateMachine.State;
    
    private script: Script;

    constructor() {
        this.states = {};
    }

    addState(name: string, state: StateMachine.State) {
        this.states[name] = state;
    }

    setState(name: string) {
        if (this.script) this.script.done = true;
        let state = this.getState(name);
        if (!state) return;
        this.currentState = state;

        if (state.callback) state.callback();

        let stateScript = O.getOrDefault(state.script, S.noop());

        this.script = new Script(S.chain(
            stateScript,
            S.loopFor(Infinity, S.chain(
                S.call(() => {
                    let transition = this.getValidTransition(this.currentState);
                    if (transition) {
                        this.setState(transition.toState);
                    }
                }),
                S.yield(),
            ))
        ));
    }

    update(delta: number) {
        if (this.script) this.script.update(delta);
    }

    getCurrentStateName() {
        for (let name in this.states) {
            if (this.states[name] === this.currentState) {
                return name;
            }
        }
        return undefined;
    }

    private getState(name: string) {
        if (!this.states[name]) {
            debug(`No state named ${name} exists on state machine`, this);
        }
        return this.states[name];
    }

    private getValidTransition(state: StateMachine.State) {
        for (let transition of state.transitions || []) {
            if (transition.type === 'instant') return transition;
            else debug(`Invalid transition type ${transition.type} for transition`, transition);
        }
        return undefined;
    }
}