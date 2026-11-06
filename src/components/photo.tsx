/**
 * Image slot. Until licensed photography is wired up from Supabase Storage,
 * this renders the striped placeholder from the design handoff with the
 * real alt text, so layout and accessibility match the final version.
 */
export function Photo({
  alt,
  tint,
  className = "",
  caption,
}: {
  alt: string;
  tint: string;
  className?: string;
  caption?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`photo-placeholder flex items-end p-3 ${className}`}
      style={{ backgroundColor: tint }}
    >
      {caption ? (
        <span className="rounded-label bg-ink/72 px-2 py-1 text-xs text-white">{caption}</span>
      ) : null}
    </div>
  );
}
