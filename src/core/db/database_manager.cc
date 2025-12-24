#include "core/db/database_manager.h"

#include <iostream>
#include <filesystem>
#include <vector>
#include <chrono> // [Added] Include for time
#include <cstdint> // [Added] For int64_t

#include <SQLiteCpp/SQLiteCpp.h>

#include "core/log/log.h"
#include "core/platform/path_manager.h"

namespace clan::core {

namespace fs = std::filesystem;

// =========================================
//  DatabaseManager Implementation
// =========================================

DatabaseManager::DatabaseManager() {
}

DatabaseManager::~DatabaseManager() {
    // Unique_ptr handles cleanup
}

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager instance;
    return instance;
}

void DatabaseManager::Initialize(const std::string& dbPath) {
    std::lock_guard<std::mutex> lock(db_mutex_);

    // Ensure directory exists
    fs::path path(dbPath);
    if (path.has_parent_path() && !fs::exists(path.parent_path())) {
        fs::create_directories(path.parent_path());
    }

    try {
        // Open database (Read/Write | Create if missing)
        db_ = std::make_unique<SQLite::Database>(
            dbPath, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);

        LOGINFO("[DB] Database opened at: {}", dbPath);

        // Enable Foreign Keys
        db_->exec("PRAGMA foreign_keys = ON;");

        // Create Tables
        CreateTables();

        // FTS Check
        CheckFTSSupport();

    } catch (std::exception& e) {
        LOGERROR("[DB] Initialize failed: {}", e.what());
    }
}

void DatabaseManager::CreateTables() {
    if (!db_) return;

    try {
        SQLite::Transaction transaction(*db_);

        // 1. Members Table
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
                portrait_path TEXT,
                bio TEXT,
                created_at INTEGER,
                updated_at INTEGER
            );
        )");

        // 2. Full Text Search (FTS5) Virtual Table
        // Note: FTS tables are virtual, they don't support standard ALTER TABLE well.
        // We link it to members via triggers or manual updates.
        // Here we use Contentless or External Content FTS if needed,
        // but for simplicity in v0.5, we populate it manually or via triggers.
        db_->exec(R"(
            CREATE VIRTUAL TABLE IF NOT EXISTS members_fts USING fts5(
                name, bio, content='members', content_rowid='rowid'
            );
        )");

        // Triggers to keep FTS in sync with Members
        db_->exec(R"(
            CREATE TRIGGER IF NOT EXISTS members_ai AFTER INSERT ON members BEGIN
              INSERT INTO members_fts(rowid, name, bio) VALUES (new.rowid, new.name, new.bio);
            END;
            CREATE TRIGGER IF NOT EXISTS members_ad AFTER DELETE ON members BEGIN
              INSERT INTO members_fts(members_fts, rowid, name, bio) VALUES('delete', old.rowid, old.name, old.bio);
            END;
            CREATE TRIGGER IF NOT EXISTS members_au AFTER UPDATE ON members BEGIN
              INSERT INTO members_fts(members_fts, rowid, name, bio) VALUES('delete', old.rowid, old.name, old.bio);
              INSERT INTO members_fts(rowid, name, bio) VALUES (new.rowid, new.name, new.bio);
            END;
        )");

        // 3. Media Resources Table
        // [Added] Table for v0.8 media support
        db_->exec(R"(
            CREATE TABLE IF NOT EXISTS media_resources (
                id TEXT PRIMARY KEY,           -- Unique ID
                member_id TEXT NOT NULL,       -- Foreign Key to Member
                resource_type TEXT NOT NULL,   -- 'video', 'photo', 'audio'
                file_path TEXT NOT NULL,       -- Relative path in resources dir
                title TEXT,                    -- Display title
                description TEXT,              -- Optional description
                file_hash TEXT,                -- SHA256 or unique hash for deduplication
                file_size INTEGER,             -- File size in bytes
                created_at INTEGER,            -- Import timestamp
                is_primary BOOLEAN DEFAULT 0,  -- Is this the primary profile video/photo?
                FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
            );
        )");

        // Create Indexes
        db_->exec("CREATE INDEX IF NOT EXISTS idx_members_father ON members(father_id);");
        db_->exec("CREATE INDEX IF NOT EXISTS idx_media_member ON media_resources(member_id);");

        transaction.commit();
        LOGINFO("[DB] Tables initialized successfully.");

    } catch (std::exception& e) {
        LOGERROR("[DB] CreateTables failed: {}", e.what());
    }
}

void DatabaseManager::CheckFTSSupport() {
    if (!db_) return;
    try {
        // Simple check query
        SQLite::Statement query(*db_, "SELECT count(*) FROM members_fts WHERE members_fts MATCH 'test'");
        LOGINFO("[DB] FTS5 is active.");
    } catch (std::exception& e) {
        LOGWARN("[DB] FTS5 check failed (Msg: {}). Search might be limited.", e.what());
    }
}

// ---------------------------------------------------------
// Member Operations
// ---------------------------------------------------------

std::vector<Member> DatabaseManager::GetAllMembers() {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> result;
    if (!db_) return result;

    try {
        SQLite::Statement query(*db_, "SELECT * FROM members ORDER BY generation ASC");

        while (query.executeStep()) {
            Member m;
            m.id = query.getColumn("id").getText();
            m.name = query.getColumn("name").getText();
            m.gender = query.getColumn("gender").getText();
            m.generation = query.getColumn("generation").getInt();
            m.generation_name = query.getColumn("generation_name").getText();

            // Handle nullable fields
            if (!query.getColumn("father_id").isNull())
                m.father_id = query.getColumn("father_id").getText();
            if (!query.getColumn("mother_id").isNull())
                m.mother_id = query.getColumn("mother_id").getText();
            if (!query.getColumn("spouse_name").isNull())
                m.spouse_name = query.getColumn("spouse_name").getText();

            m.birth_date = query.getColumn("birth_date").getText();
            m.death_date = query.getColumn("death_date").getText();
            m.birth_place = query.getColumn("birth_place").getText();
            m.death_place = query.getColumn("death_place").getText();

            m.portrait_path = query.getColumn("portrait_path").getText();
            m.bio = query.getColumn("bio").getText();

            result.push_back(m);
        }
    } catch (std::exception& e) {
        LOGERROR("[DB] GetAllMembers failed: {}", e.what());
    }
    return result;
}

