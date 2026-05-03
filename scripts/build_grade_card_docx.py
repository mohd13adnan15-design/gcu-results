from __future__ import annotations

from io import BytesIO
from html import escape
from pathlib import Path
import struct
import zipfile

from docx import Document
from docx.shared import Inches


ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "public" / "templates" / "assets"
DOCX_OUTPUT_PATH = ROOT / "public" / "templates" / "gcu-grade-card-template.docx"
EDITABLE_DOCX_OUTPUT_PATH = ROOT / "public" / "templates" / "gcu-grade-card-template-editable.docx"
ASSET_DOCX_OUTPUT_PATH = ROOT / "public" / "templates" / "gcu-grade-card-template-editable-with-assets.docx"

QR_PATH = ASSET_DIR / "gcu-qr.png"
LOGO_PATH = ASSET_DIR / "gcu-monogram.png"
SEAL_PATH = ASSET_DIR / "gcu-seal.png"
CENTER_SIGNATURE_PATH = ASSET_DIR / "gcu-footer-signature-center.png"
RIGHT_SIGNATURE_PATH = ASSET_DIR / "gcu-footer-signature-right.png"

PAGE_WIDTH = 11906
PAGE_HEIGHT = 16838
PAGE_MARGIN = 240

RED = "7b241c"
BLUE = "22378f"
BLACK = "111111"


def ensure_assets() -> None:
    missing = [
        path.name
        for path in (QR_PATH, LOGO_PATH, SEAL_PATH, CENTER_SIGNATURE_PATH, RIGHT_SIGNATURE_PATH)
        if not path.exists()
    ]
    if missing:
        raise SystemExit(f"Missing marks-card assets: {', '.join(missing)}")


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        if handle.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{path} is not a PNG file")
        length = struct.unpack(">I", handle.read(4))[0]
        chunk = handle.read(4)
        if chunk != b"IHDR":
            raise ValueError(f"{path} does not contain a PNG header")
        width, height = struct.unpack(">II", handle.read(length)[:8])
        return width, height


def emu_from_twips(twips: int) -> int:
    return twips * 635


def image_size_emu(path: Path, width_twips: int) -> tuple[int, int]:
    width_px, height_px = read_png_size(path)
    cx = emu_from_twips(width_twips)
    cy = int(cx * height_px / width_px)
    return cx, cy


def run_props(size: int = 20, *, bold: bool = False, color: str | None = None) -> str:
    parts = [
        '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
        f'<w:sz w:val="{size}"/>',
        f'<w:szCs w:val="{size}"/>',
    ]
    if bold:
        parts.extend(["<w:b/>", "<w:bCs/>"])
    if color:
        parts.append(f'<w:color w:val="{color}"/>')
    return "<w:rPr>" + "".join(parts) + "</w:rPr>"


def text_run(text: str, size: int = 20, *, bold: bool = False, color: str | None = None) -> str:
    return f'<w:r>{run_props(size=size, bold=bold, color=color)}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def break_run() -> str:
    return "<w:r><w:br/></w:r>"


def image_run(path: Path, rel_id: str, doc_pr_id: int, name: str, width_twips: int) -> str:
    cx, cy = image_size_emu(path, width_twips)
    return f"""
<w:r>
  <w:drawing>
    <wp:inline xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
      <wp:extent cx="{cx}" cy="{cy}"/>
      <wp:docPr id="{doc_pr_id}" name="Picture {doc_pr_id}"/>
      <wp:cNvGraphicFramePr>
        <a:graphicFrameLocks noChangeAspect="1"/>
      </wp:cNvGraphicFramePr>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic>
            <pic:nvPicPr>
              <pic:cNvPr id="0" name="{escape(path.name)}"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="{rel_id}"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="{cx}" cy="{cy}"/>
              </a:xfrm>
              <a:prstGeom prst="rect"/>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>
</w:r>
""".strip()


def paragraph(
    runs: str,
    *,
    align: str = "left",
    before: int = 0,
    after: int = 0,
) -> str:
    return (
        "<w:p><w:pPr>"
        f'<w:jc w:val="{align}"/>'
        f'<w:spacing w:before="{before}" w:after="{after}"/>'
        "</w:pPr>"
        + runs
        + "</w:p>"
    )


def border_fragment(edge: str, val: str = "single", size: int = 8, color: str = BLACK) -> str:
    return f'<w:{edge} w:val="{val}" w:sz="{size}" w:space="0" w:color="{color}"/>'


