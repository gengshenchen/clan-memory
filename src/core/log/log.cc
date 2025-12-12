// log.cpp
#include "log.h"

#include <filesystem>

#include "spdlog/spdlog.h"

namespace qt_app_template::core {

Log& Log::instance() {
    static Log inst;
    return inst;
}

void Log::init(const LogConfig& config_in) {
    LogConfig config = config_in;
#ifdef NDEBUG
    config.console = true;
#endif

    namespace fs = std::filesystem;
    fs::create_directories(config.log_dir);

    std::vector<spdlog::sink_ptr> sinks;
    if (config.console) {
        auto console_sink = std::make_shared<spdlog::sinks::stdout_color_sink_mt>();
        console_sink->set_level(config.level);
        sinks.push_back(console_sink);
    }
    if (config.daily) {
        auto daily_sink = std::make_shared<spdlog::sinks::daily_file_sink_mt>(
            config.log_dir + "/" + config.log_name + ".log",
            config.daily_hour,
            config.daily_minute);
        daily_sink->set_level(config.level);
        sinks.push_back(daily_sink);
    }
    if (config.rotating) {
        auto rotating_sink = std::make_shared<spdlog::sinks::rotating_file_sink_mt>(
            config.log_dir + "/" + config.log_name + ".rotating.log",
            config.rotating_max_size,
            config.rotating_max_files);
        rotating_sink->set_level(config.level);
        sinks.push_back(rotating_sink);
    }

    if (config.use_async) {
        size_t queue_size = 8192;
        size_t thread_count = 1;
        spdlog::init_thread_pool(queue_size, thread_count);
        logger_ = std::make_shared<spdlog::async_logger>(config.log_name,
                                                         sinks.begin(),
                                                         sinks.end(),
                                                         spdlog::thread_pool(),
                                                         spdlog::async_overflow_policy::block);
        spdlog::flush_every(std::chrono::seconds(3));

    } else {
        logger_ = std::make_shared<spdlog::logger>(config.log_name, sinks.begin(), sinks.end());
    }

    logger_->set_level(config.level);
    logger_->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [%t] [%s:%#] %v");
    spdlog::register_logger(logger_);
    logger_->flush_on(spdlog::level::err);
}

void Log::set_level(spdlog::level::level_enum level) {
    if (logger_)
        logger_->set_level(level);
}
void Log::flush() {
    if (logger_)
        logger_->flush();
}
void Log::deinit() {
    spdlog::shutdown();
}

}  // namespace qt_app_template::core

