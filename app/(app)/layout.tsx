import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { VideoProvider } from "@/components/video/video-context";

/** Highlights and Ball Tracking share the loaded video, so switching tabs keeps your work. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VideoProvider>
      <AppNav />
      <main className="pb-16">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-mute sm:px-6">
          <span>Flipper · videos never leave your device</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-navy">Privacy</Link>
            <Link href="/terms" className="hover:text-navy">Terms</Link>
          </span>
        </div>
      </footer>
    </VideoProvider>
  );
}
