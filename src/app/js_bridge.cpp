#include "js_bridge.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMessageBox>
#include <QImage>
#include <QBuffer>
#include <QFileInfo>
#include <QDir>

#include "core/db/database_manager.h"
#include "core/log/log.h"
#include "core/platform/path_manager.h"

JsBridge::JsBridge(QObject* parent)
    : QObject(parent) {
}

void JsBridge::test(const QString& message) {
    LOGINFO("Message from JS: {}", message.toStdString());
    QMessageBox::information(nullptr, "Message from JS", message);
}

QString JsBridge::fetchFamilyTree() {
    auto& db = clan::core::DatabaseManager::instance();
    auto members = db.GetAllMembers();

    QJsonArray jsonArray;
    for (const auto& m : members) {
        QJsonObject jobj;
        jobj["id"] = QString::fromStdString(m.id);
        jobj["name"] = QString::fromStdString(m.name);
        jobj["parentId"] = QString::fromStdString(m.father_id);
        jobj["generation"] = m.generation;

        // 【新增】字辈 (用于树状图节点显示，比如 "第12世(定)")
        jobj["generationName"] = QString::fromStdString(m.generation_name);

        // 列表页需要的概要信息
        jobj["mateName"] = QString::fromStdString(m.spouse_name);
        jobj["gender"] = QString::fromStdString(m.gender);

        // 【新增】简要生卒年，方便树上显示 (如 "1920-2010")
        QString lifeSpan;
        if (!m.birth_date.empty()) {
            lifeSpan = QString::fromStdString(m.birth_date).left(4); // 只取年份
            if (!m.death_date.empty()) {
                lifeSpan += "-" + QString::fromStdString(m.death_date).left(4);
            }
        }
        jobj["lifeSpan"] = lifeSpan;

        jsonArray.append(jobj);
    }

    QJsonDocument doc(jsonArray);
    return doc.toJson(QJsonDocument::Compact);
}

QString JsBridge::fetchMemberDetail(const QString& id) {
    auto& db = clan::core::DatabaseManager::instance();
    auto m = db.GetMemberById(id.toStdString());

    if (m.id.empty()) {
        return "null";
    }

    QJsonObject jobj;
    // --- 基础信息 ---
    jobj["id"] = QString::fromStdString(m.id);
    jobj["name"] = QString::fromStdString(m.name);
    jobj["gender"] = QString::fromStdString(m.gender);
    jobj["generation"] = m.generation;
    jobj["generationName"] = QString::fromStdString(m.generation_name); // 新增

    // --- 亲属关系 ---
    jobj["parentId"] = QString::fromStdString(m.father_id);
    jobj["motherId"] = QString::fromStdString(m.mother_id); // 新增
    jobj["mateName"] = QString::fromStdString(m.spouse_name);

    // --- 时空信息 (新增) ---
    jobj["birthDate"] = QString::fromStdString(m.birth_date);
    jobj["deathDate"] = QString::fromStdString(m.death_date);
    jobj["birthPlace"] = QString::fromStdString(m.birth_place);
    jobj["deathPlace"] = QString::fromStdString(m.death_place);

    // --- 媒体与生平 ---
    // 注意：portraitPath 可能是相对路径，也可能是绝对路径
    // 如果是相对路径 (如 "media/images/xxx.jpg")，前端暂时无法直接读取
    // 需要后续 SchemeHandler 支持。目前 v0.5 阶段我们先透传路径。
    jobj["portraitPath"] = QString::fromStdString(m.portrait_path);
    jobj["bio"] = QString::fromStdString(m.bio);

    QJsonDocument doc(jobj);
    return doc.toJson(QJsonDocument::Compact);
}

QString JsBridge::getLocalImage(const QString& filePath) {
    if (filePath.isEmpty() || filePath.startsWith("http")) {
        return "";
    }

    // 处理相对路径逻辑
    // 如果数据库存的是 "media/images/photo.jpg"，我们需要拼接完整路径
    QString realPath = filePath;
    QFileInfo fileInfo(realPath);

    // 如果是相对路径，尝试去 resources 目录下找
    if (fileInfo.isRelative()) {
        auto& paths = clan::core::PathManager::instance();
        std::filesystem::path resDir = paths.resources_dir();
        std::filesystem::path absPath = resDir / filePath.toStdString();
        realPath = QString::fromStdString(absPath.string());
    }

    QFileInfo finalInfo(realPath);
    if (!finalInfo.exists()) {
        qWarning() << "[JsBridge] Image file not found:" << realPath;
        return "";
    }

    QImage image(realPath);
    if (image.isNull()) {
        qWarning() << "[JsBridge] Failed to load image:" << realPath;
        return "";
    }

    // 性能优化：详情页头像压缩到 500px
    if (image.width() > 500) {
        image = image.scaledToWidth(500, Qt::SmoothTransformation);
    }

    QByteArray byteArray;
    QBuffer buffer(&byteArray);
    buffer.open(QIODevice::WriteOnly);
    image.save(&buffer, "PNG");
    QString base64 = byteArray.toBase64();

    return QString("data:image/png;base64,%1").arg(base64);
}

QString JsBridge::searchMembers(const QString& keyword) {
    if (keyword.trimmed().isEmpty()) {
        return "[]";
    }

    auto& db = clan::core::DatabaseManager::instance();
    // 调用我们在 DatabaseManager 中实现的混合搜索策略
    auto results = db.SearchMembers(keyword.toStdString());

    QJsonArray jsonArray;
    for (const auto& m : results) {
        QJsonObject jobj;
        jobj["id"] = QString::fromStdString(m.id);
        jobj["name"] = QString::fromStdString(m.name);
        jobj["generation"] = m.generation;

        // 截取生平的一小段作为摘要 (Snippet)
        QString bio = QString::fromStdString(m.bio);
        if (bio.length() > 50) {
            bio = bio.left(50) + "...";
        }
        jobj["bioSnippet"] = bio;

        jsonArray.append(jobj);
    }

    QJsonDocument doc(jsonArray);
    return doc.toJson(QJsonDocument::Compact);
}
