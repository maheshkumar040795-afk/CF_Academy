// CF Academy — business details used by the website, WhatsApp
// messages and fee receipts. Edit here; every page picks it up.

export const SITE = {
  name: "CF Academy",
  fullName: "Challenge Future Academy",
  poweredBy: "Powered by IAS / IES / IIT Alumni",
  tagline: "No.1 Home Tuition & Online Tuition",
  since: 2010,
  experience: "17+",
  faculty: "850+",
  founders: [
    { name: "R. Nirmal", qual: "M.E.", role: "Founder" },
    { name: "V. Akshya", qual: "MSE", role: "Founder" }
  ],
  phones: ["8190870673", "8072135956"],
  // WhatsApp number that receives booking drafts (country code + number)
  whatsapp: "918190870673",
  email: "",                         // e.g. info@cfacademy.in
  address: "[OFFICE ADDRESS], Chennai, Tamil Nadu",   // TODO: same as old office
  mapUrl: "https://maps.app.goo.gl/Ae5GPFYDPdFMSE5u8",   // Google Maps share link ("Get directions")
  mapLat: 13.1291944,                // map pin shown on the Contact page
  mapLng: 80.1291944,
  coverage: "All over Chennai & Tamil Nadu",
  instagram: "",
  facebook: ""
};

export const SUBJECTS = [
  "Mathematics", "Science", "Physics", "Chemistry", "Biology",
  "English", "Tamil", "Hindi", "Social Science", "Accountancy",
  "Commerce", "Economics", "Computer Science", "All Subjects"
];

export const CLASSES = [
  "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11",
  "Class 12", "College / Other"
];

export const BOARDS = ["State Board", "CBSE", "ICSE", "IGCSE / IB", "Matriculation", "Other"];

export const CITIES = [
  "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem",
  "Tirunelveli", "Vellore", "Erode", "Thanjavur", "Tiruppur",
  "Kanchipuram", "Chengalpattu", "Tiruvallur", "Other (Tamil Nadu)"
];

