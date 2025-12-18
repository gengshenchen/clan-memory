#pragma once
#include <functional>
#include <string>

#include "json/single_include/nlohmann/json.hpp"

// 使用nlohmann::json作為數據類型別名
using json = nlohmann::json;

// 定義一個回調函數類型，用於處理網絡請求的結果
using HttpResponseCallback = std::function<void(bool success, const json& data)>;
namespace clan::core {
class NetworkManager {
public:
    static NetworkManager& instance();

    // 異步發送GET請求
    void get(const std::string& host, const std::string& path, HttpResponseCallback callback);

    // 異步發送POST請求
    void post(const std::string& host, const std::string& path, const json& body,
              HttpResponseCallback callback);

private:
    NetworkManager() = default;
    NetworkManager(const NetworkManager&) = delete;
    NetworkManager& operator=(const NetworkManager&) = delete;
};
}  // namespace clan::core

