#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
ADVISION AI - KẾT NỐI GOOGLE DRIVE API & ĐỒNG BỘ TRI THỨC (GOOGLE DRIVE SYNC)
=============================================================================
Chức năng:
1. Kết nối với Google Drive API v3 thông qua OAuth2 hoặc Service Account.
2. Tự động kiểm tra hoặc tạo thư mục: "AdVision_Research_Knowledge" trên Drive.
3. Tải các tệp PDF tri thức Master lên Google Drive:
   - docs/SO_TAY_QUY_CHUAN_THIET_KE_MASTER.pdf (Cho NotebookLM)
   - trainingdocs/TAI_LIEU_NGHIEN_CUU_HOP_NHAT_16_PDF.pdf (Tài liệu gốc)
4. Lấy liên kết chia sẻ trực tiếp (Shareable Link) để người dùng nạp vào Google NotebookLM.
=============================================================================
"""

import os
import sys
import logging
from pathlib import Path

# Khắc phục lỗi mã hóa tiếng Việt trên Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("GoogleDriveSync")

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_DIR = BASE_DIR / "credentials"
DOCS_DIR = BASE_DIR / "docs"
TRAINING_DIR = BASE_DIR / "trainingdocs"

MASTER_NOTEBOOKLM_PDF = DOCS_DIR / "SO_TAY_QUY_CHUAN_THIET_KE_MASTER.pdf"
MERGED_SOURCE_PDF = TRAINING_DIR / "TAI_LIEU_NGHIEN_CUU_HOP_NHAT_16_PDF.pdf"

# Các đường dẫn file khóa xác thực Google Drive API
OAUTH_CLIENT_SECRETS = CREDENTIALS_DIR / "credentials.json"
OAUTH_TOKEN_FILE = CREDENTIALS_DIR / "token.json"
SERVICE_ACCOUNT_FILE = CREDENTIALS_DIR / "service_account.json"

SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']


def print_setup_instructions():
    """In hướng dẫn thiết lập Google Drive API nếu chưa có file chứng thực."""
    print("\n" + "=" * 70)
    print("📋 HƯỚNG DẪN 3 BƯỚC KẾT NỐI GOOGLE DRIVE API")
    print("=" * 70)
    print("Để kích hoạt kết nối tự động tải tệp lên Google Drive, bạn cần 1 file chứng thực:")
    print("👉 Cách 1 (Dễ nhất - OAuth2 Client ID):")
    print("   1. Truy cập: https://console.cloud.google.com")
    print("   2. Tạo một Dự án mới (ví dụ: AdVision-Research) -> Bật 'Google Drive API'")
    print("   3. Vào 'Credentials' -> 'Create Credentials' -> 'OAuth client ID' (chọn Desktop App)")
    print("   4. Tải file JSON về, đổi tên thành 'credentials.json' và đặt vào thư mục:")
    print(f"      📁 {CREDENTIALS_DIR}\\credentials.json")
    print("\n👉 Cách 2 (Dành cho tài khoản Service Account):")
    print("   Tạo Service Account key, tải file JSON về, đổi tên thành 'service_account.json' và đặt vào thư mục trên.")
    print("=" * 70 + "\n")


def get_drive_service():
    """Khởi tạo và trả về Google Drive API Service."""
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Ưu tiên xác thực qua OAuth2 Client ID (Dành cho tài khoản cá nhân, có 15GB quota)
    if OAUTH_TOKEN_FILE.exists() or OAUTH_CLIENT_SECRETS.exists():
        try:
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build

            creds = None
            if OAUTH_TOKEN_FILE.exists():
                creds = Credentials.from_authorized_user_file(str(OAUTH_TOKEN_FILE), SCOPES)

            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                elif OAUTH_CLIENT_SECRETS.exists():
                    logger.info("Khởi động luồng xác thực OAuth2 trên trình duyệt...")
                    flow = InstalledAppFlow.from_client_secrets_file(str(OAUTH_CLIENT_SECRETS), SCOPES)
                    creds = flow.run_local_server(port=0)
                    with open(OAUTH_TOKEN_FILE, 'w', encoding='utf-8') as token:
                        token.write(creds.to_json())
                    logger.info(f"Đã lưu token xác thực tại: {OAUTH_TOKEN_FILE}")

            if creds and creds.valid:
                logger.info("Xác thực thành công qua OAuth2 (Tài khoản cá nhân).")
                return build('drive', 'v3', credentials=creds)
        except Exception as e:
            logger.error(f"Lỗi xác thực OAuth2: {e}")

    # 2. Thử xác thực qua Service Account nếu có
    if SERVICE_ACCOUNT_FILE.exists():
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            creds = service_account.Credentials.from_service_account_file(
                str(SERVICE_ACCOUNT_FILE), scopes=SCOPES
            )
            logger.info("Xác thực thành công qua Service Account.")
            return build('drive', 'v3', credentials=creds)
        except Exception as e:
            logger.error(f"Lỗi xác thực Service Account: {e}")

    return None


def get_or_create_folder(service, folder_name="AdVision_Research_Knowledge"):
    """Tìm thư mục trên Google Drive (bao gồm cả thư mục được tài khoản cá nhân chia sẻ)."""
    # Tìm kiếm thư mục có tên folder_name
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name, owners)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()
    files = results.get('files', [])

    if files:
        folder_id = files[0]['id']
        logger.info(f"Đã tìm thấy thư mục trên Drive: '{folder_name}' (ID: {folder_id})")
        return folder_id

    # Nếu không tìm thấy, thử tạo mới
    try:
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        folder = service.files().create(body=file_metadata, fields='id').execute()
        folder_id = folder.get('id')
        logger.info(f"Đã tạo mới thư mục trên Drive: '{folder_name}' (ID: {folder_id})")
        return folder_id
    except Exception as e:
        logger.warning(f"Không thể tạo thư mục trực tiếp: {e}")
        return None


def upload_pdf_to_drive(service, file_path: Path, folder_id: str):
    """Tải tệp PDF lên thư mục Google Drive và bật quyền truy cập xem."""
    from googleapiclient.http import MediaFileUpload

    file_name = file_path.name
    # Kiểm tra xem tệp đã tồn tại chưa
    query = f"name = '{file_name}' and '{folder_id}' in parents and trashed = false"
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    existing_files = results.get('files', [])

    media = MediaFileUpload(str(file_path), mimetype='application/pdf', resumable=True)

    if existing_files:
        file_id = existing_files[0]['id']
        logger.info(f"Cập nhật tệp đã tồn tại: {file_name} (ID: {file_id})...")
        updated_file = service.files().update(
            fileId=file_id,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()
    else:
        logger.info(f"Đang tải lên tệp mới: {file_name}...")
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        updated_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()
        file_id = updated_file.get('id')

    # Bật quyền xem công khai (Anyone with link can view)
    try:
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'},
            fields='id'
        ).execute()
    except Exception as e:
        logger.warning(f"Không thể đặt quyền công khai: {e}")

    # Lấy thông tin link xem
    file_info = service.files().get(fileId=file_id, fields='id, name, webViewLink').execute()
    return file_info


def main():
    print("\n=============================================================")
    print("🚀 ADVISION AI — KẾT NỐI GOOGLE DRIVE API & ĐỒNG BỘ TRI THỨC")
    print("=============================================================\n")

    # Kiểm tra tệp nguồn cần tải lên
    if not MASTER_NOTEBOOKLM_PDF.exists():
        logger.error(f"Chưa tìm thấy tệp Master PDF tại: {MASTER_NOTEBOOKLM_PDF}")
        logger.info("Đang tự động chạy script tạo Master PDF...")
        import subprocess
        subprocess.run([sys.executable, str(BASE_DIR / "scripts" / "generate_notebooklm_master_pdf.py")])

    service = get_drive_service()

    if not service:
        logger.warning("Chưa tìm thấy cấu hình xác thực Google Drive API hợp lệ.")
        print_setup_instructions()
        print("💡 THÔNG BÁO TỆP TIN SẴN SÀNG:")
        print(f"1. Sổ tay Master cho NotebookLM: {MASTER_NOTEBOOKLM_PDF} ({MASTER_NOTEBOOKLM_PDF.stat().st_size / 1024:.1f} KB)")
        if MERGED_SOURCE_PDF.exists():
            print(f"2. File gộp 16 PDF nguồn:        {MERGED_SOURCE_PDF} ({MERGED_SOURCE_PDF.stat().st_size / (1024*1024):.1f} MB)")
        print("\n👉 Bạn có thể kéo thả trực tiếp tệp trên vào Google Drive hoặc làm theo hướng dẫn ở trên để kết nối API tự động.\n")
        return

    # Nếu đã kết nối API thành công:
    try:
        folder_id = get_or_create_folder(service, "AdVision_Research_Knowledge")

        print("\nUploading tệp Master PDF (phục vụ NotebookLM)...")
        res1 = upload_pdf_to_drive(service, MASTER_NOTEBOOKLM_PDF, folder_id)
        print(f"✅ Tải lên thành công: {res1.get('name')}")
        print(f"🔗 Liên kết Google Drive: {res1.get('webViewLink')}")

        if ('--all' in sys.argv or '-a' in sys.argv) and MERGED_SOURCE_PDF.exists():
            print("\nUploading tệp PDF hợp nhất 16 tài liệu nghiên cứu nguồn (39.9 MB)...")
            res2 = upload_pdf_to_drive(service, MERGED_SOURCE_PDF, folder_id)
            print(f"✅ Tải lên thành công: {res2.get('name')}")
            print(f"🔗 Liên kết Google Drive: {res2.get('webViewLink')}")

        print("\n=============================================================")
        print("🎉 ĐÃ ĐỒNG BỘ TRI THỨC THÀNH CÔNG VỚI GOOGLE DRIVE!")
        print(f"📌 Thư mục Drive ID: {folder_id}")
        print(f"📘 Tệp Master PDF:   {res1.get('webViewLink')}")
        print("👉 Bây giờ bạn có thể mở https://notebooklm.google.com và thêm file này làm nguồn.")
        print("=============================================================\n")
    except Exception as e:
        logger.error(f"Lỗi trong quá trình tương tác với Google Drive API: {e}")


if __name__ == "__main__":
    main()
