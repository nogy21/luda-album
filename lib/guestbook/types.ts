export type GuestbookRow = {
  id: string;
  nickname: string;
  message: string;
  created_at: string;
};

export type CreateGuestbookPayload = {
  nickname?: string | null;
  message: string;
};

export type ValidGuestbookPayload = {
  nickname: string;
  message: string;
};
