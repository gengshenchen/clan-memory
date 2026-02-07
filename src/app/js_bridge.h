#pragma once

#include <QObject>

class JsBridge : public QObject {
    Q_OBJECT
public:
    explicit JsBridge(QObject* parent = nullptr);

public slots:
    Q_INVOKABLE void test(const QString& message);
    Q_INVOKABLE QString fetchFamilyTree();
    Q_INVOKABLE QString fetchMemberDetail(const QString& id);
    Q_INVOKABLE QString getLocalImage(const QString& filePath);
    Q_INVOKABLE QString searchMembers(const QString& keyword);
    Q_INVOKABLE QString importResource(const QString& memberId, const QString& type);
    Q_INVOKABLE QString fetchMemberResources(const QString& memberId, const QString& type);
    Q_INVOKABLE void updateMemberPortrait(const QString& memberId);
    Q_INVOKABLE QString deleteMediaResource(const QString& resourceId);

    // New methods for admin management
    Q_INVOKABLE QString saveMember(const QString& memberJson);
    Q_INVOKABLE QString deleteMember(const QString& memberId);
    Q_INVOKABLE QString getSettings(const QString& key);
    Q_INVOKABLE void saveSettings(const QString& key, const QString& value);
    Q_INVOKABLE QString getOperationLogs(int limit, int offset);
    Q_INVOKABLE QString selectFile(const QString& filter);

    Q_INVOKABLE QString importMultipleResources(const QString& memberId,
                                                const QString& type);  // Batch import
};
