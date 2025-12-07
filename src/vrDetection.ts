/**
 * VR Detection: Implicit VR detection based on tag patterns
 *
 * Provides VR detection for implicit transfer syntax files.
 */

// Dictionary import removed - not needed for VR detection

/**
 * VR types that have explicit length (2 bytes reserved + 4 bytes length)
 */
export const EXPLICIT_LENGTH_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT']);

/**
 * Common VR patterns based on tag groups and elements
 * This is a simplified VR dictionary - full implementation would be more comprehensive
 */
const VR_PATTERNS: Record<string, string> = {
  // Patient Information (Group 0010)
  '00100010': 'PN', // Patient's Name
  '00100020': 'LO', // Patient ID
  '00100021': 'LO', // Issuer of Patient ID
  '00100030': 'DA', // Patient's Birth Date
  '00100032': 'TM', // Patient's Birth Time
  '00100040': 'CS', // Patient's Sex
  '00100050': 'LO', // Patient's Insurance Plan Code Sequence
  '00100101': 'AS', // Patient's Age
  '00100102': 'DS', // Patient's Size
  '00100103': 'DS', // Patient's Weight
  
  // Study Information (Group 0020)
  '0020000D': 'UI', // Study Instance UID
  '0020000E': 'UI', // Series Instance UID
  '00200010': 'SH', // Study ID
  '00200011': 'IS', // Series Number
  '00200012': 'IS', // Acquisition Number
  '00200013': 'IS', // Instance Number
  '00200020': 'CS', // Patient Orientation
  '00200032': 'DS', // Image Position Patient
  '00200037': 'DS', // Image Orientation Patient
  
  // Image Information (Group 0028)
  '00280002': 'US', // Samples per Pixel
  '00280004': 'CS', // Photometric Interpretation
  '00280010': 'US', // Rows
  '00280011': 'US', // Columns
  '00280030': 'DS', // Pixel Spacing
  '00280031': 'DS', // Slice Thickness
  '00280100': 'US', // Bits Allocated
  '00280101': 'US', // Bits Stored
  '00280102': 'US', // High Bit
  '00280103': 'US', // Pixel Representation
  '00280106': 'US', // Smallest Image Pixel Value
  '00280107': 'US', // Largest Image Pixel Value
  '00281050': 'DS', // Window Center
  '00281051': 'DS', // Window Width
  '00281052': 'DS', // Rescale Intercept
  '00281053': 'DS', // Rescale Slope
  
  // Identifying Information (Group 0008)
  '00080005': 'CS', // Specific Character Set
  '00080008': 'CS', // Image Type
  '00080012': 'DA', // Instance Creation Date
  '00080013': 'TM', // Instance Creation Time
  '00080016': 'UI', // SOP Class UID
  '00080018': 'UI', // SOP Instance UID
  '00080020': 'DA', // Study Date
  '00080030': 'TM', // Study Time
  '00080050': 'SH', // Accession Number
  '00080060': 'CS', // Modality
  '00080070': 'LO', // Manufacturer
  '00080080': 'LO', // Institution Name
  '00080090': 'PN', // Referring Physician's Name
  '00081030': 'LO', // Study Description
  '0008103E': 'LO', // Series Description
  '00081050': 'PN', // Performing Physician's Name
  '00081070': 'PN', // Operators' Name
  '00081080': 'LO', // Admitting Diagnoses Description
  '00081090': 'LO', // Manufacturer's Model Name
  '00081150': 'UI', // Referenced SOP Class UID
  '00081155': 'UI', // Referenced SOP Instance UID
  
  // Equipment Information (Group 0018)
  '00180015': 'CS', // Body Part Examined
  '00180020': 'CS', // Scanning Sequence
  '00180021': 'CS', // Sequence Variant
  '00180022': 'CS', // Scan Options
  '00180050': 'DS', // Slice Thickness
  '00180060': 'DS', // KVP
  '00180081': 'DS', // Echo Time
  '00180082': 'DS', // Inversion Time
  '00180083': 'DS', // Number of Averages
  '00180088': 'DS', // Spacing Between Slices
  '00180090': 'DS', // Data Collection Diameter
  '00181000': 'LO', // Device Serial Number
  '00181020': 'LO', // Software Version
  '00181030': 'LO', // Protocol Name
  '00181050': 'DS', // Slice Location
  '00181200': 'DA', // Date of Last Calibration
  '00181201': 'TM', // Time of Last Calibration
  
  // Pixel Data
  '7FE00010': 'OB', // Pixel Data (usually OB or OW)
};

