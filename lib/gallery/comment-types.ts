export type PhotoCommentRow = {
  id: string;
  photo_id: string;
  nickname: string;
  message: string;
  created_at: string;
};

export type CreatePhotoCommentPayload = {
  nickname?: string | null;
  message: string;
};

export type ValidPhotoCommentPayload = {
  nickname: string;
  message: string;
};
