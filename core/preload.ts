/// <reference path="../texture/basicTexture.ts"/>

namespace Preload {
    export type Resource = {
        name: string;
        src: string;
        done: boolean;
    }

    export type Options = {
        textures?: Dict<Preload.Texture>;
        sounds?: Dict<Preload.Sound>;
        tilesets?: Dict<Preload.Tileset>;
        pyxelTilemaps?: Dict<Preload.PyxelTilemap>;
        fonts?: Dict<Preload.Font>;
        progressCallback?: (progress: number) => any;
        onLoad?: Function;
    }

    export type Texture = {
        url?: string;
        spritesheet?: TextureSpritesheet;
        frames?: Dict<TextureFrame>;
    } & TextureFrame;

    export type TextureFrame = {
        rect?: Rect;
        anchor?: Vector2;
    }

    export type Sound = {
        url?: string;
        volume?: number;
        speed?: number;
    }

    export type TextureSpritesheet = {
        frameWidth: number;
        frameHeight: number;
        prefix?: string;
        anchor?: Vector2;
    }

    export type Tileset = {
        url?: string;
        tileWidth: number;
        tileHeight: number;
        collisionIndices: number[];
    }

    export type PyxelTilemap = {
        url?: string;
    }

    export type PyxelTilemapJson = {
        tilewidth: number;
        tileheight: number;
        tileswide: number;
        tileshigh: number;
        layers: {
            number: number;
            name: string;
            tiles: {
                x: number;
                y: number;
                index: number;
                tile: number;
                flipX: boolean;
                rot: number;
            }[];
        }[];
    }

    export type Font = {
        url?: string;
        charWidth: number;
        charHeight: number;
        spaceWidth: number;
        newlineHeight: number;
    }
}

class Preload {
    private static preloadOptions: Preload.Options;

    private static resources: Preload.Resource[];

    static preload(options: Preload.Options) {
        this.preloadOptions = options;
        this.resources = [];

        if (options.textures) {
            for (let key in options.textures) {
                this.preloadTexture(key, options.textures[key]);
            }
        }

        if (options.sounds) {
            for (let key in options.sounds) {
                this.preloadSound(key, options.sounds[key]);
            }
        }

        if (options.tilesets) {
            for (let key in options.tilesets) {
                this.preloadTileset(key, options.tilesets[key]);
            }
        }

        if (options.pyxelTilemaps) {
            for (let key in options.pyxelTilemaps) {
                this.preloadPyxelTilemap(key, options.pyxelTilemaps[key]);
            }
        }

        if (options.fonts) {
            for (let key in options.fonts) {
                this.preloadFont(key, options.fonts[key]);
            }
        }

        PIXI.Loader.shared.load();
    }

    private static load(options: Preload.Options) {
        if (options.textures) {
            for (let key in options.textures) {
                this.loadTexture(key, options.textures[key]);
            }
        }

        if (options.sounds) {
            for (let key in options.sounds) {
                this.loadSound(key, options.sounds[key]);
            }
        }

        if (options.tilesets) {
            for (let key in options.tilesets) {
                this.loadTileset(key, options.tilesets[key]);
            }
        }

        if (options.pyxelTilemaps) {
            for (let key in options.pyxelTilemaps) {
                this.loadPyxelTilemap(key, options.pyxelTilemaps[key]);
            }
        }

        if (options.fonts) {
            for (let key in options.fonts) {
                this.loadFont(key, options.fonts[key]);
            }
        }

        if (options.onLoad) {
            options.onLoad();
        }
    }

    private static preloadTexture(key: string, texture: Preload.Texture) {
        let url = texture.url || `assets/${key}.png`;
        let resource = {
            name: key,
            src: url,
            done: false
        };
        this.resources.push(resource);
        PIXI.Loader.shared.add(key + this.TEXTURE_KEY_SUFFIX, url, undefined, () => this.onLoadResource(resource));
    }

