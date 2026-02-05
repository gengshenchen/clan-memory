#pragma once

#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

// Forward declaration
namespace SQLite {
class Database;
}

namespace clan::core {

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

// Operation log for tracking changes
struct OperationLog {
    int id = 0;
    std::string action;       // CREATE, UPDATE, DELETE
    std::string target_type;  // member, media
    std::string target_id;
    std::string target_name;
    std::string changes;  // JSON string of changes
    long long created_at = 0;
};
// 产品级结构体：包含完整的家谱信息
struct Member {
    std::string id;
    std::string name;
    std::string gender;  // "M" or "F"
    int generation = 1;
    std::string generation_name;  // 字辈 (如 "定", "英")

    // 关系
    std::string father_id;
    std::string mother_id;    // 母系关联
    std::string spouse_name;  // 配偶姓名

    // 时间与地点 (使用 ISO 8601 字符串 "YYYY-MM-DD")
    std::string birth_date;
    std::string death_date;
    std::string birth_place;
    std::string death_place;

    // 媒体与描述
    std::string portrait_path;  // 头像路径
    std::string bio;            // 生平传记 (支持 FTS 全文检索)
};

class DatabaseManager {
public:
    static DatabaseManager& instance();

    void Initialize(const std::string& dbPath);

    std::vector<Member> GetAllMembers();
    Member GetMemberById(const std::string& id);
    std::vector<Member> SearchMembers(const std::string& keyword);

    void SaveMember(const Member& m);
    bool DeleteMember(const std::string& memberId);
    bool UpdateMemberPortrait(const std::string& memberId, const std::string& portraitPath);
    bool HasChildren(const std::string& memberId);

    void AddMediaResource(const MediaResource& res);
    bool DeleteMediaResource(const std::string& resourceId);
    std::vector<MediaResource> GetMediaResources(const std::string& memberId,
                                                 const std::string& type);

    // Settings management
    std::string GetSetting(const std::string& key);
    void SaveSetting(const std::string& key, const std::string& value);

    // Operation logs
    void AddOperationLog(const std::string& action, const std::string& targetType,
                         const std::string& targetId, const std::string& targetName,
                         const std::string& changes);
    std::vector<OperationLog> GetOperationLogs(int limit = 100, int offset = 0);

private:
    DatabaseManager();
    ~DatabaseManager();

    void CreateTables();
    void CheckAndMigrateSchema();
    void CheckFTSSupport();

    std::unique_ptr<SQLite::Database> db_;
    std::mutex db_mutex_;
};

}  // namespace clan::core
