const BACK_PAGE_TEMPLATE = "/templates/assets/file_00000000f02871f897434ec5582a144c.png";

/** Matches BACK_PAGE_FOOTER_WIPE + BACK_PAGE_SIGNATURE_SLOTS in marksheet-documents.ts */
const FOOTER_WIPE = { left: "0%", top: "83.4%", width: "100%", height: "16.6%" } as const;

const SLOTS = {
  checkedBy: { left: "12.1%", top: "89.3%", width: "15.5%", height: "6.9%" },
  verifiedBy: { left: "72.6%", top: "89.3%", width: "15.5%", height: "6.9%" },
  labelChecked: { left: "19.8%", top: "97.2%" },
  labelVerified: { left: "80.3%", top: "97.2%" },
} as const;

type Props = {
  checkedByUrl?: string | null;
  verifiedByUrl?: string | null;
  className?: string;
};

export function BackPageSignaturePreview({
  checkedByUrl,
  verifiedByUrl,
  className = "",
}: Props) {
  return (
    <div className={`relative mx-auto w-full max-w-[595px] ${className}`}>
      <img
        src={BACK_PAGE_TEMPLATE}
        alt="Grade card back page"
        className="block w-full h-auto"
      />
      {/* Wipe entire baked-in footer (static signatures + labels) */}
      <div
        className="absolute bg-[#fdfcf7]"
        style={{
          left: FOOTER_WIPE.left,
          top: FOOTER_WIPE.top,
          width: FOOTER_WIPE.width,
          height: FOOTER_WIPE.height,
        }}
      />
      {checkedByUrl && (
        <>
          <img
            src={checkedByUrl}
            alt="Checked by signature"
            className="absolute object-contain object-bottom"
            style={{
              left: SLOTS.checkedBy.left,
              top: SLOTS.checkedBy.top,
              width: SLOTS.checkedBy.width,
              height: SLOTS.checkedBy.height,
            }}
          />
          <span
            className="absolute -translate-x-1/2 font-serif text-[11px] text-[#141414]"
            style={{ left: SLOTS.labelChecked.left, top: SLOTS.labelChecked.top }}
          >
            Checked by
          </span>
        </>
      )}
      {verifiedByUrl && (
        <>
          <img
            src={verifiedByUrl}
            alt="Verified by signature"
            className="absolute object-contain object-bottom"
            style={{
              left: SLOTS.verifiedBy.left,
              top: SLOTS.verifiedBy.top,
              width: SLOTS.verifiedBy.width,
              height: SLOTS.verifiedBy.height,
            }}
          />
          <span
            className="absolute -translate-x-1/2 font-serif text-[11px] text-[#141414]"
            style={{ left: SLOTS.labelVerified.left, top: SLOTS.labelVerified.top }}
          >
            Verified by
          </span>
        </>
      )}
    </div>
  );
}
