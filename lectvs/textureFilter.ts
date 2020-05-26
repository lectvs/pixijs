///<reference path="./debug.ts"/>

namespace TextureFilter {
    /**
     * Texture filter config.
     * 
     * @property uniforms Uniform definitions for the filter. Of the form ["float rx", "vec2 position"]
     * @property defaultUniforms Map of uniform name => value to initialize the filter. Of the form {"rx": 5, "position": [1,4]}
     * @property code The fragment shader code. Set the color in `outp`.
     *           Available for use are the following variables and methods:
     *               vec4 inp - the input color
     *               float width/height - the width and height of the filter
     *               float x/y - the local x/y coordinates in pixels
     *               float worldx/y - the x/y coordinates in world/screenspace(?)
     *               float t - time in seconds
     *               vec4 getColor(float x, float y) - get the color at local x/y
     *               vec4 getWorldColor(float worldx, float worldy) - get the color at world x/y
     * @property vertCode The vertex shader code. Set the vertex in `outp`.
*                Available for use are the following variables and methods:
*                    vec2 inp - the input vertex
*                    float width/height - the width and height of the filter(?)
*                    float t - time in seconds
     */
    export type Config = {
        uniforms?: string[];
        defaultUniforms?: Dict<any>;
        code?: string;
        vertCode?: string;
    }
}

class TextureFilter {
    enabled: boolean;

    private uniforms: Dict<any>;
    private pixiFilter: PIXI.Filter;

    constructor(config: TextureFilter.Config) {
        let code = O.getOrDefault(config.code, '');
        let vertCode = O.getOrDefault(config.vertCode, '');
        this.pixiFilter = this.constructPixiFilterCached(code, vertCode, config.uniforms);
        this.uniforms = this.constructUniforms(config.uniforms);
        this.setUniforms(config.defaultUniforms);

        this.setUniform('t', 0);

        this.enabled = true;
    }

    getPixiFilter() {
        return this.pixiFilter;
    }

    getUniform(uniform: string) {
        return this.uniforms[uniform];
    }

    setPixiUniforms() {
        for (let uniform in this.uniforms) {
            this.pixiFilter.uniforms[uniform] = this.uniforms[uniform];
        }
    }

    setDimensions(width: number, height: number) { }

    setTexturePosition(posx: number, posy: number) {
        this.pixiFilter.uniforms['posx'] = posx;
        this.pixiFilter.uniforms['posy'] = posy;
    }

    setUniform(uniform: string, value: any) {
        this.uniforms[uniform] = value;
    }

    setUniforms(uniforms: Dict<any>) {
        if (!uniforms) return;
        for (let key in uniforms) {
            this.uniforms[key] = uniforms[key];
        }
    }

    updateTime(delta: number) {
        this.setUniform('t', this.getUniform('t') + delta);
    }

    private constructUniforms(uniformDeclarations: string[]) {
        if (_.isEmpty(uniformDeclarations)) return {};
        let uniformMap = {};
        uniformDeclarations
            .map(decl => decl.trim())
            .map(decl => decl.substring(decl.lastIndexOf(' ') + 1))
            .forEach(decl => (uniformMap[decl] = undefined));
        return uniformMap;
    }

    protected constructPixiFilterCached(code: string, vertCode: string, uniforms: string[]) {
        let uniformsCode = (uniforms || []).map(uniform => `uniform ${uniform};`).join('');
        let cacheKey = uniformsCode + code + vertCode;

        if (!TextureFilter.cache[cacheKey]) {
            let vert = TextureFilter.vertPreUniforms + uniformsCode + TextureFilter.vertStartFunc + vertCode + TextureFilter.vertEndFunc;
            let frag = TextureFilter.fragPreUniforms + uniformsCode + TextureFilter.fragStartFunc + code + TextureFilter.fragEndFunc;
            let result = new PIXI.Filter(vert, frag, {});
            TextureFilter.cache[cacheKey] = result;
        }
        
        return TextureFilter.cache[cacheKey];
    }

    private static vertPreUniforms = `
        precision highp float;
        attribute vec2 aVertexPosition;
        uniform mat3 projectionMatrix;
        varying vec2 vTextureCoord;
        uniform vec4 inputSize;
        uniform vec4 outputFrame;

        uniform float posx;
        uniform float posy;
        uniform float t;

        float width;
        float height;
    `;

    private static vertStartFunc = `
        vec4 filterVertexPosition(void) {
            width = inputSize.x;
            height = inputSize.y;
            vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;
            vec2 inp = position - vec2(posx, posy);
            vec2 outp = vec2(inp.x, inp.y);
    `;

    private static vertEndFunc = `
            position = outp + vec2(posx, posy);
            return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
        }

        vec2 filterTextureCoord(void) {
            return aVertexPosition * (outputFrame.zw * inputSize.zw);
        }

        void main(void) {
            gl_Position = filterVertexPosition();
            vTextureCoord = filterTextureCoord();
        }
    `;

