#include "database_manager.h"

#include <SQLiteCpp/SQLiteCpp.h>

#include <filesystem>
#include <iostream>
#include <set>  // 用于去重

#include "core/log/log.h"

namespace clan::core {

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager instance;
    return instance;
}

DatabaseManager::DatabaseManager() {
}
DatabaseManager::~DatabaseManager() {
}

void DatabaseManager::Initialize(const std::string& dbPath) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    try {
        std::filesystem::path path(dbPath);
        if (path.has_parent_path()) {
            std::filesystem::create_directories(path.parent_path());
        }

        db_ = std::make_unique<SQLite::Database>(dbPath,
                                                 SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);

        // 启用外键约束
        db_->exec("PRAGMA foreign_keys = ON;");

        CreateTables();
        CheckAndMigrateSchema();
        CheckFTSSupport();

        LOGINFO("[DB] Initialized at: {}", dbPath);
    } catch (const std::exception& e) {
        LOGERROR("[DB] Init failed: {}", e.what());
    }
}

void DatabaseManager::CheckFTSSupport() {
    try {
        db_->exec("CREATE VIRTUAL TABLE IF NOT EXISTS temp_fts_check USING fts5(content)");
        db_->exec("DROP TABLE temp_fts_check");
        LOGINFO("[DB] SQLite FTS5 extension is ENABLED. Full-text search is ready.");
    } catch (std::exception& e) {
        LOGCRITICAL("[DB] SQLite FTS5 extension is NOT enabled! Error: {}", e.what());
    }
}

void DatabaseManager::CreateTables() {
    try {
        SQLite::Transaction transaction(*db_);

        db_->exec(R"(
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        )");

        db_->exec(R"(
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

                bio TEXT,
                portrait_path TEXT,

                created_at INTEGER,
                updated_at INTEGER,

                FOREIGN KEY(father_id) REFERENCES members(id) ON DELETE SET NULL,
                FOREIGN KEY(mother_id) REFERENCES members(id) ON DELETE SET NULL
            );
        )");

        db_->exec("CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);");
        db_->exec("CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);");

        db_->exec(R"(
            CREATE TABLE IF NOT EXISTS media_resources (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                original_name TEXT,
                file_hash TEXT,
                file_size INTEGER,
                title TEXT,
                description TEXT,
                is_primary BOOLEAN DEFAULT 0,
                created_at INTEGER,
                FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
            );
        )");
        db_->exec("CREATE INDEX IF NOT EXISTS idx_media_member ON media_resources(member_id);");

        // 尝试创建 FTS 表
        try {
            // 尝试使用 trigram 分词器 (SQLite 3.34+ 支持)，对中文支持更好
            // 如果不支持 trigram，SQLiteCpp 会抛异常，我们在 catch 里降级为默认分词器
            db_->exec(R"(
                CREATE VIRTUAL TABLE IF NOT EXISTS members_fts USING fts5(
                    name,
                    bio,
                    birth_place,
                    content='members',
                    content_rowid='rowid',
                    tokenize='trigram'
                );
            )");
        } catch (...) {
            // 降级策略：使用默认分词器 (unicode61)
            // 虽然对中文分词支持一般，但总比没有好，后续我们用 LIKE 兜底
            db_->exec(R"(
                CREATE VIRTUAL TABLE IF NOT EXISTS members_fts USING fts5(
                    name,
                    bio,
                    birth_place,
                    content='members',
                    content_rowid='rowid'
                );
            )");
        }

        // 触发器 (Trigger) - 保持 FTS 表同步
        db_->exec(
            "CREATE TRIGGER IF NOT EXISTS members_ai AFTER INSERT ON members BEGIN INSERT INTO "
            "members_fts(rowid, name, bio, birth_place) VALUES (new.rowid, new.name, new.bio, "
            "new.birth_place); END;");
        db_->exec(
            "CREATE TRIGGER IF NOT EXISTS members_ad AFTER DELETE ON members BEGIN INSERT INTO "
            "members_fts(members_fts, rowid, name, bio, birth_place) VALUES('delete', old.rowid, "
            "old.name, old.bio, old.birth_place); END;");
        db_->exec(
            "CREATE TRIGGER IF NOT EXISTS members_au AFTER UPDATE ON members BEGIN INSERT INTO "
            "members_fts(members_fts, rowid, name, bio, birth_place) VALUES('delete', old.rowid, "
            "old.name, old.bio, old.birth_place); INSERT INTO members_fts(rowid, name, bio, "
            "birth_place) VALUES (new.rowid, new.name, new.bio, new.birth_place); END;");

        transaction.commit();
    } catch (std::exception& e) {
        LOGERROR("[DB] CreateTables failed: {}", e.what());
    }
}

void DatabaseManager::CheckAndMigrateSchema() {
    if (!db_)
        return;
    std::vector<std::pair<std::string, std::string>> columns = {{"generation_name", "TEXT"},
                                                                {"mother_id", "TEXT"},
                                                                {"spouse_name", "TEXT"},
                                                                {"birth_date", "TEXT"},
                                                                {"death_date", "TEXT"},
                                                                {"birth_place", "TEXT"},
                                                                {"death_place", "TEXT"},
                                                                {"portrait_path", "TEXT"},
                                                                {"bio", "TEXT"}};
    for (const auto& col : columns) {
        try {
            db_->exec("SELECT " + col.first + " FROM members LIMIT 0");
        } catch (std::exception&) {
            try {
                db_->exec("ALTER TABLE members ADD COLUMN " + col.first + " " + col.second);
            } catch (std::exception& e) {
                LOGERROR("[DB] Migration failed for {}: {}", col.first, e.what());
            }
        }
    }
}

