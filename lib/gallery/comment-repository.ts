import type {
  CreatePhotoCommentPayload,
  PhotoCommentRow,
} from "./comment-types";

type RepositoryClient = {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => PromiseLike<{ data: PhotoCommentRow[] | null; error: { message: string } | null }>;
      };
    };
    insert: (values: Record<string, unknown>) => {
      select: (columns?: string) => {
        single: () => PromiseLike<{ data: PhotoCommentRow | null; error: { message: string } | null }>;
      };
    };
  };
};

export const getPhotoCommentsTableName = () => {
  return process.env.PHOTO_COMMENTS_TABLE ?? "photo_comments";
};

export const listPhotoComments = async (
  supabase: RepositoryClient,
  photoId: string,
  tableName = getPhotoCommentsTableName(),
): Promise<PhotoCommentRow[]> => {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("photo_id", photoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list photo comments: ${error.message}`);
  }

  return data ?? [];
};

export const createPhotoComment = async (
  supabase: RepositoryClient,
  photoId: string,
  payload: CreatePhotoCommentPayload,
  tableName = getPhotoCommentsTableName(),
): Promise<PhotoCommentRow> => {
  const { data, error } = await supabase
    .from(tableName)
    .insert({
      photo_id: photoId,
      nickname: payload.nickname,
      message: payload.message,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create photo comment: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to create photo comment: no data returned");
  }

  return data;
};
