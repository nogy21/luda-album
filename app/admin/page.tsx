import { AdminConsole } from "@/components/admin-console";

export default function AdminPage() {
  return (
    <div className="min-h-screen px-4 pb-12 pt-8 sm:px-6">
      <main className="mx-auto w-full max-w-4xl">
        <AdminConsole />
      </main>
    </div>
  );
}

