import type {
  StoredWebPushSubscription,
  WebPushSubscriptionPayload,
} from "@/lib/notifications/types";

type RepositoryClient = {
  from: (table: string) => unknown;
};

type QueryResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type QueryPromise<T> = PromiseLike<QueryResponse<T>>;

type QueryChain = {
  select: (columns?: string) => QueryChain;
  order: (column: string, options: { ascending: boolean }) => QueryChain;
  eq: (column: string, value: unknown) => QueryChain;
  limit: (count: number) => QueryChain;
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string; ignoreDuplicates?: boolean },
  ) => QueryChain;
  delete: () => QueryChain;
  update: (values: Record<string, unknown>) => QueryChain;
};

const SUBSCRIPTION_SELECT = "endpoint, p256dh, auth";

export const getWebPushSubscriptionsTableName = () => {
  return process.env.WEB_PUSH_SUBSCRIPTIONS_TABLE ?? "web_push_subscriptions";
};

export const upsertWebPushSubscription = async (
  supabase: RepositoryClient,
  payload: WebPushSubscriptionPayload,
  tableName = getWebPushSubscriptionsTableName(),
) => {
  const nowIso = new Date().toISOString();
  const query = (supabase.from(tableName) as QueryChain).upsert(
    {
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      expiration_time: payload.expirationTime,
      is_active: true,
      updated_at: nowIso,
    },
    { onConflict: "endpoint" },
  );

  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to upsert web push subscription: ${error.message}`);
  }
};

export const deleteWebPushSubscription = async (
  supabase: RepositoryClient,
  endpoint: string,
  tableName = getWebPushSubscriptionsTableName(),
) => {
  const query = (supabase.from(tableName) as QueryChain).delete().eq("endpoint", endpoint);
  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to delete web push subscription: ${error.message}`);
  }
};

export const listActiveWebPushSubscriptions = async (
  supabase: RepositoryClient,
  tableName = getWebPushSubscriptionsTableName(),
): Promise<StoredWebPushSubscription[]> => {
  const query = (supabase.from(tableName) as QueryChain)
    .select(SUBSCRIPTION_SELECT)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(500);
  const { data, error } = (await (query as unknown as QueryPromise<StoredWebPushSubscription[]>)) as {
    data: StoredWebPushSubscription[] | null;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to list web push subscriptions: ${error.message}`);
  }

  return data ?? [];
};

export const markWebPushSubscriptionNotified = async (
  supabase: RepositoryClient,
  endpoint: string,
  tableName = getWebPushSubscriptionsTableName(),
) => {
  const nowIso = new Date().toISOString();
  const query = (supabase.from(tableName) as QueryChain)
    .update({ last_notified_at: nowIso, updated_at: nowIso })
    .eq("endpoint", endpoint);
  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to update web push subscription status: ${error.message}`);
  }
};

export const deactivateWebPushSubscription = async (
  supabase: RepositoryClient,
  endpoint: string,
  tableName = getWebPushSubscriptionsTableName(),
) => {
  const nowIso = new Date().toISOString();
  const query = (supabase.from(tableName) as QueryChain)
    .update({ is_active: false, updated_at: nowIso })
    .eq("endpoint", endpoint);
  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: { message: string } | null;
  };

  if (error) {
    throw new Error(`Failed to deactivate web push subscription: ${error.message}`);
  }
};
