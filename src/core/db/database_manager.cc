#include "database_manager.h"
#include <SQLiteCpp/SQLiteCpp.h>
#include <iostream>
#include <filesystem> // 确保引入 filesystem

namespace clan::core {

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager instance;
    return instance;
}

DatabaseManager::DatabaseManager() {}
DatabaseManager::~DatabaseManager() {}

void DatabaseManager::Initialize(const std::string& dbPath) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    try {
        std::filesystem::path path(dbPath);
        if (path.has_parent_path()) {
            std::filesystem::create_directories(path.parent_path());
        }

        db_ = std::make_unique<SQLite::Database>(dbPath, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);

        // 1. 确保表存在
        CreateTables();

        // 2. 确保表结构是最新的 (产品级关键特性)
        CheckAndMigrateSchema();

        std::cout << "[DB] Initialized at: " << dbPath << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "[DB] Init failed: " << e.what() << std::endl;
    }
}

void DatabaseManager::CreateTables() {
    // 基础建表，如果表不存在则创建
    // 注意：SQLite 的 IF NOT EXISTS 不会自动添加新字段，所以这里的字段可以只写最基础的
    // 完整的字段由 CheckAndMigrateSchema 保证
    db_->exec(R"(
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            gender TEXT,
            generation INTEGER,
            father_id TEXT,
            mate_name TEXT,
            bio TEXT
        )
    )");
}

// 产品级特性：自动数据库迁移
// 每次启动时检查，如果发现缺字段，自动 ALTER TABLE 添加
void DatabaseManager::CheckAndMigrateSchema() {
    if (!db_) return;

    // 定义所有需要的列及其类型
    std::vector<std::pair<std::string, std::string>> columns = {
        {"mother_id", "TEXT"},
        {"birth_date", "TEXT"},
        {"death_date", "TEXT"},
        {"birth_place", "TEXT"},
        {"death_place", "TEXT"},
        {"portrait_path", "TEXT"},
        {"bio", "TEXT"},       // 再次检查基础字段，防止老版本缺失
        {"mate_name", "TEXT"}
    };

    for (const auto& col : columns) {
        try {
            // 尝试查询该列 (LIMIT 0 不会消耗性能)
            std::string sql = "SELECT " + col.first + " FROM members LIMIT 0";
            db_->exec(sql);
        } catch (std::exception&) {
            // 如果报错说明列不存在，执行添加列操作
            std::cout << "[DB] Migrating: Adding column " << col.first << std::endl;
            try {
                std::string alterSql = "ALTER TABLE members ADD COLUMN " + col.first + " " + col.second;
                db_->exec(alterSql);
            } catch (std::exception& e) {
                std::cerr << "[DB] Migration failed for " << col.first << ": " << e.what() << std::endl;
            }
        }
    }
}

void DatabaseManager::SaveMember(const Member& m) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    if (!db_) return;
    try {
        // 使用 REPLACE INTO 实现 "不存在则插入，存在则更新"
        SQLite::Statement query(*db_, R"(
            INSERT OR REPLACE INTO members
            (id, name, gender, generation, father_id, mother_id, mate_name,
             birth_date, death_date, birth_place, death_place, portrait_path, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        )");

        query.bind(1, m.id);
        query.bind(2, m.name);
        query.bind(3, m.gender);
        query.bind(4, m.generation);
        query.bind(5, m.father_id);
        query.bind(6, m.mother_id);
        query.bind(7, m.mate_name);
        query.bind(8, m.birth_date);
        query.bind(9, m.death_date);
        query.bind(10, m.birth_place);
        query.bind(11, m.death_place);
        query.bind(12, m.portrait_path);
        query.bind(13, m.bio);

        query.exec();
        // std::cout << "[DB] Saved member: " << m.name << std::endl; // 减少日志刷屏
    } catch (std::exception& e) {
        std::cerr << "[DB] Save failed: " << e.what() << std::endl;
    }
}

std::vector<Member> DatabaseManager::GetAllMembers() {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> list;
    if (!db_) return list;

    try {
        SQLite::Statement query(*db_, "SELECT * FROM members");
        while (query.executeStep()) {
            Member m;
            // 使用 getText() 而不是 getString()，因为它在值为 NULL 时返回 "" 而不是抛出异常
            m.id = query.getColumn("id").getText();
            m.name = query.getColumn("name").getText();
            m.gender = query.getColumn("gender").getText();
            m.generation = query.getColumn("generation").getInt();
            m.father_id = query.getColumn("father_id").getText();
            m.mate_name = query.getColumn("mate_name").getText();
            m.bio = query.getColumn("bio").getText();

            // 读取新增字段 (即使数据库里是 NULL，getText 也会安全返回空串)
            // 注意：要用 try-catch 包裹列名获取，以防 CheckAndMigrateSchema 失败的极端情况
            if (db_->tableExists("members")) { // 简单的防御
                 // 下面这些列必须跟 CheckAndMigrateSchema 里的一致
                 try { m.mother_id = query.getColumn("mother_id").getText(); } catch(...) {}
                 try { m.birth_date = query.getColumn("birth_date").getText(); } catch(...) {}
                 try { m.death_date = query.getColumn("death_date").getText(); } catch(...) {}
                 try { m.birth_place = query.getColumn("birth_place").getText(); } catch(...) {}
                 try { m.death_place = query.getColumn("death_place").getText(); } catch(...) {}
                 try { m.portrait_path = query.getColumn("portrait_path").getText(); } catch(...) {}
            }

            list.push_back(m);
        }
    } catch (std::exception& e) {
        std::cerr << "[DB] Query All failed: " << e.what() << std::endl;
    }
    return list;
}

Member DatabaseManager::GetMemberById(const std::string& id) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    Member m;

    try {
        if (!db_) return m;

        SQLite::Statement query(*db_, "SELECT * FROM members WHERE id = ?");
        query.bind(1, id);

        if (query.executeStep()) {
            m.id = query.getColumn("id").getText();
            m.name = query.getColumn("name").getText();
            m.gender = query.getColumn("gender").getText();
            m.generation = query.getColumn("generation").getInt();
            m.father_id = query.getColumn("father_id").getText();
            m.mate_name = query.getColumn("mate_name").getText();
            m.bio = query.getColumn("bio").getText();

            // 安全读取新字段
            try { m.mother_id = query.getColumn("mother_id").getText(); } catch(...) {}
            try { m.birth_date = query.getColumn("birth_date").getText(); } catch(...) {}
            try { m.death_date = query.getColumn("death_date").getText(); } catch(...) {}
            try { m.birth_place = query.getColumn("birth_place").getText(); } catch(...) {}
            try { m.death_place = query.getColumn("death_place").getText(); } catch(...) {}
            try { m.portrait_path = query.getColumn("portrait_path").getText(); } catch(...) {}
        }
    } catch (std::exception& e) {
        std::cerr << "[DB] GetById Error: " << e.what() << std::endl;
    }

    return m;
}
} // namespace clan
