const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Descarga un archivo desde la API conservando la sesión (cookies). */
export async function downloadFile(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'export';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
