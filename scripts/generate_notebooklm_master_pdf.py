#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
ADVISION AI - BIÊN DỊCH SỔ TAY TRI THỨC MASTER PDF CHO GOOGLE NOTEBOOKLM
=============================================================================
Chức năng:
- Đọc 22 quy chuẩn thẩm định thị giác từ data/design_rules.json
- Tích hợp danh mục 16 tài liệu nghiên cứu chuyên ngành từ trainingdocs/
- Xuất bản tài liệu PDF chuyên nghiệp: docs/SO_TAY_QUY_CHUAN_THIET_KE_MASTER.pdf
  sử dụng ReportLab với font Times New Roman tiếng Việt, bảng biểu và bố cục chuẩn.
- Tối ưu hóa 100% định dạng Text-based để đưa lên Google Drive và nạp vào NotebookLM.
=============================================================================
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Khắc phục lỗi mã hóa tiếng Việt trên Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("NotebookLMPdfCompiler")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = BASE_DIR / "docs"
TRAINING_DIR = BASE_DIR / "trainingdocs"

RULES_JSON_PATH = DATA_DIR / "design_rules.json"
OUTPUT_PDF_PATH = DOCS_DIR / "SO_TAY_QUY_CHUAN_THIET_KE_MASTER.pdf"


def register_fonts():
    """Đăng ký font Times New Roman từ hệ thống Windows."""
    regular_path = "C:/Windows/Fonts/times.ttf"
    bold_path = "C:/Windows/Fonts/timesbd.ttf"
    italic_path = "C:/Windows/Fonts/timesi.ttf"
    bold_italic_path = "C:/Windows/Fonts/timesbi.ttf"

    font_names = {
        "VN-Times": regular_path,
        "VN-Times-Bold": bold_path,
        "VN-Times-Italic": italic_path,
        "VN-Times-BoldItalic": bold_italic_path
    }

    registered_all = True
    for name, path in font_names.items():
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(name, path))
            except Exception as e:
                logger.warning(f"Lỗi đăng ký font {name}: {e}")
                registered_all = False
        else:
            registered_all = False

    return "VN-Times" if registered_all else "Helvetica"


class NumberedCanvas(SimpleDocTemplate):
    """Custom canvas để đánh số trang tự động ở chân trang."""
    pass


def add_footer(canvas, doc):
    """Vẽ chân trang gồm số trang và tiêu đề rút gọn."""
    canvas.saveState()
    canvas.setFont("VN-Times", 9)
    canvas.setFillColor(colors.HexColor("#64748b"))
    
    # Chỉ đánh số từ trang 2 trở đi (bỏ qua trang bìa)
    if doc.page > 1:
        canvas.drawString(2 * cm, 1.2 * cm, "AdVision AI — Sổ Tay Quy Chuẩn Thẩm Định Thị Giác (NotebookLM Grounding)")
        canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Trang {doc.page}")
        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)

    canvas.restoreState()


