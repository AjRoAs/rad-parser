# RAD-Parser API Reference

This guide documents every public export from `rad-parser`. The package is organized into several conceptual layers: parser entry points, streaming helpers, pixel-data utilities, compression utilities, dictionary/tag helpers, value parsers, and VR detection. Each section below lists the function signature, purpose, and usage notes.

## Parser Entry Points

| Export                                                        | Description                                                                                                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(byteArray: Uint8Array, options?: UnifiedParseOptions)` | **Unified Entry Point (Recommended).** Supports all parsing modes (`type`: 'shallow'\|'full'\|'light'\|'lazy') and tag filtering (`tags`). Returns the appropriate dataset type. |

| `parseWithMetadata(byteArray: Uint8Array): ParseResult` | Same as `fullParse` but returns `{ dataset, transferSyntax, characterSet }`. Useful when you need the detected transfer syntax for downstream logic. |
| `extractTransferSyntax(byteArray: Uint8Array): string \| undefined` | Quickly read the Transfer Syntax UID (e.g., `1.2.840.10008.1.2.1`) without fully parsing the dataset. |
| `canParse(byteArray: Uint8Array): boolean` | Lightweight check to assert whether the bytes look like a DICOM file (either Part 10 or non-Part 10). |

## Streaming Helpers

| Export                                      | Description                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StreamingParser`                           | Class that consumes chunks of data from large files. Emits callbacks for each element, enabling incremental processing in browsers or Node streams. |
| `parseFromAsyncIterator(iterator, options)` | Helper that feeds async iterators (e.g., `ReadableStream`) into `StreamingParser`.                                                                  |
| `parseFromStream(stream, options)`          | Convenience wrapper that accepts a browser/Node stream and parses it incrementally.                                                                 |
| `ElementCallback`, `StreamingOptions`       | Types that define callbacks/options for streaming use cases.                                                                                        |

## Pixel Data & Compression Utilities

| Export                                                                                       | Description                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extractPixelData(byteArray: Uint8Array): PixelDataInfo \| null`                             | High-level utility to quickly locate and extract Pixel Data (7FE0,0010) from a raw buffer without parsing the whole file. Returns `{ pixelData, transferSyntax, fragments }`. |
| `isCompressedTransferSyntax(transferSyntax: string): boolean`                                | Returns `true` for common compression UIDs (RLE, JPEG variants).                                                                                                              |
| `decompressPixelData(pixelData: PixelDataResult): Uint8Array \| null`                        | Performs RLE decompression when required.                                                                                                                                     |
| `supportsImageDecoder(): boolean`                                                            | Detects whether the browser `ImageDecoder` API is available.                                                                                                                  |
| `decompressJPEG(pixelData: PixelDataResult, mimeType?: string): Promise<Uint8Array \| null>` | Uses the browser `ImageDecoder` API to decode JPEG frames into raw pixel bytes.                                                                                               |

## Utility Modules

| Export                                                                                                | Description                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `dicomDictionary`, `getTagName(tag: string)`, `isPrivateTag(tag: string)`                             | Tag dictionary helpers for looking up tag names and identifying private tags.                        |
| `formatTagWithComma(tag: string)`, `normalizeTag(tag: string)`                                        | Tag formatting helpers for conversion between `xGGGGEHHHH` and `GGGG,EEEE` forms.                    |
| `SafeDataView`                                                                                        | Bounds-checked `DataView` wrapper used internally and exported for tight buffer manipulation.        |
| `parsePersonName`, `parseAgeString`, `parseDate`, `parseTime`, `parseDateTime`, `parseValueByVR`      | Value parser helpers that parse PN/AS/DA/TM/DT strings while honoring separators and trimming rules. |
| `detectVR`, `detectVRForPrivateTag`, `requiresExplicitLength`                                         | VR-detection helpers that support implicit VR datasets and heuristics for private tags.              |
| `StreamingParser`, `parseFromAsyncIterator`, `parseFromStream`, `ElementCallback`, `StreamingOptions` | Streaming exports (described above).                                                                 |

## Types

| Export                                            | Description                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DicomElement`, `DicomDataSet`                    | Core types describing DICOM elements and datasets. **Note:** `elements` property in `DicomDataSet` is non-enumerable to prevent JSON duplication. |
| `ShallowDicomDataSet`, `ShallowDicomElement`      | Lightweight types returned by `shallowParse`.                                                                                                     |
| `UnifiedParseOptions`                             | Configuration for the unified `parse()` function. Properties: `type` ('shallow'\|'full'\|'light'\|'lazy') and `tags` (string[] of tags to parse). |
| `ParseResult`, `PixelDataResult`, `PixelDataInfo` | Results for parsing and pixel extraction.                                                                                                         |

## Best Practices

-   **Unified Access:** Use `parse()` with `type: 'shallow'` (fast scanning) or `type: 'full'` (validation/rendering).

-   **Parsing Large Files:** Use `StreamingParser` or `extractPixelData` to avoid loading everything into memory.
-   **JSON Output:** `JSON.stringify(dataset)` will produce clean output without duplicate keys. To access legacy properties (e.g., `VR` vs `vr`), use standard property access in code (e.g., `element.VR`).

## Bundle Variants

-   `dist/rad-parser.js` / `dist/rad-parser.min.js`: Standard bundles with the full dictionary included.
-   `dist/rad-parser-nodict.js` / `dist/rad-parser-nodict.min.js`: Dictionary-free bundles that omit `dicomDictionary`, `getTagName`, and `isPrivateTag` for smaller payloads. Use this variant when you resolve tags another way or only care about core parsing utilities.
    \*\*\* End Patch