    private static fragPreUniforms = `
        precision highp float;
        varying vec2 vTextureCoord;
        uniform vec4 inputSize;
        uniform sampler2D uSampler;

        uniform float posx;
        uniform float posy;
        uniform float t;

        float width;
        float height;
    `;

    private static fragStartFunc = `
        vec4 getColor(float localx, float localy) {
            float tx = (localx + posx) / width;
            float ty = (localy + posy) / height;
            return texture2D(uSampler, vec2(tx, ty));
        }

        vec4 getWorldColor(float worldx, float worldy) {
            float tx = worldx / width;
            float ty = worldy / height;
            return texture2D(uSampler, vec2(tx, ty));
        }

        void main(void) {
            width = inputSize.x;
            height = inputSize.y;
            float worldx = vTextureCoord.x * width;
            float worldy = vTextureCoord.y * height;
            float x = worldx - posx;
            float y = worldy - posy;
            vec4 inp = texture2D(uSampler, vTextureCoord);
            // Un-premultiply alpha before applying the color matrix. See PIXI issue #3539.
            if (inp.a > 0.0) {
                inp.rgb /= inp.a;
            }
            vec4 outp = vec4(inp.r, inp.g, inp.b, inp.a);
    `;

    private static fragEndFunc = `
            // Premultiply alpha again.
            outp.rgb *= outp.a;
            gl_FragColor = outp;
        }
    `;
}

namespace TextureFilter {
    export const cache: Dict<PIXI.Filter> = {};

    export class Static extends TextureFilter {
        constructor(code: string) {
            super({ code });
        }
    }

    export class Mask extends TextureFilter {
        private type: Mask.Type;
        private offsetX: number;
        private offsetY: number;

        get invert() { return this.getUniform('invert'); }
        set invert(value: boolean) { this.setUniform('invert', value); }

        constructor(config: Mask.Config) {
            super({
                uniforms: [ "sampler2D mask", "float maskWidth", "float maskHeight", "float maskX", "float maskY", "bool invert" ],
                code: `
                    vec2 vTextureCoordMask = vTextureCoord * is.xy / vec2(maskWidth, maskHeight) - vec2(maskX, maskY) / vec2(maskWidth, maskHeight);
                    if (vTextureCoordMask.x >= 0.0 && vTextureCoordMask.x < 1.0 && vTextureCoordMask.y >= 0.0 && vTextureCoordMask.y < 1.0) {
                        float a = texture2D(mask, vTextureCoordMask).a;
                        outp *= invert ? 1.0-a : a;
                    } else {
                        outp.a = invert ? inp.a : 0.0;
                    }
                `
            });
            this.type = config.type;
            this.offsetX = O.getOrDefault(config.offsetX, 0);
            this.offsetY = O.getOrDefault(config.offsetY, 0);
            this.invert = O.getOrDefault(config.invert, false);
            this.setMask(config.mask);
        }

        setMask(mask: Texture) {
            this.setUniform('mask', mask.toMaskTexture());
            this.setUniform('maskWidth', mask.width);
            this.setUniform('maskHeight', mask.height);
            this.setMaskPosition(0, 0);
        }

        setTexturePosition(posx: number, posy: number) {
            super.setTexturePosition(posx, posy);
            this.setMaskPosition(posx, posy);
        }

        private setMaskPosition(textureX: number, textureY: number) {
            if (this.type === Mask.Type.GLOBAL) {
                this.setUniform('maskX', this.offsetX);
                this.setUniform('maskY', this.offsetY);
            } else if (this.type === Mask.Type.LOCAL) {
                this.setUniform('maskX', textureX + this.offsetX);
                this.setUniform('maskY', textureY + this.offsetY);
            }
        }
    }

    export namespace Mask {
        export type Config = {
            mask: Texture;
            type: Mask.Type;
            offsetX?: number;
            offsetY?: number;
            invert?: boolean;
        }

        export enum Type {
            GLOBAL = 'global', LOCAL = 'local',
        }
    }

    export class Slice extends TextureFilter {
        constructor(rect: Rect) {
            super({
                uniforms: [ "float sliceX", "float sliceY", "float sliceWidth", "float sliceHeight" ],
                defaultUniforms: {
                    'sliceX': rect.x,
                    'sliceY': rect.y,
                    'sliceWidth': rect.width,
                    'sliceHeight': rect.height,
                },
                code: `
                    if (x < sliceX || x >= sliceX + sliceWidth || y < sliceY || y >= sliceY + sliceHeight) {
                        outp.a = 0.0;
                    }
                `
            });
        }

        setSlice(rect: Rect) {
            this.setUniforms({
                'sliceX': rect.x,
                'sliceY': rect.y,
                'sliceWidth': rect.width,
                'sliceHeight': rect.height,
            });
        }
    }

    const _sliceFilter: Slice = new Slice({ x: 0, y: 0, width: 0, height: 0 });
    export function SLICE(rect: Rect) {
        _sliceFilter.setSlice(rect);
        return _sliceFilter;
    }
}