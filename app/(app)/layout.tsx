import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { VideoProvider } from "@/components/video/video-context";
import { currentUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <VideoProvider>
      <AppNav name={user.name} />
      <main className="pb-16">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-mute sm:px-6">
          <span>Flipper · practice command centre</span>
          <span>Video analysis runs in your browser. Estimates are not a substitute for a radar gun.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-navy">Privacy</Link>
            <Link href="/terms" className="hover:text-navy">Terms</Link>
          </span>
        </div>
      </footer>
    </VideoProvider>
  );
}
