#pragma once
// 在包含 taskflow 头文件之前，检查是否定义了 signals 宏。
// 如果定义了，就用 #undef 取消它的定义。
// 这可以防止Qt的宏污染到taskflow的内部实现。
#ifdef signals
#undef signals
#endif

#include <functional>
#include <future>

#include "taskflow/taskflow.hpp"

namespace clan::core {
class TaskManager {
  public:
    static TaskManager& instance();

    // 提交一個無需返回值的任務到隊列中執行
    void enqueue(std::function<void()> task);

    // 提交一個帶返回值的任務，並返回一個future以便將來獲取結果
    template <typename F, typename... Args>
    auto async(F&& f, Args&&... args) -> std::future<decltype(f(args...))> {
        return executor_.async(std::forward<F>(f), std::forward<Args>(args)...);
    }
    tf::Executor& executor() { return executor_; } 
  private:
    TaskManager();
    ~TaskManager();
    TaskManager(const TaskManager&) = delete;
    TaskManager& operator=(const TaskManager&) = delete;

    tf::Executor executor_;
};
}  // namespace clan::core
