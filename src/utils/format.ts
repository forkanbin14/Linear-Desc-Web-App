export function fmtNum(val: number | null | undefined, decimals = 4): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  if (Math.abs(val) === 0) return '0';
  if (Math.abs(val) >= 1e7 || (Math.abs(val) > 0 && Math.abs(val) < 1e-4)) {
    return val.toExponential(3);
  }
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function fmtBound(val: number | null | undefined, infLabel: string): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return infLabel;
  return fmtNum(val, 4);
}

export function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
