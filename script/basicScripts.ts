namespace S {
    // There is no async function. Use global.script.world.runScript(scriptFunction) instead.

    export function call(func: () => any): Script.Function {
        return function*() {
            func();
        }
    }

    export function callAfterTime(time: OrFactory<number>, func: () => any): Script.Function {
        return S.chain(S.wait(time), S.call(func));
    }

    export function chain(...scriptFunctions: Script.Function[]): Script.Function {
        return function*() {
            for (let scriptFunction of scriptFunctions) {
                yield scriptFunction;
            }
        }
    }

    export function doOverTime(time: OrFactory<number>, func: (t: number) => any): Script.Function {
        return function*() {
            let t = new Timer(OrFactory.resolve(time));
            while (!t.done) {
                func(t.progress);
                t.update(global.script.delta);
                yield;
            }
            func(1);
        }
    }

    export function loopFor(count: number, scriptFunction: Script.Function): Script.Function {
        return function*() {
            for (let i = 0; i < count; i++) {
                yield scriptFunction;
            }
        }
    }

    export function loopUntil(condition: () => any, scriptFunction: Script.Function): Script.Function {
        return function*() {
            while (!condition()) {
                yield scriptFunction;
            }
        }
    }

    export function noop(): Script.Function {
        return function*() {}
    }

    export function setData(prop: string, value: any): Script.Function {
        return function*() {
            global.script.data[prop] = value;
        }
    }

    export function simul(...scriptFunctions: Script.Function[]): Script.Function {
        return function*() {
            let scripts: Script[] = scriptFunctions.map(sfn => new Script(sfn));
            while (!_.isEmpty(scripts)) {
                scripts = scripts.filter(script => {
                    script.update(global.script.delta);
                    return !script.done;
                });
                if (!_.isEmpty(scripts)) yield;
            }
        }
    }

    export function tween<T extends Partial<Record<K, number>>, K extends keyof T>(duration: OrFactory<number>, obj: T, prop: K, start: number, end: number, easingFunction: Tween.Easing.Function = Tween.Easing.Linear): Script.Function {
        return function*() {
            let tween = new Tween(start, end, OrFactory.resolve(duration), easingFunction);
            while (!tween.done) {
                tween.update(global.script.delta);
                obj[prop] = <any>tween.value;
                yield;
            }
            obj[prop] = <any>end;
        }
    }

    export function tweenPt(duration: OrFactory<number>, pt: Pt, start: Pt, end: Pt, easingFunction: Tween.Easing.Function = Tween.Easing.Linear): Script.Function {
        let startx = start.x;
        let starty = start.y;
        let endx = end.x;
        let endy = end.y;
        return S.simul(
            S.tween(duration, pt, 'x', startx, endx, easingFunction),
            S.tween(duration, pt, 'y', starty, endy, easingFunction),
        );
    }

    export function wait(time: OrFactory<number>): Script.Function {
        return doOverTime(time, t => null);
    }

    export function waitUntil(condition: () => any): Script.Function {
        return function*() {
            while (!condition()) {
                yield;
            }
        }
    }

    export function yield(): Script.Function {
        return function*() {
            yield;
        }
    }
}