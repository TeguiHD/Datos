import { Construction } from 'lucide-react';

export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="fade-up flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Construction className="size-12 text-ds-muted" />
      <div>
        <h2 className="text-lg font-semibold text-text">{label}</h2>
        <p className="mt-1 text-sm text-ds-muted">En desarrollo - disponible próximamente.</p>
      </div>
    </div>
  );
}
