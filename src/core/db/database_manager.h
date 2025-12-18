#pragma once

#include <string>
#include <vector>
#include <memory>
#include <mutex>
#include <optional> /* C++17, 用于更优雅的处理可选字段，这里暂时用 string空值代表以保持简单 */

// Forward declaration
namespace SQLite { class Database; }

namespace clan::core  {

// 产品级结构体：包含完整的家谱信息
struct Member {
    std::string id;
    std::string name;
    std::string gender;       // "M" or "F"
    int generation = 1;

    // 关系
    std::string father_id;
    std::string mother_id;    // 新增：母系关联
    std::string mate_name;    // 配偶姓名 (暂存，未来可以扩展为 mate_id)

    // 时间与地点 (使用 ISO 8601 字符串 "YYYY-MM-DD" 以便于排序和解析)
    std::string birth_date;   // 新增
    std::string death_date;   // 新增
    std::string birth_place;  // 新增
    std::string death_place;  // 新增

    // 媒体与描述
    std::string portrait_path; // 新增：头像路径 (本地 file:// 或 http://)
    std::string bio;
};

class DatabaseManager {
public:
    static DatabaseManager& instance();

    void Initialize(const std::string& dbPath);

    std::vector<Member> GetAllMembers();
    Member GetMemberById(const std::string& id);

    // 重命名为 SaveMember，意为“保存或更新”，符合产品语义
    void SaveMember(const Member& m);

private:
    DatabaseManager();
    ~DatabaseManager();

    void CreateTables();

    // 新增：自动检查并升级旧数据库结构
    void CheckAndMigrateSchema();

    std::unique_ptr<SQLite::Database> db_;
    std::mutex db_mutex_;
};

} // namespace clan
