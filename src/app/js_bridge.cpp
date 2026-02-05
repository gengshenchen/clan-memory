#include "js_bridge.h"

#include <QApplication>
#include <QBuffer>
#include <QDir>
#include <QFileDialog>
#include <QFileInfo>
#include <QImage>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMessageBox>
#include <QStandardPaths>
#include <QUuid>

#include "core/db/database_manager.h"
#include "core/log/log.h"
#include "core/platform/path_manager.h"
#include "core/resource/resource_manager.h"

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
        jobj["generationName"] = QString::fromStdString(m.generation_name);
        jobj["spouseName"] = QString::fromStdString(m.spouse_name);
        jobj["gender"] = QString::fromStdString(m.gender);
        jobj["portraitPath"] = QString::fromStdString(m.portrait_path);

        QString lifeSpan;
        if (!m.birth_date.empty()) {
            lifeSpan = QString::fromStdString(m.birth_date).left(4);
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
    jobj["id"] = QString::fromStdString(m.id);
    jobj["name"] = QString::fromStdString(m.name);
    jobj["gender"] = QString::fromStdString(m.gender);
    jobj["generation"] = m.generation;
    jobj["generationName"] = QString::fromStdString(m.generation_name);
    jobj["parentId"] = QString::fromStdString(m.father_id);
    jobj["motherId"] = QString::fromStdString(m.mother_id);
    jobj["spouseName"] = QString::fromStdString(m.spouse_name);
    jobj["birthDate"] = QString::fromStdString(m.birth_date);
    jobj["deathDate"] = QString::fromStdString(m.death_date);
    jobj["birthPlace"] = QString::fromStdString(m.birth_place);
    jobj["deathPlace"] = QString::fromStdString(m.death_place);
    jobj["portraitPath"] = QString::fromStdString(m.portrait_path);
    jobj["bio"] = QString::fromStdString(m.bio);

    QJsonDocument doc(jobj);
    return doc.toJson(QJsonDocument::Compact);
}

