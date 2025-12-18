#include <fstream>
#include <future>

#include "gtest/gtest.h"

// 引入所有我們要測試的類
#include "core/config/config_manager.h"
#include "core/log/log.h"
#include "core/network/network_manager.h"
#include "core/platform/path_manager.h"
#include "core/task/task_manager.h"
#include "shared/Constants.h"
// 使用我們的命名空間
using namespace clan::core;

// 創建一個測試夾具，用於初始化和清理工作
class CoreManagersTest : public testing::Test {
  protected:
    // 在所有測試用例開始前，執行一次
    static void SetUpTestSuite() {
        // 初始化日誌
        auto& paths = clan::core::PathManager::instance();
        clan::core::Log::instance().init({
            .use_async = true,
            .log_dir = paths.log_dir(),
            .log_name = Constants::APP_NAME.toStdString(),
        });
    }

    // 在所有測試用例結束後，執行一次
    static void TearDownTestSuite() {}

    // 每個測試用例執行前後，都可以進行設置和清理
    void SetUp() override {
        // 創建一個臨時的配置文件用於測試
        test_ini_path_ = "test_config.ini";
        std::ofstream test_ini(test_ini_path_);
        test_ini << "[Network]\n"
                 << "DefaultUrl = https://httpbin.org\n";
        test_ini.close();
    }

    void TearDown() override { std::remove(test_ini_path_.c_str()); }

    std::string test_ini_path_;
};

// --- 開始測試 ---

TEST_F(CoreManagersTest, PathManagerReturnsValidPaths) {
    auto& paths = PathManager::instance();
    EXPECT_FALSE(paths.config_dir().empty());
    EXPECT_FALSE(paths.data_dir().empty());
    // 簡單驗證路徑是否以應用名結尾
    EXPECT_EQ(paths.config_dir().filename().string(), Constants::APP_NAME.toStdString());
}

TEST_F(CoreManagersTest, ConfigManagerReadsAndWrites) {
    auto& config = ConfigManager::instance();

    // 1. 測試讀取
    ASSERT_TRUE(config.load(test_ini_path_));
    EXPECT_EQ(config.getString("Network", "DefaultUrl", ""), "https://httpbin.org");

    // 2. 測試寫入和保存
    config.setString("User", "Name", "Karl");
    config.save();

    // 3. 創建一個新的ConfigManager實例來重新加載，驗證持久化
    clan::core::ConfigManager::instance().load(test_ini_path_);
    EXPECT_EQ(clan::core::ConfigManager::instance().getString("User", "Name", ""),
              "Karl");
}

TEST_F(CoreManagersTest, TaskManagerAsyncReturnsFuture) {
    std::future<int> future_result = TaskManager::instance().async([]() { return 42; });
    EXPECT_EQ(future_result.get(), 42);
}
// 不使用測試夾具 TEST_F
TEST(karltaskflow, TaskManagerTaskflow) {
    std::vector<int> execution_order;
    std::mutex mtx;  // 用於保護 execution_order

    tf::Taskflow taskflow;

    // 創建三個任務，每個任務都會在執行時，線程安全地記錄自己的標識
    auto [A, B, C] = taskflow.emplace(
        [&]() {
            std::scoped_lock lock(mtx);
            execution_order.push_back(1);
        },
        [&]() {
            std::scoped_lock lock(mtx);
            execution_order.push_back(2);
        },
        [&]() {
            std::scoped_lock lock(mtx);
            execution_order.push_back(3);
        });

    // 定義依賴關係：A -> B -> C
    A.precede(B);
    B.precede(C);

    // 運行圖譜並等待完成
    TaskManager::instance().executor().run(taskflow).get();

    // 驗證執行順序是否嚴格為 1, 2, 3
    ASSERT_EQ(execution_order.size(), 3);
    EXPECT_EQ(execution_order[0], 1);
    EXPECT_EQ(execution_order[1], 2);
    EXPECT_EQ(execution_order[2], 3);

    // LOGINFO("--- kkkkkkarl Taskflow 線性依賴 測試通過 ---");
}

TEST_F(CoreManagersTest, NetworkManagerPostRequest) {
    std::promise<json> response_promise;
    std::future<json> response_future = response_promise.get_future();

    json post_body = {{"user", "test"}};

    NetworkManager::instance().post(
        "https://httpbin.org",
        "/post",
        post_body,
        [&response_promise](bool success, const json& data) {
            if (success) {
                response_promise.set_value(data);
            } else {
                response_promise.set_value({{"test_error", data.value("error", "Unknown error")}});
            }
        });

    auto status = response_future.wait_for(std::chrono::seconds(30));
    ASSERT_NE(status, std::future_status::timeout) << "網絡請求超時！";

    json result_data = response_future.get();
    ASSERT_TRUE(result_data.contains("json"));
    EXPECT_EQ(result_data["json"].value("user", ""), "test");
}
