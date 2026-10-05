import { AppShell } from "@/components/app-shell";
import { CategoriesClient } from "@/components/categories-client";
import { getSettingsMap, listCategories } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  const settings = getSettingsMap();
  const cats = JSON.parse(JSON.stringify(listCategories())) as ReturnType<
    typeof listCategories
  >;

  return (
    <AppShell
      title="Categories"
      subtitle="Each category is a subfolder under your download root"
    >
      <CategoriesClient
        initial={cats}
        downloadRoot={settings.downloadRoot}
      />
    </AppShell>
  );
}
