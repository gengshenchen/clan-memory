#pragma once  // 防止头文件被重复包含
#include <openssl/ssl.h>

#include <QString>

// 使用命名空间来组织常量，避免全局污染
namespace Constants {
const QString ORG_NAME = "dong-xiong-community";
const QString APP_NAME = "clan-memory";
}  // namespace Constants

