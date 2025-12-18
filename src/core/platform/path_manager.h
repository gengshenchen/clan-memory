#ifndef QTAPPTEMPLATE_SRC_CORE_PLATFORM_PATH_MANAGER_H_
#define QTAPPTEMPLATE_SRC_CORE_PLATFORM_PATH_MANAGER_H_

#include <filesystem>

// 為我們所有的核心代碼定義頂級和次級命名空間
namespace clan::core {

class PathManager {
public:
    // 獲取全局唯一的實例
    static PathManager& instance();

    // 獲取可執行文件相關路徑
    const std::filesystem::path& executable_path() const;
    const std::filesystem::path& executable_dir() const;

    // 獲取語義清晰的、跨平台的用戶目錄
    const std::filesystem::path& config_dir() const;          // 用戶配置目錄
    const std::filesystem::path& data_dir() const;            // 用戶數據目錄
    const std::filesystem::path& cache_dir() const;           // 用戶緩存目錄
    const std::filesystem::path& log_dir() const;             // 用戶日志目錄
    const std::filesystem::path& crash_dir() const;           // 用戶崩潰目錄
    const std::filesystem::path& machine_config_dir() const;  //

    // 獲取與應用程序捆綁的、只讀的資源目錄
    const std::filesystem::path& resources_dir() const;

private:
    // 私有化構造函數等，確保單例模式
    PathManager();
    ~PathManager() = default;
    PathManager(const PathManager&) = delete;
    PathManager& operator=(const PathManager&) = delete;

    // 在構造時一次性計算並緩存所有路徑
    void initialize_paths();
    std::filesystem::path find_executable_path();

    // 緩存路徑的成員變量，使用後置下劃線
    std::filesystem::path executable_path_;
    std::filesystem::path executable_dir_;
    std::filesystem::path config_dir_;
    std::filesystem::path data_dir_;
    std::filesystem::path cache_dir_;
    std::filesystem::path log_dir_;
    std::filesystem::path crash_dir_;
    std::filesystem::path resources_dir_;
    std::filesystem::path machine_config_dir_;  // 安装程序负责创建
};

}  // namespace clan::core
   //

#endif  // QTAPPTEMPLATE_SRC_CORE_PLATFORM_PATH_MANAGER_H_
