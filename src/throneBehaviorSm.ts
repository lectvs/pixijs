class ThroneBehaviorSm extends StateMachine {
    private throne: Throne;

    private lastPos: Pt;
    private targetPos: Pt;
    private jumpCount: number;

    constructor(throne: Throne) {
        super();
        this.throne = throne;
        this.lastPos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.jumpCount = 0;

        this.addState('passive', {
            callback: () => {
                this.throne.light.alpha = 0;
            }
        });

        this.addState('jump', {
            script: S.chain(
                S.call(() => {
                    this.setLastPos();
                    this.setFirstJumpTargetPos();
                    this.throne.world.playSound('dash').volume = 0.6;
                }),
                S.doOverTime(1, t => this.throne.z = 500*t),
                S.wait(1),
                S.doOverTime(1, t => {
                    this.throne.x = M.lerp(this.lastPos.x, this.targetPos.x, t);
                    this.throne.y = M.lerp(this.lastPos.y, this.targetPos.y, t);
                }),
                S.call(() => {
                    World.Actions.setLayer(this.throne, 'main');
                    World.Actions.setLayer(this.throne.king, 'main');
                    World.Actions.setLayer(this.throne.shadow, 'bg');
                }),
                S.doOverTime(1, t => this.throne.z = 500 - 500*t),
                S.call(() => {
                    this.throne.world.playSound('land');
                    this.throne.colliding = true;
                }),
            ),
        });

        this.addState('idle', {
            callback: () => {
                this.jumpCount = 0;
            },
            script: S.wait(3),
            transitions: [
                { type: 'instant', toState: 'small_jump' },
            ],
        });

        this.addState('small_jump', {
            callback: () => {
                this.jumpCount++;
            },
            script: S.chain(
                S.call(() => {
                    this.setLastPos();
                    this.setSmallJumpTargetPos();
                    
                    this.throne.world.playSound('dash').volume = 0.4;
                    this.throne.colliding = false;
                }),
                S.doOverTime(1, t => {
                    this.throne.x = M.lerp(this.lastPos.x, this.targetPos.x, t);
                    this.throne.y = M.lerp(this.lastPos.y, this.targetPos.y, t);
                    this.throne.z = M.jumpParabola(0, 100, 0, t);
                }),
                S.call(() => {
                    let s = this.throne.world.playSound('land');
                    s.webAudioSound.speed = 1.5;
                    s.volume = 0.7;
                    this.throne.colliding = true;
                }),
                S.wait(1),
            ),
            transitions: [
                { type: 'condition', condition: () => this.jumpCount < 2, toState: 'small_jump' },
                { type: 'condition', condition: () => this.jumpCount >= 2, toState: 'big_jump' },
            ]
        });

        this.addState('big_jump', {
            script: S.chain(
                S.call(() => {
                    this.setLastPos();
                    this.setBigJumpTargetPos();

                    this.throne.world.playSound('dash').volume = 0.6;
                    this.throne.colliding = false;
                }),
                S.doOverTime(1, t => this.throne.z = 500*t),
                S.doOverTime(1, t => {
                    this.throne.x = M.lerp(this.lastPos.x, this.targetPos.x, t);
                    this.throne.y = M.lerp(this.lastPos.y, this.targetPos.y, t);
                }),
                S.doOverTime(1, t => this.throne.z = 500 - 500*t),
                S.call(() => {
                    this.throne.world.playSound('land');
                    this.throne.colliding = true;
                }),
                S.wait(1),
            ),
            transitions: [{ type: 'instant', toState: 'dash' }],
        });

        this.addState('dash', {
            script: S.chain(
                S.call(() => {
                    this.setLastPos();
                }),
                S.doOverTime(1, t => {
                    this.setDashTargetPos();
                    this.throne.light.alpha = t;
                    this.throne.light.angle = M.radToDeg(Math.atan2(this.targetPos.y - this.throne.y, this.targetPos.x - this.throne.x));
                }),
                S.wait(1),
                S.call(() => {
                    this.throne.light.alpha = 0;
                    this.throne.world.playSound('dash');
                }),
                S.simul(
                    S.doOverTime(0.1, t => {
                        this.throne.x = M.lerp(this.lastPos.x, this.targetPos.x, t);
                        this.throne.y = M.lerp(this.lastPos.y, this.targetPos.y, t);
                    }),
                    S.chain(
                        S.wait(0.05),
                        S.call(() => {
                            this.throne.spawnBomb();
                        }),
                    ),
                ),
            ),
            transitions: [{ type: 'instant', toState: 'vulnerable' }],
        });

        this.addState('vulnerable', {
            script: S.waitUntil(() => _.isEmpty(this.throne.world.select.typeAll(Bomb))),
            transitions: [{ type: 'instant', toState: 'idle' }],
        });

        this.addState('defeat', {});
    }

    private setLastPos() {
        this.lastPos.x = this.throne.x;
        this.lastPos.y = this.throne.y;
    }

    private setFirstJumpTargetPos() {
        let player = this.throne.world.select.type(Player);
        if (M.distance(player.x, player.y, 384, 480) > 36) {
            this.targetPos.x = 384;
            this.targetPos.y = 480;
        } else {
            this.targetPos.x = 384;
            this.targetPos.y = 440;
        }
    }

    private setSmallJumpTargetPos() {
        let candidates = A.range(20).map(i => {
            let d = Random.inDisc(64, 128);
            d.x += this.throne.x;
            d.y += this.throne.y;
            return d;
        }).filter(pos => 64 <= pos.x && pos.x <= 706 && 338 <= pos.y && pos.y <= 704);

        if (_.isEmpty(candidates)) {
            this.targetPos.x = 384;
            this.targetPos.y = 480;
        } else {
            this.targetPos = Random.element(candidates);
        }
    }

    private setBigJumpTargetPos() {
        this.targetPos.x = Random.float(64, 706);
        this.targetPos.y = Random.float(338, 704);
    }

    private setDashTargetPos() {
        let player = this.throne.world.select.type(Player);
        let d = { x: player.x - this.throne.x, y: player.y - this.throne.y };
        if (V.magnitude(d) < 200) V.setMagnitude(d, 200);
        this.targetPos.x = this.throne.x + d.x;
        this.targetPos.y = this.throne.y + d.y;
    }
}