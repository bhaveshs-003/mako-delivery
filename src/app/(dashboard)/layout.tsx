import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

// App shell (spec §4.1): fixed sidebar + sticky header + centered content.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar role={user.role} name={user.name} email={user.email} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="scroll-slim flex-1 overflow-y-auto">
          <div className="animate-fade-in px-6 py-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
