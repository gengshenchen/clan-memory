#include "js_bridge.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMessageBox>
#include <QImage>
#include <QBuffer>
#include <QFileInfo>
#include <QDir>
#include <QFileDialog>
#include <QApplication>
#include <QStandardPaths>

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
    if (memberId.isEmpty()) return "{\"error\": \"No member ID\"}";

    QString filter;
    if (type == "video") filter = "Videos (*.mp4 *.avi *.mov *.mkv *.webm)";
    else if (type == "photo") filter = "Images (*.png *.jpg *.jpeg *.bmp)";
    else if (type == "audio") filter = "Audio (*.mp3 *.wav *.aac)";

    QString filePath = QFileDialog::getOpenFileName(
        nullptr,
        QString("Select %1 for Import").arg(type),
        QDir::homePath(),
        filter
    );

    if (filePath.isEmpty()) return "{\"status\": \"cancelled\"}";

    auto res = clan::core::ResourceManager::instance().ImportFile(
        filePath.toStdString(),
        memberId.toStdString(),
        type.toStdString()
    );

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
    auto list = clan::core::DatabaseManager::instance().GetMediaResources(
        memberId.toStdString(), type.toStdString()
    );

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
        return; // 用户取消了选择
    }

    // 2. 更新数据库
    // 注意：DatabaseManager 需要支持 UpdateMemberPortrait 方法
    bool success =clan::core::DatabaseManager::instance().UpdateMemberPortrait(
        memberId.toStdString(),
        fileName.toStdString()
    );

    if (success) {
        qDebug() << "Portrait updated for member:" << memberId << "Path:" << fileName;

        // 3. 关键步骤：主动刷新前端的成员详情
        // 这会触发前端的 onMemberDetailReceived 回调，从而更新头像显示
        fetchMemberDetail(memberId);
    } else {
        qWarning() << "Failed to update portrait in database.";
    }
}
