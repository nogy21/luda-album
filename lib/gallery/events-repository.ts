import {
  normalizeEventName,
  sanitizeEventNames,
} from "./event-names";

type QueryError = { message: string } | null;

type GalleryEventRow = {
  id: string;
  name: string;
  normalized_name: string;
  updated_at?: string | null;
};

type GalleryPhotoEventRow = {
  photo_id: string;
  event_id: string;
};

type RepositoryClient = {
  from: (table: string) => unknown;
};

const EVENTS_TABLE = "gallery_events";
const PHOTO_EVENTS_TABLE = "gallery_photo_events";

const clampSuggestionLimit = (limit?: number) => {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return 8;
  }

  return Math.min(20, Math.max(1, Math.floor(limit)));
};

const escapeIlikePattern = (value: string) => {
  return value.replace(/[%_]/g, "\\$&");
};

const sortWithInputOrder = (rows: GalleryEventRow[], names: string[]) => {
  const orderMap = new Map(
    names.map((name, index) => [normalizeEventName(name), index] as const),
  );

  return [...rows].sort((left, right) => {
    const leftOrder = orderMap.get(left.normalized_name) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderMap.get(right.normalized_name) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });
};

export { normalizeEventName };

export const upsertEventNames = async (
  supabase: RepositoryClient,
  names: string[],
): Promise<GalleryEventRow[]> => {
  const eventNames = sanitizeEventNames(names);

  if (eventNames.length === 0) {
    return [];
  }

  const payload = eventNames.map((name) => ({
    name,
    normalized_name: normalizeEventName(name),
  }));

  const upsertBuilder = supabase.from(EVENTS_TABLE) as {
    upsert: (values: Array<Record<string, unknown>>, options: { onConflict: string }) => {
      select: (columns: string) => Promise<{ data: GalleryEventRow[] | null; error: QueryError }>;
    };
  };

  const { error } = await upsertBuilder
    .upsert(payload, { onConflict: "normalized_name" })
    .select("id, name, normalized_name, updated_at");

  if (error) {
    throw new Error(`Failed to upsert gallery events: ${error.message}`);
  }

  const normalizedNames = payload.map((item) => item.normalized_name);
  const selectBuilder = supabase.from(EVENTS_TABLE) as {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{ data: GalleryEventRow[] | null; error: QueryError }>;
    };
  };

  const { data, error: selectError } = await selectBuilder
    .select("id, name, normalized_name, updated_at")
    .in("normalized_name", normalizedNames);

  if (selectError) {
    throw new Error(`Failed to load gallery events: ${selectError.message}`);
  }

  return sortWithInputOrder(data ?? [], eventNames);
};

export const replacePhotoEvents = async (
  supabase: RepositoryClient,
  photoId: string,
  names: string[],
): Promise<string[]> => {
  const eventNames = sanitizeEventNames(names);

  const relationDeleteBuilder = supabase.from(PHOTO_EVENTS_TABLE) as {
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: QueryError }>;
    };
  };

  const { error: deleteError } = await relationDeleteBuilder
    .delete()
    .eq("photo_id", photoId);

  if (deleteError) {
    throw new Error(`Failed to clear gallery photo events: ${deleteError.message}`);
  }

  if (eventNames.length === 0) {
    return [];
  }

  const eventRows = await upsertEventNames(supabase, eventNames);
  const byNormalized = new Map(
    eventRows.map((row) => [row.normalized_name, row] as const),
  );

  const relationRows = eventNames
    .map((name) => {
      const event = byNormalized.get(normalizeEventName(name));

      if (!event) {
        return null;
      }

      return {
        photo_id: photoId,
        event_id: event.id,
      };
    })
    .filter((row): row is { photo_id: string; event_id: string } => row !== null);

  if (relationRows.length === 0) {
    return [];
  }

  const relationInsertBuilder = supabase.from(PHOTO_EVENTS_TABLE) as {
    insert: (
      values: Array<Record<string, unknown>>,
    ) => Promise<{ error: QueryError }>;
  };
  const { error: insertError } = await relationInsertBuilder.insert(relationRows);

  if (insertError) {
    throw new Error(`Failed to link gallery photo events: ${insertError.message}`);
  }

  return eventRows.map((row) => row.name);
};

