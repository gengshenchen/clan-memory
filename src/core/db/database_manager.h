#pragma once

#include <string>
#include <vector>
#include <memory>
#include <mutex>
#include <optional>

// Forward declaration
namespace SQLite { class Database; }

namespace clan::core  {

struct MediaResource {
    std::string id;
    std::string member_id;
    std::string resource_type;
    std::string file_path;
    std::string title;
    std::string description;
    std::string file_hash;
    long long file_size = 0;
    long long created_at = 0;
};
// 产品级结构体：包含完整的家谱信息
struct Member {
    std::string id;
    std::string name;
    std::string gender;       // "M" or "F"
    int generation = 1;
    std::string generation_name; // 【新增】字辈 (如 "定", "英")

    // 关系
    std::string father_id;
    std::string mother_id;    // 【新增】母系关联
    std::string spouse_name;    // 配偶姓名 (数据库对应字段 spouse_name)

    // 时间与地点 (使用 ISO 8601 字符串 "YYYY-MM-DD")
    std::string birth_date;   // 【新增】
    std::string death_date;   // 【新增】
    std::string birth_place;  // 【新增】
    std::string death_place;  // 【新增】

    // 媒体与描述
    std::string portrait_path; // 头像路径
    std::string bio;           // 生平传记 (支持 FTS 全文检索)
};

class DatabaseManager {
public:
    static DatabaseManager& instance();

    void Initialize(const std::string& dbPath);

    std::vector<Member> GetAllMembers();
    Member GetMemberById(const std::string& id);
    std::vector<Member> SearchMembers(const std::string& keyword);

    void SaveMember(const Member& m);
    void AddMediaResource(const MediaResource& res);
    std::vector<MediaResource> GetMediaResources(const std::string& memberId, const std::string& type);
private:
    DatabaseManager();
    ~DatabaseManager();

    void CreateTables();
    void CheckAndMigrateSchema();
    void CheckFTSSupport();

    std::unique_ptr<SQLite::Database> db_;
    std::mutex db_mutex_;
};

} // namespace clan