    private static loadTexture(key: string, texture: Preload.Texture) {
        let baseTexture: PIXI.BaseTexture = PIXI.utils.TextureCache[key + this.TEXTURE_KEY_SUFFIX];
        if (!baseTexture) {
            error(`Failed to preload texture ${key}`);
            return;
        }

        let mainTexture = new PIXI.Texture(baseTexture);
        let rect = texture.rect;
        let anchor = texture.anchor;
        if (rect) {
            mainTexture.frame = new Rectangle(rect.x, rect.y, rect.width, rect.height);
        }
        if (anchor) {
            mainTexture.defaultAnchor = new Point(anchor.x, anchor.y);
        }
        AssetCache.pixiTextures[key] = mainTexture;
        AssetCache.textures[key] = Texture.fromPixiTexture(mainTexture);

        let frames: Dict<Preload.TextureFrame> = {};

        if (texture.spritesheet) {
            let numFramesX = Math.floor(baseTexture.width / texture.spritesheet.frameWidth);
            let numFramesY = Math.floor(baseTexture.height / texture.spritesheet.frameHeight);

            for (let y = 0; y < numFramesY; y++) {
                for (let x = 0; x < numFramesX; x++) {
                    let frameKeyPrefix = texture.spritesheet.prefix ?? `${key}_`;
                    let frameKey = `${frameKeyPrefix}${x + y*numFramesX}`;
                    frames[frameKey] = {
                        rect: {
                            x: x*texture.spritesheet.frameWidth,
                            y: y*texture.spritesheet.frameHeight,
                            width: texture.spritesheet.frameWidth,
                            height: texture.spritesheet.frameHeight
                        },
                        anchor: texture.spritesheet.anchor,
                    };
                }
            }
        }

        if (texture.frames) {
            for (let frame in texture.frames) {
                frames[frame] = texture.frames[frame];
            }
        }

        for (let frame in frames) {
            let frameTexture: PIXI.Texture = new PIXI.Texture(baseTexture);
            let rect = frames[frame].rect || texture.rect;
            let anchor = frames[frame].anchor || texture.anchor;
            if (rect) {
                frameTexture.frame = new Rectangle(rect.x, rect.y, rect.width, rect.height);
            }
            if (anchor) {
                frameTexture.defaultAnchor = new Point(anchor.x, anchor.y);
            }
            AssetCache.pixiTextures[frame] = frameTexture;
            AssetCache.textures[frame] = Texture.fromPixiTexture(frameTexture);
        }
    }

    private static preloadSound(key: string, sound: Preload.Sound) {
        let url = sound.url || `assets/${key}.wav`;
        let resource = {
            name: key,
            src: url,
            done: false
        };
        this.resources.push(resource);
        WebAudio.preloadSound(key, url, () => this.onLoadResource(resource));
    }

    private static loadSound(key: string, sound: Preload.Sound) {
        let preloadedSound = WebAudio.preloadedSounds[key];
        if (!preloadedSound) {
            error(`Failed to preload sound ${key}`);
            return;
        }

        let volume = sound.volume ?? 1;
        if (volume < 0 || volume > Sound.MAX_VOLUME) {
            error(`Sound ${key} has invalid volume:`, sound);
            volume = M.clamp(volume, 0, Sound.MAX_VOLUME);
        }

        let speed = sound.speed ?? 1;
        if (speed < 0 || speed > Sound.MAX_SPEED) {
            error(`Sound ${key} has invalid speed:`, sound);
            speed = M.clamp(speed, 0, Sound.MAX_SPEED);
        }

        AssetCache.sounds[key] = {
            buffer: preloadedSound.buffer,
            volume: volume,
            speed: speed
        };
    }

    private static preloadTileset(key: string, tileset: Preload.Tileset) {
        let url = tileset.url || `assets/${key}.png`;
        let resource = {
            name: key,
            src: url,
            done: false
        };
        this.resources.push(resource);
        PIXI.Loader.shared.add(key + this.TILESET_KEY_SUFFIX, url, () => this.onLoadResource(resource));
    }

    private static loadTileset(key: string, tileset: Preload.Tileset) {
        let baseTexture: PIXI.BaseTexture = PIXI.utils.TextureCache[key + this.TILESET_KEY_SUFFIX];
        if (!baseTexture) {
            error(`Failed to preload tileset ${key}`);
            return;
        }

        let frames: Dict<Preload.TextureFrame> = {};
        let tiles: string[] = [];

        let numFramesX = Math.floor(baseTexture.width / tileset.tileWidth);
        let numFramesY = Math.floor(baseTexture.height / tileset.tileHeight);

        for (let y = 0; y < numFramesY; y++) {
            for (let x = 0; x < numFramesX; x++) {
                let frameKeyPrefix = `${key}_`;
                let frameKey = `${frameKeyPrefix}${x + y*numFramesX}`;
                frames[frameKey] = {
                    rect: {
                        x: x*tileset.tileWidth,
                        y: y*tileset.tileHeight,
                        width: tileset.tileWidth,
                        height: tileset.tileHeight
                    },
                    anchor: Vector2.CENTER,
                };
                tiles.push(frameKey);
            }
        }

        for (let frame in frames) {
            let frameTexture: PIXI.Texture = new PIXI.Texture(baseTexture);
            let rect = frames[frame].rect;
            let anchor = frames[frame].anchor;
            frameTexture.frame = new Rectangle(rect.x, rect.y, rect.width, rect.height);
            frameTexture.defaultAnchor = new Point(anchor.x, anchor.y);
            AssetCache.pixiTextures[frame] = frameTexture;
            AssetCache.textures[frame] = Texture.fromPixiTexture(frameTexture);
        }

        AssetCache.tilesets[key] = {
            tileWidth: tileset.tileWidth,
            tileHeight: tileset.tileHeight,
            tiles: tiles,
            collisionIndices: tileset.collisionIndices,
        };
    }

