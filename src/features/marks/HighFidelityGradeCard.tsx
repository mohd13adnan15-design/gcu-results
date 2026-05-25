import React, { useEffect, useState } from "react";
import { groupCoursesBySection, type StudentMarksheet } from "@/lib/marksheet";

interface HighFidelityGradeCardProps {
  marksheet: StudentMarksheet;
  photoUrl?: string | null;
}

export const HighFidelityGradeCard: React.FC<HighFidelityGradeCardProps> = ({
  marksheet,
  photoUrl,
}) => {
  const [photoSrc, setPhotoSrc] = useState<string | null>(photoUrl ?? null);

  useEffect(() => {
    setPhotoSrc(photoUrl ?? null);
  }, [photoUrl]);

  return (
    <div className="grade-card-container">
      <div className="grade-card-paper">
        {/* Security Pattern Background */}
        <div className="security-pattern" />

        {/* Outer Borders */}
        <div className="outer-border-main" />
        <div className="outer-border-inner" />

        <div className="grade-card-content">
          {/* Header Section */}
          <div className="header-section">
            <div className="header-left">
              <span className="unique-id">
                {(marksheet.student_id || "").split("-")[0].toUpperCase() || marksheet.grade_card_no}
              </span>
              <div className="qr-code-placeholder">
                <div className="qr-box" />
              </div>
            </div>

            <div className="header-center">
              <div className="university-logo-block">
                <img
                  src="/templates/assets/ChatGPT Image May 11, 2026, 06_01_10 PM.png"
                  alt="Garden City University Logo"
                  className="university-logo-img"
                />
              </div>
              <div className="school-title">{marksheet.school_name}</div>
            </div>

            <div className="header-right">
              <div className="student-photo-container">
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt="Student"
                    className="student-photo"
                    onError={() => setPhotoSrc(null)}
                  />
                ) : (
                  <div className="photo-placeholder">Student Photo</div>
                )}
              </div>
            </div>
          </div>

          {/* Student Info Section */}
          <div className="student-info-grid">
            <div className="info-row">
              <div className="info-col">
                <span className="label">PROGRAMME TITLE</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.programme_title}</span>
              </div>
              <div className="info-col">
                <span className="label">PROGRAMME CODE</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.programme_code}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-col">
                <span className="label">NAME OF THE STUDENT</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.student_name}</span>
              </div>
              <div className="info-col">
                <span className="label">REGISTRATION NO</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.registration_no}</span>
              </div>
            </div>
            <div className="info-row">
              <div className="info-col">
                <span className="label">SEMESTER</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.semester_label}</span>
              </div>
              <div className="info-col">
                <span className="label">MONTH & YEAR OF THE EXAMINATION</span>
                <span className="colon">:</span>
                <span className="value">{marksheet.exam_month_year}</span>
              </div>
            </div>
          </div>

          {/* Grade Card Title */}
          <div className="grade-card-title-box">
            <span>GRADE CARD</span>
          </div>

          {/* Marks Table */}
          <table className="marks-table">
            <thead>
              <tr>
                <th style={{ width: "6%" }}>SL No.</th>
                <th style={{ width: "14%" }}>COURSE CODE</th>
                <th style={{ width: "35%" }}>COURSE TITLE</th>
                <th style={{ width: "10%" }}>COURSE CREDITS</th>
                <th style={{ width: "10%" }}>CREDITS EARNED</th>
                <th style={{ width: "12%" }}>GRADE OBTAINED</th>
                <th style={{ width: "13%" }}>GRADE POINTS</th>
              </tr>
            </thead>
            {(() => {
              let slNoCounter = 1;
              return groupCoursesBySection(marksheet.courses).map((group, groupIdx) => {
                const isPractical = group.section.trim().toLowerCase().includes("practical");
                return (
                  <tbody key={groupIdx}>
                    {/* Section Header Row */}
                    <tr className="section-header-row">
                      <td
                        colSpan={7}
                        style={{
                          textAlign: isPractical ? "left" : "center",
                          color: isPractical ? "#2e2e2e" : "#6b1f1f",
                          paddingLeft: isPractical ? "12px" : "8px",
                          fontWeight: "bold",
                          fontSize: isPractical ? "11px" : "14.5px",
                          backgroundColor: "#fcf8f8",
                          height: "30px",
                          borderBottom: "1px solid #ddd"
                        }}
                      >
                        {isPractical ? "Practical" : group.section}
                      </td>
                    </tr>
                    {group.courses.map((course, idx) => {
                      const currentSl = slNoCounter++;
                      return (
                        <tr key={idx}>
                          <td className="center">{currentSl}</td>
                          <td className="center">{course.course_code}</td>
                          <td className="left">{course.course_title}</td>
                          <td className="center">{course.course_credits?.toFixed(1)}</td>
                          <td className="center">{course.credits_earned?.toFixed(1)}</td>
                          <td className="center">{course.grade_obtained}</td>
                          <td className="center">{course.grade_points?.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              });
            })()}
            <tbody>
              <tr className="total-row">
                <td colSpan={2}></td>
                <td className="right bold maroon">TOTAL</td>
                <td className="center bold">{marksheet.total_credits?.toFixed(1)}</td>
                <td className="center bold">{marksheet.total_credits_earned?.toFixed(1)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>

          <div className="totals-section-new">
            <div className="totals-row border-bottom">
              <div className="totals-label bold maroon">
                TOTAL CREDIT POINTS = <span className="value-black">{marksheet.total_credit_points?.toFixed(1)}</span>
              </div>
            </div>
            <div className="totals-row">
              <div className="sgpa-container">
                <span className="bold maroon">SEMESTER GRADE POINT AVERAGE = </span>
                <span className="value-black bold">{marksheet.total_credit_points?.toFixed(1)} / {marksheet.total_credits?.toFixed(1)} = {marksheet.sgpa?.toFixed(2)}</span>
              </div>
              <div className="grade-container bold maroon">
                GRADE : <span className="value-black">{marksheet.final_grade}</span>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="footer-section">
            <div className="date-line">Date : {new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>

            <div className="footer-bottom">
              <div className="seal-container">
                <img src="/templates/assets/gcu-seal.png" alt="University Seal" className="university-seal" />
              </div>

              <div className="signature-container">
                <div className="signature-block">
                  <img
                    src={(() => {
                      if (!marksheet.exam_month_year) return "/templates/assets/sibimamsign.png";
                      const match = marksheet.exam_month_year.match(/([a-zA-Z]+)\s*(?:-)?\s*(\d{4})/);
                      if (!match) return "/templates/assets/sibimamsign.png";
                      const month = match[1];
                      const year = parseInt(match[2], 10);
                      const d = new Date(`${month} 1, ${year}`);
                      return d > new Date("July 31, 2024")
                        ? "/templates/assets/sibimamsign.png"
                        : "/templates/assets/ChatGPT Image May 10, 2026, 11_22_08 PM.png";
                    })()}
                    alt="Signature"
                    className={`signature-img ${(() => {
                      if (!marksheet.exam_month_year) return "sibi-sig";
                      const match = marksheet.exam_month_year.match(/([a-zA-Z]+)\s*(?:-)?\s*(\d{4})/);
                      if (!match) return "sibi-sig";
                      const month = match[1];
                      const year = parseInt(match[2], 10);
                      const d = new Date(`${month} 1, ${year}`);
                      return d > new Date("July 31, 2024") ? "sibi-sig" : "bheeja-sig";
                    })()
                      }`}
                  />
                  <div className="signature-label">Controller of Examinations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');

        .grade-card-container {
          display: flex;
          justify-content: center;
          padding: 20px;
          background: #e5e7eb;
          font-family: "Times New Roman", Times, serif;
          min-height: 100vh;
        }

        .grade-card-paper {
          position: relative;
          width: 800px;
          min-height: 1131px; /* A4 Ratio Minimum */
          height: auto;
          background: #f7f4ee;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          padding: 50px;
          color: #2b2b2b;
          filter: contrast(0.98) brightness(1.02) sepia(0.04);
          margin: 0 auto;
        }

        .grade-card-paper::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("https://www.transparenttextures.com/patterns/natural-paper.png");
          opacity: 0.2;
          pointer-events: none;
        }

        .security-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url("/templates/assets/gcu-gradecard-bg.png");
          background-size: 100% 100%;
          opacity: 0.1;
          pointer-events: none;
        }

        .outer-border-main {
          position: absolute;
          top: 15px;
          left: 15px;
          right: 15px;
          bottom: 15px;
          border: 1px solid #4b4b4b;
        }

        .outer-border-inner {
          position: absolute;
          top: 18px;
          left: 18px;
          right: 18px;
          bottom: 18px;
          border: 0.5px solid #555555;
        }

        .grade-card-content {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .header-section {
          display: grid;
          grid-template-columns: 100px 1fr 100px;
          align-items: start;
          margin-bottom: 25px;
        }

        .unique-id {
          font-family: "Times New Roman", serif;
          font-size: 15px;
          font-weight: bold;
          color: #2e2e2e;
          display: block;
          margin-bottom: 5px;
          padding-left: 15px;
        }

        .qr-box {
          width: 65px;
          height: 65px;
          background: #ddd;
          border: 1px solid #ccc;
          margin-left: 15px;
          mix-blend-mode: multiply;
        }

        .header-center {
          text-align: center;
        }

        .university-logo-block {
          margin-bottom: 5px;
          display: flex;
          justify-content: center;
        }

        .university-logo-img {
          width: 560px;
          height: auto;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.05));
          margin-top: -35px;
        }

        .school-title {
          font-family: "Times New Roman", serif;
          font-size: 26px;
          font-weight: bold;
          color: #6b1f1f;
          text-transform: uppercase;
          margin-top: 15px;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .student-photo-container {
          width: 100px;
          height: 125px;
          border: 1.5px solid #4b4b4b;
          margin-left: auto;
          margin-top: 10px;
          background: #f7f4ee;
          overflow: hidden;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
          mix-blend-mode: multiply;
        }

        .student-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: contrast(1.15) brightness(1.02);
          mix-blend-mode: multiply;
        }

        .photo-placeholder {
          font-size: 11px;
          color: #999;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 10px;
        }

        .student-info-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 25px 0;
          font-size: 17px;
          color: #333333;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
        }

        .info-col {
          display: flex;
          align-items: flex-start;
          flex: 1;
        }

        .info-col:last-child {
          justify-content: flex-end;
          flex: 0 0 380px;
        }

        .label {
          width: 150px;
          flex-shrink: 0;
          line-height: 1.2;
        }

        .colon {
          margin: 0 10px;
          width: 12px;
          flex-shrink: 0;
        }

        .value {
          font-weight: bold;
          color: #2a2a2a;
          flex: 1;
          word-break: break-word;
          line-height: 1.2;
        }

        .grade-card-title-box {
          border: 0.5px solid #4a4a4a;
          text-align: center;
          padding: 6px;
          margin-bottom: 2px;
          font-weight: bold;
          font-size: 23px;
          color: #6b1f1f;
          text-transform: uppercase;
        }

        .marks-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: #353535;
        }

        .marks-table th, .marks-table td {
          border: 0.5px solid #4b4b4b;
          padding: 6px 8px;
          vertical-align: middle;
        }

        .marks-table th {
          background: transparent;
          font-weight: bold;
          text-align: center;
          color: #303030;
          font-size: 13.5px;
          height: 40px;
          line-height: 1.1;
        }

        .section-header {
          text-align: center;
          font-weight: bold;
          color: #6b1f1f;
          height: 28px;
          font-size: 16px;
        }

        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .maroon { color: #6b1f1f; }
        .charcoal { color: #2e2e2e; }
        .bold { font-weight: bold; }

        .totals-section-new {
          border: 0.5px solid #4b4b4b;
          border-top: none;
          display: flex;
          flex-direction: column;
        }

        .totals-row {
          display: flex;
          min-height: 32px;
          align-items: center;
        }

        .border-bottom {
          border-bottom: 0.5px solid #4b4b4b;
        }

        .totals-label {
          padding: 0 10px;
          font-size: 16px;
        }

        .sgpa-container {
          flex: 1;
          padding: 0 10px;
          font-size: 16px;
        }

        .grade-container {
          width: 180px;
          border-left: 0.5px solid #4b4b4b;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          padding: 6px 0;
        }

        .value-black {
          color: #000000;
          margin-left: 4px;
        }

        .footer-section {
          margin-top: 30px;
          text-align: center;
          color: #3a3a3a;
        }

        .date-line {
          font-size: 16px;
          margin-bottom: 15px;
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 0 40px;
        }

        .university-seal {
          width: 105px;
          opacity: 0.72;
          mix-blend-mode: multiply;
          transform: rotate(-6deg);
          filter: sepia(0.2) hue-rotate(185deg) brightness(0.9);
        }

        .signature-block {
          text-align: center;
        }

        .signature-img {
          mix-blend-mode: multiply;
          filter: brightness(0.85) contrast(1.1) sepia(0.25) hue-rotate(85deg);
        }

        .signature-img.sibi-sig {
          width: 300px;
          margin-bottom: -16px;
        }

        .signature-img.bheeja-sig {
          width: 240px;
          margin-bottom: -12px;
        }

        .signature-label {
          font-size: 19px;
          font-weight: bold;
          color: #2f2f2f;
          margin-top: 5px;
        }
      ` }} />
    </div>
  );
};