void DatabaseManager::SaveMember(const Member& m) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    if (!db_)
        return;
    try {
        SQLite::Statement query(*db_, R"(
            INSERT OR REPLACE INTO members
            (id, name, gender, generation, generation_name, father_id, mother_id, spouse_name,
             birth_date, death_date, birth_place, death_place, portrait_path, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        )");

        query.bind(1, m.id);
        query.bind(2, m.name);
        query.bind(3, m.gender);
        query.bind(4, m.generation);
        query.bind(5, m.generation_name);

        // 空字符串转 nullptr，防止外键约束失败
        if (m.father_id.empty())
            query.bind(6, nullptr);
        else
            query.bind(6, m.father_id);
        if (m.mother_id.empty())
            query.bind(7, nullptr);
        else
            query.bind(7, m.mother_id);

        query.bind(8, m.mate_name);
        query.bind(9, m.birth_date);
        query.bind(10, m.death_date);
        query.bind(11, m.birth_place);
        query.bind(12, m.death_place);
        query.bind(13, m.portrait_path);
        query.bind(14, m.bio);

        query.exec();
    } catch (std::exception& e) {
        LOGERROR("[DB] Save failed: {}", e.what());
    }
}

// 辅助函数：从 Query 中提取 Member
Member ParseMemberFromQuery(SQLite::Statement& query) {
    Member m;
    m.id = query.getColumn("id").getText();
    m.name = query.getColumn("name").getText();
    m.gender = query.getColumn("gender").getText();
    m.generation = query.getColumn("generation").getInt();
    if (!query.getColumn("generation_name").isNull())
        m.generation_name = query.getColumn("generation_name").getText();
    if (!query.getColumn("father_id").isNull())
        m.father_id = query.getColumn("father_id").getText();
    if (!query.getColumn("mother_id").isNull())
        m.mother_id = query.getColumn("mother_id").getText();
    try {
        m.mate_name = query.getColumn("spouse_name").getText();
    } catch (...) {
    }
    m.birth_date = query.getColumn("birth_date").getText();
    m.death_date = query.getColumn("death_date").getText();
    m.birth_place = query.getColumn("birth_place").getText();
    m.death_place = query.getColumn("death_place").getText();
    m.portrait_path = query.getColumn("portrait_path").getText();
    m.bio = query.getColumn("bio").getText();
    return m;
}

std::vector<Member> DatabaseManager::GetAllMembers() {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> list;
    if (!db_)
        return list;
    try {
        SQLite::Statement query(*db_, "SELECT * FROM members");
        while (query.executeStep()) {
            list.push_back(ParseMemberFromQuery(query));
        }
    } catch (std::exception& e) {
        LOGERROR("[DB] Query All failed: {}", e.what());
    }
    return list;
}

Member DatabaseManager::GetMemberById(const std::string& id) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    Member m;
    try {
        if (!db_)
            return m;
        SQLite::Statement query(*db_, "SELECT * FROM members WHERE id = ?");
        query.bind(1, id);
        if (query.executeStep()) {
            m = ParseMemberFromQuery(query);
        }
    } catch (std::exception& e) {
    }
    return m;
}

// 【架构升级】混合搜索：FTS + LIKE
std::vector<Member> DatabaseManager::SearchMembers(const std::string& keyword) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> list;
    std::set<std::string> addedIds;  // 用于去重
    if (!db_)
        return list;

    // 1. 尝试 FTS 搜索 (性能优先)
    try {
        SQLite::Statement query(*db_, R"(
            SELECT m.* FROM members m
            JOIN members_fts f ON m.rowid = f.rowid
            WHERE members_fts MATCH ?
            ORDER BY rank
        )");
        query.bind(1, keyword);

        while (query.executeStep()) {
            Member m = ParseMemberFromQuery(query);
            if (addedIds.find(m.id) == addedIds.end()) {
                list.push_back(m);
                addedIds.insert(m.id);
            }
        }
    } catch (std::exception& e) {
        // FTS 失败是预期的（比如表不存在或语法错误），静默失败，走兜底逻辑
    }

    // 2. 兜底策略：如果 FTS 没搜到结果（常见于中文分词问题），或者我们想保证绝对的召回率
    // 使用标准 SQL LIKE 模糊匹配 (兼容性优先)
    if (list.empty()) {
        try {
            // 搜索 姓名 或 生平
            SQLite::Statement query(*db_, R"(
                SELECT * FROM members
                WHERE name LIKE ? OR bio LIKE ?
                LIMIT 50
            )");
            std::string pattern = "%" + keyword + "%";
            query.bind(1, pattern);
            query.bind(2, pattern);

            while (query.executeStep()) {
                Member m = ParseMemberFromQuery(query);
                if (addedIds.find(m.id) == addedIds.end()) {
                    list.push_back(m);
                    addedIds.insert(m.id);
                }
            }
        } catch (std::exception& e) {
            LOGERROR("[DB] LIKE Search failed: {}", e.what());
        }
    }

    return list;
}

}  // namespace clan::core
