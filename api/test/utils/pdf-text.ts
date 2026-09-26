import { inflateSync } from 'node:zlib';

interface TextRun {
  y: number;
  text: string;
}

/**
 * Minimal text extractor for the PDFs we generate (pdfkit, standard fonts):
 * inflates each content stream, decodes the hex strings inside text objects
 * (BT…ET) and, like real extractors, joins runs that share a baseline into one
 * line (e.g. a bold "Invoice No: " followed by a regular "PUR-2026-0001").
 * Enough to assert that the PDF is real, machine-readable text; not a
 * general-purpose PDF parser.
 */
export function extractPdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const runs: TextRun[] = [];

  for (const [, body] of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(body, 'latin1')).toString('latin1');
    } catch {
      continue; // not a compressed content stream
    }
    for (const [, textObject] of content.matchAll(/BT([\s\S]*?)ET/g)) {
      const y = Number(
        /\S+ \S+ \S+ \S+ \S+ (\S+) Tm/.exec(textObject)?.[1] ?? NaN,
      );
      const text = [...textObject.matchAll(/<([0-9a-fA-F]*)>/g)]
        .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
        .join('');
      if (text) runs.push({ y, text });
    }
  }

  const lines: string[] = [];
  runs.forEach((run, i) => {
    const sameLine = i > 0 && Math.abs(runs[i - 1].y - run.y) < 0.5;
    if (!sameLine) {
      lines.push(run.text);
      return;
    }
    const previous = lines[lines.length - 1];
    lines[lines.length - 1] = previous.endsWith(' ')
      ? previous + run.text
      : `${previous} ${run.text}`;
  });
  return lines.join('\n');
}

export const pageCount = (pdf: Buffer): number =>
  (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