    private static preloadPyxelTilemap(key: string, tilemap: Preload.PyxelTilemap) {
        let url = tilemap.url || `assets/${key}.json`;
        let resource = {
            name: key,
            src: url,
            done: false
        };
        this.resources.push(resource);
        PIXI.Loader.shared.add(key + this.TILEMAP_KEY_SUFFIX, url, () => this.onLoadResource(resource));
    }

    private static loadPyxelTilemap(key: string, tilemap: Preload.PyxelTilemap) {
        let tilemapResource = PIXI.Loader.shared.resources[key + this.TILEMAP_KEY_SUFFIX];
        if (!tilemapResource || !tilemapResource.data) {
            error(`Failed to preload PyxelTilemap ${key}`);
            return;
        }

        let tilemapJson: Preload.PyxelTilemapJson = PIXI.Loader.shared.resources[key + this.TILEMAP_KEY_SUFFIX].data;

        let tilemapForCache: Tilemap.Tilemap = {
            layers: [],
        };
        for (let i = 0; i < tilemapJson.layers.length; i++) {
            let tilemapLayer: Tilemap.TilemapLayer = A.filledArray2D(tilemapJson.tileshigh, tilemapJson.tileswide);
            for (let tile of tilemapJson.layers[i].tiles) {
                tilemapLayer[tile.y][tile.x] = {
                    index: Math.max(tile.tile, -1),
                    angle: tile.rot * 90,
                    flipX: tile.flipX,
                };
            }
            tilemapForCache.layers.unshift(tilemapLayer);
        }
        AssetCache.tilemaps[key] = tilemapForCache;
    }

    private static preloadFont(key: string, font: Preload.Font) {
        let url = font.url || `assets/${key}.png`;
        let resource = {
            name: key,
            src: url,
            done: false
        };
        this.resources.push(resource);
        PIXI.Loader.shared.add(key + this.FONT_KEY_SUFFIX, url, () => this.onLoadResource(resource));
    }

    private static loadFont(key: string, font: Preload.Font) {
        let baseTexture: PIXI.BaseTexture = PIXI.utils.TextureCache[key + this.FONT_KEY_SUFFIX];
        if (!baseTexture) {
            error(`Failed to preload font ${key}`);
            return;
        }

        let frames: Dict<Preload.TextureFrame> = {};
        let charTextures: string[] = [];

        let numFramesX = Math.floor(baseTexture.width / font.charWidth);
        let numFramesY = Math.floor(baseTexture.height / font.charHeight);

        for (let y = 0; y < numFramesY; y++) {
            for (let x = 0; x < numFramesX; x++) {
                let frameKeyPrefix = `${key}_`;
                let frameKey = `${frameKeyPrefix}${x + y*numFramesX}`;
                frames[frameKey] = {
                    rect: {
                        x: x*font.charWidth,
                        y: y*font.charHeight,
                        width: font.charWidth,
                        height: font.charHeight
                    },
                    anchor: Vector2.TOP_LEFT,
                };
                charTextures.push(frameKey);
            }
        }

        for (let frame in frames) {
            let frameTexture: PIXI.Texture = new PIXI.Texture(baseTexture);
            let rect = frames[frame].rect;
            let anchor = frames[frame].anchor;
            frameTexture.frame = new Rectangle(rect.x, rect.y, rect.width, rect.height);
            frameTexture.defaultAnchor = new Point(anchor.x, anchor.y);
            AssetCache.pixiTextures[frame] = frameTexture;
            AssetCache.textures[frame] = Texture.fromPixiTexture(frameTexture);
        }

        AssetCache.fonts[key] = {
            charTextures: charTextures,
            charWidth: font.charWidth,
            charHeight: font.charHeight,
            spaceWidth: font.spaceWidth,
            newlineHeight: font.newlineHeight
        };
    }

    private static onLoadResource(resource: Preload.Resource) {
        resource.done = true;
        if (this.preloadOptions.progressCallback) {
            this.preloadOptions.progressCallback(this.getPreloadProgress());
        }
        if (this.resources.every(r => r.done)) {
            this.load(this.preloadOptions);
        }
    }

    private static getPreloadProgress() {
        return this.resources.filter(r => r.done).length / this.resources.length;
    }

    private static TEXTURE_KEY_SUFFIX = '_texture_';
    private static TILESET_KEY_SUFFIX = '_tileset_';
    private static TILEMAP_KEY_SUFFIX = '_tilemap_';
    private static FONT_KEY_SUFFIX = '_font_';
}

namespace Preload {
    export function allTilesWithPrefix(prefix: string, count: number = 1000) {
        let result: string[] = [];
        for (let i = 0; i < count; i++) {
            result.push(`${prefix}${i}`);
        }
        return result;
    }
}