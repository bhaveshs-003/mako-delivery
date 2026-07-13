"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/UserAvatar";

type Person = { id: string; name: string };

/**
 * Textarea with inline "@" mention autocomplete. Type `@`, a filtered list of
 * `people` appears; pick one (click, or ↑/↓ + Enter/Tab) to insert `@Name `.
 * Mentions are derived from the text — deleting an `@Name` unmentions them.
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  rows = 2,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Person[];
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [openList, setOpenList] = useState(false);
  const [index, setIndex] = useState(0);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);

  // Active "@query" immediately before the caret (no whitespace after @).
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf("@");
  const query = at >= 0 && !/\s/.test(upto.slice(at + 1)) ? upto.slice(at + 1) : null;

  const matches =
    query !== null
      ? people
          .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6)
      : [];
  const show = openList && matches.length > 0;

  // Restore caret after a programmatic insert.
  useLayoutEffect(() => {
    if (pendingCaret !== null && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pendingCaret, pendingCaret);
      setCaret(pendingCaret);
      setPendingCaret(null);
    }
  }, [pendingCaret]);

  function select(person: Person) {
    const before = value.slice(0, at);
    const after = value.slice(caret);
    const insert = `@${person.name} `;
    onChange(before + insert + after);
    setPendingCaret(before.length + insert.length);
    setOpenList(false);
    setIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!show) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      select(matches[Math.min(index, matches.length - 1)]);
    } else if (e.key === "Escape") {
      setOpenList(false);
    }
  }

  function sync(el: HTMLTextAreaElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setOpenList(true);
          setIndex(0);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onBlur={() => setTimeout(() => setOpenList(false), 120)}
        className={cn(
          "min-h-[64px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-line-strong focus:outline-none",
          className
        )}
      />

      {show && (
        <ul className="absolute left-2 z-30 mt-1 w-56 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-md">
          <li className="px-2 pb-1 text-2xs uppercase tracking-wide text-muted">Tag a resource</li>
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before textarea blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(p);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                  i === index ? "bg-brand/10 text-brand-ink" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                <UserAvatar name={p.name} size="sm" />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Derive mentioned user ids from free text containing `@Name` tokens. */
export function deriveMentions(text: string, people: Person[]): string[] {
  return people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);
}
