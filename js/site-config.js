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
  mapUrl: "",                        // Google Maps share link
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

// "Find a tutor for anything" tabbed table (UrbanPro style, without hobbies).
// Each item can pre-fill the booking form: cls (class), subject (one of SUBJECTS), mode, or note.
// TODO (client): confirm the IT courses and exams you actually offer.
export const CATEGORIES = [
  { tab: "Online Classes", mode: "Online tuition", groups: [
    { title: "Tuitions", cols: 2, items: [
      { label: "Class 12 Tuition", cls: "Class 12" }, { label: "Class 7 Tuition", cls: "Class 7" },
      { label: "Class 11 Tuition", cls: "Class 11" }, { label: "Class 6 Tuition", cls: "Class 6" },
      { label: "Class 10 Tuition", cls: "Class 10" }, { label: "Class I-V Tuition", cls: "Class 1" },
      { label: "Class 9 Tuition", cls: "Class 9" }, { label: "BCom Tuition", cls: "College / Other", subject: "Commerce" },
      { label: "Class 8 Tuition", cls: "Class 8" }, { label: "BTech Tuition", cls: "College / Other" }] },
    { title: "Languages", cols: 2, items: [
      { label: "Spoken English", subject: "English" }, { label: "IELTS", note: "IELTS" },
      { label: "French Language", note: "French" }, { label: "PTE", note: "PTE" },
      { label: "Spanish Language", note: "Spanish" }, { label: "TOEFL", note: "TOEFL" },
      { label: "German Language", note: "German" }, { label: "Tamil Language", subject: "Tamil" },
      { label: "Hindi Language", subject: "Hindi" }] },
    { title: "More", cols: 1, items: [
      { label: "Online Tuitions" }, { label: "Online Language Classes", note: "Language classes" },
      { label: "Online IT Coaching", cls: "College / Other", subject: "Computer Science" },
      { label: "Online Exam Entrance Coaching", note: "Entrance exam coaching" }] }
  ] },
  { tab: "Tuition", groups: [
    { title: "School tuition", cols: 2, items: [
      { label: "Nursery – KG Tuition", cls: "LKG" }, { label: "Class 8 Tuition", cls: "Class 8" },
      { label: "Class I-V Tuition", cls: "Class 1" }, { label: "Class 9 Tuition", cls: "Class 9" },
      { label: "Class 6 Tuition", cls: "Class 6" }, { label: "Class 10 Tuition", cls: "Class 10" },
      { label: "Class 7 Tuition", cls: "Class 7" }, { label: "Class 11 Tuition", cls: "Class 11" },
      { label: "Class 12 Tuition", cls: "Class 12" }] },
    { title: "College tuition", cols: 1, items: [
      { label: "BCom Tuition", cls: "College / Other", subject: "Commerce" }, { label: "BSc Tuition", cls: "College / Other" },
      { label: "BTech Tuition", cls: "College / Other" }, { label: "BBA Tuition", cls: "College / Other" }] },
    { title: "By board", cols: 1, items: [
      { label: "CBSE Tuition", board: "CBSE" }, { label: "State Board Tuition", board: "State Board" },
      { label: "ICSE Tuition", board: "ICSE" }, { label: "IGCSE / IB Tuition", board: "IGCSE / IB" }] }
  ] },
  { tab: "Languages", groups: [
    { title: "Spoken languages", cols: 2, items: [
      { label: "Spoken English", subject: "English" }, { label: "Hindi Language", subject: "Hindi" },
      { label: "Tamil Language", subject: "Tamil" }, { label: "French Language", note: "French" },
      { label: "German Language", note: "German" }, { label: "Spanish Language", note: "Spanish" }] },
    { title: "English tests", cols: 1, items: [
      { label: "IELTS", note: "IELTS" }, { label: "PTE", note: "PTE" }, { label: "TOEFL", note: "TOEFL" }] }
  ] },
  { tab: "IT Courses", groups: [
    { title: "Programming", cols: 2, items: [
      { label: "Python", note: "Python" }, { label: "Java", note: "Java" },
      { label: "C / C++", note: "C / C++" }, { label: "Web Development", note: "Web development" },
      { label: "Data Science", note: "Data science" }, { label: "SQL & Databases", note: "SQL" }] },
    { title: "Office & accounts", cols: 1, items: [
      { label: "MS Office & Excel", note: "MS Office / Excel" }, { label: "Tally", note: "Tally" },
      { label: "Basic Computer Course", note: "Basic computer course" }] },
    { title: "For school students", cols: 1, items: [
      { label: "Computer Science (School)", subject: "Computer Science" }, { label: "Coding for Kids", note: "Coding for kids" }] }
  ].map((g) => ({ ...g, items: g.items.map((i) => ({ cls: "College / Other", subject: "Computer Science", ...i })) })) },
  { tab: "Exam Coaching", groups: [
    { title: "Entrance exams", cols: 1, items: [
      { label: "NEET Coaching", note: "NEET coaching" }, { label: "JEE Main & Advanced", note: "JEE coaching" },
      { label: "CUET Coaching", note: "CUET coaching" }] },
    { title: "Government exams", cols: 1, items: [
      { label: "UPSC / IAS Coaching", note: "UPSC coaching" }, { label: "TNPSC Group Exams", note: "TNPSC coaching" },
      { label: "Bank & SSC Exams", note: "Bank / SSC coaching" }] },
    { title: "School level", cols: 1, items: [
      { label: "Olympiad Coaching", note: "Olympiad coaching" }, { label: "NTSE Coaching", note: "NTSE coaching" },
      { label: "Board Exam Revision", note: "Board exam revision" }] }
  ] }
];
