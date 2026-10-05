// Staff App language pack — English / हिंदी / मराठी. Simple words only (owner
// rule 2026-10-05): Salary · Paid · Due · Loan · Work · Attendance.
// Selected language is kept in the `sahara_lang` cookie (per phone).

export type Lang = "en" | "hi" | "mr";
export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
];
export const LANG_COOKIE = "sahara_lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "hi" || v === "mr";

const D = {
  // core words
  salary: ["Salary", "वेतन", "पगार"],
  paid: ["Paid", "मिला हुआ", "मिळालेले"],
  due: ["Due", "बाकी", "बाकी"],
  loan: ["Loan", "लोन", "कर्ज"],
  work: ["Work", "काम", "काम"],
  attendance: ["Attendance", "हाज़िरी", "हजेरी"],
  // home
  myName: ["My Name", "मेरा नाम", "माझे नाव"],
  todaysWork: ["Today's Work", "आज का काम", "आजचे काम"],
  mySalary: ["My Salary", "मेरा वेतन", "माझा पगार"],
  thisMonth: ["This month", "इस महीने", "या महिन्यात"],
  salaryDue: ["Salary Due", "बाकी वेतन", "बाकी पगार"],
  advanceTaken: ["Advance taken", "एडवांस लिया", "उचल घेतली"],
  allSettled: ["All settled", "पूरा हिसाब हो गया", "पूर्ण हिशोब झाला"],
  myLoan: ["My Loan", "मेरा लोन", "माझे कर्ज"],
  loanGiven: ["Loan Given", "लोन दिया", "कर्ज दिले"],
  loanPaid: ["Loan Paid", "लोन चुकाया", "कर्ज फेडले"],
  loanRemaining: ["Loan Remaining", "लोन बाकी", "कर्ज बाकी"],
  noLoan: ["No loan", "कोई लोन नहीं", "कर्ज नाही"],
  loanNote: ["Loan is separate from salary.", "लोन वेतन से अलग है।", "कर्ज पगारापेक्षा वेगळे आहे."],
  noWorkToday: ["No work today", "आज कोई काम नहीं", "आज काम नाही"],
  todayAttendance: ["Today", "आज", "आज"],
  workDays: ["Work days", "काम के दिन", "कामाचे दिवस"],
  seeDetails: ["See details", "पूरा देखें", "सविस्तर पहा"],
  directions: ["Directions", "रास्ता", "रस्ता"],
  jobDetails: ["Job details", "काम की जानकारी", "कामाची माहिती"],
  time: ["Time", "समय", "वेळ"],
  team: ["Team", "टीम", "टीम"],
  you: ["You", "आप", "तुम्ही"],
  callOffice: ["Call office", "ऑफिस को कॉल", "ऑफिसला कॉल"],
  language: ["Language", "भाषा", "भाषा"],
  // attendance statuses
  PRESENT: ["Present", "हाज़िर", "हजर"],
  HALF_DAY: ["Half day", "आधा दिन", "अर्धा दिवस"],
  ABSENT: ["Absent", "गैरहाज़िर", "गैरहजर"],
  LEAVE: ["Leave", "छुट्टी", "रजा"],
  WEEKLY_OFF: ["Weekly off", "साप्ताहिक छुट्टी", "साप्ताहिक सुट्टी"],
  notMarked: ["Not marked", "दर्ज नहीं", "नोंद नाही"],
  // job statuses
  PENDING: ["Pending", "बाकी", "बाकी"],
  ASSIGNED: ["Assigned", "दिया गया", "दिले"],
  ON_THE_WAY: ["On the way", "रास्ते में", "रस्त्यात"],
  STARTED: ["Started", "शुरू", "सुरू"],
  COMPLETED: ["Completed", "पूरा", "पूर्ण"],
  POSTPONED: ["Postponed", "आगे बढ़ाया", "पुढे ढकलले"],
  CANCELLED: ["Cancelled", "रद्द", "रद्द"],
  REACTIVATED: ["Reactivated", "फिर से शुरू", "पुन्हा सुरू"],
  // nav
  navHome: ["Home", "होम", "होम"],
  navCalendar: ["Calendar", "कैलेंडर", "कॅलेंडर"],
  navMoney: ["My Money", "मेरा पैसा", "माझे पैसे"],
  navCustomer: ["Customer", "ग्राहक", "ग्राहक"],
  navAlerts: ["Alerts", "सूचना", "सूचना"],
  // money page
  myMoney: ["My Money", "मेरा पैसा", "माझे पैसे"],
  month: ["Month", "महीना", "महिना"],
  year: ["Year", "साल", "वर्ष"],
  workList: ["Work", "काम", "काम"],
  paidList: ["Paid", "मिला हुआ", "मिळालेले"],
  balanceStart: ["Balance at start of year", "साल की शुरुआत में बाकी", "वर्षाच्या सुरुवातीला बाकी"],
  balanceNow: ["Balance now", "अभी बाकी", "आता बाकी"],
  oldBalance: ["Old balance (before)", "पुराना बाकी", "जुनी बाकी"],
  nothingYet: ["Nothing here yet", "अभी कुछ नहीं", "अजून काही नाही"],
  fromKhata: ["From old register", "पुराने रजिस्टर से", "जुन्या नोंदवहीतून"],
  salarySlip: ["Salary slip", "वेतन पर्ची", "पगार स्लिप"],
  // calendar / day
  myCalendar: ["My Calendar", "मेरा कैलेंडर", "माझे कॅलेंडर"],
  jobAssigned: ["Job assigned", "काम दिया", "काम दिले"],
  moneyMark: ["Money entry", "पैसे की एंट्री", "पैशाची नोंद"],
  tapDate: ["Tap a date to see the day.", "दिन देखने के लिए तारीख दबाएं।", "दिवस पाहण्यासाठी तारीख दाबा."],
  jobs: ["Jobs", "काम", "कामे"],
  noJobDay: ["No job on this day.", "इस दिन कोई काम नहीं।", "या दिवशी काम नाही."],
  site: ["Site", "साइट", "साइट"],
  package: ["Package", "पैकेज", "पॅकेज"],
  scope: ["Scope of work", "काम का विवरण", "कामाचे वर्णन"],
  terms: ["Terms", "शर्तें", "अटी"],
  jobAmount: ["Job amount", "काम की रकम", "कामाची रक्कम"],
  balance: ["Balance", "बाकी", "बाकी"],
  openMap: ["Open map", "मैप खोलें", "नकाशा उघडा"],
  officeNotes: ["Office notes", "ऑफिस नोट", "ऑफिस नोंद"],
  servicesIncluded: ["Services included", "शामिल सेवाएं", "समाविष्ट सेवा"],
  dayWage: ["Day wage", "दिन की मजदूरी", "दिवसाची मजुरी"],
  advance: ["Advance", "एडवांस", "उचल"],
  fine: ["Fine", "जुर्माना", "दंड"],
  reward: ["Reward", "इनाम", "बक्षीस"],
  salaryPaidLbl: ["Salary paid", "वेतन मिला", "पगार मिळाला"],
  back: ["Back", "वापस", "मागे"],
  // account
  account: ["My Account", "मेरा खाता", "माझे खाते"],
  staffId: ["Staff ID", "स्टाफ आईडी", "स्टाफ आयडी"],
  designation: ["Work type", "काम का प्रकार", "कामाचा प्रकार"],
  mobile: ["Mobile", "मोबाइल", "मोबाईल"],
  joined: ["Joined", "जुड़े", "रुजू"],
  correctDetails: ["To correct your details, please contact the office.", "जानकारी बदलने के लिए ऑफिस से संपर्क करें।", "माहिती बदलण्यासाठी ऑफिसशी संपर्क करा."],
  changePhoto: ["Change photo", "फोटो बदलें", "फोटो बदला"],
  addPhoto: ["Add photo", "फोटो लगाएं", "फोटो लावा"],
  myPin: ["My PIN", "मेरा पिन", "माझा पिन"],
  logout: ["Log out", "लॉग आउट", "लॉग आउट"],
  notifications: ["Notifications", "सूचनाएं", "सूचना"],
  announcements: ["Announcements", "घोषणाएं", "घोषणा"],
  seeAll: ["See all", "सब देखें", "सर्व पहा"],
  important: ["Important", "ज़रूरी", "महत्त्वाचे"],
  makePinPrivate: ["Make your PIN private — change the PIN the office gave you.", "अपना पिन बदलें — ऑफिस वाला पिन बदल दें।", "तुमचा पिन बदला — ऑफिसने दिलेला पिन बदला."],
  notLinked: ["Your login isn't linked to a staff profile yet. Please ask the office.", "आपका लॉगिन अभी स्टाफ प्रोफ़ाइल से नहीं जुड़ा। ऑफिस से बात करें।", "तुमचे लॉगिन अजून स्टाफ प्रोफाइलशी जोडलेले नाही. ऑफिसशी बोला."],
  ownerPreview: ["Owner preview · read-only", "मालिक प्रीव्यू · केवल देखना", "मालक प्रिव्ह्यू · फक्त पाहणे"],
  exitPreview: ["Exit preview", "प्रीव्यू बंद करें", "प्रिव्ह्यू बंद करा"],
} as const;

export type StaffKey = keyof typeof D;
const IDX: Record<Lang, number> = { en: 0, hi: 1, mr: 2 };

export function st(lang: Lang, key: StaffKey): string {
  return D[key][IDX[lang]];
}
/** Bound translator: const t = staffT(lang); t("salary") */
export const staffT = (lang: Lang) => (key: StaffKey) => st(lang, key);

const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
export const staffLocale = (lang: Lang) => LOCALE[lang];
export const inrFor = (lang: Lang, n: number) => `₹${Math.round(Math.abs(n)).toLocaleString(LOCALE[lang])}`;
