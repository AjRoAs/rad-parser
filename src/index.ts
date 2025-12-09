/**
 * RAD-Parser: In-House DICOM Parser Implementation
 *
 * A lightweight, performant, self-contained DICOM parser with no external dependencies.
 * Designed for safety and efficiency in medical imaging workloads.
 *
 * @module rad-parser
 */

/** Compression helpers exposed by the package. */
export { decompressJPEG, decompressPixelData, supportsImageDecoder } from './compression';
/** Dictionary and tag utilities */
export { dicomDictionary, getTagName, isPrivateTag } from './dictionary';
export { DicomParseError, createParseError } from './errors';
/** Core parser entry points */
export {
  canParse,
  parseWithMetadata,
  fullParse,
  mediumParse,
  shallowParse,
  parseWithRadParser, // Keep for backward compatibility
  type ParseResult,
  type ParseOptions,
  extractPixelData,
} from './parser';
export { extractTransferSyntax, TRANSFER_SYNTAX } from './extractTransferSyntax';
/** Pixel data utilities */
export { isCompressedTransferSyntax, type PixelDataResult } from './pixelData';
/** Safe byte readers and sequence helpers */
export { SafeDataView } from './SafeDataView';
export { parseSequence } from './sequenceParser';
export {
  StreamingParser,
  parseFromAsyncIterator,
  parseFromStream,
  type ElementCallback,
  type StreamingOptions,
} from './streaming';
export { formatTagWithComma, normalizeTag } from './tagUtils';
export type { DicomDataSet, DicomElement, ShallowDicomDataSet, ShallowDicomElement, PixelDataInfo } from './types';
export {
  parseAgeString,
  parseDate,
  parseDateTime,
  parsePersonName,
  parseTime,
  parseValueByVR,
} from './valueParsers';
export { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './vrDetection';
