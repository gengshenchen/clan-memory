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
};
