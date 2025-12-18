#include "js_bridge.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMessageBox>
#include <QImage>
#include <QBuffer>
#include <QFileInfo>

#include "core/db/database_manager.h"
#include "core/log/log.h"
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
        // 列表页通常不需要展示生平 bio，但如果有头像可以展示
        jobj["mate_name"] = QString::fromStdString(m.mate_name);
        jobj["gender"] = QString::fromStdString(m.gender);
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
    // 基础信息
    jobj["id"] = QString::fromStdString(m.id);
    jobj["name"] = QString::fromStdString(m.name);
    jobj["gender"] = QString::fromStdString(m.gender);
    jobj["generation"] = m.generation;

    // 亲属关系
    jobj["parentId"] = QString::fromStdString(m.father_id);
    jobj["motherId"] = QString::fromStdString(m.mother_id); // 新增
    jobj["mateName"] = QString::fromStdString(m.mate_name); // 注意前端用驼峰 mateName

    // 时间地点 (新增)
    jobj["birthDate"] = QString::fromStdString(m.birth_date);
    jobj["deathDate"] = QString::fromStdString(m.death_date);
    jobj["birthPlace"] = QString::fromStdString(m.birth_place);
    jobj["deathPlace"] = QString::fromStdString(m.death_place);

    // 媒体与生平 (新增)
    jobj["portraitPath"] = QString::fromStdString(m.portrait_path);
    jobj["bio"] = QString::fromStdString(m.bio);

    QJsonDocument doc(jobj);
    return doc.toJson(QJsonDocument::Compact);
}

QString JsBridge::getLocalImage(const QString& filePath) {
    // 1. 简单校验
    if (filePath.isEmpty() || filePath.startsWith("http")) {
        return ""; //如果是网络图片，前端直接加载，不需要 C++ 处理
    }

    QFileInfo fileInfo(filePath);
    if (!fileInfo.exists()) {
        qWarning() << "Image file not found:" << filePath;
        return "";
    }

    // 2. 加载图片
    QImage image(filePath);
    if (image.isNull()) {
        qWarning() << "Failed to load image:" << filePath;
        return "";
    }

    // 3. 【产品思维】性能优化：自动压缩
    // 如果原图很大（例如 > 500px），压缩到 500px 宽，保证加载速度
    // 对于详情页头像，500px 足够清晰了
    if (image.width() > 500) {
        image = image.scaledToWidth(500, Qt::SmoothTransformation);
    }

    // 4. 转为 Base64
    QByteArray byteArray;
    QBuffer buffer(&byteArray);
    buffer.open(QIODevice::WriteOnly);
    // 统一转为 PNG 或 JPG 格式，这里用 PNG 支持透明
    image.save(&buffer, "PNG");
    QString base64 = byteArray.toBase64();

    // 5. 拼接成前端可用的 Data URI Scheme
    return QString("data:image/png;base64,%1").arg(base64);
}
