import { CircleAlert } from "lucide-react";
import type { MarksheetCourse, StudentMarksheet } from "@/lib/marksheet";

export function computeMarksheetPreviewTotals(marksheet: StudentMarksheet | null) {
  const courses = marksheet?.courses ?? [];
  const totalCredits = courses.reduce((sum, row) => sum + Number(row.course_credits ?? 0), 0);
  const earnedCredits = courses.reduce((sum, row) => sum + Number(row.credits_earned ?? 0), 0);
  return { totalCredits, earnedCredits, courseCount: courses.length };
}

type MarksheetSavedPreviewProps = {
  marksheet: StudentMarksheet | null;
  /** COE / Admin review: show copy that marks cannot be edited on this screen. */
  readOnlyNotice?: boolean;
};

/** COE/Admin marksheet preview (via fetchStudentMarksheet → `student_marksheets`). */
export function MarksheetSavedPreview({ marksheet, readOnlyNotice }: MarksheetSavedPreviewProps) {
  const totals = computeMarksheetPreviewTotals(marksheet);

  if (!marksheet) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <CircleAlert className="h-4 w-4" />
          No grade card data is saved for this student.
        </div>
      </div>
    );
  }

  return (
    <div>
      {readOnlyNotice ? (
        <p className="mb-4 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground">
          <strong>View only.</strong> This table is the saved grade card record in the database. To
          change marks or header lines, Admin must use{" "}
          <strong>Admin → Students → Marks</strong> (edit there).
        </p>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-lg font-bold text-primary">
            {marksheet.programme_title} · {marksheet.programme_code}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-sm">
          <p>
            Courses: <strong>{totals.courseCount}</strong>
          </p>
          <p>
            Credits: <strong>{totals.earnedCredits.toFixed(1)}</strong> /{" "}
            {totals.totalCredits.toFixed(1)}
          </p>
          <p>
            SGPA: <strong>{marksheet.sgpa.toFixed(2)}</strong> · Grade{" "}
            <strong>{marksheet.final_grade}</strong>
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <InfoLine label="Name on card" value={marksheet.student_name} />
        <InfoLine label="Registration" value={marksheet.registration_no} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Sl</th>
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Course</th>
              <th className="px-2 py-2">Section</th>
              <th className="px-2 py-2">Total credits</th>
              <th className="px-2 py-2">Obtained credits</th>
              <th className="px-2 py-2">Grade</th>
              <th className="px-2 py-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {marksheet.courses.map((course) => (
              <CourseRow key={`${course.sl_no}-${course.course_code}`} course={course} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-lg border border-border bg-white/70 px-3 py-2">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="text-primary">{value || "-"}</strong>
    </p>
  );
}

function CourseRow({ course }: { course: MarksheetCourse }) {
  return (
    <tr className="border-b border-border/60">
      <td className="px-2 py-2">{course.sl_no}</td>
      <td className="px-2 py-2">{course.course_code}</td>
      <td className="px-2 py-2">
        {course.course_title}
        {course.total_marks_practical && course.total_marks_practical > 0 ? (
          <div className="text-xs text-muted-foreground mt-0.5">
            (Theory: {course.total_marks_theory || 0}, Practical: {course.total_marks_practical})
          </div>
        ) : null}
      </td>
      <td className="px-2 py-2">{course.section}</td>
      <td className="px-2 py-2">{course.course_credits}</td>
      <td className="px-2 py-2">{course.credits_earned}</td>
      <td className="px-2 py-2">{course.grade_obtained}</td>
      <td className="px-2 py-2">{course.grade_points}</td>
    </tr>
  );
}
