#include "database_manager.h"
#include <SQLiteCpp/SQLiteCpp.h>
#include <iostream>

namespace qt_app_template::core {

DatabaseManager& DatabaseManager::instance() {
    static DatabaseManager instance;
    return instance;
}

DatabaseManager::DatabaseManager() {}
DatabaseManager::~DatabaseManager() {}

void DatabaseManager::Initialize(const std::string& dbPath) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    try {
        // 打开或创建数据库
        db_ = std::make_unique<SQLite::Database>(dbPath, SQLite::OPEN_READWRITE | SQLite::OPEN_CREATE);
        CreateTables();
        std::cout << "[DB] Initialized at: " << dbPath << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "[DB] Init failed: " << e.what() << std::endl;
    }
}

void DatabaseManager::CreateTables() {
    // 简单的建表语句
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

void DatabaseManager::AddDummyMember(const Member& m) {
    std::lock_guard<std::mutex> lock(db_mutex_);
    try {
        SQLite::Statement query(*db_, "INSERT OR REPLACE INTO members (id, name, father_id, generation) VALUES (?, ?, ?, ?)");
        query.bind(1, m.id);
        query.bind(2, m.name);
        query.bind(3, m.father_id);
        query.bind(4, m.generation);
        query.exec();
    } catch (std::exception& e) {
        std::cerr << "[DB] Add failed: " << e.what() << std::endl;
    }
}

std::vector<Member> DatabaseManager::GetAllMembers() {
    std::lock_guard<std::mutex> lock(db_mutex_);
    std::vector<Member> list;
    if (!db_) return list;

    try {
        SQLite::Statement query(*db_, "SELECT id, name, gender, generation, father_id FROM members");
        while (query.executeStep()) {
            Member m;
            m.id = query.getColumn(0).getString();
            m.name = query.getColumn(1).getString();
            m.gender = query.getColumn(2).getText(); // 可能为空
            m.generation = query.getColumn(3).getInt();
            m.father_id = query.getColumn(4).getText();
            list.push_back(m);
        }
    } catch (std::exception& e) {
        std::cerr << "[DB] Query failed: " << e.what() << std::endl;
    }
    return list;
}

} // namespace clan
