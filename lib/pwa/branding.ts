type QueryError = { message: string } | null;
type QueryResponse<T> = {
  data: T | null;
  error: QueryError;
};

type QueryPromise<T> = PromiseLike<QueryResponse<T>>;

type QueryChain = {
  select: (columns?: string) => QueryChain;
  eq: (column: string, value: unknown) => QueryChain;
  limit: (count: number) => QueryChain;
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string; ignoreDuplicates?: boolean },
  ) => QueryChain;
  delete: () => QueryChain;
};

type RepositoryClient = {
  from: (table: string) => unknown;
};

export type PwaIconVariant = "icon192" | "icon512" | "maskable512" | "appleTouch";

export type PwaIconPaths = Record<PwaIconVariant, string>;

export type PwaBranding = {
  icons: PwaIconPaths;
  version: string;
  isCustom: boolean;
  storagePaths: string[];
};

type StoredIconAsset = {
  url: string;
  storagePath: string | null;
};

type StoredPwaBrandingValue = {
  icons: Record<PwaIconVariant, StoredIconAsset>;
};

type PwaBrandingSettingRow = {
  value?: unknown;
  updated_at?: string | null;
};

export type SavePwaBrandingInput = {
  icons: {
    icon192: StoredIconAsset;
    icon512: StoredIconAsset;
    maskable512: StoredIconAsset;
    appleTouch: StoredIconAsset;
  };
  updatedAt?: string;
};

const PWA_BRANDING_SETTING_KEY = "pwa_branding";

export const DEFAULT_PWA_ICON_PATHS: PwaIconPaths = {
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  maskable512: "/icons/maskable-512.png",
  appleTouch: "/icons/apple-touch-icon.png",
};

export const PWA_ICON_ROUTE_PATHS: PwaIconPaths = {
  icon192: "/pwa/icon/192.png",
  icon512: "/pwa/icon/512.png",
  maskable512: "/pwa/icon/maskable-512.png",
  appleTouch: "/pwa/icon/apple-touch-icon.png",
};

export const getAppSettingsTableName = () => {
  return process.env.APP_SETTINGS_TABLE ?? "app_settings";
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const normalizeStoragePath = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  return value.trim();
};

const parseStoredIconAsset = (value: unknown): StoredIconAsset | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { url?: unknown; storagePath?: unknown };

  if (!isNonEmptyString(record.url)) {
    return null;
  }

  return {
    url: record.url.trim(),
    storagePath: normalizeStoragePath(record.storagePath),
  };
};

const isMissingSettingsTableError = (errorMessage: string) => {
  return (
    /relation .* does not exist/i.test(errorMessage) ||
    /schema cache/i.test(errorMessage) ||
    /could not find the table/i.test(errorMessage)
  );
};

export const buildDefaultPwaBranding = (): PwaBranding => {
  return {
    icons: { ...DEFAULT_PWA_ICON_PATHS },
    version: "default",
    isCustom: false,
    storagePaths: [],
  };
};

export const parseStoredPwaBrandingValue = (
  value: unknown,
  updatedAt?: string | null,
): PwaBranding | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { icons?: unknown };

  if (!record.icons || typeof record.icons !== "object") {
    return null;
  }

  const iconsRecord = record.icons as Record<string, unknown>;
  const icon192 = parseStoredIconAsset(iconsRecord.icon192);
  const icon512 = parseStoredIconAsset(iconsRecord.icon512);
  const maskable512 = parseStoredIconAsset(iconsRecord.maskable512);
  const appleTouch = parseStoredIconAsset(iconsRecord.appleTouch);

  if (!icon192 || !icon512 || !maskable512 || !appleTouch) {
    return null;
  }

  const storagePaths = [
    icon192.storagePath,
    icon512.storagePath,
    maskable512.storagePath,
    appleTouch.storagePath,
  ].filter((path): path is string => Boolean(path));
  const version = isNonEmptyString(updatedAt) ? updatedAt : "custom";

  return {
    icons: {
      icon192: icon192.url,
      icon512: icon512.url,
      maskable512: maskable512.url,
      appleTouch: appleTouch.url,
    },
    version,
    isCustom: true,
    storagePaths: Array.from(new Set(storagePaths)),
  };
};

export const getPwaBrandingVersionQuery = (version: string) => {
  if (!isNonEmptyString(version) || version === "default") {
    return "";
  }

  return `?v=${encodeURIComponent(version)}`;
};

export const readPwaBrandingFromDatabase = async (
  supabase: RepositoryClient,
  tableName = getAppSettingsTableName(),
): Promise<PwaBranding> => {
  const query = (supabase.from(tableName) as QueryChain)
    .select("value, updated_at")
    .eq("key", PWA_BRANDING_SETTING_KEY)
    .limit(1);

  const { data, error } = (await (query as unknown as QueryPromise<PwaBrandingSettingRow[]>)) as {
    data: PwaBrandingSettingRow[] | null;
    error: QueryError;
  };

  if (error) {
    if (isMissingSettingsTableError(error.message)) {
      return buildDefaultPwaBranding();
    }

    throw new Error(`Failed to read app settings: ${error.message}`);
  }

  const row = data?.[0];

  if (!row) {
    return buildDefaultPwaBranding();
  }

  return parseStoredPwaBrandingValue(row.value, row.updated_at) ?? buildDefaultPwaBranding();
};

export const resolvePwaBranding = async (
  supabase: RepositoryClient | null,
): Promise<PwaBranding> => {
  if (!supabase) {
    return buildDefaultPwaBranding();
  }

  try {
    return await readPwaBrandingFromDatabase(supabase);
  } catch {
    return buildDefaultPwaBranding();
  }
};

export const savePwaBrandingToDatabase = async (
  supabase: RepositoryClient,
  input: SavePwaBrandingInput,
  tableName = getAppSettingsTableName(),
): Promise<PwaBranding> => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const value: StoredPwaBrandingValue = {
    icons: {
      icon192: {
        url: input.icons.icon192.url,
        storagePath: input.icons.icon192.storagePath,
      },
      icon512: {
        url: input.icons.icon512.url,
        storagePath: input.icons.icon512.storagePath,
      },
      maskable512: {
        url: input.icons.maskable512.url,
        storagePath: input.icons.maskable512.storagePath,
      },
      appleTouch: {
        url: input.icons.appleTouch.url,
        storagePath: input.icons.appleTouch.storagePath,
      },
    },
  };

  const query = (supabase.from(tableName) as QueryChain).upsert(
    {
      key: PWA_BRANDING_SETTING_KEY,
      value,
      updated_at: updatedAt,
    },
    { onConflict: "key" },
  );

  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: QueryError;
  };

  if (error) {
    throw new Error(`Failed to save app settings: ${error.message}`);
  }

  return parseStoredPwaBrandingValue(value, updatedAt) ?? buildDefaultPwaBranding();
};

export const clearPwaBrandingFromDatabase = async (
  supabase: RepositoryClient,
  tableName = getAppSettingsTableName(),
) => {
  const query = (supabase.from(tableName) as QueryChain)
    .delete()
    .eq("key", PWA_BRANDING_SETTING_KEY);
  const { error } = (await (query as unknown as QueryPromise<never>)) as {
    data: never;
    error: QueryError;
  };

  if (error) {
    throw new Error(`Failed to clear app settings: ${error.message}`);
  }
};