Member DatabaseManager::GetMemberById(const std::string& id) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    Member m;
    if (!db_) return m;

    try {
        SQLite::Statement query(*db_, "SELECT * FROM members WHERE id = ?");
        query.bind(1, id);

        if (query.executeStep()) {
            m.id = query.getColumn("id").getText();
            m.name = query.getColumn("name").getText();
            m.gender = query.getColumn("gender").getText();
            m.generation = query.getColumn("generation").getInt();
            m.generation_name = query.getColumn("generation_name").getText();

            if (!query.getColumn("father_id").isNull())
                m.father_id = query.getColumn("father_id").getText();
            if (!query.getColumn("mother_id").isNull())
                m.mother_id = query.getColumn("mother_id").getText();
            if (!query.getColumn("spouse_name").isNull())
                m.spouse_name = query.getColumn("spouse_name").getText();

            m.birth_date = query.getColumn("birth_date").getText();
            m.death_date = query.getColumn("death_date").getText();
            m.birth_place = query.getColumn("birth_place").getText();
            m.death_place = query.getColumn("death_place").getText();
            m.portrait_path = query.getColumn("portrait_path").getText();
            m.bio = query.getColumn("bio").getText();
        }
    } catch (std::exception& e) {
        LOGERROR("[DB] GetMemberById failed: {}", e.what());
    }
    return m;
}

std::vector<Member> DatabaseManager::SearchMembers(const std::string& keyword) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> result;
    if (!db_) return result;

    try {
        // Hybrid Search:
        // 1. Exact match on name (High priority)
        // 2. Full-text search on bio (FTS)
        // For v0.5 MVP, let's stick to FTS query

        // Note: FTS syntax usually requires sanitization.
        // Simple implementation:
        std::string ftsQuery = "\"" + keyword + "\""; // Exact phrase search

        SQLite::Statement query(*db_, R"(
            SELECT m.* FROM members m
            JOIN members_fts f ON m.rowid = f.rowid
            WHERE members_fts MATCH ?
            ORDER BY rank
        )");
        query.bind(1, ftsQuery);

        while (query.executeStep()) {
            Member m;
            m.id = query.getColumn("id").getText();
            m.name = query.getColumn("name").getText();
            m.generation = query.getColumn("generation").getInt();
            m.bio = query.getColumn("bio").getText();
            result.push_back(m);
        }
    } catch (std::exception& e) {
        LOGERROR("[DB] SearchMembers failed: {}", e.what());
    }
    return result;
}

// ---------------------------------------------------------
// Media Resource Operations (v0.8)
// ---------------------------------------------------------

// [Added] Insert a new media resource record
void DatabaseManager::AddMediaResource(const MediaResource& res) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    if (!db_) return;

    try {
        // [Added] Using REPLACE to handle potential duplicate IDs if logic changes
        SQLite::Statement query(*db_, R"(
            INSERT OR REPLACE INTO media_resources
            (id, member_id, resource_type, file_path, title, description, file_hash, file_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        )");

        query.bind(1, res.id);
        query.bind(2, res.member_id);
        query.bind(3, res.resource_type);
        query.bind(4, res.file_path);
        query.bind(5, res.title);
        query.bind(6, res.description);
        query.bind(7, res.file_hash);

        // [Fixed] Explicit cast to int64_t to resolve overload ambiguity
        query.bind(8, static_cast<int64_t>(res.file_size));

        // [Added] Use current timestamp if not provided
        // [Fixed] Explicit type int64_t for 'now'
        int64_t now = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        query.bind(9, now);

        query.exec();
        LOGINFO("[DB] Added media resource: {}", res.title);
    } catch (std::exception& e) {
        LOGERROR("[DB] AddMediaResource failed: {}", e.what());
    }
}

// [Added] Query resources by member ID and type
std::vector<MediaResource> DatabaseManager::GetMediaResources(const std::string& memberId,
                                                              const std::string& type) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<MediaResource> list;
    if (!db_) return list;

    try {
        SQLite::Statement query(*db_, R"(
            SELECT * FROM media_resources
            WHERE member_id = ? AND resource_type = ?
            ORDER BY created_at DESC
        )");

        query.bind(1, memberId);
        query.bind(2, type);

        while (query.executeStep()) {
            MediaResource res;
            res.id = query.getColumn("id").getText();
            res.member_id = query.getColumn("member_id").getText();
            res.resource_type = query.getColumn("resource_type").getText();
            res.file_path = query.getColumn("file_path").getText();
            res.title = query.getColumn("title").getText();

            // [Modified] Handle nullable columns safely
            if (!query.getColumn("description").isNull())
                res.description = query.getColumn("description").getText();

            if (!query.getColumn("file_hash").isNull())
                res.file_hash = query.getColumn("file_hash").getText();

            res.file_size = query.getColumn("file_size").getInt64();
            res.created_at = query.getColumn("created_at").getInt64();

            list.push_back(res);
        }
    } catch (std::exception& e) {
        LOGERROR("[DB] GetMediaResources failed: {}", e.what());
    }
    return list;
}

} // namespace clan::core
