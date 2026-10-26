// Owner-approved permanent Employee ID master (05-Oct-2026).
// Existing staff are re-coded in place (employeeCode + display name only) by
// applyEmployeeIdMaster — never re-created. The four staff without a production
// record get their ID when the Khata import creates them (dataset employeeCode).
// IDs are permanent and never reused; new staff continue from SCS-0022.

export type EmployeeIdEntry = {
  code: string;
  name: string;
  /** Production Staff.id of the existing record; null = created by the Khata import. */
  staffId: string | null;
  khataName: string | null;
};

export const EMPLOYEE_ID_MASTER: EmployeeIdEntry[] = [
  { code: "SCS-0001", name: "Mahesh Banbiru", staffId: "cmtsp4id9000z16pcvpxezx1m", khataName: "Hk Mahesh" },
  { code: "SCS-0002", name: "Sikandar Pathan", staffId: "cmtsp50mi001016pcsup92ljj", khataName: "Sikandar" },
  { code: "SCS-0003", name: "Matin Bhagwan", staffId: "cmtsp6evv001316pc910ycd09", khataName: "Matin Shaikh" },
  { code: "SCS-0004", name: "Kaleem Sheikh", staffId: "cmu42s63z000u15o2s2qz88p2", khataName: "Hk kaleem" },
  { code: "SCS-0005", name: "Tohid Inamdar", staffId: "cmu42tyhc000w15o25x3e60vm", khataName: "Hk Tohid" },
  { code: "SCS-0006", name: "Amir Sheikh", staffId: "cmu42vs5o001115o266ywwax2", khataName: "Amir Shaikh" },
  { code: "SCS-0007", name: "Ibrahim Sheikh", staffId: "cmu42y2i0001315o2nmqtzva5", khataName: "Ibrahim" },
  { code: "SCS-0008", name: "Moses D'Souza", staffId: "cmu430eih001515o2lxnaxq3v", khataName: "Mosek Uncle" },
  { code: "SCS-0009", name: "Amin Patil", staffId: "cmu431qm7001715o2lhp4bike", khataName: "Amin Pathan" },
  { code: "SCS-0010", name: "Bobby Waghmare", staffId: "cmu432hmg001915o2khcalsg6", khataName: "Bobby" },
  { code: "SCS-0011", name: "Aayesha Sheikh", staffId: "cmu435j8a001e15o2lho0druf", khataName: "Aayesha Shaikh" },
  { code: "SCS-0012", name: "Shamma Sheikh", staffId: "cmu436s2k001g15o2t2ts1cr8", khataName: "Shamma Shaikh" },
  { code: "SCS-0013", name: "Rehan Sheikh", staffId: "cmu43b5rv001m15o2hwerxag0", khataName: "Rehan Shaikh" },
  { code: "SCS-0014", name: "Shariful Rehman", staffId: "cmu43cfj0001o15o2yqndqsob", khataName: "HK Rahman" },
  { code: "SCS-0015", name: "Giyasuddin", staffId: "cmu43d885001q15o2uddy0d0r", khataName: "Giyashuddin" },
  { code: "SCS-0016", name: "Nilu Sheikh", staffId: "cmu43gh59001t15o2hn0wl2lz", khataName: "Nilo Shaikh" },
  { code: "SCS-0017", name: "Abhishek", staffId: null, khataName: "Abhishek" },
  { code: "SCS-0018", name: "Arshad Saiyed", staffId: null, khataName: "Arshad Sayyed" },
  { code: "SCS-0019", name: "Fransis Montero", staffId: null, khataName: "Sahara On Duty" },
  { code: "SCS-0020", name: "Shoyab Kazi", staffId: null, khataName: "Shoyab Kazi" },
  // Existing production / attendance staff; NOT in the Khata import until her identity is confirmed.
  { code: "SCS-0021", name: "Parvin Shaikh", staffId: "cmu437vq9001i15o26sszm0ia", khataName: null },
];
