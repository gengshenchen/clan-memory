import sqlite3
import uuid
import os
import random
from datetime import datetime

DB_PATH = "/home/karl/.local/share/dong-xiong-community/clan-memory/clan.db"

# 确保目录存在
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def create_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def generate_uuid():
    return str(uuid.uuid4())

def init_mock_data():
    conn = create_connection()
    if not conn:
        return

    cursor = conn.cursor()

    # 0. 清理旧数据 (开发阶段使用)
    print("Cleaning old data...")
    try:
        cursor.execute("DELETE FROM members")
        cursor.execute("DELETE FROM media_resources")
        # FTS 表会通过触发器自动清理，无需手动操作
    except Exception as e:
        print(f"Warning cleaning data: {e} (Maybe tables don't exist yet)")

    print("Inserting mock data...")

    # 1. 第一代 (始祖)
    root_id = generate_uuid()
    root = {
        "id": root_id,
        "name": "陈始祖",
        "gender": "M",
        "generation": 1,
        "generation_name": "始",
        "father_id": None,
        "mother_id": None,
        "spouse_name": "李氏",
        "birth_date": "1880-01-01",
        "death_date": "1950-12-12",
        "birth_place": "福建省福州市",
        "death_place": "台湾省台北市",
        "bio": "# 家族始祖\n\n清光绪年间渡海来台，白手起家。**勤俭持家**，教导子孙要以诚待人。\n\n曾参与修建当地妈祖庙。",
        "portrait_path": ""
    }
    insert_member(cursor, root)

    # 2. 第二代 (3个儿子)
    gen2_names = ["陈大伯", "陈二叔", "陈三叔"]
    gen2_zi = "定" # 字辈

    for i, name in enumerate(gen2_names):
        m_id = generate_uuid()
        member = {
            "id": m_id,
            "name": name,
            "gender": "M",
            "generation": 2,
            "generation_name": gen2_zi,
            "father_id": root_id,
            "mother_id": None,
            "spouse_name": f"王氏{i}",
            "birth_date": f"191{i}-05-20",
            "death_date": f"199{i}-10-01",
            "birth_place": "台湾省台北市",
            "death_place": "台湾省台北市",
            "bio": f"这是{name}的生平简介。他是家族的中流砥柱。",
            "portrait_path": ""
        }
        insert_member(cursor, member)

        # 3. 第三代 (每个儿子生2个孙子)
        gen3_zi = "英" # 字辈
        for j in range(2):
            g3_id = generate_uuid()
            grandson = {
                "id": g3_id,
                "name": f"陈{i}孙{j}",
                "gender": "M" if j==0 else "F", # 一男一女
                "generation": 3,
                "generation_name": gen3_zi,
                "father_id": m_id,
                "mother_id": None,
                "spouse_name": "",
                "birth_date": f"194{i+j}-02-15",
                "death_date": "", # 在世
                "birth_place": "台湾省台北市",
                "death_place": "",
                "bio": "生于战后婴儿潮，**考入大学**，成为家族第一代知识分子。",
                "portrait_path": ""
            }
            insert_member(cursor, grandson)

    conn.commit()
    print("Mock data inserted successfully!")

    # 验证 FTS
    print("Testing Full-Text Search (FTS)...")
    try:
        # 搜索 '大学'
        res = cursor.execute("SELECT rowid, name, bio FROM members_fts WHERE members_fts MATCH '大学'").fetchall()
        print(f"Search '大学' found {len(res)} records:")
        for r in res:
            print(f" - {r[1]}")
    except Exception as e:
        print(f"FTS Test failed: {e} (Did you enable FTS5 in C++?)")

    conn.close()

def insert_member(cursor, m):
    sql = """
        INSERT INTO members
        (id, name, gender, generation, generation_name, father_id, mother_id, spouse_name,
         birth_date, death_date, birth_place, death_place, bio, portrait_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    # 补充 created_at
    data = (
        m["id"], m["name"], m["gender"], m["generation"], m["generation_name"],
        m["father_id"], m["mother_id"], m["spouse_name"],
        m["birth_date"], m["death_date"], m["birth_place"], m["death_place"],
        m["bio"], m["portrait_path"], datetime.now().timestamp()
    )
    cursor.execute(sql, data)

if __name__ == "__main__":
    init_mock_data()
