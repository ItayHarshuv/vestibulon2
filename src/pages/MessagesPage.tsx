import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import {
  chatContactsResponseSchema,
  chatMessageSchema,
  chatMessagesResponseSchema,
  getZodErrorMessage,
  type ChatContact,
  type ChatMessage,
} from "~/lib/validation";

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.userId === selectedUserId) ?? null,
    [contacts, selectedUserId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setContactsLoading(true);
        setError(null);
        const response = await apiFetch("/api/chat/conversations");
        if (!response.ok) throw new Error("Failed to load chat contacts");
        const parsed = chatContactsResponseSchema.safeParse(
          await response.json(),
        );
        if (!parsed.success) {
          throw new Error(getZodErrorMessage(parsed.error));
        }
        if (cancelled) return;

        setContacts(parsed.data.contacts);
        setSelectedUserId((current) =>
          parsed.data.contacts.some((contact) => contact.userId === current)
            ? current
            : (parsed.data.contacts[0]?.userId ?? ""),
        );
      } catch (loadError) {
        console.error("Error loading chat contacts:", loadError);
        if (!cancelled) {
          setContacts([]);
          setSelectedUserId("");
          setError("לא ניתן לטעון את רשימת השיחות");
        }
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;

    const loadLatestMessages = async (showLoading: boolean) => {
      try {
        if (showLoading) setMessagesLoading(true);
        const query = new URLSearchParams({ userId: selectedUserId });
        const response = await apiFetch(
          `/api/chat/messages?${query.toString()}`,
        );
        if (!response.ok) throw new Error("Failed to load messages");
        const parsed = chatMessagesResponseSchema.safeParse(
          await response.json(),
        );
        if (!parsed.success) {
          throw new Error(getZodErrorMessage(parsed.error));
        }
        if (cancelled) return;

        setMessages((current) =>
          showLoading
            ? parsed.data.messages
            : mergeMessages(current, parsed.data.messages),
        );
        setHasMore(parsed.data.hasMore);
        setError(null);
        void apiFetch("/api/chat/messages", {
          method: "PATCH",
          body: JSON.stringify({ userId: selectedUserId }),
        });
      } catch (loadError) {
        console.error("Error loading chat messages:", loadError);
        if (!cancelled && showLoading) {
          setMessages([]);
          setError("לא ניתן לטעון את ההודעות");
        }
      } finally {
        if (!cancelled && showLoading) setMessagesLoading(false);
      }
    };

    setMessages([]);
    setHasMore(false);
    void loadLatestMessages(true);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadLatestMessages(false);
      }
    }, 4_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadLatestMessages(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedUserId]);

  async function loadOlderMessages() {
    const oldestMessageId = messages[0]?.id;
    if (!selectedUserId || !oldestMessageId || olderMessagesLoading) return;

    try {
      setOlderMessagesLoading(true);
      const query = new URLSearchParams({
        userId: selectedUserId,
        before: String(oldestMessageId),
      });
      const response = await apiFetch(`/api/chat/messages?${query.toString()}`);
      if (!response.ok) throw new Error("Failed to load older messages");
      const parsed = chatMessagesResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) throw new Error(getZodErrorMessage(parsed.error));
      setMessages((current) => mergeMessages(parsed.data.messages, current));
      setHasMore(parsed.data.hasMore);
    } catch (loadError) {
      console.error("Error loading older chat messages:", loadError);
      setError("לא ניתן לטעון הודעות קודמות");
    } finally {
      setOlderMessagesLoading(false);
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!selectedUserId || !body || sending) return;

    try {
      setSending(true);
      setError(null);
      const response = await apiFetch("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUserId,
          body,
          clientMessageId: crypto.randomUUID(),
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      const responseBody = (await response.json()) as { message?: unknown };
      const parsed = chatMessageSchema.safeParse(responseBody.message);
      if (!parsed.success) throw new Error(getZodErrorMessage(parsed.error));

      setMessages((current) => mergeMessages(current, [parsed.data]));
      setDraft("");
    } catch (sendError) {
      console.error("Error sending chat message:", sendError);
      setError("שליחת ההודעה נכשלה. נסו שוב.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col bg-white px-4 py-6 sm:px-6"
    >
      {user?.role === "clinician" && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">בחירת מטופל/ת</h2>
          {contactsLoading ? (
            <p className="mt-3 text-sm text-gray-600">טוען מטופלים...</p>
          ) : (
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {contacts.map((contact) => (
                <option key={contact.userId} value={contact.userId}>
                  {contact.username}
                </option>
              ))}
            </select>
          )}
        </section>
      )}

      {!contactsLoading && contacts.length === 0 ? (
        <p className="mt-8 text-center text-lg text-gray-600">
          {user?.role === "clinician"
            ? "לא נמצאו מטופלים לשיחה"
            : "עדיין לא הוגדר/ה עבורך קלינאי/ת"}
        </p>
      ) : (
        selectedContact && (
          <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
            <header className="border-b border-gray-200 bg-white px-4 py-3">
              <p className="font-bold text-gray-900">
                {selectedContact.username}
              </p>
            </header>

            <div className="flex min-h-[22rem] flex-1 flex-col overflow-y-auto p-4">
              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadOlderMessages()}
                  disabled={olderMessagesLoading}
                  className="mx-auto mb-4 rounded-lg px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {olderMessagesLoading ? "טוען..." : "טעינת הודעות קודמות"}
                </button>
              )}

              {messagesLoading ? (
                <p className="my-auto text-center text-gray-600">
                  טוען הודעות...
                </p>
              ) : messages.length === 0 ? (
                <p className="my-auto text-center text-gray-500">
                  עדיין אין הודעות. אפשר להתחיל את השיחה.
                </p>
              ) : (
                <div className="mt-auto space-y-3">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderUserId === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${
                            isOwnMessage
                              ? "bg-blue-600 text-white"
                              : "border border-gray-200 bg-white text-gray-900"
                          }`}
                        >
                          <p className="break-words whitespace-pre-wrap">
                            {message.body}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              isOwnMessage ? "text-blue-100" : "text-gray-500"
                            }`}
                          >
                            {formatMessageTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <p className="mx-4 mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <form
              className="flex items-end gap-2 border-t border-gray-200 bg-white p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4000}
                rows={2}
                placeholder="כתיבת הודעה..."
                className="min-h-12 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "שולח..." : "שליחה"}
              </button>
            </form>
          </section>
        )
      )}
    </main>
  );
}
