"use client";
import { useTransition, type ReactNode } from "react";

export default function ConfirmDelete({
  action,
  id,
  message = "Delete this record? This cannot be undone.",
  children = "Delete",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  message?: string;
  children?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(message)) return;
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <button
      className="danger small"
      type="button"
      disabled={pending}
      onClick={remove}
    >
      {pending ? "Deleting…" : children}
    </button>
  );
}
