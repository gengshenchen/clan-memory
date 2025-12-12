# 定义一个名为Core的静态库(STATIC)或动态库(SHARED)
add_library(Core STATIC
    Logger.cpp
    platform/path_manager.cc
    log/log.cc
    crash/crashpad_handler.cc
    config/config_manager.cc
    task/task_manager.cc
    network/network_manager.cc
    db/database_manager.cc
)
# 為Core庫的目標添加編譯定義，以開啟httplib的SSL功能。
# 這等效於在編譯所有Core庫的源文件時，都加上 -DCPPHTTPLIB_OPENSSL_SUPPORT 編譯選項。
target_compile_definitions(Core PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)

# Core库需要链接Shared库来获取常量定义，并链接Qt6::Core来使用QObject等
target_link_libraries(Core PUBLIC
    spdlog::spdlog
    SimpleIni::SimpleIni
    Taskflow
    nlohmann_json::nlohmann_json
    httplib::httplib
    OpenSSL::SSL
    OpenSSL::Crypto
    Shared
    Qt6::Core

    SQLiteCpp
    sqlite3
    $<$<PLATFORM_ID:Linux>:pthread>
    $<$<PLATFORM_ID:Linux>:dl>
)
# crashpad 相关库（PRIVATE 依赖）
target_link_libraries(Core PRIVATE
    crashpad::crashpad
)

# 暴露头文件目录
target_include_directories(Core PUBLIC
    ${PROJECT_SOURCE_DIR}/src
    ${PROJECT_SOURCE_DIR}/3rdparty
)