def table_borders(val: str = "single", size: int = 8, color: str = BLACK) -> str:
    return (
        "<w:tblBorders>"
        + border_fragment("top", val, size, color)
        + border_fragment("left", val, size, color)
        + border_fragment("bottom", val, size, color)
        + border_fragment("right", val, size, color)
        + border_fragment("insideH", val, size, color)
        + border_fragment("insideV", val, size, color)
        + "</w:tblBorders>"
    )


def cell_borders(top: str = "none", left: str = "none", bottom: str = "none", right: str = "none") -> str:
    return (
        "<w:tcBorders>"
        + border_fragment("top", top)
        + border_fragment("left", left)
        + border_fragment("bottom", bottom)
        + border_fragment("right", right)
        + "</w:tcBorders>"
    )


def table_cell(
    content: str,
    *,
    width: int,
    colspan: int | None = None,
    margins: tuple[int, int, int, int] = (60, 60, 50, 60),
    borders_xml: str | None = None,
    valign: str = "center",
) -> str:
    top, right, bottom, left = margins
    props = [f'<w:tcW w:w="{width}" w:type="dxa"/>', f'<w:vAlign w:val="{valign}"/>']
    if colspan:
        props.append(f'<w:gridSpan w:val="{colspan}"/>')
    props.append(
        "<w:tcMar>"
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        "</w:tcMar>"
    )
    if borders_xml:
        props.append(borders_xml)
    return "<w:tc><w:tcPr>" + "".join(props) + "</w:tcPr>" + content + "</w:tc>"


def table_row(cells: list[str], *, height: int | None = None) -> str:
    tr_pr = ""
    if height:
        tr_pr = f'<w:trPr><w:trHeight w:val="{height}" w:hRule="atLeast"/></w:trPr>'
    return "<w:tr>" + tr_pr + "".join(cells) + "</w:tr>"


def table(rows: list[str], *, widths: list[int], width: int | None = None, border_val: str = "single") -> str:
    total_width = width if width is not None else sum(widths)
    return (
        "<w:tbl>"
        "<w:tblPr>"
        f'<w:tblW w:w="{total_width}" w:type="dxa"/>'
        '<w:jc w:val="center"/>'
        '<w:tblLayout w:type="fixed"/>'
        + table_borders(val=border_val)
        + "<w:tblCellMar><w:top w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"0\" w:type=\"dxa\"/><w:bottom w:w=\"0\" w:type=\"dxa\"/><w:left w:w=\"0\" w:type=\"dxa\"/></w:tblCellMar>"
        + "</w:tblPr>"
        + "<w:tblGrid>"
        + "".join(f'<w:gridCol w:w="{column}"/>' for column in widths)
        + "</w:tblGrid>"
        + "".join(rows)
        + "</w:tbl>"
    )


def underline_cell(width: int) -> str:
    return table_cell(
        paragraph("", after=0),
        width=width,
        borders_xml=cell_borders(bottom="single"),
        margins=(20, 20, 20, 20),
        valign="bottom",
    )