def compile_pdf():
    """Biên dịch tài liệu Master PDF hoàn chỉnh."""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    font_base = register_fonts()
    font_bold = f"{font_base}-Bold" if f"{font_base}-Bold" in pdfmetrics.getRegisteredFontNames() else font_base
    font_italic = f"{font_base}-Italic" if f"{font_base}-Italic" in pdfmetrics.getRegisteredFontNames() else font_base

    # Đọc dữ liệu quy chuẩn
    if not RULES_JSON_PATH.exists():
        logger.error(f"Không tìm thấy file quy chuẩn: {RULES_JSON_PATH}")
        return

    with open(RULES_JSON_PATH, "r", encoding="utf-8") as f:
        rules_data = json.load(f)

    rules = rules_data.get("rules", [])
    version = rules_data.get("rulebook_version", "1.0")

    # Quét tài liệu nguồn
    source_pdfs = sorted([f.name for f in TRAINING_DIR.glob("*.pdf") if not f.name.startswith("TAI_LIEU_NGHIEN_CUU_HOP_NHAT") and not f.name.startswith("_")])

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF_PATH),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()

    # Định nghĩa các style văn bản chuẩn học thuật
    style_cover_univ = ParagraphStyle('CoverUniv', fontName=font_bold, fontSize=13, alignment=1, leading=16, textColor=colors.HexColor("#0f172a"))
    style_cover_title = ParagraphStyle('CoverTitle', fontName=font_bold, fontSize=20, alignment=1, leading=26, textColor=colors.HexColor("#0f172a"))
    style_cover_sub = ParagraphStyle('CoverSub', fontName=font_base, fontSize=12, alignment=1, leading=16, textColor=colors.HexColor("#334155"))
    style_cover_info = ParagraphStyle('CoverInfo', fontName=font_base, fontSize=11, leading=16, textColor=colors.HexColor("#1e293b"))

    style_h1 = ParagraphStyle('H1', fontName=font_bold, fontSize=15, leading=20, textColor=colors.HexColor("#0f172a"), spaceBefore=12, spaceAfter=8)
    style_h2 = ParagraphStyle('H2', fontName=font_bold, fontSize=12, leading=16, textColor=colors.HexColor("#1e293b"), spaceBefore=10, spaceAfter=6)
    style_body = ParagraphStyle('Body', fontName=font_base, fontSize=10, leading=14, textColor=colors.HexColor("#334155"), spaceAfter=6)
    style_body_bold = ParagraphStyle('BodyBold', fontName=font_bold, fontSize=10, leading=14, textColor=colors.HexColor("#0f172a"))
    style_callout = ParagraphStyle('Callout', fontName=font_italic, fontSize=10, leading=14, textColor=colors.HexColor("#475569"))
    style_table_header = ParagraphStyle('TableHeader', fontName=font_bold, fontSize=9, leading=12, alignment=1, textColor=colors.white)
    style_table_cell = ParagraphStyle('TableCell', fontName=font_base, fontSize=8.5, leading=11, textColor=colors.HexColor("#1e293b"))
    style_table_cell_center = ParagraphStyle('TableCellCenter', fontName=font_base, fontSize=8.5, leading=11, alignment=1, textColor=colors.HexColor("#1e293b"))

    story = []

    # =========================================================================
    # TRANG 1: TRANG BÌA CHÍNH (COVER PAGE)
    # =========================================================================
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("TRƯỜNG ĐẠI HỌC KIẾN TRÚC HÀ NỘI", style_cover_univ))
    story.append(Paragraph("KHOA CÔNG NGHỆ THÔNG TIN", style_cover_univ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="40%", thickness=1, color=colors.HexColor("#475569"), spaceBefore=0, spaceAfter=0))
    story.append(Spacer(1, 3.5 * cm))

    story.append(Paragraph("SỔ TAY QUY CHUẨN THẨM ĐỊNH THỊ GIÁC & THIẾT KẾ QUẢNG CÁO SỐ", style_cover_title))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("CƠ SỞ TRI THỨC ĐỊNH LƯỢNG CHO MÔ HÌNH THỊ GIÁC - NGÔN NGỮ (MULTIMODAL VLM)<br/>VÀ NẠP DỮ LIỆU HUẤN LUYỆN CHO GOOGLE NOTEBOOKLM", style_cover_sub))
    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph(f"Phiên bản: {version} — Ngày phát hành: {datetime.now().strftime('%d/%m/%Y')}", style_callout))

    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("<b>Sinh viên thực hiện:</b> Trần Thái Cương", style_cover_info))
    story.append(Paragraph("<b>Mã số sinh viên:</b> 2255010026 — <b>Lớp:</b> 22CN1", style_cover_info))
    story.append(Paragraph("<b>Giảng viên hướng dẫn:</b> TS. Lương Thị Hồng Lan", style_cover_info))
    story.append(Paragraph("<b>Chuyên ngành:</b> Công nghệ thông tin", style_cover_info))

    story.append(Spacer(1, 2.5 * cm))
    story.append(Paragraph("HÀ NỘI, NĂM 2026", style_cover_sub))
    story.append(PageBreak())

    # =========================================================================
    # TRANG 2: TỔNG QUAN & DANH MỤC 16 TÀI LIỆU NGUỒN
    # =========================================================================
    story.append(Paragraph("1. LỜI MỞ ĐẦU VÀ MỤC ĐÍCH NGHIÊN CỨU", style_h1))
    story.append(Paragraph(
        "Tài liệu này là công trình tổng hợp và chưng cất tri thức khoa học thị giác từ 16 tài liệu chuyên ngành đồ họa quốc tế "
        "và các nghiên cứu thực nghiệm về tâm lý học hành vi người tiêu dùng trong quảng cáo số. "
        "Tài liệu đóng vai trò là <b>Nguồn Tri thức Nền tảng (Grounding Knowledge Base)</b> được chuẩn hóa để đưa lên Google Drive "
        "và liên kết trực tiếp vào <b>Google NotebookLM</b>, giúp tác tử AI Agent có cơ sở đối chiếu khách quan khi đánh giá hình ảnh quảng cáo.",
        style_body
    ))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("2. DANH MỤC 16 TÀI LIỆU PDF NGUỒN ĐƯỢC CHƯNG CẤT", style_h1))
    story.append(Paragraph("Các quy chuẩn và định mức trong sổ tay này được trích dẫn trực tiếp từ 16 tài liệu chuyên sâu:", style_body))

    source_table_data = [
        [Paragraph("STT", style_table_header), Paragraph("Tên tài liệu nghiên cứu (PDF Source)", style_table_header), Paragraph("Lĩnh vực chuyên môn", style_table_header)]
    ]
    domain_map = {
        "Designing for Clarity": "Hệ thống lưới & Bố cục",
        "Understanding Color": "Lý thuyết màu sắc & Tương phản",
        "Typography": "Nghệ thuật chữ & Phân cấp thị giác",
        "Complete-guide-to-banner": "Tiêu chuẩn quảng cáo số",
        "Logo Design": "Nhận diện thương hiệu",
        "Graphic Design": "Nguyên lý thiết kế đồ họa",
        "Tsiotsou": "Tâm lý học hành vi quảng cáo",
        "Illustrator": "Kỹ thuật vector & Đồ họa số"
    }

    for idx, fname in enumerate(source_pdfs, 1):
        domain_tag = "Đồ họa & Truyền thông thị giác"
        for k, v in domain_map.items():
            if k.lower() in fname.lower():
                domain_tag = v
                break
        source_table_data.append([
            Paragraph(f"{idx:02d}", style_table_cell_center),
            Paragraph(fname, style_table_cell),
            Paragraph(domain_tag, style_table_cell)
        ])

    table_sources = Table(source_table_data, colWidths=[1.2 * cm, 10.5 * cm, 5.3 * cm])
    table_sources.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(table_sources)
    story.append(PageBreak())

    # =========================================================================
    # TRANG 3+: BẢNG TỔNG HỢP 22 QUY CHUẨN THẨM ĐỊNH THỊ GIÁC
    # =========================================================================
    story.append(Paragraph("3. BẢNG TỔNG HỢP 22 QUY CHUẨN THẨM ĐỊNH THỊ GIÁC", style_h1))
    story.append(Paragraph("Mỗi quy chuẩn có mã định danh, tiêu đề, ngưỡng định lượng và mức độ ảnh hưởng đến hiệu quả chuyển đổi:", style_body))

    summary_table_data = [
        [
            Paragraph("STT", style_table_header),
            Paragraph("Mã Quy Chuẩn", style_table_header),
            Paragraph("Tiêu Đề Quy Chuẩn", style_table_header),
            Paragraph("Ngưỡng Tiêu Chuẩn (Threshold)", style_table_header),
            Paragraph("Mức Độ", style_table_header)
        ]
    ]

    for idx, r in enumerate(rules, 1):
        sev_color = "#dc2626" if r.get("severity") == "critical" else "#d97706"
        sev_text = f"<font color='{sev_color}'><b>{r.get('severity', 'moderate').upper()}</b></font>"
        summary_table_data.append([
            Paragraph(f"{idx:02d}", style_table_cell_center),
            Paragraph(f"<b>{r['rule_id']}</b>", style_table_cell),
            Paragraph(r['title'], style_table_cell),
            Paragraph(r['threshold'], style_table_cell),
            Paragraph(sev_text, style_table_cell_center)
        ])

    table_summary = Table(summary_table_data, colWidths=[1.0 * cm, 3.2 * cm, 5.8 * cm, 5.0 * cm, 2.0 * cm])
    table_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(table_summary)
    story.append(PageBreak())

    # =========================================================================
    # NỘI DUNG CHI TIẾT TỪNG PHÂN VÙNG QUY CHUẨN (DETAILED SPECIFICATIONS)
    # =========================================================================
    story.append(Paragraph("4. CHI TIẾT TỪNG PHÂN VÙNG QUY CHUẨN THIẾT KẾ", style_h1))

    categories = [
        ("layout_composition", "4.1. Bố Cục & Hệ Thống Lưới Thị Giác (Layout & Grid Systems)"),
        ("color_contrast", "4.2. Khoa Học Màu Sắc & Tương Phản (Color & Contrast)"),
        ("typography", "4.3. Nghệ Thuật Chữ & Phân Cấp Nội Dung (Typography & Hierarchy)"),
        ("cta_optimization", "4.4. Tối Ưu Điểm Chốt Hành Động (CTA Optimization)"),
        ("branding", "4.5. Nhận Diện Thương Hiệu & Khoảng Thở (Branding & Negative Space)")
    ]

    rule_num = 1
    for cat_key, cat_title in categories:
        cat_rules = [r for r in rules if r.get("category") == cat_key]
        if not cat_rules:
            continue

        story.append(Paragraph(cat_title, style_h2))

        for r in cat_rules:
            rule_block = []
            rule_block.append(Paragraph(f"<b>Quy chuẩn #{rule_num:02d}: {r['title']}</b> (Mã: <i>{r['rule_id']}</i>)", style_body_bold))
            rule_block.append(Paragraph(f"• <b>Ngưỡng định lượng bắt buộc:</b> {r['threshold']}", style_body))
            rule_block.append(Paragraph(f"• <b>Nguyên lý khoa học:</b> {r['description']}", style_body))
            rule_block.append(Paragraph(f"• <b>Tác động tới tỷ lệ chuyển đổi:</b> {r.get('impact', 'Tối ưu hóa khả năng truyền đạt thông điệp và dẫn dắt ánh nhìn.')}", style_body))
            rule_block.append(Paragraph(f"• <b>Tài liệu trích dẫn:</b> <i>{r['source_book']}</i> — {r['source_location']}", style_callout))
            rule_block.append(Spacer(1, 0.25 * cm))
            story.append(KeepTogether(rule_block))
            rule_num += 1

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("5. HƯỚNG DẪN KẾT NỐI VỚI GOOGLE NOTEBOOKLM VÀ GENERATIVE AI", style_h1))
    story.append(Paragraph(
        "1. <b>Lưu trữ trên Google Drive:</b> Tải tệp PDF này lên thư mục nghiên cứu Google Drive của bạn.<br/>"
        "2. <b>Nạp vào Google NotebookLM:</b> Truy cập <i>https://notebooklm.google.com</i>, tạo một Notebook mới và thêm tệp này từ Google Drive làm nguồn dữ liệu chính thống (Grounded Source).<br/>"
        "3. <b>Truy vấn và Kiểm thử:</b> Sử dụng NotebookLM để đối chiếu các trường hợp biên, tạo câu hỏi chất vấn hệ thống hoặc tinh chỉnh các prompt chuyên sâu.<br/>"
        "4. <b>Vòng lặp Tái thiết kế (Redesign Loop):</b> Tác tử AdVision Agent trích xuất các lỗi vi phạm dựa trên sổ tay này và tự động sinh câu lệnh Prompt chuẩn studio để người dùng 1-click tạo ảnh mới đạt chuẩn qua Midjourney v6 hoặc ChatGPT DALL-E 3.",
        style_body
    ))

    # Xây dựng file PDF với số trang ở footer
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    file_size_kb = OUTPUT_PDF_PATH.stat().st_size / 1024
    logger.info("=============================================================")
    logger.info("DA BIEN DICH THANH CONG MASTER PDF CHO NOTEBOOKLM:")
    logger.info(f"Tep dich: {OUTPUT_PDF_PATH}")
    logger.info(f"Dung luong: {file_size_kb:.1f} KB (Text-based, Searchable, Toi uu Grounding)")
    logger.info("=============================================================")


if __name__ == "__main__":
    compile_pdf()
