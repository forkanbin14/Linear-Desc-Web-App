import katex from 'katex';
import { useMemo } from 'react';

interface LatexBlockProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export function LatexBlock({ math, displayMode = false, className = '' }: LatexBlockProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return '';
    }
  }, [math, displayMode]);

  if (!html) {
    return <code className={`font-mono text-xs text-slate-800 ${className}`}>{math}</code>;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
