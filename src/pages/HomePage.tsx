import { useEffect, useState } from "react";
import { getApiUrl } from "~/lib/api";

interface Post {
  id: number;
  name: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch(getApiUrl("/api/posts"));
        if (!response.ok) {
          throw new Error("Failed to fetch posts");
        }
        const data = await response.json();
        setPosts(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-10"
    >
      {/* Database Table Display */}
      <div className="mb-8 w-full max-w-4xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Database Posts Table
        </h2>
        {loading && (
          <p className="text-gray-600">Loading posts from database...</p>
        )}
        {error && <p className="text-red-600">Error: {error}</p>}
        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg border border-gray-300">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    ID
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Updated At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {posts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No posts found in database
                    </td>
                  </tr>
                ) : (
                  posts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {post.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {post.name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {new Date(post.createdAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {post.updatedAt
                          ? new Date(post.updatedAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top status text */}
      <p className="text-lg font-semibold text-gray-800">
        14:15
      </p>

      {/* Call to action */}
      <p className="mt-4 text-xl font-bold text-gray-900">
        <span className="underline">הגיע</span> הזמן לתרגל!
      </p>

      {/* Button cards */}
      <div className="mt-8 flex w-full max-w-lg flex-col gap-5">
        {/* קביעת זמני תרגול */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            קביעת זמני תרגול
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </button>

        {/* צפייה בנתוני התרגול */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            צפייה בנתוני התרגול
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 20h18" />
            <rect x="5" y="10" width="3" height="10" rx="0.5" />
            <rect x="10.5" y="4" width="3" height="16" rx="0.5" />
            <rect x="16" y="8" width="3" height="12" rx="0.5" />
          </svg>
        </button>

        {/* הודעות מקלינאים */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            הודעות מקלינאים
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 4L12 13 2 4" />
          </svg>
        </button>
      </div>

      {/* Start practice button */}
      <div className="mt-12 flex flex-col items-center">
        <button className="flex h-48 w-48 items-center justify-center rounded-full bg-green-500 text-center text-2xl font-extrabold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-600">
          התחלת
          <br />
          תרגול
        </button>
      </div>
    </main>
  );
}
