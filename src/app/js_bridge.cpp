#include "js_bridge.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QMessageBox>

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
    // 1. 从 Core 层获取纯 C++ 数据
    auto members = qt_app_template::core::DatabaseManager::instance().GetAllMembers();

    // 2. 转换为 Qt JSON 格式
    QJsonArray jsonArray;
    for (const auto& m : members) {
        QJsonObject obj;
        obj["id"] = QString::fromStdString(m.id);
        obj["name"] = QString::fromStdString(m.name);
        obj["parentId"] = QString::fromStdString(m.father_id);  // D3.js 需要 parentId
        obj["generation"] = m.generation;
        jsonArray.append(obj);
    }

    // 3. 转为字符串返回
    QJsonDocument doc(jsonArray);
    QString jsonStr = doc.toJson(QJsonDocument::Compact);

    qDebug() << "Sending to Frontend:" << jsonStr;  // 方便调试
    return jsonStr;
};
