#pragma once

#include <string>
#include <vector>
#include <mutex>

// [Added] Forward declaration
namespace clan::core {
struct MediaResource;
// [Added] Singleton class to manage physical files and DB mapping
class ResourceManager {
public:
    static ResourceManager& instance();

    // [Added] Import a file: Copy -> Rename (Hash) -> Write to DB
    // Returns the created resource object.
    MediaResource ImportFile(const std::string& originalPath,
                             const std::string& memberId,
                             const std::string& type);

    // [Added] Retrieve all resources associated with a member
    std::vector<MediaResource> GetResourcesForMember(const std::string& memberId,
                                                     const std::string& type);

    // [Added] Calculate unique hash for file content (to prevent duplicates)
    std::string CalculateFileHash(const std::string& filePath);

private:
    ResourceManager();
    ~ResourceManager() = default;

    // [Added] Helper to get file extension
    std::string GetExtension(const std::string& path);
};

} // namespace clan::core
