type ExifMetadata = {
  takenAtRaw?: unknown;
  latitudeRaw?: unknown;
  longitudeRaw?: unknown;
};

type ParseExifMetadata = (
  file: File,
) => Promise<ExifMetadata | null>;

type ExtractPhotoUploadMetadataOptions = {
  now?: Date;
  parseExifMetadata?: ParseExifMetadata;
};

const UUID_PREFIX_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i;
const CAMERA_PREFIX_REGEX = /^(img|pxl|dsc|vid|mvimg|screenshot|photo)[-_ ]+/i;

const toIsoString = (
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
) => {
  const candidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day ||
    candidate.getUTCHours() !== hours ||
    candidate.getUTCMinutes() !== minutes ||
    candidate.getUTCSeconds() !== seconds
  ) {
    return null;
  }

  return candidate.toISOString();
};

const parseExifDateTimeString = (value: string) => {
  const normalized = value.trim();
  const legacyMatch = normalized.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );

  if (legacyMatch) {
    return toIsoString(
      Number.parseInt(legacyMatch[1]!, 10),
      Number.parseInt(legacyMatch[2]!, 10),
      Number.parseInt(legacyMatch[3]!, 10),
      Number.parseInt(legacyMatch[4]!, 10),
      Number.parseInt(legacyMatch[5]!, 10),
      Number.parseInt(legacyMatch[6]!, 10),
    );
  }

  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
};

const normalizeExifTakenAt = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return parseExifDateTimeString(value);
  }

  return null;
};

const normalizeCoordinate = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const formatLocationLabel = (latitude: number, longitude: number) => {
  return `위도 ${latitude.toFixed(5)}, 경도 ${longitude.toFixed(5)}`;
};

const parseTakenAtFromLastModified = (lastModified: number) => {
  if (!Number.isFinite(lastModified) || lastModified <= 0) {
    return null;
  }

  const date = new Date(lastModified);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const defaultParseExifMetadata: ParseExifMetadata = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const exifr = await import("exifr");
  const parsed = await exifr.parse(arrayBuffer, {
    pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude"],
  });

  if (parsed && typeof parsed === "object") {
    const record = parsed as {
      DateTimeOriginal?: unknown;
      CreateDate?: unknown;
      GPSLatitude?: unknown;
      GPSLongitude?: unknown;
    };

    return {
      takenAtRaw: record.DateTimeOriginal ?? record.CreateDate ?? null,
      latitudeRaw: record.GPSLatitude ?? null,
      longitudeRaw: record.GPSLongitude ?? null,
    };
  }

  return null;
};

export const normalizeCaptionFromOriginalName = (originalName: string) => {
  const trimmed = originalName.trim();
  const withoutExt = trimmed.replace(/\.[^.]+$/, "");
  const withoutUuidPrefix = withoutExt.replace(UUID_PREFIX_REGEX, "");
  const withoutCameraPrefix = withoutUuidPrefix.replace(CAMERA_PREFIX_REGEX, "");
  const normalized = withoutCameraPrefix
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length === 0) {
    return "새 사진";
  }

  return normalized;
};

export const parseTakenAtFromFileName = (originalName: string) => {
  const source = originalName.replace(/\.[^.]+$/, "");

  const dateTimeMatch = source.match(
    /(?:^|[^0-9])([12][0-9]{3})([01][0-9])([0-3][0-9])(?:[^0-9]+)([0-2][0-9])([0-5][0-9])([0-5][0-9])(?:$|[^0-9])/,
  );
  if (dateTimeMatch) {
    return toIsoString(
      Number.parseInt(dateTimeMatch[1]!, 10),
      Number.parseInt(dateTimeMatch[2]!, 10),
      Number.parseInt(dateTimeMatch[3]!, 10),
      Number.parseInt(dateTimeMatch[4]!, 10),
      Number.parseInt(dateTimeMatch[5]!, 10),
      Number.parseInt(dateTimeMatch[6]!, 10),
    );
  }

  const dateOnlyMatch = source.match(
    /(?:^|[^0-9])([12][0-9]{3})[-_.]?([01][0-9])[-_.]?([0-3][0-9])(?:$|[^0-9])/,
  );
  if (dateOnlyMatch) {
    return toIsoString(
      Number.parseInt(dateOnlyMatch[1]!, 10),
      Number.parseInt(dateOnlyMatch[2]!, 10),
      Number.parseInt(dateOnlyMatch[3]!, 10),
    );
  }

  return null;
};

export const extractPhotoUploadMetadata = async (
  file: File,
  options: ExtractPhotoUploadMetadataOptions = {},
) => {
  const now = options.now ?? new Date();
  const parseExifMetadata = options.parseExifMetadata ?? defaultParseExifMetadata;
  const caption = normalizeCaptionFromOriginalName(file.name);
  let takenAt = parseTakenAtFromLastModified(file.lastModified);
  let locationLabel: string | null = null;

  try {
    const exif = await parseExifMetadata(file);
    const exifTakenAt = normalizeExifTakenAt(exif?.takenAtRaw);
    const latitude = normalizeCoordinate(exif?.latitudeRaw);
    const longitude = normalizeCoordinate(exif?.longitudeRaw);

    if (!takenAt && exifTakenAt) {
      takenAt = exifTakenAt;
    }

    if (latitude !== null && longitude !== null) {
      locationLabel = formatLocationLabel(latitude, longitude);
    }
  } catch {
    // Ignore EXIF failures and keep fallback value.
  }

  if (!takenAt) {
    takenAt = parseTakenAtFromFileName(file.name);
  }

  return {
    caption,
    alt: `${caption} 사진`,
    takenAt: takenAt ?? now.toISOString(),
    locationLabel,
  };
};
