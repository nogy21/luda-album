import { AdminConsole } from "@/components/admin-console";

export default function AdminPage() {
  return (
    <div className="min-h-screen pb-14">
      <main className="layout-container pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6">
        <AdminConsole />
      </main>
    </div>
  );
}
