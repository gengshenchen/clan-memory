#pragma once

#include <QObject>

class JsBridge : public QObject {
    Q_OBJECT
public:
    explicit JsBridge(QObject* parent = nullptr);

public slots:
    void test(const QString& message);
    QString fetchFamilyTree();
};
