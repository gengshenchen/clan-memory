#pragma once

#include <map>
#include <string>
#include <vector>

// 前向声明，避免在头文件中引入 Crashpad 的重量级头文件
namespace crashpad {
class CrashpadClient;
}

namespace clan::core {

/**
 * @class CrashpadHandler
 * @brief 一个封装了 Google Crashpad 客户端的单例类。
 *
 * 负责初始化 Crashpad，设置崩溃报告的存储路径、上传URL和自定义元数据。
 */
class CrashpadHandler {
public:
    /**
     * @brief 获取 CrashpadHandler 的唯一实例。
     */
    static CrashpadHandler& instance();

    /**
     * @brief 初始化 Crashpad 客户端。
     *
     * 该方法必须在应用程序启动的早期被调用。
     *
     * @param handler_path Crashpad 处理程序可执行文件的路径 (例如 "crashpad_handler.exe")。
     * @param database_path 用于存储崩溃报告的数据库目录路径。
     * @param url 崩溃报告上传服务器的 URL。如果为空，则报告仅保存在本地。
     * @param annotations 附加到每个崩溃报告的初始键值对元数据。
     * @param attachments 需要在崩溃时附加的文件路径列表 (例如日志文件)。
     * @return true 如果初始化成功，否则返回 false。
     */
    bool initialize(const std::string& handler_path, const std::string& database_path,
                    const std::string& url, const std::map<std::string, std::string>& annotations,
                    const std::vector<std::string>& attachments = {});

    /**
     * @brief 设置或更新崩溃报告的自定义元数据。
     *
     * 这些键值对将被包含在下一次崩溃的报告中。
     * @param annotations 要设置的注解。
     */
    void setAnnotations(const std::map<std::string, std::string>& annotations);

    /**
     * @brief 检查 Crashpad 是否已成功初始化。
     */
    bool isInitialized() const;

private:
    // 私有化构造/析构函数和拷贝操作，以实现单例模式
    CrashpadHandler();
    ~CrashpadHandler();
    CrashpadHandler(const CrashpadHandler&) = delete;
    CrashpadHandler& operator=(const CrashpadHandler&) = delete;

private:
    bool initialized_ = false;
    // 将 client 作为类成员，而不是局部变量
    crashpad::CrashpadClient* client_ = nullptr;
};

}  // namespace clan::core