export const TIME_SLOTS = [
  "6 – 8 AM", "8 – 10 AM", "10 AM – 12 PM", "12 – 2 PM",
  "2 – 4 PM", "4 – 6 PM", "6 – 8 PM", "8 – 10 PM", "Flexible"
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const BOOKING_STATUSES = ["New", "Called", "Tutor assigned", "Demo fixed", "Converted", "Not interested"];

// Tuition programme cards under "Our services".
// Photos are shown in full (not cropped). To change one, paste a new image URL into `image`.
// `cls` / `subject` pre-fill the booking form when a parent taps "Book now".
export const PROGRAMS = [
  { title: "Nursery – KG Tuition", tag: "Pre-KG · LKG · UKG", icon: "blocks",
    text: "Small steps, big dreams — playful phonics, numbers and early writing with patient, caring tutors.",
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791791955/Nursery-KG_Tuition__Small_Steps_Big_Dreams.png",
    cls: "LKG", subject: "All Subjects" },
  { title: "Class I – V Tuition", tag: "Primary school", icon: "pencil",
    text: "Strong basics in reading, writing, maths and EVS, with daily homework support and regular revision.",
    
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791792575/Online_and_Home_Tuition_Made_Bright.png", cls: "Class 1", subject: "All Subjects" },
  { title: "Class 6 to 10 Tuition", tag: "Middle & high school", icon: "book",
    text: "Subject experts for Maths, Science, English and Social Science — State Board, CBSE, ICSE and Matriculation.",
    
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791793793/Focused_Study_Session_with_Personal_Tuition.png", cls: "Class 6", subject: "" },
  { title: "11th & 12th Tuition", tag: "Higher secondary", icon: "flask",
    text: "Board-exam focused coaching for Science and Commerce — Physics, Chemistry, Maths, Biology, Accountancy and more.",
    
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791869152/images_17.jpg", cls: "Class 11", subject: "" },
  { title: "Exam Coaching", tag: "Competitive & entrance exams", icon: "target",
    text: "Focused preparation with practice tests, time management and doubt-clearing sessions.",
    
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791899130/6a8ea2da2c30d03b8732a30a.png", cls: "", subject: "", note: "Exam coaching" },
  { title: "IT Courses", tag: "School & college students", icon: "code",
    text: "Computer and programming courses that build practical, job-ready skills step by step.",
    
    image: "https://res.cloudinary.com/u3hhrbtz/image/upload/v1791899127/IT_course.jpg", cls: "College / Other", subject: "Computer Science" }
];

// "Find a tutor for anything" tabbed table (UrbanPro layout, without Hobby Classes).
// Each item can pre-fill the booking form: cls (class), subject (one of SUBJECTS), board, or note.
// badge: "New" shows a small red "New" label.
const L = (label, extra = {}) => ({ label, note: label, ...extra });
const IT = (label) => ({ label, note: label, cls: "College / Other", subject: "Computer Science" });
export const CATEGORIES = [
  { tab: "Online Classes", mode: "Online tuition", groups: [
    { title: "Tuitions", cols: 2, items: [
      { label: "Class 12 Tuition", cls: "Class 12" }, { label: "Class 11 Tuition", cls: "Class 11" },
      { label: "Class 10 Tuition", cls: "Class 10" }, { label: "Class 9 Tuition", cls: "Class 9" },
      { label: "Class 8 Tuition", cls: "Class 8" }, { label: "Class 7 Tuition", cls: "Class 7" },
      { label: "Class 6 Tuition", cls: "Class 6" }, { label: "Class I-V Tuition", cls: "Class 1" },
      { label: "BCom Tuition", cls: "College / Other", subject: "Commerce" }, { label: "BTech Tuition", cls: "College / Other" }] },
    { title: "Languages", cols: 2, items: [
      { label: "Spoken English", subject: "English" }, L("French Language"), L("Spanish Language"),
      L("German Language"), { label: "Hindi Language", subject: "Hindi" }, L("IELTS"), L("PTE"), L("TOEFL")] },
    { title: "More", cols: 1, items: [
      { label: "Online Tuitions" }, L("Online Language Classes"),
      IT("Online IT Coaching"), L("Online Exam Entrance Coaching")] }
  ] },
  { tab: "Tuition", groups: [
    { title: "School", cols: 2, items: [
      { label: "Class 12 Tuition", cls: "Class 12" }, { label: "Class 11 Tuition", cls: "Class 11" },
      { label: "Class 10 Tuition", cls: "Class 10" }, { label: "Class 9 Tuition", cls: "Class 9" },
      { label: "Class 8 Tuition", cls: "Class 8" }, { label: "Class 7 Tuition", cls: "Class 7" },
      { label: "Class 6 Tuition", cls: "Class 6" }, { label: "Class 1 to 5 Tuition", cls: "Class 1" },
      { label: "Nursery-KG Tuition", cls: "LKG" }] },
    { title: "College", cols: 1, items: [
      { label: "BTech Tuition", cls: "College / Other" }, { label: "BCom Tuition", cls: "College / Other", subject: "Commerce" },
      { label: "Engineering Diploma Tuition", cls: "College / Other" }, { label: "BBA Tuition", cls: "College / Other" },
      { label: "BSc Tuition", cls: "College / Other" }] },
    { title: "Subject", cols: 1, items: [
      { label: "Mathematics", subject: "Mathematics" }, { label: "English", subject: "English" },
      { label: "Science", subject: "Science" }, { label: "Physics", subject: "Physics" }, { label: "Hindi", subject: "Hindi" }] },
    { title: "More", cols: 1, items: [
      { label: "All Tuitions" }, { label: "Online Tuitions", mode: "Online tuition" },
      L("NCERT Solutions", { badge: "New" }), { label: "CBSE Syllabus", board: "CBSE", note: "CBSE syllabus", badge: "New" }] }
  ] },
  { tab: "Languages", groups: [
    { title: "Foreign Languages", cols: 1, items: [
      { label: "Spoken English", subject: "English" }, L("German Language"), L("French Language"),
      L("Spanish Language"), L("Japanese Language")] },
    { title: "Indian Languages", cols: 1, items: [
      { label: "Hindi Language", subject: "Hindi" }, L("Kannada Language"), { label: "Tamil Language", subject: "Tamil" },
      L("Telugu Language"), L("Marathi Speaking")] },
    { title: "Other Languages", cols: 1, items: [
      L("Chinese Language"), L("Arabic Language"), L("Russian Language"), L("Italian Language"), L("Sanskrit Language")] },
    { title: "More", cols: 1, items: [ L("All Languages") ] }
  ] },
  { tab: "IT Courses", groups: [
    { title: "Programming Languages", cols: 1, items: [
      IT("Python Training"), IT("Java Training"), IT(".Net Training"), IT("C++ Language"), IT("C Language")] },
    { title: "IT Training", cols: 1, items: [
      IT("Microsoft Excel Training"), IT("SAP"), IT("Selenium"), IT("Angular.JS"), IT("Amazon Web Services")] },
    { title: "Other IT Courses", cols: 1, items: [
      IT("PHP"), IT("Java Script Training"), IT("Adobe Photoshop Training"), IT("DevOps Training"), IT("Data Science")] },
    { title: "More", cols: 1, items: [ IT("All IT Courses"), IT("Software Training Institutes") ] }
  ] },
  { tab: "Exam Coaching", groups: [
    { title: "Study Abroad", cols: 1, items: [
      L("IELTS Coaching"), L("PTE Academic Exam Coaching"), L("GRE Coaching"), L("GMAT Coaching"), L("TOEFL Coaching")] },
    { title: "Study in India", cols: 1, items: [
      L("Engineering Entrance Coaching"), L("CA Coaching"), L("MBA Entrance Coaching"), L("Medical Entrance Coaching"), L("CET Coaching")] },
    { title: "Other Exams", cols: 1, items: [
      L("IBPS Exam Coaching"), L("UPSC Exams Coaching"), L("Staff Selection Commission Exam"), L("Bank Clerical Exam Coaching"), L("UGC NET Exam Coaching")] },
    { title: "More", cols: 1, items: [ L("All Exam Coaching Classes") ] }
  ] }
];
