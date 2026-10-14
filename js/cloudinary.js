// CF Academy — Cloudinary helpers
//  • cld(url, width)  → a resized, auto-format (WebP/AVIF), auto-quality version of
//    any Cloudinary image URL. Other URLs (or data: images) are returned unchanged.
//  • uploadImage(blob, sub) → uploads from the admin panel with an UNSIGNED preset.
import { CLOUDINARY } from "./firebase-config.js";

export const cloudinaryReady = !!(CLOUDINARY && CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);

export function cld(url, width, extra = "") {
  if (!url || typeof url !== "string") return url;
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m) return url;
  // already has a transformation (first path part contains "_" and "," or starts with a known key)? leave it
  if (/^(?:[a-z]{1,3}_[^/]+)\//.test(m[2]) && !/^v\d+\//.test(m[2])) return url;
  const t = ["f_auto", "q_auto", width ? `w_${Math.round(width)}` : "", width ? "c_limit" : "", extra].filter(Boolean).join(",");
  return m[1] + t + "/" + m[2];
}

// srcset for responsive images: 1x and 2x of the display width
export function cldSet(url, width) {
  if (!/res\.cloudinary\.com/.test(url || "")) return "";
  return `${cld(url, width)} 1x, ${cld(url, width * 2)} 2x`;
}

export async function uploadImage(blob, sub = "") {
  if (!cloudinaryReady) throw new Error("Cloudinary upload preset is not set in js/firebase-config.js");
  const fd = new FormData();
  fd.append("file", blob);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  const folder = [CLOUDINARY.folder, sub].filter(Boolean).join("/");
  if (folder) fd.append("folder", folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Cloudinary upload failed (" + r.status + ")");
  return { url: j.secure_url, publicId: j.public_id, width: j.width, height: j.height, bytes: j.bytes };
}

// canvas → Blob (WebP, falling back to JPEG)
export function canvasBlob(canvas, quality = 0.9) {
  return new Promise((res) => canvas.toBlob((b) => {
    if (b && b.type === "image/webp") return res(b);
    canvas.toBlob((j) => res(j), "image/jpeg", quality);
  }, "image/webp", quality));
}
