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
