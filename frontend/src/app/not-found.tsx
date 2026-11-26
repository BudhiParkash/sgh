import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { NotFoundContent } from "@/components/layout/not-found-content";
import { SignInDialog } from "@/components/play/sign-in-dialog";
import { PlayerProvider } from "@/lib/play/context";

/**
 * URLs that match no route render here, outside every layout, so this page brings its own header and footer.
 * (notFound() thrown by a site page uses app/(site)/not-found.tsx instead — no duplicate header.)
 */
export default function NotFound() {
  return (
    <PlayerProvider>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
          <NotFoundContent />
        </main>
        <Footer />
        <SignInDialog />
      </div>
    </PlayerProvider>
  );
}
