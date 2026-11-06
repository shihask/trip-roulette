import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-5 px-4 pt-12">
      <h1 className="text-[28px] font-bold">Sign in to admin</h1>
      <AdminLoginForm />
    </main>
  );
}
