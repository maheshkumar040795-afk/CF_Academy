// Professional profile icons for tutors without a photo (Admin → Website Tutors → Gender).
// Used on the website "Meet our tutors" cards and in the admin preview.

const BG = "#F5E8EC", SKIN = "#D9A07A", SKIN_D = "#C48A64", HAIR = "#2B1B17";

const MALE = `
  <rect width="96" height="96" fill="${BG}"/>
  <path d="M12 96c1-16 13-25 36-25s35 9 36 25z" fill="#5B2333"/>
  <path d="M40 70h16l-8 15z" fill="#FFF8F0"/>
  <path d="M46.2 72.5h3.6l1.6 3.2-3.4 15-3.4-15z" fill="#D8A65D"/>
  <path d="M36 69.5l12 22-8.5-3.5-6-14.5zM60 69.5L48 91.5l8.5-3.5 6-14.5z" fill="#46192A"/>
  <path d="M41 57h14v10.5a7 7 0 0 1-14 0z" fill="${SKIN_D}"/>
  <ellipse cx="33.6" cy="44" rx="2.8" ry="4.2" fill="${SKIN_D}"/>
  <ellipse cx="62.4" cy="44" rx="2.8" ry="4.2" fill="${SKIN_D}"/>
  <ellipse cx="48" cy="42" rx="14.6" ry="17" fill="${SKIN}"/>
  <path d="M33.2 42c-1.4-13 5.6-21.5 15.6-21.5 9.6 0 15.6 6.6 14.8 18.8l-.2 3.2c-1.4-6.4-4-9.8-8.4-11.2-6.4 2.4-14.4 2.2-20.4-.6-1 3.2-1.2 7-1.4 11.3z" fill="${HAIR}"/>`;

const FEMALE = `
  <rect width="96" height="96" fill="${BG}"/>
  <path d="M29.5 44c0-15.5 8-24 18.5-24s18.5 8.5 18.5 24v19.5c0 4-3 6.5-6.5 6.5h-24c-3.5 0-6.5-2.5-6.5-6.5z" fill="${HAIR}"/>
  <path d="M13 96c1-15.5 13-24.5 35-24.5S82 80.5 83 96z" fill="#5B2333"/>
  <path d="M39.5 71h17L48 86z" fill="#FFF8F0"/>
  <path d="M37 70.5l11 21-7.5-3-5.5-14.5zM59 70.5l-11 21 7.5-3 5.5-14.5z" fill="#7A3045"/>
  <path d="M41.5 58h13v10a6.5 6.5 0 0 1-13 0z" fill="${SKIN_D}"/>
  <ellipse cx="48" cy="43" rx="13.6" ry="16" fill="${SKIN}"/>
  <path d="M34.4 44c-.6-12.4 5.8-19.6 13.8-19.6 8.6 0 14 6.6 13.4 16.6-7-1.2-12.6-4.8-15.6-10-2.2 6.2-6.4 10.8-11.6 13z" fill="${HAIR}"/>
  <circle cx="34.6" cy="50.5" r="1.6" fill="#D8A65D"/>
  <circle cx="61.4" cy="50.5" r="1.6" fill="#D8A65D"/>
  <path d="M42 77.5q6 4 12 0" fill="none" stroke="#D8A65D" stroke-width="1.2"/>`;

// gender: "Male" | "Female" → inline SVG string ("" for anything else)
export function avatarSVG(gender) {
  const g = String(gender || "").toLowerCase();
  const art = g === "male" ? MALE : g === "female" ? FEMALE : "";
  return art ? `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${art}</svg>` : "";
}
