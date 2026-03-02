import { notFound } from "next/navigation";

import { FixedBottomNav } from "@/components/fixed-bottom-nav";
import { PostDetailPage } from "@/components/post-detail-page";
import { getE2EFixturePhotos } from "@/lib/gallery/e2e-fixtures";
import { getTimelinePostDetailFromDatabase } from "@/lib/gallery/repository";
import type { PhotoItem, TimelinePostDetail } from "@/lib/gallery/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EFixtureModeEnabled } from "@/lib/testing/e2e-fixture-mode";

const buildPostKey = (takenAt: string) => {
  const parsed = new Date(takenAt);

  if (Number.isNaN(parsed.getTime())) {
    return takenAt;
  }

  return takenAt.slice(0, 16);
};

const sortByTakenAtDesc = (left: PhotoItem, right: PhotoItem) => {
  const byTakenAt = +new Date(right.takenAt) - +new Date(left.takenAt);

  if (byTakenAt !== 0) {
    return byTakenAt;
  }

  return right.id.localeCompare(left.id);
};

const buildFixturePostDetail = (postId: string): TimelinePostDetail | null => {
  const familyItems = getE2EFixturePhotos().filter((item) => item.visibility === "family");
  const primary = familyItems.find((item) => item.id === postId);

  if (!primary) {
    return null;
  }

  const key = buildPostKey(primary.takenAt);
  const photos = familyItems
    .filter((item) => buildPostKey(item.takenAt) === key)
    .sort(sortByTakenAtDesc);

  return {
    id: primary.id,
    caption: primary.caption,
    takenAt: primary.takenAt,
    photos,
    commentPhotoId: primary.id,
  };
};

type PostDetailPageRouteProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostDetailPageRoute({ params }: PostDetailPageRouteProps) {
  const { postId } = await params;
  const safePostId = postId?.trim() ?? "";

  if (!safePostId) {
    notFound();
  }

  const supabase = createServerSupabaseClient();
  const fixtureMode = isE2EFixtureModeEnabled();
  let post: TimelinePostDetail | null = null;

  if (supabase) {
    try {
      post = await getTimelinePostDetailFromDatabase(supabase, {
        postId: safePostId,
        visibility: "family",
      });
    } catch {
      post = null;
    }
  }

  if (!post && fixtureMode) {
    post = buildFixturePostDetail(safePostId);
  }

  if (!post) {
    notFound();
  }

  return (
    <div className="page-bottom-safe min-h-screen">
      <PostDetailPage post={post} />
      <FixedBottomNav />
    </div>
  );
}
