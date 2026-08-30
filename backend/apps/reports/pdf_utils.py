"""Shared ReportLab helpers for generating well-formatted PDFs.

Centralizes the fixes for the common PDF problems: text overlap /
column overwriting (cells are wrapped in Paragraphs with fixed column
widths), missing wrapping (Paragraph handles multi-line text), lost
table headers across pages (repeatRows), plain landscape/portrait setup
and the timezone-aware "generated at" timestamp.
"""

import io
from zoneinfo import ZoneInfo

from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.pagesizes import landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def server_timestamp():
    """Human-readable now in Bangladesh local time (Asia/Dhaka, UTC+6)."""
    return timezone.now().astimezone(ZoneInfo("Asia/Dhaka")).strftime("%Y-%m-%d %H:%M:%S %Z")


def _paragraph_cell(style, text):
    return Paragraph(str(text), style)


def cell_style(font_name="Helvetica", font_size=8, bold=False, color=colors.black):
    return ParagraphStyle(
        "Cell",
        fontName=font_name,
        fontSize=font_size,
        leading=font_size + 2,
        textColor=color,
        spaceBefore=0,
        spaceAfter=0,
        wordWrap="CJK",
    )


def build_table(
    headers,
    rows,
    col_widths,
    font_name="Helvetica",
    font_size=8,
    repeat_rows=1,
):
    """Build a ReportLab Table with wrapped Paragraph cells.

    - Every cell is a Paragraph so long text wraps inside the fixed column
      width (fixes column overwriting / horizontal overflow).
    - ``repeat_rows`` repeats the header row on every page (fixes lost
      headers across page breaks).
    - Zebra striping, header styling and top alignment keep rows readable.
    """
    style = ParagraphStyle(
        "CellStyle",
        fontName=font_name,
        fontSize=font_size,
        leading=font_size + 2,
        wordWrap="CJK",
    )
    head_style = ParagraphStyle(
        "CellHead",
        parent=style,
        fontName=font_name if font_name == "Helvetica" else "Helvetica-Bold",
        fontSize=font_size,
        leading=font_size + 2,
        textColor=colors.whitesmoke,
    )
    if font_name != "Helvetica":
        head_style = cell_style(font_name, font_size, color=colors.whitesmoke)

    table_rows = [
        [Paragraph(h, head_style) for h in headers],
        *[[Paragraph(str(c), style) for c in row] for row in rows],
    ]

    table = Table(table_rows, colWidths=col_widths, repeatRows=repeat_rows)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#374151")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white,
            colors.HexColor("#f3f4f6"),
        ]),
    ]
    table.setStyle(TableStyle(style_cmds))
    return table


def build_report_pdf(filename, title, elements, use_landscape=False):
    """Assemble elements into a PDF HttpResponse.

    - use_landscape=True uses a larger canvas for wide tables.
    - Standard letter size with sane margins.
    """
    buffer = io.BytesIO()
    pagesize = landscape(letter) if use_landscape else letter
    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
        title=title,
        pageCompression=0,
    )
    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()

    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def summary_line(text):
    return ParagraphStyle(
        "Summary",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9,
        alignment=TA_RIGHT,
        spaceBefore=8,
    )


def section_heading(text, font_name="Helvetica-Bold", font_size=11):
    return ParagraphStyle(
        "SectionHeading",
        fontName=font_name,
        fontSize=font_size,
        leading=font_size + 4,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.HexColor("#1f2937"),
    )


def body_paragraph(text, font_name="Helvetica", font_size=9.5):
    return ParagraphStyle(
        "Body",
        fontName=font_name,
        fontSize=font_size,
        leading=font_size + 4,
        spaceAfter=4,
        alignment=0,
    )