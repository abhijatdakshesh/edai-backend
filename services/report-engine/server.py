"""
FastAPI wrapper around the Report-Generator PDF logic.
Accepts an xlsx upload + report parameters, returns a ZIP of per-student PDFs.

Endpoints:
  GET  /health                  — liveness probe
  POST /generate-from-excel     — multipart/form-data (xlsx + params) → ZIP of PDFs
"""

import io
import textwrap
import zipfile
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Table, TableStyle

app = FastAPI(title="EdAI Report Engine", version="1.0.0")

IMAGES_DIR = Path(__file__).parent / "Images"

BRANCH_SIGNATURE: dict[str, str] = {
    "COMPUTER SCIENCE & ENGINEERING": "CSE_Signature.png",
    "INFORMATION SCIENCE & ENGINEERING": "ISE_sign.png",
    "ELECTRONICS & COMMUNICATION ENGINEERING": "ECE_Signature.png",
    "MECHANICAL ENGINEERING": "ME_Signature.png",
    "MASTER OF COMPUTER APPLICATIONS": "MCA_Signature.png",
}
FALLBACK_SIG = "CSE_Signature.png"


def _sig_path(branch: str) -> str:
    filename = BRANCH_SIGNATURE.get(branch, FALLBACK_SIG)
    path = IMAGES_DIR / filename
    return str(path) if path.exists() else str(IMAGES_DIR / FALLBACK_SIG)


def _date_suffix(day: int) -> str:
    if 11 <= day <= 13:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")


