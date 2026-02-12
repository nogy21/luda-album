import type { CreateGuestbookPayload, GuestbookRow } from "./types";

type RepositoryClient = {
  from: (table: string) => {
    select: (
      columns?: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => PromiseLike<{ data: GuestbookRow[] | null; error: { message: string } | null }>;
    };
    insert: (
      values: CreateGuestbookPayload,
    ) => {
      select: (
        columns?: string,
      ) => {
        single: () => PromiseLike<{ data: GuestbookRow | null; error: { message: string } | null }>;
      };
    };
  };
};

export const listGuestbookMessages = async (
  supabase: RepositoryClient,
): Promise<GuestbookRow[]> => {
  const { data, error } = await supabase
    .from("guestbook")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list guestbook messages: ${error.message}`);
  }

  return data ?? [];
};

export const createGuestbookMessage = async (
  supabase: RepositoryClient,
  payload: CreateGuestbookPayload,
): Promise<GuestbookRow> => {
  const { data, error } = await supabase
    .from("guestbook")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create guestbook message: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to create guestbook message: no data returned");
  }

  return data;
};
