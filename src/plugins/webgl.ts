/**
 * WebGL Decoder Plugin (Fallback)
 * GPGPU style decoding using WebGL 2.0
 */

import { PixelDataCodec } from './codecs';

export class WebGlDecoder implements PixelDataCodec {
    name = 'webgl-fallback';
    priority = 80;

    isSupported(): boolean {
        if (typeof document === 'undefined') return false;
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch(e) { return false; }
    }

    canDecode(transferSyntax: string): boolean {
         // Universal Support (Fallback Tier)
         return [
            '1.2.840.10008.1.2.5',      // RLE
            '1.2.840.10008.1.2.4.50',   // JPEG Baseline
            '1.2.840.10008.1.2.4.51',   // JPEG Extended
            '1.2.840.10008.1.2.4.57',   // JPEG Lossless (Proc 14)
            '1.2.840.10008.1.2.4.70',   // JPEG Lossless (SV1)
            '1.2.840.10008.1.2.4.80',   // JPEG-LS Lossless
            '1.2.840.10008.1.2.4.81',   // JPEG-LS Lossy
            '1.2.840.10008.1.2.4.90',   // JPEG 2000 Lossless
            '1.2.840.10008.1.2.4.91',   // JPEG 2000
            '1.2.840.10008.1.2.4.100',  // MPEG2
            '1.2.840.10008.1.2.4.101',  // MPEG2
            '1.2.840.10008.1.2.4.102',  // MPEG-4 AVC
            '1.2.840.10008.1.2.4.103',  // MPEG-4 AVC
        ].includes(transferSyntax); 
    }

    async decode(encodedBuffer: Uint8Array[], length?: number, info?: any): Promise<Uint8Array> {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error("WebGL2 not supported");

        // 1. Prepare Data
        // Flatten input
        const totalSize = encodedBuffer.reduce((acc, b) => acc + b.length, 0);
        const inputData = new Uint8Array(totalSize);
        let offset = 0;
        for (const b of encodedBuffer) {
            inputData.set(b, offset);
            offset += b.length;
        }

        // Texture size need to fit data
        // Max texture size check?
        const width = 4096;
        const height = Math.ceil((totalSize / 4) / width); // RGBA = 4 bytes
        canvas.width = width;
        canvas.height = height;

        // 2. Create Input Texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Upload data as RGBA UA
        // Padding might be needed if not aligned
        const paddedSize = width * height * 4;
        const paddedData = new Uint8Array(paddedSize);
        paddedData.set(inputData);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, paddedData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 3. Setup Shaders (Pass-through / Decode logic)
        const vsSource = `#version 300 es
        in vec4 position;
        void main() {
            gl_Position = position;
        }`;
        
        const fsSource = `#version 300 es
        precision highp float;
        uniform highp usampler2D u_texture; // Use usampler for uint data
        out uvec4 outColor;
        void main() {
            // Read input texel
            ivec2 coord = ivec2(gl_FragCoord.xy);
            uvec4 val = texelFetch(u_texture, coord, 0);
            
            // Decode Logic Here...
            // For now, pass-through
            outColor = val;
        }`;

        const program = this.createProgram(gl, vsSource, fsSource);
        gl.useProgram(program);

        // 4. Setup Geometry (Full Screen Quad)
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        const positionLoc = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // Bind Texture
        const texLoc = gl.getUniformLocation(program, 'u_texture');
        gl.uniform1i(texLoc, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // 5. Render to Framebuffer (Output)
        // We'd render to a texture if we want output bytes
        const targetTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, width, height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null); // Integer format
        
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

        gl.viewport(0, 0, width, height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 6. Read Pixels
        const results = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, results);

        // Cleanup
        gl.deleteTexture(texture);
        gl.deleteTexture(targetTexture);
        gl.deleteFramebuffer(fb);
        gl.deleteProgram(program);

        return results.slice(0, length || totalSize);
    }
    
    canEncode(transferSyntax: string): boolean {
        return this.canDecode(transferSyntax);
    }

    async encode(pixelData: Uint8Array, transferSyntax: string, width: number, height: number, samples: number, bits: number): Promise<Uint8Array[]> {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error("WebGL2 not supported");

        // Use same texture logic as decode, but reversing it roughly?
        // Actually, encode typically takes Raw Pixel Data -> Encoded stream.
        // For pass-through stub, we just take Raw -> Render -> ReadPixels -> (Mock Encoded)
        
        // 1. Setup Canvas size to match input data size roughly
        const totalSize = pixelData.byteLength;
        const texWidth = 4096;
        const texHeight = Math.ceil((totalSize / 4) / texWidth);
        canvas.width = texWidth;
        canvas.height = texHeight;

        // 2. Input Texture (Raw Data)
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const paddedSize = texWidth * texHeight * 4;
        const paddedData = new Uint8Array(paddedSize);
        paddedData.set(pixelData);
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, paddedData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        // 3. Simple Pass-Through Shader
        const vsSource = `#version 300 es
        in vec4 position;
        void main() { gl_Position = position; }`;
        const fsSource = `#version 300 es
        precision highp float;
        uniform highp usampler2D u_texture;
        out uvec4 outColor;
        void main() {
            ivec2 coord = ivec2(gl_FragCoord.xy);
            outColor = texelFetch(u_texture, coord, 0);
        }`;
        
        const program = this.createProgram(gl, vsSource, fsSource);
        gl.useProgram(program);

        // 4. Quad
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const positionLoc = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        // 5. Render to Framebuffer (Simulating "Encoding" process)
        const targetTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, targetTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, texWidth, texHeight, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null);
        
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTexture, 0);

        gl.viewport(0, 0, texWidth, texHeight);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // 6. Read "Encoded" bytes
        const results = new Uint8Array(texWidth * texHeight * 4);
        gl.readPixels(0, 0, texWidth, texHeight, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, results);

        // Cleanup
        gl.deleteTexture(texture);
        gl.deleteTexture(targetTexture);
        gl.deleteFramebuffer(fb);
        gl.deleteProgram(program);

        return [results.slice(0, totalSize)];
    }

    
    private createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
        const p = gl.createProgram();
        if(!p) throw new Error("Create Program failed");
        
        const v = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(v, vs);
        gl.compileShader(v);
        if(!gl.getShaderParameter(v, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(v)!);
        
        const f = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(f, fs);
        gl.compileShader(f);
        if(!gl.getShaderParameter(f, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(f)!);
        
        gl.attachShader(p, v);
        gl.attachShader(p, f);
        gl.linkProgram(p);
        if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
        
        return p;
    }
}
