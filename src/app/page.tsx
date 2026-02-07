import Link from "next/link";
import { db } from "~/server/db";

export default async function HomePage() {

  const posts = await db.query.posts.findMany();
  console.log(posts);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b">
      app in development
    </main>
  );
}
