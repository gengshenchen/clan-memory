#include <chrono>
#include <iostream>
#include <thread>

#include <QApplication>
#include <QCefConfig.h>
#include <QCefContext.h>
#include <QDebug>
#include <QDir>
#include <QStandardPaths>
#include <QTranslator>
#include <qatomic.h>

#include "core/Logger.h"
#include "core/config/config_manager.h"
#include "core/crash/crashpad_handler.h"
#include "core/db/database_manager.h"
#include "core/log/log.h"
#include "core/network/network_manager.h"
#include "core/platform/path_manager.h"
#include "core/task/task_manager.h"
#include "mainwindow.h"
#include "shared/Constants.h"
#include "version.h"
#ifdef USE_STATIC_QML_MODULES
#include <QQmlEngineExtensionPlugin>
Q_IMPORT_QML_PLUGIN(app_uiPlugin)  // URI app.ui
#endif

void listResources(const QString& path) {
    QDir dir(path);
    if (!dir.exists()) {
        qDebug() << "目录不存在:" << path;
        return;
    }
    QStringList entries = dir.entryList(QDir::Files | QDir::Dirs | QDir::NoDotAndDotDot);
    for (const QString& entry : entries) {
        QString fullPath = path + "/" + entry;
        if (QDir(fullPath).exists()) {
            // 是目录，递归进去
            listResources(fullPath);
        } else {
            // 是文件
            qDebug() << "资源文件:" << fullPath;
        }
    }
}

void benchmark(const std::string& mode_desc, int N) {
    using namespace std::chrono;
    std::cout << "Starting test: " << mode_desc << std::endl;
    int x{8};
    auto start = high_resolution_clock::now();
    for (int i = 0; i < N; ++i) {
        LOGINFO("Log message number {}", i);
        LOGTRACE("Log message number {}", i);
    }
    auto end = high_resolution_clock::now();
    auto dur_ms = duration_cast<milliseconds>(end - start).count();
    std::cout << "Finished " << N << " logs in " << dur_ms << "ms" << std::endl;
}

void setup_crashpad() {
    auto& paths = clan::core::PathManager::instance();
    namespace fs = std::filesystem;

    // --- 1. 查找 Handler 路徑 ---
    fs::path handler_path;

    // 優先策略：檢查可執行文件同級目錄 (Release/部署包標準路徑)
#ifdef _WIN32
    fs::path candidate = paths.executable_dir() / "crashpad_handler.exe";
#else
    fs::path candidate = paths.executable_dir() / "crashpad_handler";
#endif

    if (fs::exists(candidate)) {
        handler_path = candidate;
        std::cout << "Found crashpad_handler at: " << handler_path.string() << std::endl;
    }
#ifdef PROJECT_SOURCE_DIR
    else {
        // 後備策略：開發環境下，嘗試去源碼目錄的 3rdparty 下找 (通常這也不太對，最好是依賴 CMake
        // 拷貝) 但為了兼容舊邏輯保留
        handler_path = fs::path(PROJECT_SOURCE_DIR) / "3rdparty" / "crashpad" / "bin";
#ifdef _WIN32
        handler_path /= "crashpad_handler.exe";
#else
        handler_path /= "crashpad_handler";
#endif
    }
#endif

    if (!fs::exists(handler_path)) {
        std::cerr << "WARNING: crashpad_handler not found at: " << handler_path.string()
                  << std::endl;
        return;  // 找不到就直接返回，不要嘗試初始化，否則會崩潰
    }

    fs::path db_path = paths.crash_dir();
    fs::create_directories(db_path);

    std::string upload_url =
        "https://submit.backtrace.io/cgs/"
        "dbeda80fb3f6b7ce2e48659e62206d795be35210a80e993460a9261a4ba0c4ff/"
        "minidump";

    std::map<std::string, std::string> annotations = {{"format", "minidump"},
                                                      {"product", "clan-memory"},
                                                      {"version", "1.0.0"},
                                                      {"user_id", "user-12345"}};

    fs::path log_file_path =
        paths.log_dir() / (std::string(Constants::APP_NAME.toStdString()) + ".rotating.log");
    std::vector<std::string> attachments = {log_file_path.string()};

    bool initialized = clan::core::CrashpadHandler::instance().initialize(
        handler_path.string(), db_path.string(), upload_url, annotations, attachments);

    if (initialized) {
        std::cout << "Crashpad initialized successfully." << std::endl;
    } else {
        std::cerr << "Failed to initialize Crashpad." << std::endl;
    }
}

void crash_now() {
    volatile int* ptr = nullptr;
    *ptr = 42;
}

