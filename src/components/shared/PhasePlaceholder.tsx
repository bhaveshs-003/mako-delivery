import { Construction } from "lucide-react";

/**
 * Foundation-scaffold placeholder for feature pages delivered in later phases.
 * Keeps navigation whole (no 404s) while making the build boundary explicit.
 */
export function PhasePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-slate">
          <Construction className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-navy">
          Arriving in {phase}
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate">{description}</p>
      </div>
    </div>
  );
}
