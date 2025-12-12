#pragma once

#include <string>
#include <vector>
#include <memory>
#include <mutex>

// Forward declaration
namespace SQLite { class Database; }

namespace qt_app_template::core  {

// 纯 C++ 结构体，不含 Qt 类型
struct Member {
    std::string id;
    std::string name;
    std::string gender;
    int generation = 1;
    std::string father_id;
    std::string mate_name;
    std::string bio;
};

class DatabaseManager {
public:
    static DatabaseManager& instance();

    // 初始化数据库 (传入绝对路径)
    void Initialize(const std::string& dbPath);

    // 获取所有成员（构建树用）
    std::vector<Member> GetAllMembers();

    // 插入一个测试成员（方便您调试）
    void AddDummyMember(const Member& m);

private:
    DatabaseManager();
    ~DatabaseManager();
    void CreateTables();

    std::unique_ptr<SQLite::Database> db_;
    std::mutex db_mutex_;
};

} // namespace clan
