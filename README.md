# RAD-Parser

**RAD-Parser** is a lightweight, performant, self-contained DICOM parser implementation with zero external dependencies. Designed for safety, efficiency, and reliability in medical imaging applications.

[![npm version](https://img.shields.io/npm/v/rad-parser.svg)](https://www.npmjs.com/package/rad-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

-   ✅ **Zero Dependencies**: Pure TypeScript/JavaScript implementation using only native APIs
-   ✅ **Lightweight**: Minimal code footprint (~600 lines)
-   ✅ **Performant**: Efficient binary parsing with bounds checking
-   ✅ **Parsing Modes**: `shallowParse` (scan), `mediumParse` (meta), and `fullParse` (deep)
-   ✅ **Safe**: Comprehensive error handling and safety limits
-   ✅ **Self-Contained**: All code in a single module, no external imports
-   ✅ **DICOM Part 10 Support**: Handles both Part 10 and non-Part 10 DICOM files
-   ✅ **Transfer Syntax Detection**: Automatic detection of implicit/explicit VR and endianness
-   ✅ **Compatible**: Returns data structures compatible with dcmjs format

## Installation

```bash
npm install rad-parser
```

Or install from GitHub:

```bash
npm install github:AjRoAs/rad-parse
```

The parser is self-contained and has **zero external dependencies**.

## Usage

### Basic Usage

```typescript
import {
    fullParse,
    shallowParse,
    mediumParse,
    extractPixelData,
} from "rad-parser";

// 1. Full Parse: Detailed parsing of everything (slower, more memory)
// formerly 'parseWithRadParser'
const dataset = fullParse(byteArray);

// 2. Shallow Parse: Ultra-fast scanning of top-level tags (no recursion, no large values)
// Ideal for indexing or quick checks.
const shallow = shallowParse(byteArray);
console.log(shallow["x00100010"].vr); // 'PN'

// 3. Medium Parse: Full metadata but skips Pixel Data (saves memory)
const metadataOnly = mediumParse(byteArray);

// 4. Extract Pixel Data: Get raw pixel buffer without parsing metadata
const pixelData = extractPixelData(byteArray);

// Access DICOM tags (from full/medium parse)
const patientName = dataset.string("x00100010"); // Patient's Name
const patientId = dataset.string("x00100020"); // Patient ID
const studyDate = dataset.string("x00080020"); // Study Date
```

### CommonJS usage

```javascript
const { parseWithRadParser } = require("rad-parser");
```

### Tag Formats

The parser supports multiple tag formats for compatibility:

```typescript
// x-prefixed format (recommended)
dataset.string("x00100010");

// Comma-separated format
dataset.string("0010,0010");

// Both formats work interchangeably
```

### Access Methods

```typescript
// String values
const patientName = dataset.string("x00100010");

// Numeric values
const sliceThickness = dataset.floatString("x00180050");
const rows = dataset.uint16("x00280010");
const columns = dataset.uint16("x00280011");

// Direct dictionary access
const element = dataset.dict["x00100010"];
console.log(element.vr); // Value Representation
console.log(element.Value); // Value
console.log(element.length); // Length in bytes
```

## Architecture

### Modular Structure

93: RAD-Parser is organized into focused modules:
94:
95: 1. **SafeDataView** (`SafeDataView.ts`): Safe byte reading with bounds checking
96: 2. **VR Detection** (`vrDetection.ts`): Implicit VR detection using optimized Map lookups
97: 3. **Value Parsers** (`valueParsers.ts`): Specialized parsers for PN, DA, TM, DT, AS VR types
98: 4. **Sequence Parser** (`sequenceParser.ts`): Full sequence (SQ) parsing with nested items and structural validation
99: 5. **Transfer Syntax** (`extractTransferSyntax.ts`): Optimized transfer syntax extraction
100: 6. **Dictionary** (`dictionary.ts`): DICOM tag dictionary integration
101: 7. **Tag Utils** (`tagUtils.ts`): Tag format normalization utilities
102: 8. **Parser** (`parser.ts`): Main parser orchestrating all modules with standardized error handling
103: 9. **Types** (`types.ts`): TypeScript type definitions

### Core Components

1. **SafeDataView**: A wrapper around `DataView` that provides safe byte reading with bounds checking
2. **Transfer Syntax Detection**: Automatically detects and handles different DICOM transfer syntaxes
3. **Tag Normalization**: Converts tags between different formats for compatibility
4. **Value Parsing**: Handles different VR (Value Representation) types appropriately
5. **Sequence Parsing**: Full support for nested sequences and items
6. **Character Set Handling**: Automatic detection and application of DICOM character sets

### Supported Transfer Syntaxes

-   **Implicit VR Little Endian** (`1.2.840.10008.1.2`)
-   **Explicit VR Little Endian** (`1.2.840.10008.1.2.1`) - Default
-   **Explicit VR Big Endian** (`1.2.840.10008.1.2.2`)

### Supported VR Types

The parser handles all common DICOM VR types:

-   **String Types**: AE, AS, CS, DA, DS, DT, IS, LO, LT, PN, SH, ST, TM, UI, UT, UC, UR
-   **Numeric Types**: SS, US, SL, UL, FL, FD, DS, IS
-   **Binary Types**: OB, OW, OF, OD, OL, UN
-   **Special Types**: AT (Attribute Tag), SQ (Sequence)

## Safety Features

### Bounds Checking

All read operations check buffer bounds before accessing data:

```typescript
readUint16(): number {
  if (this.offset + 2 > this.view.byteLength) {
    throw new Error('Read beyond buffer');
  }
  // ... safe read
}
```

### Safety Limits

-   **Maximum iterations**: 10,000 elements per file (prevents infinite loops)
-   **Maximum value size**: 1MB per element (prevents memory exhaustion)
-   **Meta information limit**: 20 elements (prevents excessive scanning)

### Error Handling

The parser gracefully handles:

-   Invalid file formats
-   Corrupted data
-   Missing transfer syntax information
-   Unexpected end of file

## Performance

RAD-Parser is optimized for performance:

-   **Single-pass parsing**: Reads through the file once
-   **Efficient memory usage**: Uses views instead of copying data
-   **Minimal allocations**: Reuses buffers where possible
-   **Fast tag lookup**: Multiple format support without performance penalty

## Feature Comparison

### ✅ Implemented Features

-   **Sequence Parsing**: Full support for DICOM sequences (SQ VR) with nested items
-   **Implicit VR Detection**: Automatic VR detection for implicit transfer syntax files
-   **Person Name Parsing**: Structured parsing of PN VR with Alphanumeric, Ideographic, and Phonetic components
-   **Date/Time Parsing**: Automatic conversion of DA, TM, and DT VR to Date objects
-   **Age String Parsing**: Structured parsing of AS VR (e.g., "012Y" → {value: 12, unit: 'Y'})
-   **Character Set Support**: Handles multiple character sets (UTF-8, Latin-1, ISO_IR 100, etc.)
-   **Tag Dictionary**: Full DICOM tag dictionary integration for tag name lookup
-   **Transfer Syntax Detection**: Automatic detection and handling of all common transfer syntaxes
-   **Modular Architecture**: Clean separation of concerns with dedicated modules

## Comparison with Other DICOM Parsers

| Feature                       | rad-parser              | dcmjs              | dicom-parser         | efferent-dicom         |
| ----------------------------- | ----------------------- | ------------------ | -------------------- | ---------------------- |
| **Dependencies**              | ✅ Zero                 | ❌ Multiple        | ❌ Multiple          | ❌ Multiple            |
| **Bundle Size**               | ✅ ~50KB                | ⚠️ ~500KB+         | ⚠️ ~200KB+           | ⚠️ ~300KB+             |
| **Self-Contained**            | ✅ Yes                  | ❌ No              | ❌ No                | ❌ No                  |
| **Part 10 Support**           | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ✅ Yes                 |
| **Transfer Syntax Detection** | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ✅ Yes                 |
| **Implicit VR**               | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ⚠️ Limited             |
| **Explicit VR**               | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ✅ Yes                 |
| **Big Endian**                | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ⚠️ Limited             |
| **Sequence Parsing**          | ✅ Yes                  | ✅ Yes             | ⚠️ Basic             | ⚠️ Basic               |
| **Person Name (PN)**          | ✅ Structured           | ✅ Structured      | ⚠️ String only       | ⚠️ String only         |
| **Date/Time Parsing**         | ✅ Date objects         | ⚠️ Strings         | ⚠️ Strings           | ⚠️ Strings             |
| **Character Sets**            | ✅ Multiple             | ✅ Multiple        | ⚠️ Limited           | ⚠️ Limited             |
| **Tag Dictionary**            | ✅ Full (5300+ tags)    | ⚠️ Partial         | ❌ No                | ❌ No                  |
| **Error Handling**            | ✅ Comprehensive        | ✅ Good            | ⚠️ Basic             | ⚠️ Basic               |
| **Safety Limits**             | ✅ Yes                  | ⚠️ Limited         | ⚠️ Limited           | ⚠️ Limited             |
| **Bounds Checking**           | ✅ All operations       | ⚠️ Some            | ⚠️ Some              | ⚠️ Some                |
| **Modular**                   | ✅ Yes                  | ❌ Monolithic      | ❌ Monolithic        | ❌ Monolithic          |
| **TypeScript**                | ✅ Full types           | ⚠️ Partial         | ⚠️ Partial           | ⚠️ Partial             |
| **Performance**               | ⚠️ Deep parsing (~22ms) | ✅ Fast (~1.55 ms) | ✅ Fastest (~126 μs) | ⚠️ Moderate (~2.76 ms) |
| **Memory Usage**              | ✅ Low                  | ⚠️ Medium          | ✅ Low               | ⚠️ Medium              |
| **Pixel Data**                | ✅ Full                 | ✅ Full            | ✅ Full              | ✅ Full                |
| **RLE Compression**           | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ⚠️ Limited             |
| **JPEG Compression**          | ⚠️ Browser API          | ✅ Yes             | ✅ Yes               | ⚠️ Limited             |
| **Private Tags**              | ✅ Enhanced detection   | ✅ Dictionary      | ⚠️ Basic             | ⚠️ Basic               |
| **Browser Support**           | ✅ All modern           | ✅ All modern      | ✅ All modern        | ⚠️ Modern only         |
| **Node.js Support**           | ✅ Yes                  | ✅ Yes             | ✅ Yes               | ✅ Yes                 |
| **Maintenance**               | ✅ Active               | ✅ Active          | ⚠️ Slow              | ⚠️ Slow                |
| **License**                   | ✅ MIT                  | ✅ MIT             | ✅ MIT               | ✅ MIT                 |

### Legend

-   ✅ **Full Support**: Feature is fully implemented and working
-   ⚠️ **Partial/Limited**: Feature exists but with limitations
-   ❌ **Not Available**: Feature is not supported

### Key Advantages of rad-parser

1. **Zero Dependencies**: No external libraries required - truly self-contained
2. **Small Bundle Size**: Significantly smaller than alternatives
3. **Modular Design**: Clean architecture with focused modules
4. **Full Tag Dictionary**: Complete DICOM tag dictionary (5300+ tags)
5. **Enhanced Parsing**: Structured Person Name, Date/Time objects, Age strings
6. **Safety First**: Comprehensive bounds checking and safety limits
7. **TypeScript Native**: Built from the ground up with TypeScript

### When to Use rad-parser

**Choose rad-parser when:**

-   You need a lightweight, zero-dependency solution
-   Bundle size is critical
-   You want structured data (PN, DA, TM, DT, AS)
-   You need full tag dictionary lookup
-   You prioritize safety and bounds checking
-   You want a modular, maintainable codebase

**Consider alternatives when:**

-   You need JPEG-LS or JPEG 2000 decompression (use dcmjs)
-   You need maximum compatibility with legacy systems (use dicom-parser)

### Current Features

-   **Pixel Data Extraction**: ✅ Full support for native and encapsulated pixel data
-   **RLE Compression**: ✅ RLE (Run-Length Encoding) lossless decompression
-   **Private Tags**: ✅ Enhanced VR detection for private tags based on length patterns
-   **JPEG Support**: ⚠️ Requires browser ImageDecoder API or external library

### Current Limitations

-   **JPEG Compression**: JPEG decompression requires browser ImageDecoder API (Chrome 94+) or external library
-   **JPEG-LS/JPEG 2000**: Not yet implemented (would require external libraries)
-   **Private Tags**: VR detection uses heuristics - may not always be accurate for vendor-specific tags

### Streaming Support

RAD-Parser supports streaming parsing for very large files:

```typescript
import { StreamingParser, parseFromStream } from "@/lib/rad-parser";

// Using StreamingParser directly
const parser = new StreamingParser({
    onElement: (element) => {
        // Process each element as it's parsed
        console.log("Parsed element:", element);
    },
    onError: (error) => {
        console.error("Parse error:", error);
    },
    maxBufferSize: 10 * 1024 * 1024, // 10MB
    maxIterations: 1000, // Elements per chunk
});

parser.initialize(firstChunk);
parser.processChunk(chunk2);
parser.processChunk(chunk3);
parser.finalize();

// Using ReadableStream
const response = await fetch("/large-dicom-file.dcm");
const stream = response.body!;
await parseFromStream(stream, {
    onElement: (element) => {
        // Process elements incrementally
    },
});

// Using async iterator
async function* readFileInChunks(file: File) {
    const chunkSize = 64 * 1024; // 64KB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        yield new Uint8Array(await chunk.arrayBuffer());
        offset += chunkSize;
    }
}

await parseFromAsyncIterator(readFileInChunks(largeFile), {
    onElement: (element) => {
        // Process elements as file is read
    },
});
```

### Future Enhancements

-   JPEG-LS and JPEG 2000 support (with external libraries)
-   Enhanced private tag dictionary support
-   Pixel data format conversion utilities

## Release

RAD-Parser emits two bundled builds in addition to the modular `dist/*` tree:

-   `dist/rad-parser.js`: single-file ES module combining the entire parser
-   `dist/rad-parser.min.js`: minified version suitable for CDN or browser-based distributions
-   `dist/rad-parser-nodict.js`: dictionary-free build that packs only the runtime parser utilities, streaming helpers, and pixel-data helpers (ideal for clients that already resolve tag names elsewhere)
-   `dist/rad-parser-nodict.min.js`: minified version of the dictionary-free build
-   `dist/rad-parser-dictionary.js`: standalone dictionary export for clients that need the comprehensive DICOM tag mapping without the runtime parser

Run `npm run release` to regenerate both artifacts (it runs the `esbuild` bundling pipeline shown above). This script also runs automatically before `npm publish`, so the npm release always includes the latest bundles. When creating a GitHub release, attach the `rad-parser-bundles.zip` archive (which contains the four `rad-parser.*.js` bundles) and the individual bundle files so users can download them directly without culling the `dist/` tree.

## Benchmarking

Run `npm run benchmark` to compare rad-parser performance against other DICOM parsers (`dicom-parser`, `dcmjs`, and `efferent-dicom`) using the shared DICOM files under `test_data/patient/DICOM`. The script exercises every parser on the same 50 files, tracks parse time/success/element count, and writes a JSON report to `benchmark-results.json` so you can inspect the raw measurements.

Latest results (average parse time / success) on complex test data:

-   `dicom-parser`: 126.53 μs (fastest, shallow parsing)
-   `dcmjs`: 1.55 ms
-   `efferent-dicom`: 2.76 ms
-   `rad-parser`: **22.76 ms** (deep parsing, see element count)

**Note:** `rad-parser` performs deep recursive parsing of sequences and validates structural integrity, resulting in a significantly higher element count detected (184 vs ~99 for others) in this benchmark set.

````text
================================================================================
DICOM Parser Benchmark Results
================================================================================

Summary:
--------------------------------------------------------------------------------
Parser               Files    Success    Avg Time     Avg Elements
--------------------------------------------------------------------------------
rad-parser-shallow   50       50/50      0.28 ms      94
dicom-parser         50       50/50      0.37 ms      99
dcmjs                50       50/50      1.56 ms      92
rad-parser-medium    50       50/50      0.71 ms      92
rad-parser (Full)    50       50/50      1.45 ms      92

Note: `rad-parser-shallow` is ~25% faster than `dicom-parser`.
`rad-parser-medium` (~0.71ms) is >2x faster than `dcmjs`.
`rad-parser` full parse (~1.45ms) has surpassed `dcmjs` speed, making it one of the fastest full validators available.

================================================================================

## API Documentation

Every public export is documented in [`docs/api.md`](docs/api.md), which enumerates the parser entry points (`parseWithRadParser`, `parseWithMetadata`, `extractTransferSyntax`, `canParse`), the streaming helpers (`StreamingParser`, `parseFromStream`, `parseFromAsyncIterator`), the pixel-data utilities (`extractPixelData`, `isCompressedTransferSyntax`), and the compression helpers (`decompressJPEG`, `decompressPixelData`, `supportsImageDecoder`). The guide also captures utilities like `formatTagWithComma`, `normalizeTag`, `parsePersonName`, and `detectVR` so you can find the right helper without digging through the source tree.

## Documentation & Wiki

Extended documentation lives under `docs/` (see `docs/api.md`) and is mirrored in the GitHub wiki. When you update the README or introduce new modules, be sure to:

1. Update `docs/api.md` with any new exports so the reference stays fresh.
2. Synchronize narrative content with the GitHub wiki (`https://github.com/AjRoAs/rad-parse/wiki`) by copying the new sections or linking directly to the `docs/` files.
3. Use the wiki for ongoing topics such as release checklists, contribution guidance, and troubleshooting notes that should be easy for contributors to browse.

## API Reference

### `parseWithRadParser(byteArray: Uint8Array): DicomDataSet`

Parses a DICOM file and returns a dataset compatible with the SmallVis parser system.

**Parameters:**

- `byteArray`: The DICOM file as a `Uint8Array`

**Returns:**

- `DicomDataSet`: A dataset object with access methods and dictionaries

**Throws:**

- `Error`: If the file format is invalid or parsing fails

### `parseWithMetadata(byteArray: Uint8Array): ParseResult`

Parses a DICOM file and returns dataset with metadata (transfer syntax, character set).

**Parameters:**

- `byteArray`: The DICOM file as a `Uint8Array`

**Returns:**

- `ParseResult`: Object containing `dataset`, `transferSyntax`, and `characterSet`

### `extractTransferSyntax(byteArray: Uint8Array): string | undefined`

Quickly extracts transfer syntax UID from a DICOM file without full parsing.

**Parameters:**

- `byteArray`: The DICOM file as a `Uint8Array`

**Returns:**

- `string | undefined`: Transfer syntax UID or undefined if not found

**Example:**

```typescript
const transferSyntax = extractTransferSyntax(dicomBytes);
if (transferSyntax === '1.2.840.10008.1.2.5') {
  console.log('RLE compressed');
}
````

### `canParse(byteArray: Uint8Array): boolean`

Checks if a byte array appears to be a valid DICOM file.

**Parameters:**

-   `byteArray`: The file data as a `Uint8Array`

**Returns:**

-   `boolean`: True if file appears to be valid DICOM

**Example:**

```typescript
if (canParse(fileBytes)) {
    const dataset = parseWithRadParser(fileBytes);
}
```

### `DicomDataSet` Interface

```typescript
interface DicomDataSet {
    // Access methods
    string(tag: string): string | undefined;
    uint16(tag: string): number | undefined;
    int16(tag: string): number | undefined;
    floatString(tag: string): number | undefined;
    intString(tag: string): number | undefined;

    // Direct access
    dict: Record<string, DicomElement>;
    elements: Record<string, DicomElement>;
}
```

## Examples

### Reading Patient Information

```typescript
const dataset = parseWithRadParser(dicomBytes);

const patientInfo = {
    name: dataset.string("x00100010"),
    id: dataset.string("x00100020"),
    birthDate: dataset.string("x00100030"),
    sex: dataset.string("x00100040"),
};

console.log("Patient:", patientInfo);
```

### Reading Study Information

```typescript
const studyInfo = {
    studyDate: dataset.string("x00080020"),
    studyTime: dataset.string("x00080030"),
    studyDescription: dataset.string("x00081030"),
    studyInstanceUID: dataset.string("x0020000D"),
};

console.log("Study:", studyInfo);
```

### Reading Image Properties

```typescript
const imageInfo = {
    rows: dataset.uint16("x00280010"),
    columns: dataset.uint16("x00280011"),
    bitsAllocated: dataset.uint16("x00280100"),
    bitsStored: dataset.uint16("x00280101"),
    pixelSpacing: dataset.string("x00280030"),
    sliceThickness: dataset.floatString("x00180050"),
};

console.log("Image:", imageInfo);
```

## Integration with SmallVis

RAD-Parser is integrated into SmallVis's parser system:

```typescript
import { parseDicom } from "@/core/parsers";

// Use rad-parser specifically
const dataset = await parseDicom(byteArray, "rad-parser");

// Or let the system choose (rad-parser is available as an option)
```

## License

This parser is part of the SmallVis project and follows the same license terms.

## Contributing

RAD-Parser is designed to be self-contained. When contributing:

1. Keep it dependency-free
2. Maintain safety checks
3. Add tests for new features
4. Update this README with new capabilities

## Version History

-   **v1.1.0**: Performance and API Update
    -   Added `shallowParse` for ultra-fast scanning
    -   Added `mediumParse` for memory-efficient metadata parsing
    -   Added `extractPixelData` for dedicated pixel data access
    -   Renamed `parseWithRadParser` to `fullParse` (backward compatible)
-   **v1.0.0**: Initial release
    -   Basic DICOM parsing
    -   Transfer syntax detection
    -   Multiple tag format support
    -   Safety features

