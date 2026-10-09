import type { ReactNode } from "react";

type ChatMessageContentProps = {
  content: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatMessageContent({ content }: ChatMessageContentProps) {
  const raw = String(content || "");
  const lines = raw.split("\n");
  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let numberedBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: "4px 0 0 18px", padding: 0 }}>
        {bulletBuffer.map((line, idx) => (
          <li key={idx} style={{ marginBottom: 4 }}>
            {renderInline(line.replace(/^[-*]\s+/, ""))}
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const flushNumbered = () => {
    if (numberedBuffer.length === 0) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} style={{ margin: "4px 0 0 18px", padding: 0 }}>
        {numberedBuffer.map((line, idx) => (
          <li key={idx} style={{ marginBottom: 4 }}>
            {renderInline(line.replace(/^\d+\.\s+/, ""))}
          </li>
        ))}
      </ol>
    );
    numberedBuffer = [];
  };

  const flushAll = () => {
    flushBullets();
    flushNumbered();
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushNumbered();
      bulletBuffer.push(trimmed);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushBullets();
      numberedBuffer.push(trimmed);
      continue;
    }

    flushAll();

    if (/^#{1,3}\s+/.test(trimmed) || /^\*\*[^*]+\*\*\s*—/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,3}\s+/, "");
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          style={{ margin: "8px 0 4px", fontWeight: 600, fontSize: 13 }}
        >
          {renderInline(heading)}
        </p>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} style={{ margin: "0 0 6px 0" }}>
        {renderInline(trimmed)}
      </p>
    );
  }

  flushAll();

  if (blocks.length === 0) {
    return <p style={{ margin: 0 }}>{raw}</p>;
  }

  return <>{blocks}</>;
}
