import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { isAuthConfigured, AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/adminSession";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await isAdmin()) {
    redirect("/admin");
  }

  const { next } = await searchParams;

  return (
    <LoginForm
      next={next}
      configError={isAuthConfigured() ? null : AUTH_NOT_CONFIGURED_MESSAGE}
    />
  );
}
