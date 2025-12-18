#include "crashpad_handler.h"

#include <zlib.h>

#include <filesystem>
#include <iostream>
#include <vector>

#include "base/files/file_path.h"
#include "client/crash_report_database.h"
#include "client/crashpad_client.h"
#include "client/settings.h"

// std::unique_ptr<crashpad::CrashReportDatabase> database;

// 平台特定的头文件和辅助函数
#if defined(_WIN32)
#include <Windows.h>
// 辅助函数：将 UTF-8 string 转换为 wstring (仅限 Windows)
// 这是处理非 ASCII 路径的关键
static std::wstring Utf8ToWstring(const std::string& utf8_str) {
    if (utf8_str.empty()) {
        return std::wstring();
    }
    int size_needed =
        MultiByteToWideChar(CP_UTF8, 0, utf8_str.c_str(), (int)utf8_str.size(), NULL, 0);
    std::wstring wstr_to(size_needed, 0);
    MultiByteToWideChar(
        CP_UTF8, 0, utf8_str.c_str(), (int)utf8_str.size(), &wstr_to[0], size_needed);
    return wstr_to;
}
#endif

namespace clan::core {

CrashpadHandler& CrashpadHandler::instance() {
    static CrashpadHandler handler;
    return handler;
}

CrashpadHandler::CrashpadHandler() {
    client_ = new crashpad::CrashpadClient();
}

CrashpadHandler::~CrashpadHandler() {
    delete client_;
    client_ = nullptr;
}

bool CrashpadHandler::initialize(const std::string& handler_path, const std::string& database_path,
                                 const std::string& url,
                                 const std::map<std::string, std::string>& annotations,
                                 const std::vector<std::string>& attachments) {
    if (initialized_) {
        return true;
    }

    // 检查路径是否为空，这是基本的防御性编程
    if (handler_path.empty() || database_path.empty()) {
        return false;
    }

    // 确保数据库目录存在
    std::error_code ec;
    std::filesystem::create_directories(database_path, ec);
    if (ec) {
        return false;
    }
    // 1. 准备路径，并根据平台进行正确转换
    base::FilePath handler;
    base::FilePath db;
#if defined(_WIN32)
    handler = base::FilePath(Utf8ToWstring(handler_path));
    db = base::FilePath(Utf8ToWstring(database_path));
#else
    handler = base::FilePath(handler_path);
    db = base::FilePath(database_path);
#endif

    // 2. 准备附件
    std::vector<base::FilePath> file_attachments;
    for (const auto& att : attachments) {
#if defined(_WIN32)
        file_attachments.push_back(base::FilePath(Utf8ToWstring(att)));
#else
        file_attachments.push_back(base::FilePath(att));
#endif
    }

    // 3. 准备其他参数
    std::vector<std::string> arguments;
    arguments.push_back("--no-rate-limit");
    bool restartable = true;
    bool asynchronous_start = false;

    // 4. 正确调用 StartHandler
    bool success = client_->StartHandler(handler,
                                         db,
                                         db,  // metrics_dir 通常可以和 db 路径相同
                                         url,
                                         annotations,
                                         arguments,
                                         restartable,
                                         asynchronous_start,
                                         file_attachments);

    if (success) {
        std::unique_ptr<crashpad::CrashReportDatabase> database =
            crashpad::CrashReportDatabase::Initialize(db);

        if (database == nullptr || database->GetSettings() == NULL) {
            return false;
        }
        /* Enable automated uploads. */
        database->GetSettings()->SetUploadsEnabled(true);
        std::cout << "set upload enable true" << std::endl;
    }

    initialized_ = success;
    return success;
}

void CrashpadHandler::setAnnotations(const std::map<std::string, std::string>& annotations) {
    if (!initialized_ || !client_) {
        return;
    }
    // Crashpad 没有直接更新所有注解的接口，
    // 但你可以通过 SimpleStringDictionary 来管理并传递给它。
    // 在这个封装中，最简单的方式是在初始化时传入。
    // 如果需要动态更新，需要更复杂的处理，例如重启 handler，但这通常不推荐。
    // 这里我们仅在初始化时设置。
}

bool CrashpadHandler::isInitialized() const {
    return initialized_;
}

}  // namespace clan::core
