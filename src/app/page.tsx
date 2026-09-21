import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Helpox</h1>
      {user ? (
        <>
          <p className="text-muted-foreground">Signed in as {user.email}.</p>
          <form action="/sign-out" method="post">
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">Project skeleton. Nothing built yet.</p>
          <Link href="/sign-in">
            <Button type="button">Sign in</Button>
          </Link>
        </>
      )}
    </main>
  );
}
