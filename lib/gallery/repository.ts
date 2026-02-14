import type { GalleryImage } from "./images";

type GalleryPhotoRow = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  taken_at: string;
};

type RepositoryClient = {
  from: (table: string) => {
    select: (
      columns?: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => PromiseLike<{ data: GalleryPhotoRow[] | null; error: { message: string } | null }>;
      single?: () => PromiseLike<{ data: GalleryPhotoRow | null; error: { message: string } | null }>;
    };
    insert: (
      values: Record<string, unknown>,
    ) => {
      select: (
        columns?: string,
      ) => {
        single: () => PromiseLike<{ data: GalleryPhotoRow | null; error: { message: string } | null }>;
      };
    };
  };
};

export type CreateGalleryImageRecordInput = {
  src: string;
  storagePath: string;
  originalName: string;
  type: string;
  size: number;
  caption?: string;
  alt?: string;
  takenAt?: string;
};

const GALLERY_SELECT_COLUMNS = "id, src, alt, caption, taken_at";

const formatCaptionFromFileName = (fileName: string) => {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExt.replace(/[_-]+/g, " ").trim();

  if (normalized.length === 0) {
    return "새 사진";
  }

  return normalized;
};

const mapRowToGalleryImage = (row: GalleryPhotoRow): GalleryImage => {
  return {
    id: row.id,
    src: row.src,
    alt: row.alt,
    caption: row.caption,
    takenAt: row.taken_at,
  };
};

export const getGalleryPhotosTableName = () => {
  return process.env.GALLERY_PHOTOS_TABLE ?? "gallery_photos";
};

export const listGalleryImagesFromDatabase = async (
  supabase: RepositoryClient,
  tableName = getGalleryPhotosTableName(),
): Promise<GalleryImage[]> => {
  const { data, error } = await supabase
    .from(tableName)
    .select(GALLERY_SELECT_COLUMNS)
    .order("taken_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list gallery images: ${error.message}`);
  }

  return (data ?? []).map(mapRowToGalleryImage);
};

export const createGalleryImageRecord = async (
  supabase: RepositoryClient,
  input: CreateGalleryImageRecordInput,
  tableName = getGalleryPhotosTableName(),
): Promise<GalleryImage> => {
  const caption = input.caption?.trim() || formatCaptionFromFileName(input.originalName);
  const alt = input.alt?.trim() || `${caption} 사진`;

  const { data, error } = await supabase
    .from(tableName)
    .insert({
      src: input.src,
      storage_path: input.storagePath,
      original_name: input.originalName,
      type: input.type,
      size: input.size,
      caption,
      alt,
      taken_at: input.takenAt ?? new Date().toISOString(),
    })
    .select(GALLERY_SELECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create gallery image record: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to create gallery image record: no data returned");
  }

  return mapRowToGalleryImage(data);
};

