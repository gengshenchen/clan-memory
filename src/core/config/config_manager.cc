#include "config_manager.h"
namespace clan::core {
ConfigManager& ConfigManager::instance() {
    static ConfigManager instance;
    return instance;
}

ConfigManager::ConfigManager() {
    m_ini.SetUnicode();  // 支持UTF-8
}

ConfigManager::~ConfigManager() {
    if (m_isDirty) {
        save();
    }
}

bool ConfigManager::load(const std::string& file_path) {
    m_filePath = file_path;
    SI_Error rc = m_ini.LoadFile(file_path.c_str());
    return rc >= 0;
}

bool ConfigManager::save() {
    if (m_filePath.empty())
        return false;
    SI_Error rc = m_ini.SaveFile(m_filePath.c_str());
    if (rc >= 0) {
        m_isDirty = false;
    }
    return rc >= 0;
}

// Getters
std::string ConfigManager::getString(const std::string& section, const std::string& key,
                                     const std::string& default_value) {
    return m_ini.GetValue(section.c_str(), key.c_str(), default_value.c_str());
}
long ConfigManager::getLong(const std::string& section, const std::string& key,
                            long default_value) {
    return m_ini.GetLongValue(section.c_str(), key.c_str(), default_value);
}
bool ConfigManager::getBool(const std::string& section, const std::string& key,
                            bool default_value) {
    return m_ini.GetBoolValue(section.c_str(), key.c_str(), default_value);
}

// Setters
void ConfigManager::setString(const std::string& section, const std::string& key,
                              const std::string& value) {
    m_ini.SetValue(section.c_str(), key.c_str(), value.c_str());
    m_isDirty = true;
}
void ConfigManager::setLong(const std::string& section, const std::string& key, long value) {
    m_ini.SetLongValue(section.c_str(), key.c_str(), value);
    m_isDirty = true;
}
void ConfigManager::setBool(const std::string& section, const std::string& key, bool value) {
    m_ini.SetBoolValue(section.c_str(), key.c_str(), value);
    m_isDirty = true;
}

}  // namespace clan::core

