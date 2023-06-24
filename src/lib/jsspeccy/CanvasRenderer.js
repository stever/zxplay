export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.getImageData(0, 0, 320, 240);
        this.pixels = new Uint32Array(this.imageData.data.buffer);
        this.flashPhase = 0;

        this.palette = new Uint32Array([
            /* RGBA dark */
            0x000000ff,
            0x0000ddff,
            0xdd0000ff,
            0xdd00ddff,
            0x00dd00ff,
            0x00ddddff,
            0xdddd00ff,
            0xddddddff,
            /* RGBA bright */
            0x000000ff,
            0x0000ffff,
            0xff0000ff,
            0xff00ffff,
            0x00ff00ff,
            0x00ffffff,
            0xffff00ff,
            0xffffffff,
        ]);

        const testUint8 = new Uint8Array(new Uint16Array([0x8000]).buffer);
        const isLittleEndian = (testUint8[0] === 0);
        if (isLittleEndian) {
            /* need to reverse the byte ordering of palette */
            for (let i = 0; i < 16; i++) {
                const color = this.palette[i];
                this.palette[i] = (
                        (color << 24) & 0xff000000)
                    | ((color << 8) & 0xff0000)
                    | ((color >>> 8) & 0xff00)
                    | ((color >>> 24) & 0xff
                    );
            }
        }
    }

    showFrame(frameBuffer) {
        const frameBytes = new Uint8Array(frameBuffer);
        let pixelPtr = 0;
        let bufferPtr = 0;
        /* top border */
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 160; x++) {
                let border = this.palette[frameBytes[bufferPtr++]]
                this.pixels[pixelPtr++] = border;
                this.pixels[pixelPtr++] = border;
            }
        }

        for (let y = 0; y < 192; y++) {
            /* left border */
            for (let x = 0; x < 16; x++) {
                let border = this.palette[frameBytes[bufferPtr++]]
                this.pixels[pixelPtr++] = border;
                this.pixels[pixelPtr++] = border;
            }
            /* main screen */
            for (let x = 0; x < 32; x++) {
                let bitmap = frameBytes[bufferPtr++];
                const attr = frameBytes[bufferPtr++];
                let ink, paper;
                if ((attr & 0x80) && (this.flashPhase & 0x10)) {
                    // reverse ink and paper
                    paper = this.palette[((attr & 0x40) >> 3) | (attr & 0x07)];
                    ink = this.palette[(attr & 0x78) >> 3];
                } else {
                    ink = this.palette[((attr & 0x40) >> 3) | (attr & 0x07)];
                    paper = this.palette[(attr & 0x78) >> 3];
                }
                for (let i = 0; i < 8; i++) {
                    this.pixels[pixelPtr++] = (bitmap & 0x80) ? ink : paper;
                    bitmap <<= 1;
                }
            }
            /* right border */
            for (let x = 0; x < 16; x++) {
                let border = this.palette[frameBytes[bufferPtr++]]
                this.pixels[pixelPtr++] = border;
                this.pixels[pixelPtr++] = border;
            }
        }
        /* bottom border */
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 160; x++) {
                let border = this.palette[frameBytes[bufferPtr++]]
                this.pixels[pixelPtr++] = border;
                this.pixels[pixelPtr++] = border;
            }
        }
        this.ctx.putImageData(this.imageData, 0, 0);
        this.flashPhase = (this.flashPhase + 1) & 0x1f;
    }
}
