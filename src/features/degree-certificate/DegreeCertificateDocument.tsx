import { forwardRef, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import {
  DEGREE_CERTIFICATE_ASSETS,
  DEGREE_CERTIFICATE_COLORS,
  DEGREE_CERTIFICATE_FONTS,
  DEGREE_CERTIFICATE_LAYOUT,
  DEGREE_CERT_A4_HEIGHT,
  DEGREE_CERT_A4_WIDTH,
} from "@/lib/degree-certificate/constants";
import { buildDegreeDownloadUrl } from "@/lib/degree-certificate/data";
import type { DegreeCertificateView } from "@/lib/degree-certificate/types";

type Props = {
  data: DegreeCertificateView;
  className?: string;
  showPageLabels?: boolean;
};

function CenteredBlock({
  top,
  style,
  children,
}: {
  top: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top,
        transform: "translateX(-50%)",
        textAlign: "center",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CertificateBorder() {
  return (
    <img
      src={DEGREE_CERTIFICATE_ASSETS.border}
      alt=""
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "fill",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function KannadaDecorativeLine({ width }: { width: number }) {
  const lineColor = DEGREE_CERTIFICATE_COLORS.decorativeLine;
  const accentColor = DEGREE_CERTIFICATE_COLORS.orange;

  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        margin: "0 auto",
      }}
    >
      <span style={{ flex: 1, height: 1, backgroundColor: lineColor, maxWidth: 96 }} />
      <span
        style={{
          width: 5,
          height: 5,
          margin: "0 5px",
          backgroundColor: accentColor,
          transform: "rotate(45deg)",
          display: "inline-block",
        }}
      />
      <span style={{ width: 34, height: 1, backgroundColor: lineColor }} />
      <span
        style={{
          width: 7,
          height: 7,
          margin: "0 4px",
          borderRadius: "50%",
          backgroundColor: accentColor,
          display: "inline-block",
        }}
      />
      <span style={{ width: 34, height: 1, backgroundColor: lineColor }} />
      <span
        style={{
          width: 5,
          height: 5,
          margin: "0 5px",
          backgroundColor: accentColor,
          transform: "rotate(45deg)",
          display: "inline-block",
        }}
      />
      <span style={{ flex: 1, height: 1, backgroundColor: lineColor, maxWidth: 96 }} />
    </div>
  );
}

function PageLabel({ children }: { children: string }) {
  return (
    <p
      style={{
        margin: "0 0 8px",
        textAlign: "center",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#6b7280",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </p>
  );
}

function DegreeCertificateFrontPage({ data }: { data: DegreeCertificateView }) {
  const layout = DEGREE_CERTIFICATE_LAYOUT;
  const fonts = DEGREE_CERTIFICATE_FONTS;
  const displayCertNumber = data.certificateNumber ?? "";

  return (
    <div
      data-degree-certificate-page="front"
      style={{
        width: DEGREE_CERT_A4_WIDTH,
        height: DEGREE_CERT_A4_HEIGHT,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        fontFamily: fonts.georgia,
        color: DEGREE_CERTIFICATE_COLORS.dark,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <CertificateBorder />

      <CenteredBlock top={layout.logo.top}>
        <img
          src={DEGREE_CERTIFICATE_ASSETS.logo}
          alt="Garden City University"
          style={{
            width: layout.logo.width,
            height: layout.logo.height,
            objectFit: "contain",
            display: "block",
            margin: "0 auto",
          }}
        />
      </CenteredBlock>

      <CenteredBlock top={layout.legalLine.top} style={{ maxWidth: layout.legalLine.maxWidth }}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.times,
            fontSize: layout.legalLine.fontSize,
            fontWeight: 400,
            lineHeight: layout.legalLine.lineHeight,
            color: DEGREE_CERTIFICATE_COLORS.muted,
          }}
        >
          University established through Act no. 47 of 2013 in Karnataka State and approved by UGC,
          Govt. of India
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.decorativeLine.top}>
        <KannadaDecorativeLine width={layout.decorativeLine.width} />
      </CenteredBlock>

      <CenteredBlock top={layout.kannada.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.kannada,
            fontSize: layout.kannada.fontSize,
            fontWeight: 700,
            lineHeight: layout.kannada.lineHeight,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: DEGREE_CERTIFICATE_COLORS.brown }}>ಗಾರ್ಡನ್ ಸಿಟಿ </span>
          <span style={{ color: DEGREE_CERTIFICATE_COLORS.orange }}>ವಿಶ್ವವಿದ್ಯಾಲಯ</span>
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.bengaluru.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.bengaluru.fontSize,
            fontWeight: 400,
            lineHeight: layout.bengaluru.lineHeight,
          }}
        >
          Bengaluru
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.certifyIntro.top} style={{ maxWidth: layout.certifyIntro.maxWidth }}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.certifyIntro.fontSize,
            fontWeight: 400,
            lineHeight: layout.certifyIntro.lineHeight,
          }}
        >
          By virtue of powers granted to it by the Act and the Statutes,
          <br />
          the Chancellor, Vice-Chancellor and the members of the various
          <br />
          authorities of the University hereby certify that
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.photo.top}>
        <div
          style={{
            width: layout.photo.width,
            height: layout.photo.height,
            margin: "0 auto",
            overflow: "hidden",
            border: "1px solid #222",
            backgroundColor: "#f5f5f5",
          }}
        >
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : null}
        </div>
      </CenteredBlock>

      <CenteredBlock top={layout.registration.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.times,
            fontSize: layout.registration.fontSize,
            lineHeight: layout.registration.lineHeight,
            fontWeight: 400,
          }}
        >
          {data.registrationNo}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.studentName.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.studentName.fontSize,
            fontWeight: 700,
            lineHeight: layout.studentName.lineHeight,
          }}
        >
          {data.studentName}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.degreeIntro.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.degreeIntro.fontSize,
            fontWeight: 400,
            lineHeight: layout.degreeIntro.lineHeight,
          }}
        >
          has been duly admitted to the degree of
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.degreeName.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.degreeName.fontSize,
            fontWeight: 700,
            lineHeight: layout.degreeName.lineHeight,
          }}
        >
          {data.degreeName}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.specialization.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.specialization.fontSize,
            fontWeight: 400,
            lineHeight: layout.specialization.lineHeight,
          }}
        >
          {data.specialization}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.conferment.top} style={{ maxWidth: layout.conferment.maxWidth }}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.conferment.fontSize,
            fontWeight: 400,
            lineHeight: layout.conferment.lineHeight,
          }}
        >
          with all rights, honors and privileges thereunto appertaining,
          <br />
          in recognition of the fulfilment of requirements for the said degree.
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.examLine.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.examLine.fontSize,
            fontWeight: 400,
            lineHeight: layout.examLine.lineHeight,
          }}
        >
          Year of Examination : {data.examMonthYear}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.gradeLine.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.gradeLine.fontSize,
            fontWeight: 400,
            lineHeight: layout.gradeLine.lineHeight,
          }}
        >
          Grade : {data.gradeDescriptor}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.cgpaLine.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.cgpaLine.fontSize,
            fontWeight: 400,
            lineHeight: layout.cgpaLine.lineHeight,
          }}
        >
          CGPA : {data.gradeLabel}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.witness.top} style={{ maxWidth: layout.witness.maxWidth }}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.witness.fontSize,
            fontWeight: 400,
            lineHeight: layout.witness.lineHeight,
          }}
        >
          In witness whereof, the seal of the University and the signature as
          <br />
          authorised by the Statutes, is hereunto affixed, on this
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.issueDateWords.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.issueDateWords.fontSize,
            fontWeight: 400,
            lineHeight: layout.issueDateWords.lineHeight,
          }}
        >
          {data.issueDateWords}
        </p>
      </CenteredBlock>

      <CenteredBlock top={layout.issueDateParen.top}>
        <p
          style={{
            margin: 0,
            fontFamily: fonts.georgia,
            fontSize: layout.issueDateParen.fontSize,
            fontWeight: 400,
            lineHeight: layout.issueDateParen.lineHeight,
          }}
        >
          {data.issueDateDisplay}
        </p>
      </CenteredBlock>

      <div
        style={{
          position: "absolute",
          left: layout.signatureBlock.centerX,
          bottom: layout.signatureBlock.bottom,
          width: layout.signatureBlock.width,
          transform: "translateX(-50%)",
          textAlign: "center",
          zIndex: 2,
        }}
      >
        <img
          src={DEGREE_CERTIFICATE_ASSETS.viceChancellorSignature}
          alt=""
          aria-hidden
          style={{
            width: "100%",
            height: layout.signatureImage.height,
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

      <img
        src={DEGREE_CERTIFICATE_ASSETS.seal}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          right: layout.seal.right,
          bottom: layout.seal.bottom,
          width: layout.seal.width,
          height: layout.seal.height,
          objectFit: "contain",
          zIndex: 2,
        }}
      />

      {displayCertNumber ? (
        <div
          style={{
            position: "absolute",
            right: layout.seal.right,
            bottom: layout.certNumber.bottom,
            width: layout.seal.width,
            fontFamily: fonts.times,
            fontSize: layout.certNumber.fontSize,
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: DEGREE_CERTIFICATE_COLORS.muted,
            textAlign: "center",
            zIndex: 3,
          }}
        >
          {displayCertNumber}
        </div>
      ) : null}
    </div>
  );
}

