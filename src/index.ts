/**
 * RAD-Parser: In-House DICOM Parser Implementation
 *
 * A lightweight, performant, self-contained DICOM parser with no external dependencies.
 * Designed for safety and efficiency in medical imaging workloads.
 *
 * @module rad-parser
 */

/** Compression helpers exposed by the package. */
export { decompressJPEG, decompressPixelData, supportsImageDecoder } from './utils/compression';
/** Dictionary and tag utilities */
export { dicomDictionary, getTagName, isPrivateTag } from './utils/dictionary';
export { DicomParseError, createParseError } from './core/errors';
/** Core parser entry points */

export {
  canParse,
  parseWithMetadata,
  parse, // Unified API

  type ParseResult,
  type ParseOptions,
  type UnifiedParseOptions,
  extractPixelData,

} from './core/parser';
export { write, type WriteOptions } from './core/writer';
export { anonymize, type AnonymizationOptions } from './core/anonymizer';
export { extractTransferSyntax, TRANSFER_SYNTAX } from './utils/extractTransferSyntax';
/** Pixel data utilities */
export { isCompressedTransferSyntax, type PixelDataResult } from './utils/pixelData';
/** Safe byte readers and sequence helpers */
export { SafeDataView } from './utils/SafeDataView';
export { parseSequence } from './utils/sequenceParser';
export {
  StreamingParser,
  parseFromAsyncIterator,
  parseFromStream,
  type ElementCallback,
  type StreamingOptions,
} from './core/streaming';
export { formatTagWithComma, normalizeTag } from './utils/tagUtils';
export type { DicomDataSet, DicomElement, ShallowDicomDataSet, ShallowDicomElement, PixelDataInfo } from './core/types';
export {
  parseAgeString,
  parseDate,
  parseDateTime,
  parsePersonName,
  parseTime,
  parseValueByVR,
} from './utils/valueParsers';
export { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './utils/vrDetection';
