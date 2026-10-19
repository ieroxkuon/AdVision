#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
ADVISION AI - BỘ GỘP & CHUẨN HÓA CÁC FILE PDF NGUỒN (SOURCE PDFS MERGER)
=============================================================================
Chức năng:
- Quét toàn bộ 16 tài liệu nghiên cứu chuyên ngành PDF trong thư mục trainingdocs/
- Chuẩn hóa và gộp thành 1 tệp PDF tổng hợp duy nhất: TAI_LIEU_NGHIEN_CUU_HOP_NHAT_16_PDF.pdf
- Tạo trang bìa mục lục và đánh dấu phân vùng tài liệu rõ ràng để tra cứu.
=============================================================================
"""

import sys
import logging
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("SourcePdfMerger")

BASE_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = BASE_DIR / "trainingdocs"
OUTPUT_MERGED_PDF = TRAINING_DIR / "TAI_LIEU_NGHIEN_CUU_HOP_NHAT_16_PDF.pdf"
COVER_TEMP_PDF = TRAINING_DIR / "_cover_temp.pdf"


def register_vietnamese_font():
    """Đăng ký font tiếng Việt có sẵn trên hệ điều hành Windows."""
    font_paths = [
        ("TimesNewRoman", "C:/Windows/Fonts/times.ttf"),
        ("TimesNewRoman-Bold", "C:/Windows/Fonts/timesbd.ttf"),
        ("Arial", "C:/Windows/Fonts/arial.ttf"),
        ("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf")
    ]
    registered = []
    for name, path in font_paths:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                registered.append(name)
            except Exception as e:
                logger.warning(f"Không thể nạp font {name}: {e}")
    return "TimesNewRoman" if "TimesNewRoman" in registered else "Helvetica"


def create_cover_and_index(pdf_files, output_cover_path, font_name="TimesNewRoman"):
    """Tạo trang bìa và danh mục các tài liệu được hợp nhất."""
    c = canvas.Canvas(str(output_cover_path), pagesize=A4)
    width, height = A4

    # Vẽ trang bìa chính
    bold_font = f"{font_name}-Bold" if f"{font_name}-Bold" in pdfmetrics.getRegisteredFontNames() else font_name
    c.setFont(bold_font, 14)
    c.drawCentredString(width / 2, height - 70, "TRƯỜNG ĐẠI HỌC KIẾN TRÚC HÀ NỘI")
    c.drawCentredString(width / 2, height - 90, "KHOA CÔNG NGHỆ THÔNG TIN")

    c.setLineWidth(1)
    c.line(width / 2 - 100, height - 100, width / 2 + 100, height - 100)

    c.setFont(bold_font, 20)
    c.drawCentredString(width / 2, height - 200, "TÀI LIỆU NGHIÊN CỨU CHUYÊN NGÀNH")
    c.setFont(bold_font, 16)
    c.drawCentredString(width / 2, height - 230, "TỔNG HỢP 16 TÀI LIỆU NGUỒN CHUẨN HÓA")

    c.setFont(font_name, 12)
    c.drawCentredString(width / 2, height - 270, "Hệ Thống Cố Vấn Thẩm Định & Đánh Giá Tiêu Chuẩn Hình Ảnh Quảng Cáo")
    c.drawCentredString(width / 2, height - 290, "Ứng Dụng Mô Hình Thị Giác - Ngôn Ngữ (Multimodal VLM)")

    c.setFont(bold_font, 12)
    c.drawString(120, height - 420, "Sinh viên thực hiện: Trần Thái Cương")
    c.setFont(font_name, 12)
    c.drawString(120, height - 440, "Mã sinh viên: 2255010026 — Lớp: 22CN1")
    c.setFont(bold_font, 12)
    c.drawString(120, height - 470, "Giảng viên hướng dẫn: TS. Lương Thị Hồng Lan")

    c.setFont(font_name, 11)
    c.drawCentredString(width / 2, 80, "HÀ NỘI, NĂM 2026")

    # Sang trang 2: Mục lục danh mục tài liệu
    c.showPage()
    c.setFont(bold_font, 16)
    c.drawString(50, height - 60, "DANH MỤC 16 TÀI LIỆU NGHIÊN CỨU HỢP NHẤT")
    c.setLineWidth(0.8)
    c.line(50, height - 68, width - 50, height - 68)

    c.setFont(font_name, 10)
    y_pos = height - 100
    for idx, fname in enumerate(pdf_files, 1):
        c.setFont(bold_font, 10)
        c.drawString(50, y_pos, f"{idx:02d}.")
        c.setFont(font_name, 10)
        c.drawString(75, y_pos, f"{fname}")
        y_pos -= 38
        if y_pos < 60:
            c.showPage()
            y_pos = height - 60

    c.save()
    logger.info(f"Đã tạo trang bìa và mục lục chuẩn tại: {output_cover_path}")


def merge_all_pdfs():
    """Gộp các file PDF nguồn cùng với trang bìa."""
    pdf_files = sorted([
        f.name for f in TRAINING_DIR.glob("*.pdf")
        if f.name != OUTPUT_MERGED_PDF.name and not f.name.startswith("_")
    ])

    if not pdf_files:
        logger.error(f"Không tìm thấy file PDF nào trong thư mục {TRAINING_DIR}")
        return

    logger.info(f"Tìm thấy {len(pdf_files)} tài liệu PDF cần chuẩn hóa và gộp...")
    font_name = register_vietnamese_font()

    create_cover_and_index(pdf_files, COVER_TEMP_PDF, font_name)

    writer = PdfWriter()

    # Thêm trang bìa & mục lục
    cover_reader = PdfReader(str(COVER_TEMP_PDF))
    for page in cover_reader.pages:
        writer.add_page(page)

    total_pages = len(cover_reader.pages)
    file_bookmarks = []

    for idx, fname in enumerate(pdf_files, 1):
        file_path = TRAINING_DIR / fname
        try:
            reader = PdfReader(str(file_path))
            num_pages = len(reader.pages)
            start_page = total_pages
            for page in reader.pages:
                writer.add_page(page)
            total_pages += num_pages
            file_bookmarks.append((f"[{idx:02d}] {fname}", start_page))
            logger.info(f"  + Đã nạp [{idx}/{len(pdf_files)}]: {fname} ({num_pages} trang)")
        except Exception as e:
            logger.error(f"Lỗi khi đọc file {fname}: {e}")

    # Tạo outline / bookmark để dễ dàng tra cứu
    for title, p_num in file_bookmarks:
        try:
            writer.add_outline_item(title, p_num)
        except Exception:
            pass

    with open(OUTPUT_MERGED_PDF, "wb") as f_out:
        writer.write(f_out)

    if COVER_TEMP_PDF.exists():
        COVER_TEMP_PDF.unlink()

    file_size_mb = OUTPUT_MERGED_PDF.stat().st_size / (1024 * 1024)
    logger.info("=============================================================")
    logger.info(f"✅ GỘP THÀNH CÔNG 16 FILE PDF THÀNH 1 TỆP DUY NHẤT:")
    logger.info(f"📁 Tệp đích: {OUTPUT_MERGED_PDF}")
    logger.info(f"📄 Tổng số trang: {total_pages} trang")
    logger.info(f"💾 Dung lượng: {file_size_mb:.2f} MB")
    logger.info("=============================================================")


if __name__ == "__main__":
    merge_all_pdfs()
