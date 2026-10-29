import { headers } from "next/headers";

/** Structured data block. Carries the request CSP nonce; content is JSON-escaped. */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}
