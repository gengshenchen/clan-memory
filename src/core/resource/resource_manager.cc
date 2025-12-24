#include "resource_manager.h"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <iostream>
#include <chrono>

#include "core/platform/path_manager.h"
#include "core/db/database_manager.h"
#include "core/log/log.h"

namespace clan::core {

namespace fs = std::filesystem;

ResourceManager& ResourceManager::instance() {
    static ResourceManager instance;
    return instance;
}

ResourceManager::ResourceManager() {
    auto& paths = PathManager::instance();
    fs::path mediaDir = paths.resources_dir() / "media";
    if (!fs::exists(mediaDir)) {
        fs::create_directories(mediaDir);
        LOGINFO("[ResourceManager] Created media directory: {}", mediaDir.string());
    }
}

std::string ResourceManager::CalculateFileHash(const std::string& filePath) {
    fs::path p(filePath);
    if (!fs::exists(p)) return "";

    try {
        auto fileSize = fs::file_size(p);
        // [Modified] Use stem() instead of filename() to avoid double extension
        // e.g. "video.mp4" -> stem is "video"
        std::stringstream ss;
        ss << fileSize << "_" << p.stem().string();
        return ss.str();
    } catch (const std::exception& e) {
        LOGERROR("[ResourceManager] Hash calc failed: {}", e.what());
        return "";
    }
}

std::string ResourceManager::GetExtension(const std::string& path) {
    return fs::path(path).extension().string();
}

MediaResource ResourceManager::ImportFile(const std::string& originalPath,
                                          const std::string& memberId,
                                          const std::string& type) {
    MediaResource res;
    fs::path srcPath(originalPath);

    if (!fs::exists(srcPath)) {
        LOGERROR("[ResourceManager] Source file not found: {}", originalPath);
        return res;
    }

    // 1. Prepare target path
    std::string hash = CalculateFileHash(originalPath);
    std::string newFileName = hash + GetExtension(originalPath);

    auto& paths = PathManager::instance();
    fs::path mediaDir = paths.resources_dir() / "media";
    fs::path destPath = mediaDir / newFileName;

    // 2. Copy file if it doesn't exist
    if (!fs::exists(destPath)) {
        try {
            fs::copy_file(srcPath, destPath);
            LOGINFO("[ResourceManager] Copied file to: {}", destPath.string());
        } catch (const std::exception& e) {
            LOGERROR("[ResourceManager] Copy failed: {}", e.what());
            return res;
        }
    } else {
        LOGINFO("[ResourceManager] File already exists: {}", newFileName);
    }

    // 3. Construct Resource Object
    res.id = std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
    res.member_id = memberId;
    res.resource_type = type;
    res.file_path = "media/" + newFileName;
    res.title = srcPath.stem().string();
    res.file_hash = hash;
    res.file_size = fs::file_size(srcPath);

    // 4. Save to Database
    DatabaseManager::instance().AddMediaResource(res);

    return res;
}

std::vector<MediaResource> ResourceManager::GetResourcesForMember(const std::string& memberId,
                                                                  const std::string& type) {
    return DatabaseManager::instance().GetMediaResources(memberId, type);
}

} // namespace clan::core
