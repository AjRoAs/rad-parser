/**
 * RAD-Parser: In-House DICOM Parser Implementation
 *
 * A lightweight, performant, self-contained DICOM parser with no external dependencies.
 * Designed for safety and efficiency.
 *
 * @module rad-parser
 */

export { decompressJPEG, decompressPixelData, supportsImageDecoder } from './compression';
export { dicomDictionary, getTagName, isPrivateTag } from './dictionary';
export { DicomParseError, createParseError } from './errors';
export {
  canParse,
  extractTransferSyntax,
  parseWithMetadata,
  parseWithRadParser,
  type ParseResult,
} from './parser';
export { extractPixelData, isCompressedTransferSyntax, type PixelDataResult } from './pixelData';
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
export type { DicomDataSet, DicomElement } from './types';
export {
  parseAgeString,
  parseDate,
  parseDateTime,
  parsePersonName,
  parseTime,
  parseValueByVR,
} from './valueParsers';
export { detectVR, detectVRForPrivateTag, requiresExplicitLength } from './vrDetection';
