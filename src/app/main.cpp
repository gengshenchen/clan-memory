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
    auto& paths = qt_app_template::core::PathManager::instance();
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

    bool initialized = qt_app_template::core::CrashpadHandler::instance().initialize(
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

    QCefConfig config;
    config.setBridgeObjectName("CallBridge");
    config.setRemoteDebuggingPort(9000);
    config.setSandboxDisabled(true);
    config.addCommandLineSwitchWithValue("remote-allow-origins", "*");
    config.addCommandLineSwitchWithValue("ozone-platform", "x11");
    // config.addCommandLineSwitch("disable-gpu-compositing"); // 如果遇到黑屏，尝试禁用 GPU 合成
    QApplication a(argc, argv);

    QCefContext cefContext(&a, argc, argv, &config);

    a.setOrganizationName(Constants::ORG_NAME);
    a.setApplicationName(Constants::APP_NAME);
    // PathManager是第一個被實例化的，因為其他管理器依賴它
    auto& paths = qt_app_template::core::PathManager::instance();
    qt_app_template::core::ConfigManager::instance().load(paths.config_dir().string());

    const int log_count = 1132;
    // clang-format off
    qt_app_template::core::Log::instance().init({
        .use_async = true,
        .log_dir = paths.log_dir(),
        .log_name = Constants::APP_NAME.toStdString(),
    });
    // clang-format on
    setup_crashpad();

    qt_app_template::core::Log::instance().set_level(spdlog::level::trace);

    // benchmark("vim-commentarySync + Rotating", log_count);

    qt_app_template::core::ConfigManager::instance().load(
        (paths.config_dir() / "settings.ini").string());

    // 使用版本信息
    LOGINFO("Starting {} version {}",
            Constants::APP_NAME.toStdString(),
            qt_app_template::version::kVersionString.data());
    LOGINFO("exe path: {}", paths.executable_path().string());
    LOGINFO("data path: {}", paths.data_dir().string());
    LOGINFO("executable_dir : {}", paths.executable_dir().string());
    LOGINFO("cache_dir : {}", paths.cache_dir().string());
    LOGINFO("log_dir : {}", paths.log_dir().string());
    LOGINFO("crash_dir : {}", paths.crash_dir().string());
    LOGINFO("machine_config_dir : {}", paths.machine_config_dir().string());
    LOGINFO("resources_dir : {}", paths.resources_dir().string());
    // 2. 使用任務管理器執行異步任務
    std::stringstream ss;
    ss << std::this_thread::get_id();
    LOGINFO("主線程ID: {}", ss.str());
    qt_app_template::core::TaskManager::instance().enqueue([]() {
        LOGINFO("這是一個來自後台線程的問候！線程ID: {}",
                std::hash<std::thread::id>{}(std::this_thread::get_id()));
    });

    // 3. 使用網絡管理器獲取數據
    qt_app_template::core::NetworkManager::instance().get(
        "https://jsonplaceholder.typicode.com", "/todos/1", [](bool success, const json& data) {
            if (success) {
                LOGINFO("網絡請求成功，獲取標題: {}", data["title"].get<std::string>());
                // 【關鍵】如果要在回調中更新UI，必須使用Qt的機制切回主線程
                // QMetaObject::invokeMethod(...);
            } else {
                LOGERROR("網絡請求失敗: {}", data["error"].get<std::string>());
            }
        });
    QTranslator translator;
    // const QLocale currentLocale = QLocale();
    const QLocale currentLocale("zh_CN");
    // 2. 定义翻译文件的基础名 (与项目名一致)
    const QString baseName = QCoreApplication::applicationName();

    // 3. 定义翻译文件在资源系统中的搜索路径
    const QString path = ":/i18n/translations/";
    if (translator.load(currentLocale, baseName, "_", path)) {
        QCoreApplication::installTranslator(&translator);
        qDebug() << "Successfully loaded translation for" << currentLocale.name();
    } else {
        qDebug() << "Could not load translation for" << currentLocale.name();
    }

    Logger::instance().log("Application starting...");

    // 1. 确定数据库路径 (存放在 AppData/Local/ClanMemory 下)
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    QDir dir(dataPath);
    if (!dir.exists())
        dir.mkpath(".");
    QString dbPath = dir.filePath("clan.db");

    // 2. 初始化数据库
    auto& db = qt_app_template::core::DatabaseManager::instance();
    db.Initialize(dbPath.toStdString());

    // 3. 插入一些假数据 (测试用，之后可以注释掉)
    db.AddDummyMember({"1", "爷爷(根)", "", 1, "", "", ""});
    db.AddDummyMember({"2", "大伯", "", 2, "1", "", ""});
    db.AddDummyMember({"3", "我爸", "", 2, "1", "", ""});
    db.AddDummyMember({"4", "我", "", 3, "3", "", ""});

    MainWindow w;
    w.show();
    Logger::instance().log("Main window shown.");
    int result = a.exec();

    qt_app_template::core::Log::instance().deinit();
    return result;
}