int main(int argc, char* argv[]) {
#ifdef NDEBUG
    std::cout << "This is a RELEASE build." << std::endl;
#else
    std::cout << "This is a DEBUG build." << std::endl;
#endif

    // cef config
    QCefConfig config;
    config.setBridgeObjectName("CallBridge");
    config.setRemoteDebuggingPort(9000);
    config.setSandboxDisabled(true);
    config.addCommandLineSwitchWithValue("remote-allow-origins", "*");
    config.addCommandLineSwitchWithValue("allow-file-access-from-files", "1");
    config.addCommandLineSwitchWithValue("allow-universal-access-from-files", "1");

#if defined(__linux__)
    // Linux 下 GPU 加速与 Qt 事件循环经常冲突导致崩溃或黑屏，建议禁用
    config.addCommandLineSwitchWithValue("disable-gpu", "1");
    config.addCommandLineSwitchWithValue("disable-gpu-compositing", "1");

    // 显式指定 ozone 平台为 x11 (如果你的环境是 Wayland，CEF 经常出问题，强制 x11 更稳)
    config.addCommandLineSwitchWithValue("ozone-platform", "x11");
#endif

    QApplication a(argc, argv);
    QCefContext cefContext(&a, argc, argv, &config);
    a.setOrganizationName(Constants::ORG_NAME);
    a.setApplicationName(Constants::APP_NAME);

    // init path
    auto& paths = clan::core::PathManager::instance();
    clan::core::ConfigManager::instance().load(paths.config_dir().string());

    const int log_count = 1132;
    // clang-format off
    clan::core::Log::instance().init({
        .use_async = true,
        .log_dir = paths.log_dir(),
        .log_name = Constants::APP_NAME.toStdString(),
    });
    // clang-format on

    // setup_crashpad();

    clan::core::Log::instance().set_level(spdlog::level::trace);

    // benchmark("vim-commentarySync + Rotating", log_count);

    clan::core::ConfigManager::instance().load((paths.config_dir() / "settings.ini").string());

    // 使用版本信息
    LOGINFO("Starting {} version {}",
            Constants::APP_NAME.toStdString(),
            clan::version::kVersionString.data());
    LOGINFO("exe path: {}", paths.executable_path().string());
    LOGINFO("data path: {}", paths.data_dir().string());
    LOGINFO("executable_dir : {}", paths.executable_dir().string());
    LOGINFO("cache_dir : {}", paths.cache_dir().string());
    LOGINFO("log_dir : {}", paths.log_dir().string());
    LOGINFO("crash_dir : {}", paths.crash_dir().string());
    LOGINFO("machine_config_dir : {}", paths.machine_config_dir().string());
    LOGINFO("resources_dir : {}", paths.resources_dir().string());

    // 2. 使用任務管理器執行異步任務
    // std::stringstream ss;
    // ss << std::this_thread::get_id();
    // LOGINFO("主線程ID: {}", ss.str());
    // clan::core::TaskManager::instance().enqueue([]() {
    //     LOGINFO("這是一個來自後台線程的問候！線程ID: {}",
    //             std::hash<std::thread::id>{}(std::this_thread::get_id()));
    // });

    // 3. 使用網絡管理器獲取數據
    // clan::core::NetworkManager::instance().get(
    //     "https://jsonplaceholder.typicode.com", "/todos/1", [](bool success, const json& data) {
    //         if (success) {
    //             LOGINFO("網絡請求成功，獲取標題: {}", data["title"].get<std::string>());
    //             // 【關鍵】如果要在回調中更新UI，必須使用Qt的機制切回主線程
    //             // QMetaObject::invokeMethod(...);
    //         } else {
    //             LOGERROR("網絡請求失敗: {}", data["error"].get<std::string>());
    //         }
    //     });

    const QLocale currentLocale = QLocale::system();
    // const QLocale currentLocale("zh_CN");
    // 2. 设置默认 Locale (这对日期、数字格式化很重要)
    QLocale::setDefault(currentLocale);

    // 3. 加载翻译
    QTranslator translator;
    std::filesystem::path transDir = paths.resources_dir() / "translations";
    QString transPath = QString::fromStdString(transDir.string());

    // 4. 智能加载
    // 参数含义: (Locale对象, 前缀名, 分隔符, 目录)
    // 逻辑: 如果 currentLocale 是 "zh_CN"，它会按顺序尝试加载：
    //      1. bin/resources/translations/clan-memory_zh_CN.qm
    //      2. bin/resources/translations/clan-memory_zh.qm  <-- 你的 CMake 生成的是这个
    //      3. bin/resources/translations/clan-memory.qm
    if (translator.load(currentLocale, "clan-memory", "_", transPath)) {
        QCoreApplication::installTranslator(&translator);
        qDebug() << "Successfully loaded translations for:" << currentLocale.name();
    } else {
        qWarning() << "Failed to load translations for:" << currentLocale.name() << "from"
                   << transPath;
    }

    Logger::instance().log("Application starting...");

    // db
    // 1. 确定数据库路径 (存放在 AppData/Local/ClanMemory 下)
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    QDir dir(dataPath);
    if (!dir.exists())
        dir.mkpath(".");
    QString dbPath = dir.filePath("clan.db");

    // 2. 初始化数据库
    auto& db = clan::core::DatabaseManager::instance();
    db.Initialize(dbPath.toStdString());

    // 3. 插入丰富的产品级数据
    // 注意：SaveMember 会自动处理更新，所以每次运行都不会重复插入
    db.SaveMember({.id = "1",
                   .name = "爷爷(一世)",
                   .gender = "M",
                   .generation = 1,
                   .mate_name = "奶奶",
                   .birth_date = "1930-01-01",
                   .birth_place = "福建老家",
                   .bio = "家族迁徙第一人，勤劳勇敢..."});

    db.SaveMember({.id = "2",
                   .name = "父亲",
                   .gender = "M",
                   .generation = 2,
                   .father_id = "1",
                   .mate_name = "母亲",
                   .birth_date = "1960-05-20",
                   .bio = "虽然话不多，但..."});

    db.SaveMember({.id = "3",
                   .name = "我",
                   .gender = "M",
                   .generation = 3,
                   .father_id = "2",
                   .birth_date = "1990-10-10",
                   .portrait_path = "/home/karl/Documents/aa.png",  // 之后我们可以换成本地路径
                   .bio = "这是我的数字记忆。"});
    int result = 0;
    {
        MainWindow w;
        w.show();
        Logger::instance().log("Main window shown.");
        result = a.exec();
    }
    clan::core::Log::instance().deinit();
    return result;
}