def placeholder_box(label: str, *, width: int, height: int, size: int = 14) -> str:
    return table(
        [
            table_row(
                [
                    table_cell(
                        paragraph(text_run(label, size, bold=True), align="center", before=height // 3, after=0),
                        width=width,
                        margins=(40, 40, 40, 40),
                    )
                ],
                height=height,
            )
        ],
        widths=[width],
        width=width,
    )


def field_table(label: str, total_width: int) -> str:
    widths = [2200, 180, total_width - 2380]
    return table(
        [
            table_row(
                [
                    table_cell(paragraph(text_run(label, 18, bold=True), after=0), width=widths[0], margins=(0, 10, 0, 0)),
                    table_cell(paragraph(text_run(":", 18, bold=True), align="center", after=0), width=widths[1], margins=(0, 10, 0, 10)),
                    underline_cell(widths[2]),
                ],
                height=360,
            )
        ],
        widths=widths,
        width=total_width,
        border_val="none",
    )


def marks_table() -> str:
    widths = [500, 1750, 3800, 1100, 1100, 1100, 1316]

    def empty_row(serial: int) -> str:
        return table_row(
            [
                table_cell(paragraph(text_run(str(serial), 18), align="center", after=0), width=widths[0]),
                table_cell(paragraph("", after=0), width=widths[1]),
                table_cell(paragraph("", after=0), width=widths[2]),
                table_cell(paragraph("", after=0), width=widths[3]),
                table_cell(paragraph("", after=0), width=widths[4]),
                table_cell(paragraph("", after=0), width=widths[5]),
                table_cell(paragraph("", after=0), width=widths[6]),
            ],
            height=250,
        )

    def section(title: str) -> str:
        return table_row(
            [
                table_cell(
                    paragraph(text_run(title, 20, bold=True, color=RED), align="center", after=0),
                    width=sum(widths),
                    colspan=7,
                )
            ],
            height=290,
        )

    rows = [
        table_row(
            [
                table_cell(
                    paragraph(text_run("GRADE CARD", 20, bold=True, color=RED), align="center", after=0),
                    width=sum(widths),
                    colspan=7,
                )
            ],
            height=260,
        ),
        table_row(
            [
                table_cell(
                    paragraph(text_run("SL", 18, bold=True) + break_run() + text_run("No.", 18, bold=True), align="center", after=0),
                    width=widths[0],
                ),
                table_cell(paragraph(text_run("COURSE CODE", 18, bold=True), align="center", after=0), width=widths[1]),
                table_cell(paragraph(text_run("COURSE TITLE", 18, bold=True), align="center", after=0), width=widths[2]),
                table_cell(
                    paragraph(text_run("COURSE", 18, bold=True) + break_run() + text_run("CREDITS", 18, bold=True), align="center", after=0),
                    width=widths[3],
                ),
                table_cell(
                    paragraph(text_run("CREDITS", 18, bold=True) + break_run() + text_run("EARNED", 18, bold=True), align="center", after=0),
                    width=widths[4],
                ),
                table_cell(
                    paragraph(text_run("GRADE", 18, bold=True) + break_run() + text_run("OBTAINED", 18, bold=True), align="center", after=0),
                    width=widths[5],
                ),
                table_cell(
                    paragraph(text_run("GRADE", 18, bold=True) + break_run() + text_run("POINTS", 18, bold=True), align="center", after=0),
                    width=widths[6],
                ),
            ],
            height=500,
        ),
        section("CORE COURSE"),
        empty_row(1),
        empty_row(2),
        empty_row(3),
        section("PRACTICAL"),
        empty_row(4),
        empty_row(5),
        section("ABILITY ENHANCEMENT COMPULSORY COURSE"),
        empty_row(6),
        empty_row(7),
        section("SKILL ENHANCEMENT COURSE"),
        empty_row(8),
        section("PRACTICAL"),
        empty_row(9),
        empty_row(10),
        section("OPEN ELECTIVE COURSE"),
        empty_row(11),
        table_row(
            [
                table_cell(
                    paragraph(text_run("TOTAL", 20, bold=True, color=RED), align="center", after=0),
                    width=sum(widths[:3]),
                    colspan=3,
                ),
                table_cell(paragraph("", after=0), width=widths[3]),
                table_cell(paragraph("", after=0), width=widths[4]),
                table_cell(paragraph("", after=0), width=widths[5]),
                table_cell(paragraph("", after=0), width=widths[6]),
            ],
            height=280,
        ),
    ]

    return table(rows, widths=widths, width=sum(widths))


def totals_table() -> str:
    widths = [8200, 2700]
    left_cell = table_cell(
        paragraph(text_run("TOTAL CREDIT POINTS = ", 20, bold=True, color=RED) + text_run("__________", 20), after=60)
        + paragraph(
            text_run("SEMESTER GRADE POINT AVERAGE = ", 20, bold=True, color=RED)
            + text_run("__________", 20)
            + text_run(" / ", 20)
            + text_run("__________", 20)
            + text_run(" = ", 20)
            + text_run("__________", 20),
            after=0,
        ),
        width=widths[0],
        margins=(90, 90, 90, 90),
    )
    right_cell = table_cell(
        paragraph(text_run("GRADE : ", 24, bold=True, color=RED) + text_run("__________", 24), align="center", after=0),
        width=widths[1],
        margins=(90, 90, 90, 90),
    )
    return table([table_row([left_cell, right_cell], height=720)], widths=widths, width=sum(widths))


def footer_table() -> str:
    widths = [3200, 4266, 3600]
    left_cell = table_cell(
        paragraph(image_run(SEAL_PATH, "rId11", 3, "GCU Seal", 860), align="center", before=0, after=0),
        width=widths[0],
        margins=(40, 40, 40, 40),
        valign="bottom",
    )
    center_cell = table_cell(
        paragraph(text_run("Date : ", 18, bold=True, color=BLUE) + text_run("________________", 18), align="center", after=60)
        + paragraph(image_run(CENTER_SIGNATURE_PATH, "rId12", 4, "Controller Signature Center", 1600), align="center", after=0),
        width=widths[1],
        margins=(40, 40, 40, 40),
        valign="bottom",
    )
    right_cell = table_cell(
        paragraph(image_run(RIGHT_SIGNATURE_PATH, "rId13", 5, "Controller Signature Right", 1600), align="center", before=70, after=0),
        width=widths[2],
        margins=(40, 40, 40, 40),
        valign="bottom",
    )
    return table([table_row([left_cell, center_cell, right_cell], height=850)], widths=widths, width=sum(widths), border_val="none")


def header_table() -> str:
    widths = [2300, 6400, 2300]
    left_cell = table_cell(
        paragraph(text_run("GCUBCA________", 13, bold=True), align="center", after=60)
        + paragraph(image_run(QR_PATH, "rId9", 1, "GCU QR Code", 850), align="center", after=0),
        width=widths[0],
        margins=(40, 40, 40, 40),
    )
    center_cell = table_cell(
        paragraph(image_run(LOGO_PATH, "rId10", 2, "GCU Logo", 500), align="center", after=0)
        + paragraph(text_run("GARDEN CITY", 24, bold=True, color=RED), align="center", after=0)
        + paragraph(text_run("UNIVERSITY", 26, bold=True, color=RED), align="center", after=0)
        + paragraph(text_run("EMPHASIS ON LIFE", 11, bold=True), align="center", after=0),
        width=widths[1],
        margins=(40, 40, 40, 40),
    )
    right_cell = table_cell(
        placeholder_box("", width=1200, height=1200) + paragraph("", after=0),
        width=widths[2],
        margins=(40, 40, 40, 40),
    )
    return (
        table([table_row([left_cell, center_cell, right_cell], height=1500)], widths=widths, width=sum(widths), border_val="none")
        + paragraph(
            text_run("SCHOOL OF COMPUTATIONAL SCIENCES AND", 20, bold=True, color=RED)
            + break_run()
            + text_run("INFORMATION TECHNOLOGY", 20, bold=True, color=RED),
            align="center",
            before=60,
            after=120,
        )
    )


def details_table() -> str:
    widths = [1880, 160, 3300, 1880, 160, 3300]

    def row(left_label: str, right_label: str) -> str:
        return table_row(
            [
                table_cell(paragraph(text_run(left_label, 18, bold=True), after=0), width=widths[0], margins=(0, 10, 0, 0)),
                table_cell(paragraph(text_run(":", 18, bold=True), align="center", after=0), width=widths[1], margins=(0, 10, 0, 10)),
                underline_cell(widths[2]),
                table_cell(paragraph(text_run(right_label, 18, bold=True), after=0), width=widths[3], margins=(0, 10, 0, 120)),
                table_cell(paragraph(text_run(":", 18, bold=True), align="center", after=0), width=widths[4], margins=(0, 10, 0, 10)),
                underline_cell(widths[5]),
            ],
            height=300,
        )

    return table(
        [
            row("PROGRAMME TITLE", "PROGRAMME CODE"),
            row("NAME OF THE STUDENT", "REGISTRATION NO"),
            row("SEMESTER", "MONTH & YEAR OF THE EXAMINATION"),
        ],
        widths=widths,
        width=sum(widths),
        border_val="none",
    )


def build_document_xml() -> str:
    body = (
        header_table()
        + details_table()
        + paragraph("", after=40)
        + marks_table()
        + paragraph("", after=50)
        + totals_table()
        + paragraph(
            text_run("Note: This grade card is valid only with the seal and authorized signatures of the University.", 16),
            align="center",
            before=30,
            after=0,
        )
        + footer_table()
    )

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="{PAGE_WIDTH}" w:h="{PAGE_HEIGHT}"/>
      <w:pgMar w:top="{PAGE_MARGIN}" w:right="{PAGE_MARGIN}" w:bottom="{PAGE_MARGIN}" w:left="{PAGE_MARGIN}" w:header="0" w:footer="0" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"""


def seed_docx_bytes() -> bytes:
    document = Document()
    for path in (QR_PATH, LOGO_PATH, SEAL_PATH, CENTER_SIGNATURE_PATH, RIGHT_SIGNATURE_PATH):
        document.add_picture(str(path), width=Inches(0.5))
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def write_docx(output_path: Path = DOCX_OUTPUT_PATH) -> None:
    ensure_assets()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(BytesIO(seed_docx_bytes()), "r") as seed_archive:
        with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as output_archive:
            for item in seed_archive.infolist():
                if item.filename == "word/document.xml":
                    output_archive.writestr(item, build_document_xml())
                else:
                    output_archive.writestr(item, seed_archive.read(item.filename))


def main() -> None:
    write_docx()
    try:
        write_docx(EDITABLE_DOCX_OUTPUT_PATH)
    except PermissionError:
        print(f"Skipped locked file {EDITABLE_DOCX_OUTPUT_PATH}")
    write_docx(ASSET_DOCX_OUTPUT_PATH)
    print(f"Wrote {DOCX_OUTPUT_PATH}")
    print(f"Wrote {ASSET_DOCX_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
