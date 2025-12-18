#pragma once

#include <spdlog/async.h>
#include <spdlog/async_logger.h>
#include <spdlog/fmt/ostr.h>
#include <spdlog/logger.h>
#include <spdlog/pattern_formatter.h>
#include <spdlog/sinks/daily_file_sink.h>
#include <spdlog/sinks/rotating_file_sink.h>
#include <spdlog/sinks/stdout_color_sinks.h>
#include <spdlog/spdlog.h>

#include <memory>
#include <string>

namespace clan::core {

struct LogConfig {
    bool use_async = false;
    bool console = true;
    bool daily = false;
    bool rotating = true;
    std::string log_dir = "logs";
    std::string log_name = "application";

    spdlog::level::level_enum level = spdlog::level::trace;

    size_t rotating_max_size = 1048576 * 5;  // 5 MB
    size_t rotating_max_files = 3;

    int daily_hour = 0;
    int daily_minute = 0;
};

class Log {
public:
    static Log& instance();

    void init(const LogConfig& config);
    void deinit();
    void set_level(spdlog::level::level_enum level);
    void flush();
    std::shared_ptr<spdlog::logger> logger() const { return logger_; }

private:
    Log() = default;
    ~Log() = default;
    Log(const Log&) = delete;
    Log& operator=(const Log&) = delete;

    std::shared_ptr<spdlog::logger> logger_;
};

}  // namespace clan::core

// -------------------- 宏定义 --------------------

// 推荐：用 SPDLOG_LOGGER_CALL 以便未来加 __FILE__/__LINE__
#define LOGTRACE(...)   \
    SPDLOG_LOGGER_CALL( \
        clan::core::Log::instance().logger(), spdlog::level::trace, __VA_ARGS__)
#define LOGDEBUG(...)   \
    SPDLOG_LOGGER_CALL( \
        clan::core::Log::instance().logger(), spdlog::level::debug, __VA_ARGS__)
#define LOGINFO(...)    \
    SPDLOG_LOGGER_CALL( \
        clan::core::Log::instance().logger(), spdlog::level::info, __VA_ARGS__)
#define LOGWARN(...)    \
    SPDLOG_LOGGER_CALL( \
        clan::core::Log::instance().logger(), spdlog::level::warn, __VA_ARGS__)
#define LOGERROR(...)   \
    SPDLOG_LOGGER_CALL( \
        clan::core::Log::instance().logger(), spdlog::level::err, __VA_ARGS__)
#define LOGCRITICAL(...) \
    SPDLOG_LOGGER_CALL(  \
        clan::core::Log::instance().logger(), spdlog::level::critical, __VA_ARGS__)

