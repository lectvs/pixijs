/// <reference path="./enemy.ts"/>

class Mage extends Enemy {

    private static readonly MAX_RUNNERS = 4;

    private attacking: WorldObject;
    private targetPos: Pt;

    private willSpawnNext: boolean;

    constructor() {
        super({
            maxHealth: 1,
            immuneTime: 0.5,
            weight: 1,
            speed: 70,
            deadTexture: 'mage_dead',
        });

        this.bounds = new CircleBounds(0, -4, 8);
        this.effects.addOutline.color = 0x000000;
        this.addAnimation(Animations.fromTextureList({ name: 'idle', texturePrefix: 'mage_', textures: [0, 1, 2], frameRate: 8, count: -1 }));
        this.addAnimation(Animations.fromTextureList({ name: 'run', texturePrefix: 'mage_', textures: [4, 5], frameRate: 4, count: -1,
                overrides: {
                    2: { callback: () => { this.world.playSound('walk'); }}
                }
        }));
        this.addAnimation(Animations.fromTextureList({ name: 'wave', texturePrefix: 'mage_', textures: [8, 9], frameRate: 2, count: -1 }));
        this.playAnimation('idle');

        this.willSpawnNext = true;

        this.stateMachine.addState('start', {
            script: S.wait(Random.float(0, 1)),
            transitions: [
                { toState: 'idle' },
            ]
        })
        this.stateMachine.addState('idle', {
            script: S.chain(
                S.wait(Random.float(1.4, 2)),
                S.call(() => {
                    this.pickNextTargetPos();
                    this.willSpawnNext = !this.willSpawnNext;
                    if (this.world.select.typeAll(Runner).length >= Mage.MAX_RUNNERS) {
                        this.willSpawnNext = false;
                    }
                }),
            ),
            transitions: [
                { toState: 'spawn', condition: () => this.willSpawnNext },
                { toState: 'walking', condition: () => !this.willSpawnNext },
            ]
        });
        this.stateMachine.addState('walking', {
            transitions: [
                { toState: 'idle', condition: () => M.distance(this.x, this.y, this.targetPos.x, this.targetPos.y) < 4 },
            ]
        });
        this.stateMachine.addState('spawn', {
            script: S.chain(
                S.wait(1),
                S.call(() => {
                    this.pickNextSpawnTargetPos();
                    this.spawn();
                }),
                S.doOverTime(1, t => this.effects.outline.color = M.vec3ToColor([0, t, t])),
                S.wait(1),
                S.doOverTime(0.2, t => this.effects.outline.color = M.vec3ToColor([0, 1-t, 1-t])),
            ),
            transitions: [
                { toState: 'idle' },
            ]
        })
        this.stateMachine.setState('start');

        this.targetPos = { x: 0, y: 0 };
    }

    update() {
        this.ai();

        if (this.state === 'idle') {
            this.playAnimation('idle');
        } else if (this.state === 'walking') {
            this.v = { x: this.targetPos.x - this.x, y: this.targetPos.y - this.y };
            V.setMagnitude(this.v, this.speed);

            if (this.v.x < 0) this.flipX = true;
            if (this.v.x > 0) this.flipX = false;

            this.playAnimation('run');
        } else if (this.state === 'spawn') {
            this.playAnimation('wave');
            let player = global.world.select.type(Player);
            if (player.x < this.x) this.flipX = true;
            if (player.x > this.x) this.flipX = false;
        }

        super.update();
    }

    damage(amount: number) {
        super.damage(amount);
        this.setState('idle');

        this.runScript(S.chain(
            S.call(() => {
                this.effects.silhouette.color = 0xFFFFFF;
                this.effects.silhouette.enabled = true;
            }),
            S.loopFor(8, S.chain(
                S.wait(this.immuneTime/8),
                S.call(() => {
                    this.effects.silhouette.enabled = !this.effects.silhouette.enabled;
                })
            )),
            S.call(() => {
                this.effects.silhouette.enabled = false;
            }),
        ));
    }

    spawn() {
        let runner = new Runner();
        runner.x = this.targetPos.x;
        runner.y = this.targetPos.y;
        runner.layer = 'main';
        runner.physicsGroup = 'enemies';
        this.world.addWorldObject(spawn(runner));
    }

    onCollide(other: PhysicsWorldObject) {
        super.onCollide(other);

        if (other.physicsGroup === 'walls') {
            this.setState('idle');
        }
    }

    private ai() {
        if (!this.attacking) this.attacking = this.world.select.type(Player);
    }

    private pickNextTargetPos() {
        if (this.x < 64 || this.x > 706 || this.y < 338 || this.y > 704) {
            // Too close to edge of room
            let candidates = A.range(20).map(i => {
                return { x: Random.float(64, 706), y: Random.float(338, 704) };
            });
            this.targetPos = M.argmin(candidates, pos => M.distance(this.x, this.y, pos.x, pos.y));
            return;
        }

        let candidates = A.range(3).map(i => {
            let d = Random.inDisc(50, 100);
            d.x += this.x;
            d.y += this.y;
            return d;
        });

        this.targetPos = M.argmin(candidates, pos => Math.abs(M.distance(this.attacking.x, this.attacking.y, pos.x, pos.y) - 150));
    }

    private pickNextSpawnTargetPos() {
        this.targetPos = Random.inDisc(16, 32);
        this.targetPos.x += this.x;
        this.targetPos.y += this.y;
    }
}