def generate_pdf(
    df: "pd.DataFrame",
    row: int,
    branch_choice: str,
    test_choice: str,
    submission_d: str,
    semester: str,
    no_of_subjects: int,
    note: str,
) -> io.BytesIO:
    today = datetime.today()
    date_of_generation = today.strftime(f"%d{_date_suffix(today.day)} %b, %Y")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0, leftMargin=50, rightMargin=50, bottomMargin=0)
    styles = getSampleStyleSheet()

    bold_times = styles["Heading1"]
    bold_times.fontName = "Times-Bold"
    bold_times.fontSize = 12
    bold_times.alignment = 1
    bold_times.spaceAfter = 1
    bold_times.spaceBefore = 1

    bold = styles["Heading2"]
    bold.fontName = "Times-Bold"
    bold.fontSize = 10
    bold.spaceAfter = 1
    bold.spaceBefore = 1

    normal = styles["Normal"]
    elements = []

    header_img = IMAGES_DIR / "Header_RV.png"
    if header_img.exists():
        elements.append(Image(str(header_img), width=8 * inch, height=1.6445 * inch))

    elements.append(Paragraph(f"<u>{branch_choice}</u>", bold_times))
    elements.append(Paragraph(f"<u>{test_choice}</u>", bold_times))
    elements.append(Paragraph(date_of_generation, normal))
    elements.append(Paragraph(" ", normal))
    elements.append(Paragraph("To, ", normal))

    father = str(df.iloc[row, 2])
    elements.append(Paragraph(f"     Mr/Mrs  {father},", bold))

    student_name = df.iloc[row, 0]
    usn = df.iloc[row, 1]
    elements.append(Paragraph(
        f"           The Attendance report of your ward "
        f"<b>{student_name}, {usn}</b> studying in <b>{semester}</b> is given below : ",
        normal,
    ))

    test_hdr_raw = df.iloc[0, 7] if 7 < df.shape[1] and not pd.isna(df.iloc[0, 7]) else "Test Marks"
    assign_hdr_raw = df.iloc[0, 8] if 8 < df.shape[1] and not pd.isna(df.iloc[0, 8]) else "Assignment"
    if isinstance(test_hdr_raw, str) and "(" in test_hdr_raw:
        test_hdr_raw = test_hdr_raw.split("(")[0].strip()
    if isinstance(assign_hdr_raw, str) and "(" in assign_hdr_raw:
        assign_hdr_raw = assign_hdr_raw.split("(")[0].strip()

    table_data = [[
        textwrap.fill("Sl. No", width=3),
        "Subject Name",
        textwrap.fill("Classes Held", width=7),
        textwrap.fill("Classes Attended", width=9),
        textwrap.fill("Attendance Percentage", width=10),
        textwrap.fill(str(test_hdr_raw), width=10),
        textwrap.fill(str(assign_hdr_raw), width=10),
    ]]

    cat_kw = ["professional elective", "open elective", "elective", "core", "lab"]

    for i in range(no_of_subjects):
        sc = 6 + i * 5
        tc = 7 + i * 5
        ac = 8 + i * 5
        hc = 9 + i * 5
        atc = 10 + i * 5

        if sc >= df.shape[1]:
            break

        subject: str | None = None
        r0 = None if pd.isna(df.iloc[0, sc]) else str(df.iloc[0, sc]).strip()
        is_cat = r0 is not None and any(k in r0.lower() for k in cat_kw) and len(r0.split()) <= 4
        if is_cat and df.shape[0] > 1 and sc < df.shape[1] and not pd.isna(df.iloc[1, sc]):
            r1 = str(df.iloc[1, sc]).strip()
            if r1 and not any(k in r1.lower() for k in cat_kw):
                subject = r1
        if subject is None:
            subject = r0 if (r0 and not is_cat) else f"Subject {i + 1}"

        def _int(col: int) -> int:
            if col >= df.shape[1]:
                return 0
            v = df.iloc[row, col]
            if pd.isna(v) or str(v).strip() == "-":
                return 0
            try:
                return int(v)
            except Exception:
                return 0

        def _mark(col: int) -> str:
            if col >= df.shape[1]:
                return "-"
            v = df.iloc[row, col]
            if pd.isna(v) or str(v).strip() == "-":
                return "-"
            try:
                return str(int(float(v)))
            except Exception:
                return "-"

        held = _int(hc)
        attended = _int(atc)

        if held == 0 and attended == 0:
            held_s, attended_s, att_pct = "-", "-", "-"
        else:
            try:
                pct = min(100, int(attended / held * 100))
                att_pct = f"{pct}%"
            except ZeroDivisionError:
                att_pct = "0%"
            held_s, attended_s = str(held), str(attended)

        table_data.append([
            str(i + 1),
            textwrap.fill(str(subject), width=30),
            held_s,
            attended_s,
            att_pct,
            _mark(tc),
            _mark(ac),
        ])

    table = Table(table_data, splitByRow=1, spaceBefore=10, spaceAfter=10)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), "#FFFFFF"),
        ("TEXTCOLOR", (0, 0), (-1, 0), "#000000"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGNMENT", (1, 1), (1, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 1), (-1, -1), "#FFFFFF"),
        ("GRID", (0, 0), (-1, -1), 1, "black"),
    ]))
    elements.append(table)

    remarks_val = df.iloc[row, 5]
    remarks = "" if (pd.isna(remarks_val) or str(remarks_val).lower() in {"", "nan"}) else str(remarks_val)
    elements.append(Paragraph(f"<b>Remarks:</b> {remarks}", normal))
    elements.append(Paragraph("  ", normal))
    elements.append(Paragraph(f"<b>Note:</b> {note}", normal))
    elements.append(Paragraph("  ", normal))

    counsellor = str(df.iloc[row, 4])
    elements.append(Paragraph(
        f'Please sign and send the report to "{counsellor}" on or before {submission_d}.',
        normal,
    ))

    sig = _sig_path(branch_choice)
    try:
        elements.append(Image(sig, width=7 * inch, height=1.4155 * inch))
    except Exception:
        pass

    elements.append(Paragraph(" ", normal))
    elements.append(Paragraph("This report was auto-generated through EdAI", normal))

    doc.build(elements)
    buffer.seek(0)
    return buffer


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/generate-from-excel")
async def generate_from_excel(
    file: UploadFile = File(...),
    branch_choice: str = Form("COMPUTER SCIENCE & ENGINEERING"),
    test_choice: str = Form("CIE-1"),
    submission_date: str = Form(""),
    semester: str = Form("V Semester BE"),
    no_of_subjects: int = Form(0),
    note: str = Form(""),
) -> StreamingResponse:
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as exc:
        return JSONResponse(status_code=422, content={"error": f"Invalid Excel file: {exc}"})

    if df.shape[0] < 3:
        return JSONResponse(status_code=422, content={"error": "Excel must have at least 3 rows (2 header rows + 1 student row)"})

    if no_of_subjects <= 0:
        no_of_subjects = min(11, max(1, (df.shape[1] - 6) // 5))

    if not submission_date:
        today = datetime.today()
        submission_date = today.strftime(f"%d{_date_suffix(today.day)} %b, %Y")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(2, df.shape[0]):
            try:
                pdf_buf = generate_pdf(df, i, branch_choice, test_choice, submission_date, semester, no_of_subjects, note)
                usn = str(df.iloc[i, 1]).strip() or f"student_{i}"
                zf.writestr(f"{usn}.pdf", pdf_buf.getvalue())
            except Exception:
                continue

    zip_buffer.seek(0)
    filename = f"{test_choice}-{semester}.zip".replace(" ", "_")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