/**
 * Detect VR for a tag in implicit VR transfer syntax
 * @param group - Tag group (e.g., 0x0010)
 * @param element - Tag element (e.g., 0x0010)
 * @returns Detected VR or 'UN' if unknown
 */
export function detectVR(group: number, element: number): string {
  const tagHex = `${group.toString(16).padStart(4, '0')}${element.toString(16).padStart(4, '0')}`;
  
  // Check explicit patterns first
  if (VR_PATTERNS[tagHex]) {
    return VR_PATTERNS[tagHex];
  }
  
  // Check common patterns based on group
  if (group === 0x0002) {
    // File Meta Information - usually UI, UL, OB
    if (element === 0x0000 || element === 0x0001) return 'UL';
    if (element === 0x0002 || element === 0x0003 || element === 0x0010 || element === 0x0012) return 'UI';
    return 'OB';
  }
  
  if (group === 0x0008) {
    // Identifying Information - common VRs
    if (element === 0x0005) return 'CS'; // Character Set
    if (element === 0x0006 || element === 0x0016 || element === 0x0018 || element === 0x1150 || element === 0x1155) return 'UI'; // UIDs
    if (element >= 0x0012 && element <= 0x0015) return 'DA'; // Dates
    if (element >= 0x0030 && element <= 0x0035) return 'TM'; // Times
    return 'LO'; // Default for 0008 group
  }
  
  if (group === 0x0010) {
    // Patient Information
    if (element === 0x0010) return 'PN'; // Patient Name
    if (element === 0x0010 || element === 0x0020 || element === 0x0021) return 'LO'; // IDs
    if (element === 0x0030 || element === 0x0032) return 'DA'; // Dates
    if (element === 0x0101) return 'AS'; // Age
    return 'LO';
  }
  
  if (group === 0x0018) {
    // Equipment Information
    if (element >= 0x0012 && element <= 0x0015) return 'DA'; // Dates
    if (element >= 0x0016 && element <= 0x0019) return 'TM'; // Times
    if (element >= 0x0050 && element <= 0x0090) return 'DS'; // Numeric values
    return 'LO';
  }
  
  if (group === 0x0020) {
    // Study/Series/Image Information
    if (element === 0x000D || element === 0x000E) return 'UI'; // UIDs
    if (element === 0x0010 || element === 0x0011 || element === 0x0012 || element === 0x0013) return 'SH'; // IDs
    if (element === 0x0032 || element === 0x0037) return 'DS'; // Position/Orientation
    return 'IS';
  }
  
  if (group === 0x0028) {
    // Image Pixel Information
    if (element >= 0x0002 && element <= 0x0004) return 'US';
    if (element === 0x0010 || element === 0x0011) return 'US'; // Rows/Columns
    if (element >= 0x0030 && element <= 0x0031) return 'DS'; // Spacing
    if (element >= 0x0100 && element <= 0x0103) return 'US'; // Bits
    if (element >= 0x0106 && element <= 0x0107) return 'US'; // Pixel values
    if (element >= 0x1050 && element <= 0x1053) return 'DS'; // Window/Rescale
    return 'US';
  }
  
  if (group === 0x7FE0 && element === 0x0010) {
    // Pixel Data
    return 'OB'; // Usually OB, but could be OW
  }
  
  // Default: Unknown
  return 'UN';
}

/**
 * Check if VR requires explicit length encoding
 */
export function requiresExplicitLength(vr: string): boolean {
  return EXPLICIT_LENGTH_VR.has(vr);
}

/**
 * Detect VR for private tags based on length and common patterns
 * Private tags (odd group numbers) don't have standard VR definitions
 */
export function detectVRForPrivateTag(_group: number, _element: number, length: number): string {
  // Common patterns for private tags based on length and element number
  if (length === 0) {
    return 'UN';
  }

  // Very short values are often strings or numbers
  if (length <= 4) {
    // Could be US, SS, IS, DS, or short string
    if (length === 2) {
      return 'US'; // Most common for 2-byte values
    }
    if (length === 4) {
      return 'UL'; // Common for 4-byte values
    }
    return 'LO'; // Default to string for odd lengths
  }

  // Medium length - likely strings
  if (length <= 64) {
    return 'LO';
  }

  // Long values - could be strings, binary, or sequences
  if (length <= 1024) {
    return 'OB'; // Binary data
  }

  // Very long - likely binary or sequence
  if (length === 0xffffffff) {
    return 'SQ'; // Sequence
  }

  // Default to binary for very long values
  return 'OB';
}

