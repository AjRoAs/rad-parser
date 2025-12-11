import * as fs from "fs";
import * as path from "path";
import { parse, write, anonymize, registry, formatTagWithComma } from "./index";

const args = process.argv.slice(2);
const command = args[0];

async function run() {
    if (!command) {
        printHelp();
        process.exit(1);
    }

    switch (command) {
        case "dump":
            if (!args[1]) {
                console.error("Usage: rad-parser dump <file>");
                process.exit(1);
            }
            dumpFile(args[1]);
            break;

        case "anonymize":
            if (!args[1]) {
                console.error("Usage: rad-parser anonymize <input> [output]");
                process.exit(1);
            }
            anonymizeFile(args[1], args[2]);
            break;

        case "convert":
            if (!args[1] || !args[2]) {
                console.error("Usage: rad-parser convert <input> <output>");
                process.exit(1);
            }
            await convertFile(args[1], args[2]);
            break;

        case "help":
        case "--help":
        case "-h":
            printHelp();
            break;

        default:
            console.error(`Unknown command: ${command}`);
            printHelp();
            process.exit(1);
    }
}

function printHelp() {
    console.log(`
rad-parser CLI v2.0.0

Commands:
  dump <file>                  Parse and print DICOM tags from a file.
  anonymize <input> [output]   Anonymize a DICOM file using Basic Application Level Confidentiality Profile.
                               If output is omitted, defaults to <input>_anon.dcm.
  convert <input> <output>     Convert/Rewrite a DICOM file (e.g. to Explicit VR Little Endian).
    `);
}

function dumpFile(filePath: string) {
    try {
        const buffer = fs.readFileSync(filePath);
        const dataset = parse(new Uint8Array(buffer), { type: "full" });

        console.log(`\nParsed ${filePath}:`);
        console.log(`Total Tags: ${Object.keys(dataset.dict).length}`);
        console.log("-".repeat(50));

        // Sort tags
        const sortedTags = Object.keys(dataset.dict).sort();

        for (const tag of sortedTags) {
            const element = (dataset.dict as any)[tag];
            const tagName = formatTagWithComma(tag);
            const vr = element.vr || "UN";
            let value = element.Value;

            // Format value for display
            if (value instanceof Uint8Array) {
                value = `[Binary Data: ${value.length} bytes]`;
            } else if (
                value instanceof Uint8Array ||
                (Array.isArray(value) && value[0] instanceof Uint8Array)
            ) {
                value = `[Binary Data / Fragments]`;
            } else if (typeof value === "object" && value !== null) {
                value = JSON.stringify(value);
            }

            // Truncate long values
            let displayValue = String(value);
            if (displayValue.length > 50) {
                displayValue = displayValue.substring(0, 47) + "...";
            }

            console.log(`${tagName} [${vr}] : ${displayValue}`);
        }
        console.log("-".repeat(50));
    } catch (e: any) {
        console.error(`Error parsing file: ${e.message}`);
        process.exit(1);
    }
}

function anonymizeFile(inputPath: string, outputPath?: string) {
    try {
        if (!outputPath) {
            const ext = path.extname(inputPath);
            const base = path.basename(inputPath, ext);
            outputPath = path.join(
                path.dirname(inputPath),
                `${base}_anon${ext}`,
            );
        }

        const buffer = fs.readFileSync(inputPath);
        const dataset = parse(new Uint8Array(buffer), {
            type: "full",
        }) as import("./core/types").DicomDataSet;

        console.log(`Anonymizing ${inputPath}...`);
        const anonDataset = anonymize(dataset);

        console.log(`Writing to ${outputPath}...`);
        const outBytes = write(anonDataset);

        fs.writeFileSync(outputPath, outBytes);
        console.log("Done.");
    } catch (e: any) {
        console.error(`Error anonymizing file: ${e.message}`);
        process.exit(1);
    }
}

async function convertFile(inputPath: string, outputPath: string) {
    try {
        const buffer = fs.readFileSync(inputPath);
        console.log(`Reading ${inputPath}...`);
        const dataset = parse(new Uint8Array(buffer), {
            type: "full",
        }) as import("./core/types").DicomDataSet;

        // Let's implement robust Logic:
        // 1. Get current Transfer Syntax
        const transferSyntaxElement = dataset.dict["x00020010"];
        const currentTs = transferSyntaxElement
            ? (transferSyntaxElement.Value as string[])[0]
            : "1.2.840.10008.1.2.1";
        console.log(`Current Transfer Syntax: ${currentTs}`);

        // 2. Decode Pixel Data if compressed
        const pixelParams = getPixelDataParams(dataset);

        if (pixelParams && pixelParams.pixelData) {
            const decoder = await registry.getDecoder(currentTs);
            if (decoder) {
                console.log(`Decoding using ${decoder.name}...`);

                // Construct the info object for the decoder
                const samplesPerPixelEl = dataset.dict["x00280002"];
                const bitsAllocatedEl = dataset.dict["x00280100"];

                const info = {
                    transferSyntax: currentTs,
                    samplesPerPixel:
                        samplesPerPixelEl &&
                        Array.isArray(samplesPerPixelEl.Value)
                            ? (samplesPerPixelEl.Value[0] as number)
                            : 1,
                    bitsAllocated:
                        bitsAllocatedEl && Array.isArray(bitsAllocatedEl.Value)
                            ? (bitsAllocatedEl.Value[0] as number)
                            : 8,
                    // Add other relevant tags if needed by codecs
                };

                const raw = await decoder.decode(pixelParams.pixelData, info);
                // 3. Re-Encode logic could go here

                const targetTs = "1.2.840.10008.1.2.1"; // Explicit Little Endian

                // Updating PixelData
                dataset.dict["x7fe00010"].Value = raw;
                dataset.dict["x7fe00010"].vr = "OW";
                // Update Transfer Syntax
                if (dataset.dict["x00020010"]) {
                    dataset.dict["x00020010"].Value = [targetTs];
                } else {
                    // Add if missing (unlikely if valid dicom)
                    dataset.dict["x00020010"] = { vr: "UI", Value: [targetTs] };
                }
                console.log(
                    "Transcoded to Uncompressed (Explicit VR Little Endian)",
                );
            } else {
                console.log("No decoder found or already uncompressed.");
            }
        }

        console.log(`Writing to ${outputPath}...`);
        const outBytes = write(dataset);

        fs.writeFileSync(outputPath, outBytes);
        console.log("Done.");
    } catch (e: any) {
        console.error(`Error converting file: ${e.message}`);
        process.exit(1);
    }
}

function getPixelDataParams(dataset: any) {
    const el = dataset.dict["x7fe00010"];
    if (!el || !el.Value) return null;
    // Check if encapsulated
    if (
        Array.isArray(el.Value) &&
        el.Value[0] instanceof Uint8Array &&
        el.Value.length > 1
    ) {
        return { pixelData: el.Value };
    }
    if (
        Array.isArray(el.Value) &&
        el.Value[0] instanceof Uint8Array &&
        el.Value.length === 1 &&
        el.vr === "OB"
    ) {
        // Single fragment OW/OB
        return { pixelData: el.Value as Uint8Array[] };
    }
    return null;
}

export { run };

// Run if main
import { fileURLToPath } from "url";
// ESM check
if (import.meta.url && process.argv[1] === fileURLToPath(import.meta.url)) {
    run().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
