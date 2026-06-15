/** Degree certificate module — isolated from grade/marks card assets. */

export const DEGREE_CERT_A4_WIDTH = 595.28;
export const DEGREE_CERT_A4_HEIGHT = 841.89;

export const DEGREE_CERTIFICATE_ASSETS = {
  border: "/templates/assets/DegreeBG.png",
  seal: "/templates/assets/DegreeSEAL.png",
  viceChancellorSignature: "/templates/assets/DegreeSIGNATURE.png",
  logo: "/templates/assets/Degreelogo.jpg",
  layoutReference: "/templates/assets/BlankDEGREE.png",
} as const;

export const DEGREE_CERTIFICATE_COLORS = {
  maroon: "#7a1111",
  brown: "#6d3f2a",
  orange: "#b45309",
  kannada: "#a8581f",
  dark: "#1a1a1a",
  muted: "#3d3d3d",
  decorativeLine: "#8b5a2b",
} as const;

/** Typography spec for degree certificate (pt). */
export const DEGREE_CERTIFICATE_FONTS = {
  times: '"Times New Roman", Times, serif',
  georgia: 'Georgia, "Times New Roman", serif',
  kannada: '"Noto Serif Kannada", "Tunga", serif',
} as const;

export const DEGREE_CERTIFICATE_DOWNLOAD_PATH = "/degree/download";
export const DEGREE_CERTIFICATE_VERIFY_PATH = "/degree/verify";

/** Layout + font sizes (pt) matched to official certificate spec. */
export const DEGREE_CERTIFICATE_LAYOUT = {
  logo: { top: 72, width: 262, height: 62 },
  legalLine: { top: 136, fontSize: 6, maxWidth: 392, lineHeight: 1.18 },
  decorativeLine: { top: 150, width: 268 },
  kannada: { top: 158, fontSize: 22, lineHeight: 1.08 },
  bengaluru: { top: 186, fontSize: 12, lineHeight: 1.1 },
  certifyIntro: { top: 222, fontSize: 10.5, maxWidth: 382, lineHeight: 1.16 },
  photo: { top: 264, width: 92, height: 112 },
  registration: { top: 384, fontSize: 8, lineHeight: 1.1 },
  studentName: { top: 398, fontSize: 22, lineHeight: 1.05 },
  degreeIntro: { top: 428, fontSize: 11, lineHeight: 1.12 },
  degreeName: { top: 444, fontSize: 18, lineHeight: 1.1 },
  specialization: { top: 466, fontSize: 13, lineHeight: 1.1 },
  conferment: { top: 484, fontSize: 10.5, maxWidth: 430, lineHeight: 1.16 },
  examLine: { top: 526, fontSize: 11, lineHeight: 1.12 },
  gradeLine: { top: 542, fontSize: 11, lineHeight: 1.12 },
  cgpaLine: { top: 556, fontSize: 11, lineHeight: 1.12 },
  witness: { top: 574, fontSize: 10.5, maxWidth: 440, lineHeight: 1.16 },
  issueDateWords: { top: 608, fontSize: 10.5, lineHeight: 1.12 },
  issueDateParen: { top: 624, fontSize: 10, lineHeight: 1.1 },
  signatureBlock: { centerX: 298, bottom: 112, width: 200 },
  signatureImage: { height: 78 },
  seal: { right: 72, bottom: 96, width: 122, height: 122 },
  certNumber: { bottom: 72, fontSize: 6 },
  backQr: { left: 56, bottom: 128, size: 132 },
} as const;
