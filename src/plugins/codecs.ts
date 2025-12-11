export interface CodecInfo {
    multiFrame: boolean; // Does the codec handle multi-frame fragments individually?
}

export interface PixelDataCodec {
    name: string;
    priority: number;
    codecInfo: CodecInfo;
    isSupported(): Promise<boolean> | boolean;
    canDecode(transferSyntax: string): boolean;
    decode(encodedBuffer: Uint8Array[], info: any): Promise<Uint8Array>;

    // Encoding Support
    canEncode?(transferSyntax: string): boolean;
    encode?(
        pixelData: Uint8Array,
        transferSyntax: string,
        width: number,
        height: number,
        samples: number,
        bits: number,
    ): Promise<Uint8Array[]>;
}

// Type for a function that dynamically imports a codec module
type DynamicCodecLoader = () => Promise<{
    [key: string]: new () => PixelDataCodec;
}>;

export class CodecRegistry {
    private codecs: PixelDataCodec[] = [];
    private dynamicCodecs: Map<string, DynamicCodecLoader> = new Map();
    private loadingCodecs: Map<string, Promise<PixelDataCodec | null>> =
        new Map();

    register(codec: PixelDataCodec) {
        // Avoid duplicates
        if (!this.codecs.some((c) => c.name === codec.name)) {
            this.codecs.push(codec);
            this.codecs.sort((a, b) => b.priority - a.priority);
        }
    }

    registerDynamic(transferSyntax: string, loader: DynamicCodecLoader) {
        this.dynamicCodecs.set(transferSyntax, loader);
    }

    async getDecoder(transferSyntax: string): Promise<PixelDataCodec | null> {
        // 1. Check statically registered codecs first
        for (const codec of this.codecs) {
            if (
                codec.canDecode(transferSyntax) &&
                (await codec.isSupported())
            ) {
                return codec;
            }
        }

        // 2. Check if a dynamic loader is available
        const loader = this.dynamicCodecs.get(transferSyntax);
        if (!loader) {
            return null;
        }

        // 3. Handle concurrent loading
        if (this.loadingCodecs.has(transferSyntax)) {
            return this.loadingCodecs.get(transferSyntax)!;
        }

        // 4. Load, instantiate, and register the codec
        const loadPromise = (async () => {
            try {
                const codecModule = await loader();
                const codecClass = Object.values(codecModule)[0];
                if (!codecClass) throw new Error("Invalid codec module");

                const codecInstance = new codecClass();
                if (
                    codecInstance.canDecode(transferSyntax) &&
                    (await codecInstance.isSupported())
                ) {
                    this.register(codecInstance); // Add to static list for next time
                    return codecInstance;
                }
                return null;
            } catch (e) {
                console.error(
                    `Error dynamically loading codec for ${transferSyntax}:`,
                    e,
                );
                return null;
            } finally {
                this.loadingCodecs.delete(transferSyntax);
            }
        })();

        this.loadingCodecs.set(transferSyntax, loadPromise);
        return loadPromise;
    }

    async getEncoder(transferSyntax: string): Promise<PixelDataCodec | null> {
        for (const codec of this.codecs) {
            if (codec.canEncode && codec.canEncode(transferSyntax)) {
                if (await codec.isSupported()) {
                    return codec;
                }
            }
        }
        // Dynamic loading for encoders can be added here if needed
        return null;
    }

    getCodecs(): PixelDataCodec[] {
        return this.codecs;
    }
}

export const registry = new CodecRegistry();
