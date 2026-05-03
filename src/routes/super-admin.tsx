import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin Portal — GCU" }] }),
  component: SuperAdminRoute,
});

function SuperAdminRoute() {
  return <Outlet />;
}
function CredentialList() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("portal_admins").select("*").order("created_at");
    setAdmins((data as Admin[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("portal-admins:refresh", h);
    return () => window.removeEventListener("portal-admins:refresh", h);
  }, []);

  async function deleteAdmin(id: string) {
    if (!confirm("Delete this admin credential?")) return;
    const { error } = await supabase.from("portal_admins").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
      <h2 className="mb-4 text-lg font-bold text-primary">All credentials ({admins.length})</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Portal</th>
                <th className="px-2 py-2 font-medium">Username</th>
                <th className="px-2 py-2 font-medium">Password</th>
                <th className="px-2 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
                      {a.portal}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium text-primary">{a.username}</td>
                  <td className="px-2 py-2 font-mono text-foreground">{a.password}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => deleteAdmin(a.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary hover:bg-secondary"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
const TEMPLATE_HEADERS = [
  "Student ID",
  "Email",
  "Password",
  "Student Name",
  "Department",
  "Semester",
  "Year",
  "Programme Title",
  "Programme Code",
  "Registration No",
  "Exam Month & Year",
  "Issue Date",
  "Semester Label",
  "Course Category",
  "Course Code",
  "Course Title",
  "Course Credits",
  "Credits Earned",
  "Marks Obtained",
  "Max Marks",
  "Grade Obtained",
  "Grade Points",
] as const;

type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

function gradePointsFromGrade(grade: string): number {
  switch (grade.toUpperCase()) {
    case "O":
      return 10;
    case "A+":
      return 9;
    case "A":
      return 8;
    case "B+":
      return 7;
    case "B":
      return 6;
    case "C":
      return 5;
    case "RA":
      return 0;
    default:
      return 0;
  }
}

function autoGrade(obtained: number, max: number): string {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  if (pct >= 90) return "O";
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B+";
  if (pct >= 50) return "B";
  if (pct >= 40) return "C";
  return "RA";
}

function assertStrictHeaders(rows: Record<string, unknown>[]) {
  const actual = Object.keys(rows[0] ?? {}).map((value) => value.trim());
  if (actual.length !== TEMPLATE_HEADERS.length) {
    throw new Error("Invalid template. Please use the downloaded Super Admin grade-card format.");
  }
  for (let i = 0; i < TEMPLATE_HEADERS.length; i += 1) {
    if (actual[i] !== TEMPLATE_HEADERS[i]) {
      throw new Error(`Invalid column at position ${i + 1}. Expected "${TEMPLATE_HEADERS[i]}".`);
    }
  }
}

function getValue(row: Record<string, unknown>, header: TemplateHeader): string {
  const value = row[header];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function MarksUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...TEMPLATE_HEADERS],
      [
        "22BCAR241",
        "22bcar241@gcu.edu.in",
        "student123",
        "Lekkala Prabhakar Reddy",
        "CSE",
        1,
        1,
        "Bachelor of Computer Applications",
        "BCAR",
        "22BCAR241",
        "March - 2023",
        "13 Jun 2023",
        "Semester 1",
        "CORE COURSE",
        "05ABCAR2111",
        "PROBLEM SOLVING TECHNIQUE USING C",
        2,
        0,
        35,
        100,
        "RA",
        0,
      ],
      [
        "22BCAR241",
        "22bcar241@gcu.edu.in",
        "student123",
        "Lekkala Prabhakar Reddy",
        "CSE",
        1,
        1,
        "Bachelor of Computer Applications",
        "BCAR",
        "22BCAR241",
        "March - 2023",
        "13 Jun 2023",
        "Semester 1",
        "ABILITY ENHANCEMENT COMPULSORY COURSE",
        "04AAECC2124",
        "FUNCTIONAL KANNADA",
        3,
        3,
        91,
        100,
        "A+",
        9,
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, "marks_template.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        toast.error("The sheet is empty.");
        return;
      }
      assertStrictHeaders(rows);

      const parsed = rows.map((row) => {
        const student_id = getValue(row, "Student ID");
        const email = getValue(row, "Email").toLowerCase();
        const password = getValue(row, "Password") || "student123";
        const full_name = getValue(row, "Student Name");
        const department = getValue(row, "Department") || "CSE";
        const semester = Number(getValue(row, "Semester")) || 1;
        const year = Number(getValue(row, "Year")) || 1;
        const programme_title = getValue(row, "Programme Title");
        const programme_code = getValue(row, "Programme Code");
        const registration_no = getValue(row, "Registration No");
        const exam_month_year = getValue(row, "Exam Month & Year");
        const issue_date = getValue(row, "Issue Date");
        const semester_label = getValue(row, "Semester Label");
        const course_category = getValue(row, "Course Category") || "CORE COURSE";
        const subject_code = getValue(row, "Course Code");
        const subject = getValue(row, "Course Title");
        const credits = Number(getValue(row, "Course Credits")) || 0;
        const marks_obtained = Number(getValue(row, "Marks Obtained"));
        const max_marks = Number(getValue(row, "Max Marks")) || 100;
        const gradeRaw = getValue(row, "Grade Obtained").toUpperCase();
        const grade = gradeRaw || autoGrade(marks_obtained, max_marks);
        const credits_earned =
          Number(getValue(row, "Credits Earned")) || (grade === "RA" ? 0 : credits);
        const grade_points = Number(getValue(row, "Grade Points")) || gradePointsFromGrade(grade);
        return {
          student_id,
          email,
          password,
          full_name,
          department,
          semester,
          year,
          programme_title,
          programme_code,
          registration_no,
          exam_month_year,
          issue_date,
          semester_label,
          course_category,
          subject_code,
          subject,
          credits,
          credits_earned,
          marks_obtained,
          max_marks,
          grade,
          grade_points,
        };
      });

      const validRows = parsed.filter(
        (row) =>
          row.student_id &&
          row.email &&
          row.full_name &&
          row.subject_code &&
          row.subject &&
          Number.isFinite(row.credits) &&
          Number.isFinite(row.marks_obtained),
      );

      const uniqueEmails = Array.from(new Set(validRows.map((r) => r.email)));
      const uniqueIds = Array.from(new Set(validRows.map((r) => r.student_id)));
      const [existingByEmailRes, existingByStudentRes] = await Promise.all([
        uniqueEmails.length
          ? supabase.from("students").select("id, email, student_id").in("email", uniqueEmails)
          : Promise.resolve({ data: [], error: null }),
        uniqueIds.length
          ? supabase.from("students").select("id, email, student_id").in("student_id", uniqueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (existingByEmailRes.error) throw existingByEmailRes.error;
      if (existingByStudentRes.error) throw existingByStudentRes.error;
      const existingRows = [
        ...((existingByEmailRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
        ...((existingByStudentRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
      ];

      const existingByEmail = new Map(
        ((existingRows ?? []) as Array<{ id: string; email: string; student_id: string }>).map(
          (row) => [row.email.toLowerCase(), row],
        ),
      );
      const existingByStudent = new Map(
        ((existingRows ?? []) as Array<{ id: string; email: string; student_id: string }>).map(
          (row) => [row.student_id.toLowerCase(), row],
        ),
      );

      const toInsertStudents = validRows
        .filter(
          (row) =>
            !existingByEmail.has(row.email) && !existingByStudent.has(row.student_id.toLowerCase()),
        )
        .map((row) => ({
          student_id: row.student_id,
          email: row.email,
          password: row.password,
          full_name: row.full_name,
          department: row.department,
          semester: row.semester,
          year: row.year,
          in_fees: true,
          in_hostel: false,
          in_library: false,
        }));
      if (toInsertStudents.length > 0) {
        const { error: insertStudentsError } = await supabase
          .from("students")
          .insert(toInsertStudents);
        if (insertStudentsError) throw insertStudentsError;
      }

      const [allByEmailRes, allByStudentRes] = await Promise.all([
        uniqueEmails.length
          ? supabase.from("students").select("id, email, student_id").in("email", uniqueEmails)
          : Promise.resolve({ data: [], error: null }),
        uniqueIds.length
          ? supabase.from("students").select("id, email, student_id").in("student_id", uniqueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (allByEmailRes.error) throw allByEmailRes.error;
      if (allByStudentRes.error) throw allByStudentRes.error;
      const allRows = [
        ...((allByEmailRes.data ?? []) as Array<{ id: string; email: string; student_id: string }>),
        ...((allByStudentRes.data ?? []) as Array<{
          id: string;
          email: string;
          student_id: string;
        }>),
      ];
      const idByEmail = new Map(
        ((allRows ?? []) as Array<{ id: string; email: string; student_id: string }>).map((row) => [
          row.email.toLowerCase(),
          row.id,
        ]),
      );
      const idByStudent = new Map(
        ((allRows ?? []) as Array<{ id: string; email: string; student_id: string }>).map((row) => [
          row.student_id.toLowerCase(),
          row.id,
        ]),
      );

      const insertRows = validRows
        .map((row) => ({
          student_id:
            idByEmail.get(row.email) ?? idByStudent.get(row.student_id.toLowerCase()) ?? "",
          course_category: row.course_category,
          subject: row.subject,
          subject_code: row.subject_code,
          credits: row.credits,
          credits_earned: row.credits_earned,
          marks_obtained: row.marks_obtained,
          max_marks: row.max_marks,
          grade: row.grade,
          grade_points: row.grade_points,
        }))
        .filter((row) => row.student_id !== "");

      if (insertRows.length === 0) {
        toast.error("No students matched.");
        return;
      }

      const matchedStudentIds = Array.from(new Set(insertRows.map((row) => row.student_id)));
      if (replace) {
        await supabase.from("student_marks").delete().in("student_id", matchedStudentIds);
      }
      const { error: insertError } = await supabase.from("student_marks").insert(insertRows);
      if (insertError) throw insertError;

      const profileByStudent = new Map<
        string,
        {
          programme_title: string;
          programme_code: string;
          registration_no: string;
          exam_month_year: string;
          issue_date: string;
          semester_label: string;
          total_credits: number;
          total_credits_earned: number;
          total_credit_points: number;
          semester_gpa: number;
          final_grade: string;
        }
      >();
      validRows.forEach((row) => {
        const sid = idByEmail.get(row.email) ?? idByStudent.get(row.student_id.toLowerCase());
        if (!sid) return;
        const current = profileByStudent.get(sid);
        const total_credits = (current?.total_credits ?? 0) + row.credits;
        const total_credits_earned = (current?.total_credits_earned ?? 0) + row.credits_earned;
        const total_credit_points =
          (current?.total_credit_points ?? 0) + row.credits * row.grade_points;
        const semester_gpa =
          total_credits > 0 ? Number((total_credit_points / total_credits).toFixed(2)) : 0;
        profileByStudent.set(sid, {
          programme_title: row.programme_title || "Bachelor of Computer Applications",
          programme_code: row.programme_code || "BCAR",
          registration_no: row.registration_no || row.student_id,
          exam_month_year: row.exam_month_year,
          issue_date: row.issue_date,
          semester_label: row.semester_label,
          total_credits,
          total_credits_earned,
          total_credit_points,
          semester_gpa,
          final_grade: row.grade,
        });
      });

      const profileRows = Array.from(profileByStudent.entries()).map(([student_id, profile]) => ({
        student_id,
        ...profile,
      }));
      if (profileRows.length > 0) {
        const { error: profileError } = await supabase
          .from("student_grade_profiles")
          .upsert(profileRows, { onConflict: "student_id" });
        if (profileError) throw profileError;
      }

      await supabase
        .from("students")
        .update({ faculty_verified: false, admin_verified: false, fully_verified: false })
        .in("id", matchedStudentIds);

      await supabase.from("portal_notifications").insert(
        matchedStudentIds.map((studentId) => ({
          recipient_portal: "faculty" as const,
          sender_portal: "super_admin" as const,
          student_id: studentId,
          title: "New marks uploaded",
          message: "Marks were uploaded/updated by Super Admin. Please review and verify.",
        })),
      );

      toast.success(`Uploaded ${insertRows.length} mark rows.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <FileSpreadsheet className="h-5 w-5" /> Upload student marks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the strict grade-card Excel format only. This upload also inserts missing students
            and profile data in Supabase.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-cream px-3 py-1.5 text-sm text-primary hover:bg-secondary"
        >
          <Download className="h-4 w-4" /> Download template
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload Excel"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Replace existing marks for matched students
        </label>
      </div>
    </div>
  );
}

type MarkWithStudent = {
  id: string;
  student_id: string;
  subject_code: string;
  subject: string;
  course_category: string;
  credits: number;
  credits_earned: number;
  marks_obtained: number;
  max_marks: number;
  grade: string;
  grade_points: number;
  students?: {
    id: string;
    student_id: string;
    full_name: string;
    fees_cleared: boolean;
    hostel_cleared: boolean;
    library_cleared: boolean;
  } | null;
};

function MarksManagementPanel() {
  const navigate = useNavigate();
  const [marks, setMarks] = useState<MarkWithStudent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MarkWithStudent>>({});
  const [manual, setManual] = useState({
    student_id: "",
    course_category: "CORE COURSE",
    subject_code: "",
    subject: "",
    credits: 4,
    credits_earned: 0,
    marks_obtained: 0,
    max_marks: 100,
    grade: "",
    grade_points: 0,
  });

  async function load() {
    const [{ data: markRows }, { data: studentRows }] = await Promise.all([
      supabase
        .from("student_marks")
        .select(
          "id,student_id,subject_code,subject,course_category,credits,credits_earned,marks_obtained,max_marks,grade,grade_points,students(id,student_id,full_name,fees_cleared,hostel_cleared,library_cleared)",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("students").select("*").order("student_id", { ascending: true }),
    ]);
    setMarks((markRows as MarkWithStudent[]) ?? []);
    setStudents((studentRows as Student[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(row: MarkWithStudent) {
    setEditingId(row.id);
    setDraft({ ...row });
  }

  async function saveEdit() {
    if (!editingId) return;
    const marksObtained = Number(draft.marks_obtained ?? 0);
    const maxMarks = Number(draft.max_marks ?? 100);
    const grade = String(draft.grade ?? "").toUpperCase() || autoGrade(marksObtained, maxMarks);
    const gradePoints = Number(draft.grade_points ?? 0) || gradePointsFromGrade(grade);
    const credits = Number(draft.credits ?? 0);
    const creditsEarned = Number(draft.credits_earned ?? 0) || (grade === "RA" ? 0 : credits);

    const { error } = await supabase
      .from("student_marks")
      .update({
        course_category: String(draft.course_category ?? "CORE COURSE"),
        subject_code: String(draft.subject_code ?? ""),
        subject: String(draft.subject ?? ""),
        credits,
        credits_earned: creditsEarned,
        marks_obtained: marksObtained,
        max_marks: maxMarks,
        grade,
        grade_points: gradePoints,
      })
      .eq("id", editingId);
    if (error) {
      toast.error(error.message);
      return;
    }

    const studentId = String(draft.student_id ?? "");
    if (studentId) {
      await supabase
        .from("students")
        .update({ faculty_verified: false, admin_verified: false, fully_verified: false })
        .eq("id", studentId);
      await supabase.from("portal_notifications").insert({
        recipient_portal: "faculty",
        sender_portal: "super_admin",
        student_id: studentId,
        title: "Marks updated manually",
        message: "Super Admin edited marks manually. Please re-verify.",
      });
    }

    toast.success("Mark updated");
    setEditingId(null);
    setDraft({});
    load();
  }

  async function addManualMark() {
    if (!manual.student_id || !manual.subject_code || !manual.subject) {
      toast.error("Select student and enter subject details.");
      return;
    }
    const grade =
      manual.grade.trim().toUpperCase() ||
      autoGrade(Number(manual.marks_obtained), Number(manual.max_marks));
    const gradePoints = manual.grade_points || gradePointsFromGrade(grade);
    const creditsEarned = manual.credits_earned || (grade === "RA" ? 0 : manual.credits);
    const { error } = await supabase.from("student_marks").insert({
      student_id: manual.student_id,
      course_category: manual.course_category,
      subject_code: manual.subject_code,
      subject: manual.subject,
      credits: manual.credits,
      credits_earned: creditsEarned,
      marks_obtained: manual.marks_obtained,
      max_marks: manual.max_marks,
      grade,
      grade_points: gradePoints,
    });
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase
      .from("students")
      .update({ faculty_verified: false, admin_verified: false, fully_verified: false })
      .eq("id", manual.student_id);
    await supabase.from("portal_notifications").insert({
      recipient_portal: "faculty",
      sender_portal: "super_admin",
      student_id: manual.student_id,
      title: "New mark added manually",
      message: "A mark was added manually by Super Admin. Please verify.",
    });

    toast.success("Manual mark added");
    setManual({
      student_id: "",
      course_category: "CORE COURSE",
      subject_code: "",
      subject: "",
      credits: 4,
      credits_earned: 0,
      marks_obtained: 0,
      max_marks: 100,
      grade: "",
      grade_points: 0,
    });
    load();
  }

  async function toggleClearance(
    studentDbId: string | undefined,
    field: "fees_cleared" | "hostel_cleared" | "library_cleared",
    current: boolean | undefined,
  ) {
    if (!studentDbId) return;
    const next = !current;
    const patch =
      field === "fees_cleared"
        ? { fees_cleared: next }
        : field === "hostel_cleared"
          ? { hostel_cleared: next }
          : { library_cleared: next };
    const { error } = await supabase.from("students").update(patch).eq("id", studentDbId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${field.replace("_", " ")} updated`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="card-elevated rounded-2xl p-6">
        <h2 className="text-lg font-bold text-primary">Marks in Supabase (Edit)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit marks from database directly and save changes.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Subject</th>
                <th className="px-2 py-2">Marks</th>
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2">Points</th>
                <th className="px-2 py-2 text-center">Fees</th>
                <th className="px-2 py-2 text-center">Hostel</th>
                <th className="px-2 py-2 text-center">Library</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {marks.map((row) => {
                const isEditing = editingId === row.id;
                const data = isEditing ? ({ ...row, ...draft } as MarkWithStudent) : row;
                return (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      <div className="text-primary">{row.students?.full_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.students?.student_id ?? "-"}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={String(data.subject_code ?? "")}
                          onChange={(e) =>
                            setDraft((v) => ({ ...v, subject_code: e.target.value }))
                          }
                          className="w-28 rounded border border-border bg-cream px-2 py-1"
                        />
                      ) : (
                        row.subject_code
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={String(data.subject ?? "")}
                          onChange={(e) => setDraft((v) => ({ ...v, subject: e.target.value }))}
                          className="w-64 rounded border border-border bg-cream px-2 py-1"
                        />
                      ) : (
                        row.subject
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={Number(data.marks_obtained ?? 0)}
                            onChange={(e) =>
                              setDraft((v) => ({ ...v, marks_obtained: Number(e.target.value) }))
                            }
                            className="w-20 rounded border border-border bg-cream px-2 py-1"
                          />
                          /
                          <input
                            type="number"
                            value={Number(data.max_marks ?? 100)}
                            onChange={(e) =>
                              setDraft((v) => ({ ...v, max_marks: Number(e.target.value) }))
                            }
                            className="w-20 rounded border border-border bg-cream px-2 py-1"
                          />
                        </div>
                      ) : (
                        `${row.marks_obtained}/${row.max_marks}`
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={String(data.grade ?? "")}
                          onChange={(e) =>
                            setDraft((v) => ({ ...v, grade: e.target.value.toUpperCase() }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      ) : (
                        row.grade
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={Number(data.grade_points ?? 0)}
                          onChange={(e) =>
                            setDraft((v) => ({ ...v, grade_points: Number(e.target.value) }))
                          }
                          className="w-16 rounded border border-border bg-cream px-2 py-1"
                        />
                      ) : (
                        row.grade_points
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.students?.fees_cleared)}
                        onChange={() =>
                          toggleClearance(
                            row.students?.id,
                            "fees_cleared",
                            row.students?.fees_cleared,
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.students?.hostel_cleared)}
                        onChange={() =>
                          toggleClearance(
                            row.students?.id,
                            "hostel_cleared",
                            row.students?.hostel_cleared,
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(row.students?.library_cleared)}
                        onChange={() =>
                          toggleClearance(
                            row.students?.id,
                            "library_cleared",
                            row.students?.library_cleared,
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {/* Grade card application is handled by the single form above the list. */}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isEditing ? (
                        <button
                          onClick={saveEdit}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                        >
                          <Save className="h-3.5 w-3.5" /> Save
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-cream px-2 py-1 text-xs text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-elevated rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <PlusCircle className="h-5 w-5" /> Add mark manually
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={manual.student_id}
            onChange={(e) => setManual((v) => ({ ...v, student_id: e.target.value }))}
            className="rounded border border-border bg-cream px-2 py-2"
          >
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_id} - {student.full_name}
              </option>
            ))}
          </select>
          <input
            value={manual.course_category}
            onChange={(e) => setManual((v) => ({ ...v, course_category: e.target.value }))}
            placeholder="Course Category"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            value={manual.subject_code}
            onChange={(e) => setManual((v) => ({ ...v, subject_code: e.target.value }))}
            placeholder="Course Code"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            value={manual.subject}
            onChange={(e) => setManual((v) => ({ ...v, subject: e.target.value }))}
            placeholder="Course Title"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            type="number"
            value={manual.credits}
            onChange={(e) => setManual((v) => ({ ...v, credits: Number(e.target.value) }))}
            placeholder="Credits"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            type="number"
            value={manual.credits_earned}
            onChange={(e) => setManual((v) => ({ ...v, credits_earned: Number(e.target.value) }))}
            placeholder="Credits Earned"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            type="number"
            value={manual.marks_obtained}
            onChange={(e) => setManual((v) => ({ ...v, marks_obtained: Number(e.target.value) }))}
            placeholder="Marks Obtained"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            type="number"
            value={manual.max_marks}
            onChange={(e) => setManual((v) => ({ ...v, max_marks: Number(e.target.value) }))}
            placeholder="Max Marks"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            value={manual.grade}
            onChange={(e) => setManual((v) => ({ ...v, grade: e.target.value.toUpperCase() }))}
            placeholder="Grade (optional)"
            className="rounded border border-border bg-cream px-2 py-2"
          />
          <input
            type="number"
            value={manual.grade_points}
            onChange={(e) => setManual((v) => ({ ...v, grade_points: Number(e.target.value) }))}
            placeholder="Grade Points (optional)"
            className="rounded border border-border bg-cream px-2 py-2"
          />
        </div>
        <button
          onClick={addManualMark}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add Manual Data
        </button>
      </div>
    </div>
  );
}
