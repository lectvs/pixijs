/// <reference path="../lectvs/debug/cheat.ts" />

Cheat.init({
    'win': () => global.world.select.type(Throne).damage(5),
    'lose': () => A.range(5).forEach(i => global.world.select.type(Player).damage()),
    'killall': () => global.world.select.typeAll(Enemy).forEach(enemy => enemy.kill()),
    'explode': () => {
        let explosion = global.world.addWorldObject(new Explosion());
        explosion.x = 400;
        explosion.y = 400;
    }
});