QString JsBridge::getLocalImage(const QString& filePath) {
    if (filePath.isEmpty() || filePath.startsWith("http")) {
        return "";
    }

    QString realPath = filePath;
    QFileInfo fileInfo(realPath);

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
        return "";
    }

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
    auto results = db.SearchMembers(keyword.toStdString());

    QJsonArray jsonArray;
    for (const auto& m : results) {
        QJsonObject jobj;
        jobj["id"] = QString::fromStdString(m.id);
        jobj["name"] = QString::fromStdString(m.name);
        jobj["generation"] = m.generation;
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

QString JsBridge::importResource(const QString& memberId, const QString& type) {
    if (memberId.isEmpty())
        return "{\"error\": \"No member ID\"}";

    QString filter;
    if (type == "video")
        filter = "Videos (*.mp4 *.avi *.mov *.mkv *.webm)";
    else if (type == "photo")
        filter = "Images (*.png *.jpg *.jpeg *.bmp)";
    else if (type == "audio")
        filter = "Audio (*.mp3 *.wav *.aac)";

    QString filePath = QFileDialog::getOpenFileName(
        nullptr, QString("Select %1 for Import").arg(type), QDir::homePath(), filter);

    if (filePath.isEmpty())
        return "{\"status\": \"cancelled\"}";

    auto res = clan::core::ResourceManager::instance().ImportFile(
        filePath.toStdString(), memberId.toStdString(), type.toStdString());

    if (res.id.empty()) {
        return "{\"error\": \"Import failed\"}";
    }

    QJsonObject jobj;
    jobj["id"] = QString::fromStdString(res.id);
    jobj["title"] = QString::fromStdString(res.title);
    jobj["filePath"] = QString::fromStdString(res.file_path);

    QJsonDocument doc(jobj);
    return doc.toJson(QJsonDocument::Compact);
}

QString JsBridge::fetchMemberResources(const QString& memberId, const QString& type) {
    auto list = clan::core::DatabaseManager::instance().GetMediaResources(memberId.toStdString(),
                                                                          type.toStdString());

    auto& paths = clan::core::PathManager::instance();
    std::filesystem::path mediaDir = paths.resources_dir();

    QJsonArray jsonArray;
    for (const auto& r : list) {
        QJsonObject jobj;
        jobj["id"] = QString::fromStdString(r.id);
        jobj["title"] = QString::fromStdString(r.title);
        jobj["description"] = QString::fromStdString(r.description);

        std::filesystem::path absPath = mediaDir / r.file_path;
        QString url = QUrl::fromLocalFile(QString::fromStdString(absPath.string())).toString();

        // [Added] Debug Log for URL
        qDebug() << "[JsBridge] Generated Media URL:" << url;

        jobj["url"] = url;
        jobj["type"] = QString::fromStdString(r.resource_type);

        jsonArray.append(jobj);
    }

    QJsonDocument doc(jsonArray);
    return doc.toJson(QJsonDocument::Compact);
}
QString JsBridge::deleteMediaResource(const QString& resourceId) {
    if (resourceId.isEmpty()) {
        QJsonObject result;
        result["success"] = false;
        result["error"] = "Invalid Resource ID";
        return QJsonDocument(result).toJson(QJsonDocument::Compact);
    }

    bool success =
        clan::core::DatabaseManager::instance().DeleteMediaResource(resourceId.toStdString());

    if (success) {
        clan::core::DatabaseManager::instance().AddOperationLog(
            "DELETE", "media", resourceId.toStdString(), "MediaResource", "");
    }

    QJsonObject result;
    result["success"] = success;
    return QJsonDocument(result).toJson(QJsonDocument::Compact);
}

void JsBridge::updateMemberPortrait(const QString& memberId) {
    if (memberId.isEmpty()) {
        return;
    }

    // 1. 打开原生文件选择对话框
    // 限制只能选择图片格式
    QString fileName = QFileDialog::getOpenFileName(
        nullptr,
        tr("选择头像 (Select Portrait)"),
        QStandardPaths::writableLocation(QStandardPaths::PicturesLocation),
        tr("Images (*.png *.jpg *.jpeg *.bmp)"));

    if (fileName.isEmpty()) {
        return;  // 用户取消了选择
    }

    // 2. 更新数据库
    // 注意：DatabaseManager 需要支持 UpdateMemberPortrait 方法
    bool success = clan::core::DatabaseManager::instance().UpdateMemberPortrait(
        memberId.toStdString(), fileName.toStdString());

    if (success) {
        qDebug() << "Portrait updated for member:" << memberId << "Path:" << fileName;

        // 3. 关键步骤：主动刷新前端的成员详情
        // 这会触发前端的 onMemberDetailReceived 回调，从而更新头像显示
        fetchMemberDetail(memberId);
    } else {
        qWarning() << "Failed to update portrait in database.";
    }
}

QString JsBridge::saveMember(const QString& memberJson) {
    auto& db = clan::core::DatabaseManager::instance();

    QJsonDocument doc = QJsonDocument::fromJson(memberJson.toUtf8());
    if (!doc.isObject()) {
        return "{\"error\": \"Invalid JSON\"}";
    }

    QJsonObject obj = doc.object();

    clan::core::Member m;
    m.id = obj["id"].toString().toStdString();
    m.name = obj["name"].toString().toStdString();
    m.gender = obj["gender"].toString().toStdString();
    m.generation = obj["generation"].toInt(1);
    m.generation_name = obj["generationName"].toString().toStdString();
    m.father_id = obj["parentId"].toString().toStdString();
    m.mother_id = obj["motherId"].toString().toStdString();
    m.spouse_name = obj["spouseName"].toString().toStdString();
    m.birth_date = obj["birthDate"].toString().toStdString();
    m.death_date = obj["deathDate"].toString().toStdString();
    m.birth_place = obj["birthPlace"].toString().toStdString();
    m.death_place = obj["deathPlace"].toString().toStdString();
    m.portrait_path = obj["portraitPath"].toString().toStdString();
    m.bio = obj["bio"].toString().toStdString();

    // Generate new ID if not provided
    if (m.id.empty()) {
        m.id = QUuid::createUuid().toString(QUuid::WithoutBraces).toStdString();
    }

    // Determine if this is create or update
    bool isNew = obj["isNew"].toBool(false);
    std::string action = isNew ? "CREATE" : "UPDATE";

    try {
        db.SaveMember(m);

        // Log the operation
        db.AddOperationLog(action, "member", m.id, m.name, memberJson.toStdString());

        QJsonObject result;
        result["success"] = true;
        result["id"] = QString::fromStdString(m.id);
        result["action"] = QString::fromStdString(action);

        return QJsonDocument(result).toJson(QJsonDocument::Compact);
    } catch (std::exception& e) {
        QJsonObject error;
        error["error"] = QString::fromStdString(e.what());
        return QJsonDocument(error).toJson(QJsonDocument::Compact);
    }
}

QString JsBridge::deleteMember(const QString& memberId) {
    auto& db = clan::core::DatabaseManager::instance();

    // Check for children first
    if (db.HasChildren(memberId.toStdString())) {
        QJsonObject result;
        result["success"] = false;
        result["error"] = "该成员有后代，无法删除";
        result["hasChildren"] = true;
        return QJsonDocument(result).toJson(QJsonDocument::Compact);
    }

    // Get member name for logging
    auto member = db.GetMemberById(memberId.toStdString());
    std::string memberName = member.name;

    bool success = db.DeleteMember(memberId.toStdString());

    if (success) {
        // Log the operation
        db.AddOperationLog("DELETE", "member", memberId.toStdString(), memberName, "");
    }

    QJsonObject result;
    result["success"] = success;
    if (!success) {
        result["error"] = "删除失败";
    }
    return QJsonDocument(result).toJson(QJsonDocument::Compact);
}

QString JsBridge::getSettings(const QString& key) {
    auto& db = clan::core::DatabaseManager::instance();
    std::string value = db.GetSetting(key.toStdString());

    // For generation_names, return the JSON array directly
    if (key == "generation_names" && !value.empty()) {
        return QString::fromStdString(value);
    }

    QJsonObject result;
    result["key"] = key;
    result["value"] = QString::fromStdString(value);
    return QJsonDocument(result).toJson(QJsonDocument::Compact);
}

void JsBridge::saveSettings(const QString& key, const QString& value) {
    auto& db = clan::core::DatabaseManager::instance();
    db.SaveSetting(key.toStdString(), value.toStdString());
}

QString JsBridge::getOperationLogs(int limit, int offset) {
    auto& db = clan::core::DatabaseManager::instance();
    auto logs = db.GetOperationLogs(limit, offset);

    QJsonArray jsonArray;
    for (const auto& log : logs) {
        QJsonObject obj;
        obj["id"] = log.id;
        obj["action"] = QString::fromStdString(log.action);
        obj["targetType"] = QString::fromStdString(log.target_type);
        obj["targetId"] = QString::fromStdString(log.target_id);
        obj["targetName"] = QString::fromStdString(log.target_name);
        obj["changes"] = QString::fromStdString(log.changes);
        obj["createdAt"] = static_cast<qint64>(log.created_at);
        jsonArray.append(obj);
    }

    return QJsonDocument(jsonArray).toJson(QJsonDocument::Compact);
}

QString JsBridge::selectFile(const QString& filter) {
    // Open file dialog without saving - just return path
    QString fileName = QFileDialog::getOpenFileName(
        nullptr,
        tr("选择文件 (Select File)"),
        QStandardPaths::writableLocation(QStandardPaths::PicturesLocation),
        filter.isEmpty() ? tr("Images (*.png *.jpg *.jpeg *.bmp)") : filter);

    return fileName;  // Empty if cancelled
}
