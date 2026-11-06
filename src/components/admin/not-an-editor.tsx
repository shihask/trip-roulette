import { SignOutButton } from "@/components/admin/admin-ui";

export function NotAnEditor() {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-card border border-warn-border bg-warn-bg p-5 text-warn-text">
      <h1 className="text-[24px] font-bold">This account isn&apos;t an editor</h1>
      <p className="text-[15px]">
        You&apos;re signed in, but this account has no active editor or admin role. Ask an admin to add it to{" "}
        <code>admin_users</code>.
      </p>
      <div>
        <SignOutButton />
      </div>
    </div>
  );
}
