/**
 * Uploads NFT metadata (an image, then the JSON that references it) to
 * Arweave via Irys's devnet bundler, and returns the metadata URI to put
 * on-chain.
 *
 * This exercise's on-chain `uri` field has a hard ~200-byte limit, so a
 * self-contained `data:` URI is a non-starter — even a tiny embedded SVG
 * blows past that once base64 + JSON-wrap it. Irys is the standard
 * Metaplex/Umi answer: upload once, get back a short `https://gateway.irys.xyz/...`
 * URL that's genuinely public and permanent, exactly the "must point to
 * valid public JSON" rule this exercise calls out.
 */
import { createGenericFile, Umi } from "@metaplex-foundation/umi";
import { Attribute } from "./types";

/** A tiny flat-color SVG with a label. */
function svgImage(label: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><text x="200" y="215" font-size="48" font-family="monospace" fill="white" text-anchor="middle">${label}</text></svg>`;
}

export async function uploadMetadata(
  umi: Umi,
  params: {
    name: string;
    description: string;
    label: string;
    color: string;
    attributes: Attribute[];
  },
): Promise<string> {
  const imageFile = createGenericFile(svgImage(params.label, params.color), `${params.label}.svg`, {
    contentType: "image/svg+xml",
  });
  const [imageUri] = await umi.uploader.upload([imageFile]);

  return umi.uploader.uploadJson({
    name: params.name,
    description: params.description,
    image: imageUri,
    attributes: params.attributes,
  });
}