export const listEventNamesByPhotoIds = async (
  supabase: RepositoryClient,
  photoIds: string[],
): Promise<Map<string, string[]>> => {
  const uniquePhotoIds = Array.from(new Set(photoIds));

  if (uniquePhotoIds.length === 0) {
    return new Map();
  }

  const relationSelectBuilder = supabase.from(PHOTO_EVENTS_TABLE) as {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{ data: GalleryPhotoEventRow[] | null; error: QueryError }>;
    };
  };

  const { data: relationRows, error: relationError } = await relationSelectBuilder
    .select("photo_id, event_id")
    .in("photo_id", uniquePhotoIds);

  if (relationError) {
    throw new Error(`Failed to load gallery photo event links: ${relationError.message}`);
  }

  const rows = relationRows ?? [];
  const eventIds = Array.from(new Set(rows.map((row) => row.event_id)));
  const eventNameById = new Map<string, string>();

  if (eventIds.length > 0) {
    const eventSelectBuilder = supabase.from(EVENTS_TABLE) as {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<{ data: GalleryEventRow[] | null; error: QueryError }>;
      };
    };
    const { data: eventRows, error: eventError } = await eventSelectBuilder
      .select("id, name, normalized_name, updated_at")
      .in("id", eventIds);

    if (eventError) {
      throw new Error(`Failed to load gallery event names: ${eventError.message}`);
    }

    for (const event of eventRows ?? []) {
      eventNameById.set(event.id, event.name);
    }
  }

  const result = new Map<string, string[]>();

  for (const photoId of uniquePhotoIds) {
    result.set(photoId, []);
  }

  for (const relation of rows) {
    const eventName = eventNameById.get(relation.event_id);

    if (!eventName) {
      continue;
    }

    const current = result.get(relation.photo_id) ?? [];

    if (!current.includes(eventName)) {
      current.push(eventName);
      result.set(relation.photo_id, current);
    }
  }

  return result;
};

export const listEventSuggestions = async (
  supabase: RepositoryClient,
  query: string,
  limit?: number,
): Promise<string[]> => {
  const normalizedQuery = normalizeEventName(query);
  const suggestionLimit = clampSuggestionLimit(limit);

  const eventsBuilder = supabase.from(EVENTS_TABLE) as {
    select: (columns: string) => {
      ilike: (column: string, value: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (
            count: number,
          ) => Promise<{ data: GalleryEventRow[] | null; error: QueryError }>;
        };
      };
      order: (
        column: string,
        options: { ascending: boolean },
      ) => {
        limit: (
          count: number,
        ) => Promise<{ data: GalleryEventRow[] | null; error: QueryError }>;
      };
    };
  };

  const eventsQuery = eventsBuilder.select("id, name, normalized_name, updated_at");

  const { data: eventRows, error: eventsError } = normalizedQuery
    ? await eventsQuery
        .ilike("normalized_name", `%${escapeIlikePattern(normalizedQuery)}%`)
        .order("updated_at", { ascending: false })
        .limit(120)
    : await eventsQuery.order("updated_at", { ascending: false }).limit(200);

  if (eventsError) {
    throw new Error(`Failed to list gallery events: ${eventsError.message}`);
  }

  const events = eventRows ?? [];

  if (events.length === 0) {
    return [];
  }

  const relationBuilder = supabase.from(PHOTO_EVENTS_TABLE) as {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{ data: Array<{ event_id: string }> | null; error: QueryError }>;
    };
  };

  const { data: relationRows, error: relationError } = await relationBuilder
    .select("event_id")
    .in(
      "event_id",
      events.map((event) => event.id),
    );

  if (relationError) {
    throw new Error(`Failed to list gallery event usage: ${relationError.message}`);
  }

  const usageCountMap = new Map<string, number>();

  for (const relation of relationRows ?? []) {
    usageCountMap.set(
      relation.event_id,
      (usageCountMap.get(relation.event_id) ?? 0) + 1,
    );
  }

  return [...events]
    .sort((left, right) => {
      if (normalizedQuery) {
        const leftPrefix = left.normalized_name.startsWith(normalizedQuery) ? 0 : 1;
        const rightPrefix = right.normalized_name.startsWith(normalizedQuery) ? 0 : 1;

        if (leftPrefix !== rightPrefix) {
          return leftPrefix - rightPrefix;
        }
      }

      const usageDiff =
        (usageCountMap.get(right.id) ?? 0) - (usageCountMap.get(left.id) ?? 0);

      if (usageDiff !== 0) {
        return usageDiff;
      }

      return left.name.localeCompare(right.name, "ko");
    })
    .slice(0, suggestionLimit)
    .map((event) => event.name);
};