function DegreeCertificateBackPage({ qrDataUrl }: { qrDataUrl: string | null }) {
  const layout = DEGREE_CERTIFICATE_LAYOUT;

  return (
    <div
      data-degree-certificate-page="back"
      style={{
        width: DEGREE_CERT_A4_WIDTH,
        height: DEGREE_CERT_A4_HEIGHT,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <CertificateBorder />

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            left: layout.backQr.left,
            bottom: layout.backQr.bottom,
            width: layout.backQr.size,
            height: layout.backQr.size,
          }}
        />
      ) : null}
    </div>
  );
}

export const DegreeCertificateDocument = forwardRef<HTMLDivElement, Props>(
  function DegreeCertificateDocument({ data, className = "", showPageLabels = false }, ref) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const qrTarget = useMemo(() => {
      if (!data.registrationNo) return null;
      return buildDegreeDownloadUrl(data.registrationNo);
    }, [data.registrationNo]);

    useEffect(() => {
      if (!qrTarget) {
        setQrDataUrl(null);
        return;
      }
      let cancelled = false;
      void QRCode.toDataURL(qrTarget, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 280,
        color: { dark: "#1a1a1a", light: "#ffffff" },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
      return () => {
        cancelled = true;
      };
    }, [qrTarget]);

    return (
      <div
        ref={ref}
        className={`degree-certificate-document ${className}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div>
          {showPageLabels ? <PageLabel>Front</PageLabel> : null}
          <DegreeCertificateFrontPage data={data} />
        </div>
        <div>
          {showPageLabels ? <PageLabel>Back (QR Code)</PageLabel> : null}
          <DegreeCertificateBackPage qrDataUrl={qrDataUrl} />
        </div>
      </div>
    );
  },
);
