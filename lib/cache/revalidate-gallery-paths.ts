import { revalidatePath } from "next/cache";

export const revalidateGalleryPublicPaths = () => {
  revalidatePath("/");
  revalidatePath("/photos");
};
