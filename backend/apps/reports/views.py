import datetime
from decimal import Decimal

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Spacer

from apps.books.models import Book, Author, Category
from apps.members.models import Member
from apps.circulation.models import Borrowing, Fine, Reservation
from apps.reviews.models import Review

from .guide_content import GUIDE_SECTIONS
from .pdf_utils import (
    body_paragraph,
    build_report_pdf,
    build_table,
    section_heading,
    server_timestamp,
    summary_line,
)


def _title(elements, styles, text):
    """Add the report title and the exact server-timezone timestamp."""
    title = Paragraph(text, styles["Title"])
    elements.append(title)
    elements.append(Paragraph(
        "Generated: " + server_timestamp(),
        ParagraphStyle(
            "ReportDate",
            parent=styles["Normal"],
            fontSize=9,
            italic=True,
        ),
    ))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_report(request):
    """Generate a PDF inventory report from the current DB state."""
    books = Book.objects.all().order_by("title")

    headers = [
        "Title", "ISBN", "Authors", "Genres",
        "Total Copies", "Available", "Shelf Location", "Active",
    ]
    rows = []

    total_books = 0
    total_copies = 0
    total_available = 0

    for book in books:
        total_books += 1
        total_copies += book.total_copies
        total_available += book.available_copies

        authors = ", ".join([a.name for a in book.authors.all()]) or "-"
        genres = ", ".join([c.name for c in book.categories.all()]) or "-"
        rows.append([
            book.title,
            book.isbn,
            authors,
            genres,
            book.total_copies,
            book.available_copies,
            book.shelf_location or "-",
            "Yes" if book.is_active else "No",
        ])

    styles = getSampleStyleSheet()
    elements = []
    _title(elements, styles, "Library Inventory Report")

    col_widths = [150, 90, 110, 110, 55, 55, 95, 55]
    elements.append(build_table(headers, rows, col_widths))

    elements.append(Paragraph(
        "Summary: <b>%d</b> books | <b>%d</b> total copies | <b>%d</b> available copies"
        % (total_books, total_copies, total_available),
        summary_line("Summary"),
    ))

    return build_report_pdf(
        "library_inventory.pdf",
        "Library Inventory Report",
        elements,
        use_landscape=True,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overdue_report(request):
    """Generate a PDF of currently overdue borrowings (current data)."""
    borrowings = Borrowing.objects.filter(
        status__in=["BORROWED", "OVERDUE"],
        due_date__lt=timezone.now(),
    ).select_related("book", "member").order_by("due_date")

    headers = [
        "Book Title", "Member Name", "Member Code",
        "Borrow Date", "Due Date", "Overdue Days", "Fine Amount", "Fine Status",
    ]
    rows = []

    total_fines = Decimal("0.00")

    for b in borrowings:
        overdue_days = b.overdue_days
        fine_amount = b.calculate_fine_amount(daily_rate=Decimal("1.00"))
        total_fines += fine_amount

        fine_status = "Pending"
        fine_obj = b.fines.first()
        if fine_obj:
            fine_status = fine_obj.status

        rows.append([
            b.book.title,
            b.member.full_name if b.member else "Unknown",
            b.member.member_code if b.member else "-",
            b.borrow_date.strftime("%Y-%m-%d") if b.borrow_date else "-",
            b.due_date.strftime("%Y-%m-%d") if b.due_date else "-",
            overdue_days,
            "%.2f" % fine_amount,
            fine_status,
        ])

    styles = getSampleStyleSheet()
    elements = []
    _title(elements, styles, "Overdue Loans Report")

    col_widths = [150, 110, 80, 90, 90, 70, 65, 65]
    elements.append(build_table(headers, rows, col_widths))

    elements.append(Paragraph(
        "Total overdue fines: <b>%s</b>" % ("%.2f" % total_fines),
        summary_line("Summary"),
    ))

    return build_report_pdf(
        "library_overdue.pdf",
        "Overdue Loans Report",
        elements,
        use_landscape=True,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_report(request, member_id):
    """Generate a PDF member history report."""
    member = get_object_or_404(Member, pk=member_id)

    borrowings = Borrowing.objects.filter(member=member).select_related("book").order_by("-borrow_date")
    unpaid_fines = Fine.objects.filter(member=member, status="PENDING").select_related("borrowing__book")
    reservations = Reservation.objects.filter(member=member).select_related("book").order_by("-reservation_date")
    reviews = Review.objects.filter(member=member, is_approved=True).select_related("book").order_by("-created_at")

    styles = getSampleStyleSheet()
    elements = []

    _title(elements, styles, "Member History Report: %s (%s)" % (member.full_name, member.member_code))
    elements.append(Paragraph(
        "Email: %s | Membership Status: %s" % (member.email, member.membership_status),
        styles["Normal"],
    ))
    elements.append(Paragraph(
        "Join Date: %s" % member.joined_date.strftime("%Y-%m-%d"),
        styles["Normal"],
    ))
    elements.append(Spacer(1, 12))

    # Borrowing history
    if borrowings.exists():
        bh_headers = ["Book Title", "Borrow Date", "Due Date", "Return Date", "Status", "Fine"]
        bh_rows = []
        for b in borrowings:
            fine_str = ""
            fine_obj = b.fines.first()
            if fine_obj and fine_obj.status == "PENDING":
                fine_str = "$%s (pending)" % str(fine_obj.amount)
            bh_rows.append([
                b.book.title,
                b.borrow_date.strftime("%Y-%m-%d") if b.borrow_date else "-",
                b.due_date.strftime("%Y-%m-%d") if b.due_date else "-",
                b.return_date.strftime("%Y-%m-%d") if b.return_date else "-",
                b.status,
                fine_str,
            ])
        elements.append(Paragraph("Borrowing History", styles["Heading2"]))
        elements.append(build_table(
            bh_headers, bh_rows, [130, 70, 70, 70, 65, 90],
        ))
    else:
        elements.append(Paragraph("No borrowing history found.", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # Unpaid fines
    if unpaid_fines.exists():
        elements.append(Paragraph("Unpaid Fines", styles["Heading2"]))
        fines_rows = []
        for f in unpaid_fines:
            fines_rows.append([
                f.id,
                str(f.amount),
                f.reason or "-",
                f.created_at.strftime("%Y-%m-%d") if f.created_at else "-",
            ])
        elements.append(build_table(
            ["Fine ID", "Amount", "Reason", "Created"],
            fines_rows,
            [60, 70, 250, 90],
        ))
    else:
        elements.append(Paragraph("No unpaid fines.", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # Reservations
    if reservations.exists():
        elements.append(Paragraph("Reservations", styles["Heading2"]))
        res_rows = []
        for r in reservations:
            res_rows.append([
                r.book.title,
                r.status,
                r.priority,
                r.reservation_date.strftime("%Y-%m-%d") if r.reservation_date else "-",
            ])
        elements.append(build_table(
            ["Book", "Status", "Priority", "Reservation Date"],
            res_rows,
            [140, 70, 50, 80],
        ))
    else:
        elements.append(Paragraph("No reservations.", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # Reviews
    if reviews.exists():
        elements.append(Paragraph("Reviews", styles["Heading2"]))
        rev_rows = []
        for r in reviews:
            comment = r.comment
            if comment and len(comment) > 50:
                comment = comment[:50] + "..."
            rev_rows.append([
                r.book.title,
                r.rating,
                comment or "-",
                r.created_at.strftime("%Y-%m-%d") if r.created_at else "-",
            ])
        elements.append(build_table(
            ["Book", "Rating", "Comment", "Date"],
            rev_rows,
            [140, 45, 200, 70],
        ))
    else:
        elements.append(Paragraph("No reviews.", styles["Normal"]))

    filename = "member_%s_report.pdf" % member_id
    return build_report_pdf(
        filename,
        "Member History Report",
        elements,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def guide_content(request):
    """Serve the Admin Guide in both languages for the in-page viewer."""
    return Response(GUIDE_SECTIONS)


def _guide_pdf_elements():
    """Build the English Admin Guide flowables for the PDF download."""
    styles = getSampleStyleSheet()
    elements = []
    _title(elements, styles, "Admin Guide")
    elements.append(Spacer(1, 6))

    for section in GUIDE_SECTIONS["en"]:
        elements.append(Paragraph(
            section["title"],
            section_heading(section["title"]),
        ))
        for paragraph in section["paragraphs"]:
            elements.append(Paragraph(paragraph, body_paragraph(paragraph)))

    return elements


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def guide_pdf(request):
    """Generate the English Admin Guide PDF download."""
    elements = _guide_pdf_elements()
    return build_report_pdf(
        "admin_guide_en.pdf",
        "Admin Guide",
        elements,
    )