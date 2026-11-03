// Professional profile icons for tutors without a photo (Admin → Website Tutors → Gender).
// Used on the website "Meet our tutors" cards and in the admin preview.
// Images: assets/tutor-male.webp, assets/tutor-female.webp (320 × 320, square)

const SRC = { male: "assets/tutor-male.webp?v=2", female: "assets/tutor-female.webp?v=2" };

// gender: "Male" | "Female" → <img> string ("" for anything else)
export function avatarSVG(gender) {
  const src = SRC[String(gender || "").toLowerCase()];
  return src ? `<img class="avatar-img" src="${src}" alt="" width="160" height="160" loading="lazy" decoding="async">` : "";
}
