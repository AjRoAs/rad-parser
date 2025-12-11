# Utility Functions API Reference

This document provides detailed documentation for the low-level utility functions exported by `rad-parser`. These helpers are useful for advanced use cases, such as custom element processing, display formatting, and manual value parsing.

---

## Tag Utilities

These functions help with the manipulation and display of DICOM tag strings.

### `getTagName()`

Retrieves the descriptive name for a given DICOM tag.

**Signature:** `getTagName(tag: string): string | undefined`

**Example:**

```typescript
import { getTagName } from 'rad-parser';

const patientNameTag = 'x00100010';
const studyDateTag = 'x00080020';

console.log(`${patientNameTag} => ${getTagName(patientNameTag)}`); // "PatientName"
console.log(`${studyDateTag} => ${getTagName(studyDateTag)}`);     // "StudyDate"
```

### `formatTagWithComma()`

Converts a tag string from the 'x' format (e.g., `'x00100010'`) to the standard comma-separated group/element format (e.g., `'(0010,0010)'`).

**Signature:** `formatTagWithComma(tag: string): string`

**Example:**

```typescript
import { formatTagWithComma } from 'rad-parser';

const tag = 'x00100010';
const formattedTag = formatTagWithComma(tag);

console.log(formattedTag); // "(0010,0010)"
```

### `normalizeTag()`

Converts a tag from various common formats (e.g., `(0010,0010)`, `'0010,0010'`) into the internal 'x' format (`'x00100010'`) used by the `DicomDataSet`.

**Signature:** `normalizeTag(tag: string): string`

**Example:**

```typescript
import { normalizeTag } from 'rad-parser';

const normalized1 = normalizeTag('(0010,0010)');
const normalized2 = normalizeTag('0008,0020');

console.log(normalized1); // "x00100010"
console.log(normalized2); // "x00080020"
```

### `isPrivateTag()`

Checks if a given tag string (in 'x' format) falls within the private tag range.

**Signature:** `isPrivateTag(tag: string): boolean`

**Example:**

```typescript
import { isPrivateTag } from 'rad-parser';

const publicTag = 'x00100010';
const privateTag = 'x00190010'; // Odd group number indicates a private tag

console.log(`Is ${publicTag} private? ${isPrivateTag(publicTag)}`); // false
console.log(`Is ${privateTag} private? ${isPrivateTag(privateTag)}`);   // true
```

---

## Value Parsers

These functions are used internally to parse the raw string values of DICOM elements into more useful JavaScript types. They are exposed for cases where you might need to parse a value manually.

### `parseDate()`

Parses a DICOM date string (DA VR) in the format `YYYYMMDD` into a JavaScript `Date` object.

**Signature:** `parseDate(dateString: string): Date | null`

**Example:**

```typescript
import { parseDate } from 'rad-parser';

const dicomDate = '20231026';
const jsDate = parseDate(dicomDate);

console.log(jsDate?.toUTCString()); // "Thu, 26 Oct 2023 00:00:00 GMT"
```

### `parseTime()`

Parses a DICOM time string (TM VR) in formats like `HHMMSS.FFFFFF` into an object containing hours, minutes, seconds, and fractional seconds.

**Signature:** `parseTime(timeString: string): { hours: number, minutes: number, seconds: number, fractional: number } | null`

**Example:**

```typescript
import { parseTime } from 'rad-parser';

const dicomTime = '235958.123456';
const parsedTime = parseTime(dicomTime);

console.log(parsedTime);
// { hours: 23, minutes: 59, seconds: 58, fractional: 0.123456 }
```

### `parseDateTime()`

Parses a DICOM date-time string (DT VR) into a JavaScript `Date` object.

**Signature:** `parseDateTime(dtString: string): Date | null`

**Example:**

```typescript
import { parseDateTime } from 'rad-parser';

const dicomDateTime = '20231026235958';
const jsDate = parseDateTime(dicomDateTime);

console.log(jsDate?.toUTCString()); // "Thu, 26 Oct 2023 23:59:58 GMT"
```

### `parsePersonName()`

Parses a DICOM person name string (PN VR), which can contain multiple components separated by `^`.

**Signature:** `parsePersonName(nameString: string): { Alphabetic: string, ... }`

**Example:**

```typescript
import { parsePersonName } from 'rad-parser';

const dicomName = 'Doe^John^Middle^^Dr.';
const parsedName = parsePersonName(dicomName);

console.log(parsedName);
// {
//   Alphabetic: 'Doe, John, Middle, Dr.',
//   Family: 'Doe',
//   Given: 'John',
//   Middle: 'Middle',
//   Prefix: '',
//   Suffix: 'Dr.'
// }
```

### `parseAgeString()`

Parses a DICOM age string (AS VR) like `'045Y'` into a number of days.

**Signature:** `parseAgeString(ageString: string): number | null`

**Example:**

```typescript
import { parseAgeString } from 'rad-parser';

const ageInYears = '045Y'; // 45 years
const ageInMonths = '006M'; // 6 months
const ageInWeeks = '002W'; // 2 weeks
const ageInDays = '010D'; // 10 days

console.log(`045Y => ${parseAgeString(ageInYears)} days`);     // 16425
console.log(`006M => ${parseAgeString(ageInMonths)} days`);   // 180
console.log(`002W => ${parseAgeString(ageInWeeks)} days`);     // 14
console.log(`010D => ${parseAgeString(ageInDays)} days`);       // 10
```

---

## Other Utilities

### `detectVR()`

Infers the Value Representation (VR) of a tag based on the DICOM dictionary. This is primarily for files using Implicit VR transfer syntaxes.

**Signature:** `detectVR(tag: string): string`

**Example:**

```typescript
import { detectVR } from 'rad-parser';

// PatientName is 'PN'
console.log(`VR for x00100010 is ${detectVR('x00100010')}`); // "PN"

// StudyDate is 'DA'
console.log(`VR for x00080020 is ${detectVR('x00080020')}`); // "DA"
```
