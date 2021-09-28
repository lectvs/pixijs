/// <reference path="./textureCreationData.ts"/>
/// <reference path="./filter/textureFilter.ts"/>
/// <reference path="./filter/slice.ts"/>

class BasicTexture implements Texture {
    get width() { return this.renderTextureSprite._renderTexture.width; }
    get height() { return this.renderTextureSprite._renderTexture.height; }

    immutable: boolean;

    renderTextureSprite: Texture.PIXIRenderTextureSprite;

    constructor(width: number, height: number, immutable: boolean = false, source?: string) {
        this.renderTextureSprite = new Texture.PIXIRenderTextureSprite(width, height);
        this.immutable = immutable;
        TextureCreationData.logCreateTexture(this, source ?? arguments?.callee?.caller?.name ?? "none");
    }

    clear() {
        if (this.immutable) {
            error('Cannot clear immutable texture!');
            return;
        }
        this.renderTextureSprite.clear();
    }

    clone() {
        return this.transform();
    }

    free() {
        this.renderTextureSprite.renderTexture.destroy(true);
        TextureCreationData.logFreeTexture(this);
    }

    getLocalBounds(properties: Texture.Properties) {
        let scaleX = properties.scaleX ?? 1;
        let scaleY = properties.scaleY ?? 1;
        let angle = properties.angle ?? 0;
        let width = this.width * scaleX;
        let height = this.height * scaleY;

        if (angle === 0) {
            return rect(0, 0, width, height);
        }

        let v1x = 0;
        let v1y = 0;
        let v2x = width * M.cos(angle);
        let v2y = width * M.sin(angle);
        let v3x = -height * M.sin(angle);
        let v3y = height * M.cos(angle);
        let v4x = v2x + v3x;
        let v4y = v2y + v3y;

        let minx = Math.min(v1x, v2x, v3x, v4x);
        let maxx = Math.max(v1x, v2x, v3x, v4x);
        let miny = Math.min(v1y, v2y, v3y, v4y);
        let maxy = Math.max(v1y, v2y, v3y, v4y);

        return <Rect>{
            x: minx,
            y: miny,
            width: maxx - minx,
            height: maxy - miny,
        };
    }

    renderTo(texture: Texture, properties?: Texture.Properties) {
        if (!texture) return;
        if (texture.immutable) {
            error('Cannot render to immutable texture!');
            return;
        }

        properties = this.setRenderTextureSpriteProperties(properties);
        let allFilters = this.setRenderTextureSpriteFilters(texture, properties);
        texture.renderPIXIDisplayObject(this.renderTextureSprite);
        this.returnTextureFilters(allFilters);
    }

    renderPIXIDisplayObject(displayObject: PIXI.DisplayObject) {
        if (this.immutable) {
            error('Cannot render to immutable texture!');
            return;
        }
        global.renderer.render(displayObject, this.renderTextureSprite.renderTexture, false);
    }

    subdivide(h: number, v: number): Texture.Subdivision[] {
        if (h <= 0 || v <= 0) return [];

        let result: Texture.Subdivision[] = [];

        let framew = Math.floor(this.width/h);
        let frameh = Math.floor(this.height/v);
        let lastframew = this.width - (h-1)*framew;
        let lastframeh = this.height - (v-1)*frameh;

        for (let y = 0; y < v; y++) {
            for (let x = 0; x < h; x++) {
                let tx = x * framew;
                let ty = y * frameh;
                let tw = x === h-1 ? lastframew : framew;
                let th = y === v-1 ? lastframeh : frameh;
                let texture = new BasicTexture(tw, th);
                this.renderTo(texture, {
                    x: -tx,
                    y: -ty,
                });
                result.push({
                    x: tx, y: ty,
                    texture: texture
                });
            }
        }
        return result;
    }

    toMask() {
        return {
            renderTexture: this.renderTextureSprite.renderTexture,
            offsetx: 0, offsety: 0,
        };
    }

    /**
     * Returns a NEW texture which is transformed from the original.
     */
    transform(properties: Texture.TransformProperties = {}) {
        _.defaults(properties, {
            scaleX: 1,
            scaleY: 1,
            tint: 0xFFFFFF,
            alpha: 1,
            filters: [],
        });

        let result = new BasicTexture(this.width * Math.abs(properties.scaleX), this.height * Math.abs(properties.scaleY));
        this.renderTo(result, {
            x: this.width/2 * (Math.abs(properties.scaleX) - properties.scaleX),
            y: this.height/2 * (Math.abs(properties.scaleY) - properties.scaleY),
            scaleX: properties.scaleX,
            scaleY: properties.scaleY,
            tint: properties.tint,
            alpha: properties.alpha,
            filters: properties.filters,
        });
        return result;
    }

    private getAllTextureFilters(properties: Texture.Properties) {
        let allFilters: TextureFilter[] = [];

        if (properties.slice) {
            let sliceFilter = TextureFilter.SLICE_FILTER(properties.slice);
            let sliceRect = this.getSliceRect(properties);
            // Subtract sliceRect.xy because slice requires the shifted xy of the texture after slice
            Texture.setFilterProperties(sliceFilter, properties.x - sliceRect.x, properties.y - sliceRect.y, sliceRect.width, sliceRect.height);
            allFilters.push(sliceFilter);
        }

        if (properties.mask && properties.mask.texture) {
            let maskFilter = Mask.SHARED(properties.mask.texture, 'global', properties.mask.x, properties.mask.y, properties.mask.invert);
            Texture.setFilterProperties(maskFilter, properties.x, properties.y, this.width, this.height);
            allFilters.push(maskFilter);
        }

        properties.filters.forEach(filter => filter && Texture.setFilterProperties(filter, properties.x, properties.y, this.width, this.height));
        allFilters.push(...properties.filters);

        return allFilters.filter(filter => filter && filter.enabled);
    }

    private getSliceRect(properties: Texture.Properties) {
        return properties.slice ?? { x: 0, y: 0, width: this.width, height: this.height };
    }

    private returnTextureFilters(allFilters: TextureFilter[]) {
        allFilters.forEach(filter => filter.returnPixiFilter());
    }

    private setRenderTextureSpriteProperties(properties: Texture.Properties) {
        if (!properties) properties = {};

        _.defaults(properties, {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            tint: 0xFFFFFF,
            alpha: 1,
            slice: undefined,
            filters: [],
            blendMode: Texture.BlendModes.NORMAL,
        });

        let sliceRect = this.getSliceRect(properties);

        // Position
        this.renderTextureSprite.x = properties.x - sliceRect.x;
        this.renderTextureSprite.y = properties.y - sliceRect.y;

        // Other values
        this.renderTextureSprite.scale.x = properties.scaleX;
        this.renderTextureSprite.scale.y = properties.scaleY;
        this.renderTextureSprite.angle = properties.angle;
        this.renderTextureSprite.tint = properties.tint;
        this.renderTextureSprite.alpha = properties.alpha;
        this.renderTextureSprite.blendMode = <number><any>properties.blendMode;

        return properties;
    }

    private setRenderTextureSpriteFilters(destTexture: Texture, properties: Texture.Properties) {
        let allFilters = this.getAllTextureFilters(properties);
        allFilters.forEach(filter => filter.update());
        this.renderTextureSprite.filters = allFilters.map(filter => filter.borrowPixiFilter());
        this.renderTextureSprite.filterArea = new PIXI.Rectangle(0, 0, destTexture.width, destTexture.height);
        return allFilters;
    }
}
