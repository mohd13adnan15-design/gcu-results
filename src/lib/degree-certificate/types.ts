export type DegreeCertificateSemesterRecord = {
  semesterLabel: string;
  sgpa: number;
  examMonthYear: string;
};

export type DegreeCertificateView = {
  studentId: string;
  studentRollNo: string;
  studentName: string;
  registrationNo: string;
  degreeName: string;
  specialization: string;
  schoolName: string;
  university: string;
  examMonthYear: string;
  cgpa: number;
  gradeLabel: string;
  gradeDescriptor: string;
  semesterRecords: DegreeCertificateSemesterRecord[];
  photoUrl: string | null;
  certificateNumber: string | null;
  issueDateIso: string;
  issueDateDisplay: string;
  issueDateWords: string;
};

export type DegreeCertificateSettings = {
  issueDateIso: string | null;
  qrVerificationBaseUrl: string | null;
};

export type DegreeCertificateStudentRow = {
  studentUuid: string;
  rollNo: string;
  fullName: string;
  registrationNo: string;
  department: string;
  programmeTitle: string;
  programmeCode: string;
  semesterCount: number;
  cgpa: number;
  cgpaLabel: string;
  certificateNumber: string | null;
};
