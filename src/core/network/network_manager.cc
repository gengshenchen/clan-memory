#include "network_manager.h"

#include <QCoreApplication>
#include <QFile>
#include <QTemporaryFile>

#include "cpp-httplib/httplib.h"
#include "log/log.h"  // 使用日誌
#include "platform/path_manager.h"
#include "task/task_manager.h"  // 我們將使用自己的任務管理器
namespace clan::core {

NetworkManager& NetworkManager::instance() {
    static NetworkManager instance;
    return instance;
}

void NetworkManager::get(const std::string& host, const std::string& path,
                         HttpResponseCallback callback) {
    // 將網絡請求提交到我們的任務管理器中，在後台線程執行
    clan::core::TaskManager::instance().enqueue([host, path, callback]() {
        try {
            // 為HTTPS創建客戶端，注意需要OpenSSL依賴  #TODO openssl
            httplib::Client cli(host);
            // 需要CA證書文件
            auto& paths = clan::core::PathManager::instance();
            cli.set_ca_cert_path(paths.resources_dir().string() + "/certs/cacert.pem");
            // Disable cert verification
            cli.enable_server_certificate_verification(true);

            cli.set_proxy("127.0.0.1", 7897);

            auto res = cli.Get(path.c_str());
            LOGTRACE("    Response Body: {}", res->body);
            if (res && res->status == 200) {
                LOGINFO("FUCKING OKOKOKOKOKOKOKOKOKOK");
                callback(true, json::parse(res->body));
            } else {
                LOGERROR("FUCKING NGNGNG");
                std::string error_msg = res ? httplib::to_string(res.error()) : "Request failed";
                LOGERROR("HTTP GET failed for {}{}: {}", host, path, error_msg);
                callback(false, {{"error", error_msg}});
            }
        } catch (const std::exception& e) {
            LOGERROR("HTTP GET exception for {}{}: {}", host, path, e.what());
            callback(false, {{"error", e.what()}});
        }
    });
}

void NetworkManager::post(const std::string& host, const std::string& path, const json& body,
                          HttpResponseCallback callback) {
    TaskManager::instance().enqueue([host, path, body, callback]() {
        try {
            httplib::Client cli(host);

            auto& paths = clan::core::PathManager::instance();
            cli.set_ca_cert_path(paths.resources_dir().string() + "/certs/cacert.pem");
            cli.enable_server_certificate_verification(true);

            auto res = cli.Post(path.c_str(), body.dump(), "application/json");

            if (res && res->status == 200) {
                callback(true, json::parse(res->body));
            } else {
                std::string error_msg = res ? httplib::to_string(res.error()) : "Request failed";
                LOGERROR("HTTP POST failed for {}{}: {}", host, path, error_msg);
                callback(false, {{"error", error_msg}});
            }
        } catch (const std::exception& e) {
            LOGERROR("HTTP POST exception for {}{}: {}", host, path, e.what());
            callback(false, {{"error", e.what()}});
        }
    });
}
}  // namespace clan::core
