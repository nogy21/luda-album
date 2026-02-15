import { AdminConsole } from "@/components/admin-console";

export default function AdminPage() {
  return (
    <div className="min-h-screen px-4 pb-14 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
      <main className="mx-auto w-full max-w-4xl">
        <AdminConsole />
      </main>
    </div>
  );
}
