namespace ConvertTilemap {

    function not(i: number): SmartTilemap.Rule.PatternTile {
        return { type: 'not', index: i };
    }

    export function convert(binaryTiles: number[][], tileset: Tilemap.Tileset): Tilemap.Config {

        let tilesWithWalls = getRoughTilemap(binaryTiles);

        let tilemapLayer = A.map2D(tilesWithWalls, tileIndex => <Tilemap.Tile>{ index: tileIndex, angle: 0, flipX: false });

        let smartTilemapLayer = SmartTilemap.getSmartTilemapLayer(tilemapLayer, {
            rules: SmartTilemap.sortedRules([
                // General
                { pattern: { tile: 0 }, tile: 9 },
                { pattern: { tile: -1 }, tile: -1 },

                // Edges
                { pattern: { tile: 0, above: not(0) }, tile: 1 },
                { pattern: { tile: 0, below: not(0) }, tile: 17 },
                { pattern: { tile: 0, left: not(0) }, tile: 8 },
                { pattern: { tile: 0, right: not(0) }, tile: 10 },

                // Corners
                { pattern: { tile: 0, above: not(0), left: not(0) }, tile: 0 },
                { pattern: { tile: 0, above: not(0), right: not(0) }, tile: 2 },
                { pattern: { tile: 0, below: not(0), left: not(0) }, tile: 16 },
                { pattern: { tile: 0, below: not(0), right: not(0) }, tile: 18 },

                // Double Edges
                { pattern: { tile: 0, above: not(0), below: not(0) }, tile: 25 },
                { pattern: { tile: 0, left: not(0), right: not(0) }, tile: 11 },

                // Peninsulas
                { pattern: { tile: 0, above: not(0), below: not(0), left: not(0) }, tile: 24 },
                { pattern: { tile: 0, above: not(0), below: not(0), right: not(0) }, tile: 26 },
                { pattern: { tile: 0, left: not(0), right: not(0), above: not(0) }, tile: 3 },
                { pattern: { tile: 0, left: not(0), right: not(0), below: not(0) }, tile: 19 },

                // Inverse Corners
                { pattern: { tile: 0, aboveLeft: not(0) }, tile: 4 },
                { pattern: { tile: 0, aboveRight: not(0) }, tile: 5 },
                { pattern: { tile: 0, belowLeft: not(0) }, tile: 12 },
                { pattern: { tile: 0, belowRight: not(0) }, tile: 13 },

                // Wall General
                { pattern: { tile: 1 }, tile: 33 },

                // Wall Edges
                { pattern: { tile: 1, left: -1 }, tile: 32 },
                { pattern: { tile: 1, right: -1 }, tile: 34 },

                // Wall Double Edge
                { pattern: { tile: 1, left: -1, right: -1 }, tile: 35 },
            ]),
            outsideRule: { type: 'extend' },
        })

        let ceilingZ = 2;
        return {
            tilemap: {
                tileset: tileset,
                layers: [smartTilemapLayer],
            },
            zMap: {
                0: ceilingZ,  1: ceilingZ,  2: ceilingZ,  3: ceilingZ,  4: ceilingZ,  5: ceilingZ,
                8: ceilingZ,  9: ceilingZ, 10: ceilingZ, 11: ceilingZ,
               16: ceilingZ, 17: ceilingZ, 18: ceilingZ, 19: ceilingZ,
               24: ceilingZ, 25: ceilingZ, 26: ceilingZ, 27: ceilingZ,
           },
        };
    }

    export function getRoughTilemap(binaryTiles: number[][]) {
        let tilesWithWalls = A.filledArray2D(binaryTiles.length, binaryTiles[0].length, -1);

        // Create walls
        for (let y = 0; y < binaryTiles.length; y++) {
            for (let x = 0; x < binaryTiles[y].length; x++) {
                if (binaryTiles[y][x] === 0) {
                    if (y+1 < tilesWithWalls.length) tilesWithWalls[y+1][x] = 1;
                    //if (y+2 < tilesWithWalls.length) tilesWithWalls[y+2][x] = 1;
                }
            }
        }

        // Create ceiling
        for (let y = 0; y < binaryTiles.length; y++) {
            for (let x = 0; x < binaryTiles[y].length; x++) {
                if (binaryTiles[y][x] === 0) {
                    tilesWithWalls[y][x] = 0;
                }
            }
        }

        return tilesWithWalls;
    }
}