import Link from "next/link";
import { db } from "~/server/db";

export default async function HomePage() {

  const posts = await db.query.posts.findMany();
  console.log(posts);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold">Welcome</h1>
        <p className="text-gray-600">app in development</p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Login
        </button>
      </div>
    </main>
  );
}
