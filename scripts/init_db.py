#!/usr/bin/env python3
import sqlite3
import uuid
import os
import csv
import sys
from datetime import datetime

# 配置路径
DEFAULT_DB_PATH = "/home/karl/.local/share/dong-xiong-community/clan-memory/clan.db"
CSV_FILE_PATH = os.path.join(os.path.dirname(__file__), "clan_data.csv")

def create_connection(db_file):
    """创建数据库连接"""
    os.makedirs(os.path.dirname(db_file), exist_ok=True)
    try:
        conn = sqlite3.connect(db_file)
        # 启用外键支持
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def create_tables(conn):
    """[Fix] 创建完整的数据库表结构，与 C++ 保持一致"""
    cursor = conn.cursor()

    # 1. Members 表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            gender TEXT,
            generation INTEGER,
            generation_name TEXT,
            father_id TEXT,
            mother_id TEXT,
            spouse_name TEXT,
            birth_date TEXT,
            death_date TEXT,
            birth_place TEXT,
            death_place TEXT,
            portrait_path TEXT,
            bio TEXT,
            created_at INTEGER,
            updated_at INTEGER
        );
    """)

    # 2. FTS5 全文检索表 (用于搜索)
    # 注意：Python sqlite3 必须编译了 FTS5 支持才能运行此句。
    # 大多数现代 Linux/macOS 的 Python 默认都支持。
    try:
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS members_fts USING fts5(
                name, bio, content='members', content_rowid='rowid'
            );
        """)

        # FTS 触发器 (保持同步)
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS members_ai AFTER INSERT ON members BEGIN
              INSERT INTO members_fts(rowid, name, bio) VALUES (new.rowid, new.name, new.bio);
            END;
        """)
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS members_ad AFTER DELETE ON members BEGIN
              INSERT INTO members_fts(members_fts, rowid, name, bio) VALUES('delete', old.rowid, old.name, old.bio);
            END;
        """)
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS members_au AFTER UPDATE ON members BEGIN
              INSERT INTO members_fts(members_fts, rowid, name, bio) VALUES('delete', old.rowid, old.name, old.bio);
              INSERT INTO members_fts(rowid, name, bio) VALUES (new.rowid, new.name, new.bio);
            END;
        """)
    except sqlite3.OperationalError as e:
        print(f"Warning: FTS5 support missing in Python sqlite3. Search index skipped. ({e})")

    # 3. Media Resources 表 (v0.8 支持)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS media_resources (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            title TEXT,
            description TEXT,
            file_hash TEXT,
            file_size INTEGER,
            created_at INTEGER,
            is_primary BOOLEAN DEFAULT 0,
            FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
        );
    """)

    # 4. Settings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER
        );
    """)

    # 5. Operation Logs Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            target_name TEXT,
            changes TEXT,
            created_at INTEGER NOT NULL
        );
    """)

    # 6. 索引
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_member ON media_resources(member_id);")

    # 7. Default Settings
    try:
        # Initialize default generation names
        default_gen_names = '["始","定","英","华","富","贵","荣","昌","盛","德","永"]'
        now = int(datetime.now().timestamp())
        cursor.execute("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)", 
                      ("generation_names", default_gen_names, now))
    except Exception as e:
        print(f"Warning initializing settings: {e}")

    conn.commit()
    print("Database schema created successfully.")

def generate_uuid():
    return str(uuid.uuid4())

def init_db_from_csv(db_path, csv_path):
    print(f"Initializing DB at: {db_path}")
    print(f"Reading CSV from: {csv_path}")

    conn = create_connection(db_path)
    if not conn:
        return

    # [Fix] 第一步：先建表
    create_tables(conn)

    cursor = conn.cursor()

    # 1. 清理旧数据
    print("Cleaning old members data...")
    try:
        cursor.execute("DELETE FROM members")
        cursor.execute("DELETE FROM media_resources")
        cursor.execute("DELETE FROM settings")
        cursor.execute("DELETE FROM operation_logs")
        # 如果 FTS 表存在，重建它通常会自动清理，或者手动清理
        # cursor.execute("INSERT INTO members_fts(members_fts) VALUES('rebuild')")
    except Exception as e:
        print(f"Warning cleaning data: {e}")

    # 2. 读取 CSV
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    members_cache = {} # Name -> UUID 映射

    try:
        with open(csv_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)

            # 检查必要列
            if 'Name' not in reader.fieldnames:
                print("Error: CSV missing 'Name' column")
                return

            print("Importing members...")
            count = 0

            for row in reader:
                name = row['Name'].strip()
                if not name: continue

                # 生成 ID
                m_id = generate_uuid()
                members_cache[name] = m_id

                # 查找父亲 ID
                father_name = row.get('FatherName', '').strip()
                father_id = None
                if father_name:
                    if father_name in members_cache:
                        father_id = members_cache[father_name]
                    else:
                        print(f"Warning: Father '{father_name}' not found for '{name}'. (Order matters!)")

                # 构建数据
                member_data = (
                    m_id,
                    name,
                    row.get('Gender', 'M'),
                    int(row.get('Generation', 1) or 1),
                    row.get('GenerationName', ''),
                    father_id,
                    None, # Mother ID
                    row.get('Spouse', ''),
                    row.get('BirthDate', ''),
                    row.get('DeathDate', ''),
                    row.get('BirthPlace', ''),
                    row.get('DeathPlace', ''),
                    row.get('Bio', ''),
                    row.get('PortraitPath', ''),
                    datetime.now().timestamp()
                )

                sql = """
                    INSERT INTO members
                    (id, name, gender, generation, generation_name, father_id, mother_id, spouse_name,
                     birth_date, death_date, birth_place, death_place, bio, portrait_path, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                cursor.execute(sql, member_data)
                count += 1

            conn.commit()
            print(f"Successfully imported {count} members.")

    except Exception as e:
        conn.rollback()
        print(f"Error during import: {e}")
        # 不抛出异常，只打印，方便用户看日志
        return

    # 3. 验证数据
    try:
        res = cursor.execute("SELECT count(*) FROM members").fetchone()
        print(f"Total members in DB: {res[0]}")
    except Exception as e:
        print(f"Verification failed: {e}")

    conn.close()

if __name__ == "__main__":
    db_path = DEFAULT_DB_PATH
    if len(sys.argv) > 1:
        db_path = sys.argv[1]

    init_db_from_csv(db_path, CSV_FILE_PATH)
