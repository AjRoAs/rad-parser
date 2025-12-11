/**
 * JPEG-LS Decoder Plugin (Adapter)
 * Transfer Syntaxes: 1.2.840.10008.1.2.4.80 (Lossless), 1.2.840.10008.1.2.4.81 (Near-lossless)
 */

/**
 * JPEG-LS Decoder Plugin (Adapter)
 * Transfer Syntaxes: 1.2.840.10008.1.2.4.80 (Lossless), 1.2.840.10008.1.2.4.81 (Near-lossless)
 */

import { CodecInfo, PixelDataCodec } from "./codecs";
import { concatFragments } from "../utils/pixelData";

export class JpegLsDecoder implements PixelDataCodec {
    name = "jpegls-adapter";
    priority = 20;
    codecInfo: CodecInfo = {
        multiFrame: false,
    };

    constructor(
        private externalDecoder?: (buffer: Uint8Array) => Promise<Uint8Array>,
        private externalEncoder?: (
            pixelData: Uint8Array,
            ts: string,
            w: number,
            h: number,
            s: number,
            b: number,
        ) => Promise<Uint8Array[]>,
    ) {}

    canEncode(transferSyntax: string): boolean {
        return !!this.externalEncoder && this.canDecode(transferSyntax);
    }

    async encode(
        pixelData: Uint8Array,
        transferSyntax: string,
        width: number,
        height: number,
        samples: number,
        bits: number,
    ): Promise<Uint8Array[]> {
        if (!this.externalEncoder)
            throw new Error("JPEG-LS encoder not configured.");
        return this.externalEncoder(
            pixelData,
            transferSyntax,
            width,
            height,
            samples,
            bits,
        );
    }

    isSupported(): boolean {
        return !!this.externalDecoder;
    }

    canDecode(transferSyntax: string): boolean {
        return [
            "1.2.840.10008.1.2.4.80", // JPEG-LS Lossless Image Compression
            "1.2.840.10008.1.2.4.81", // JPEG-LS Lossy (Near-Lossless) Image Compression
        ].includes(transferSyntax);
    }

    async decode(encodedBuffer: Uint8Array[], info: any): Promise<Uint8Array> {
        if (!this.externalDecoder) {
            throw new Error("JPEG-LS decoder not configured.");
        }

        const combined = concatFragments(encodedBuffer);

        return this.externalDecoder(combined);
    }
}
