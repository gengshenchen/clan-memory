#pragma once
#include <string>

#include "simpleini/SimpleIni.h"  // 直接包含submodule中的頭文件
namespace clan::core {
class ConfigManager {
public:
    static ConfigManager& instance();

    // 加載配置文件，應在程序啟動時調用
    bool load(const std::string& file_path);
    bool save();  // 保存修改

    std::string getString(const std::string& section, const std::string& key,
                          const std::string& default_value);
    long getLong(const std::string& section, const std::string& key, long default_value);
    bool getBool(const std::string& section, const std::string& key, bool default_value);

    void setString(const std::string& section, const std::string& key, const std::string& value);
    void setLong(const std::string& section, const std::string& key, long value);
    void setBool(const std::string& section, const std::string& key, bool value);

private:
    ConfigManager();
    ~ConfigManager();
    ConfigManager(const ConfigManager&) = delete;
    ConfigManager& operator=(const ConfigManager&) = delete;
    CSimpleIniA m_ini;
    std::string m_filePath;
    bool m_isDirty = false;
};
}  // namespace clan::core

