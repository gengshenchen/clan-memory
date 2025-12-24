#include "mainwindow.h"

#include <QCefView.h>
#include <QDir>
#include <QDirIterator>
#include <QDockWidget>
#include <QJsonDocument>
#include <QPushButton>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQuickView>
#include <QQuickWidget>
#include <QToolBar>
#include <QVBoxLayout>
#include <qlogging.h>

#include "core/Logger.h"
#include "core/log/log.h"
#include "core/platform/path_manager.h"
#include "js_bridge.h"
#include "ui_mainwindow.h"
#include "widgets/LogViewer.h"  // from gui-widgets

void printf_resource_runtime() {
    // ---  ---
    qDebug() << "=========================================================";
    qDebug() << "Listing all available application resources at runtime...";
    QDirIterator it(":", QDirIterator::Subdirectories);
    bool foundAny = false;
    while (it.hasNext()) {
        foundAny = true;
        // 打印找到的每一个资源的路径
        qDebug() << "  Found resource:" << it.next();
    }

    if (!foundAny) {
        qDebug() << "  !!! CRITICAL: No resources found inside the application. !!!";
        qDebug() << "  This confirms the resource file was not linked correctly.";
    }
    qDebug() << "=========================================================";
}

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent),
      ui(new Ui::MainWindow) {
    ui->setupUi(this);
    setWindowTitle(tr("Clan"));
    setWindowIcon(QIcon(":/icons/app-icon.svg"));
    setFixedWidth(800);
    setFixedHeight(600);
    // setupMenus();

    // QToolBar* toolBar = addToolBar("Main");
    // QPushButton* button = new QPushButton("Call JS", this);
    // toolBar->addWidget(button);
    // connect(button, &QPushButton::clicked, this, [this]() {
    //     if (m_cefView) {
    //         m_cefView->executeJavascript(QCefView::MainFrameID, "alert('c++ exec js');", "");
    //     }
    // });

    // setupDocks();
    // printf_resource_runtime();

    m_jsBridge = new JsBridge(this);
    embedCefView();
    // embedQmlView();
    Logger::instance().log("Main Window constructed and configured.");

    connect(m_cefView, &QCefView::invokeMethod, this, &MainWindow::onInvokeMethod);
}

MainWindow::~MainWindow() {
    delete ui;
}

void MainWindow::setupMenus() {
    QMenu* fileMenu = menuBar()->addMenu(tr("&File"));
    QAction* exitAction = fileMenu->addAction(tr("E&xit"));
    connect(exitAction, &QAction::triggered, this, &MainWindow::close);
}

void MainWindow::setupDocks() {
    // 创建 Log Viewer Dock
    auto* logDock = new QDockWidget("Log Viewer", this);
    m_logViewer = new LogViewer(logDock);
    logDock->setWidget(m_logViewer);
    addDockWidget(Qt::BottomDockWidgetArea, logDock);
    Logger::instance().log("Log viewer dock created.");
}

void MainWindow::embedQmlView() {
    auto* central = new QWidget(this);
    auto* layout = new QVBoxLayout(central);
    layout->setContentsMargins(0, 0, 0, 0);

    auto* quickWidget = new QQuickWidget(this);
    quickWidget->setResizeMode(QQuickWidget::SizeRootObjectToView);

#ifdef USE_STATIC_QML_MODULES

    qDebug() << "use static qml module";
    quickWidget->engine()->addImportPath("qrc:/qt/qml");
    quickWidget->setSource(QUrl("qrc:/qt/qml/app/ui/Dashboard/Dashboard.qml"));

#else

    // qDebug() << "use shared qml module";
    // QString strQmlRootPath = QCoreApplication::applicationDirPath() + "/../qml";
    // quickWidget->engine()->addImportPath(strQmlRootPath);

    // QString qmlFilePath = (strQmlRootPath) + "/app/ui/Dashboard/Dashboard.qml";
    // quickWidget->setSource(QUrl::fromLocalFile(qmlFilePath));

    // qDebug() << "QCoreApplication::applicationDirPath:" <<
    // QCoreApplication::applicationDirPath(); qDebug() << "strQmlRootPath:" << strQmlRootPath;
    // 1. 获取资源根目录 (bin/resources)
    auto& paths = clan::core::PathManager::instance();

    // 2. 拼接 QML 模块的 import 路径: bin/resources/qml
    std::filesystem::path qmlImportPath = paths.resources_dir() / "qml";
    QString strQmlImportPath = QString::fromStdString(qmlImportPath.string());

    // 3. 添加 Import Path (这对 shared 模式至关重要)
    quickWidget->engine()->addImportPath(strQmlImportPath);

    // 4. 拼接具体 QML 文件路径
    // 结构是: bin/resources/qml/app/ui/Dashboard/Dashboard.qml
    // (因为 URI 是 "app.ui"，Qt 会自动创建 app/ui 子目录)
    std::filesystem::path qmlFile = qmlImportPath / "app" / "ui" / "Dashboard" / "Dashboard.qml";
    QString strQmlFile = QString::fromStdString(qmlFile.string());

    // 5. 检查文件是否存在 (调试神器)
    if (!std::filesystem::exists(qmlFile)) {
        qCritical() << "CRITICAL: QML file not found at:" << strQmlFile;
        // 打印一下当前 Import Path 方便排查
        qDebug() << "Current Import Path:" << strQmlImportPath;
    } else {
        qDebug() << "Loading QML from:" << strQmlFile;
    }

    quickWidget->setSource(QUrl::fromLocalFile(strQmlFile));
#endif

#if 1
    qDebug() << "QML import paths:";
    for (const auto& path : quickWidget->engine()->importPathList()) {
        qDebug() << path;
    }
#endif

    layout->addWidget(quickWidget);
    setCentralWidget(central);
}

void MainWindow::embedCefView() {
    auto* central = new QWidget(this);
    auto* layout = new QVBoxLayout(central);
    layout->setContentsMargins(0, 0, 0, 0);
    QCefSetting setting;
    setting.setOffScreenRenderingEnabled(true);

#if defined(NDEBUG)
    // 1. 获取路径 (利用 PathManager 指向 bin/resources)
    auto& paths = clan::core::PathManager::instance();
    // 注意：Vite 生成的是 dist 目录，不是 build
    std::filesystem::path webIndex = paths.resources_dir() / "web" / "dist" / "index.html";

    // 2. 转换类型 (std::filesystem::path -> QString)
    QString absolutePath = QString::fromStdString(webIndex.string());

    qInfo() << "Preparing to load local file:" << absolutePath;

    // 3. 安全检查 (防止文件不存在导致白屏或崩溃)
    if (!std::filesystem::exists(webIndex)) {
        qCritical() << "CRITICAL ERROR: Web resource not found at:" << absolutePath;
        // 如果找不到文件，加载一个空白页或错误提示，防止 CEF 崩溃
        m_cefView = new QCefView("about:blank", &setting, this);
    } else {
        // 4. 转换为 URL 格式 (自动添加 file:// 前缀并处理斜杠)
        QString url = QUrl::fromLocalFile(absolutePath).toString();

        // 5. 初始化 CEF
        m_cefView = new QCefView(url, &setting, this);
    }
#else
    m_cefView = new QCefView("http://localhost:5173", &setting, this);
#endif

    layout->addWidget(m_cefView);

    setCentralWidget(central);
}

// web --call-- c++
void MainWindow::onInvokeMethod(const QCefBrowserId& browserId, const QCefFrameId& frameId,
                                const QString& method, const QVariantList& arguments) {
    // 1. 既有的测试逻辑
    if (method == "test") {
        if (arguments.size() > 0) {
            m_jsBridge->test(arguments.at(0).toString());
        }
    }
    // 2. 【新增】核心业务：获取家谱数据
    else if (method == "fetchFamilyTree") {
        qInfo() << "[C++] Bridge: Received fetchFamilyTree request";

        // A. 从数据库获取数据 (通过 JsBridge 封装)
        // 这里的 jsonStr 格式如: [{"id":"1", "name":"爷爷", "parentId":""}, ...]
        QString jsonStr = m_jsBridge->fetchFamilyTree();

        // B. 构造回调 JS 代码
        // 我们约定：前端必须挂载一个 window.onFamilyTreeDataReceived 函数来接收数据
        // 注意：jsonStr 已经是合法的 JSON 字符串，直接拼接进 JS 代码中
        // 为了防止 JSON 中有特殊字符导致 JS 语法错误，建议最好用 base64
        // 传输，但为了演示简单，先直接拼。
        QString jsCode =
            QString(
                "if(window.onFamilyTreeDataReceived) { window.onFamilyTreeDataReceived(%1); } else "
                "{ console.warn('Frontend callback not found'); }")
                .arg(jsonStr);

        // C. 执行 JS，将数据“推”回前端
        if (m_cefView) {
            m_cefView->executeJavascript(frameId, jsCode, "");
            qDebug() << "[C++] Data sent to frontend, length:" << jsonStr.length();
        }
    } else if (method == "searchMembers") {
        if (!arguments.isEmpty()) {
            QString keyword = arguments.first().toString();
            // 搜索结果返回的是 JSON 数组字符串，例如 [{"id":"..."}, ...]
            QString jsonResult = m_jsBridge->searchMembers(keyword);

            // 拼接 JS 回调，同样以对象字面量形式传递
            QString jsCode =
                QString(
                    "if(window.onSearchResultsReceived) { window.onSearchResultsReceived(%1); }")
                    .arg(jsonResult);

            if (m_cefView) {
                m_cefView->executeJavascript(frameId, jsCode, "");
            }
        }
    } else if (method == "showMemberDetail") {
        // arguments[0] 是我们传过来的 ID
        if (!arguments.isEmpty()) {
            QString memberId = arguments.first().toString();
            QString msg = QString("前端点击了成员 ID: %1").arg(memberId);

            qInfo() << "[C++] " << msg;

            // 弹个原生框证明成功了 (需要包含 <QMessageBox>)
            // QMessageBox::information(this, "点击事件", msg);
            // 如果不想弹框，只看控制台日志也可以
        }
    } else if (method == "fetchMemberDetail") {
        if (!arguments.isEmpty()) {
            // 1. 获取参数
            QString id = arguments.first().toString();
            qInfo() << "[C++] Fetching details for Member ID:" << id;

            // 2. 调用 Bridge (逻辑封装在 Bridge 中)
            QString jsonResult = m_jsBridge->fetchMemberDetail(id);

            // 3. 回调前端
            // 注意：如果 jsonResult 是 "null"，前端判断 member 为空显示“未找到”
            QString jsCode =
                QString("if(window.onMemberDetailReceived) { window.onMemberDetailReceived(%1); }")
                    .arg(jsonResult);

            if (m_cefView) {
                m_cefView->executeJavascript(frameId, jsCode, "");
            }
        }
    }

    else if (method == "getLocalImage") {
        if (!arguments.isEmpty()) {
            QString path = arguments.first().toString();
            // 调用 Bridge 读取并压缩图片
            QString base64Data = m_jsBridge->getLocalImage(path);

            // 回调前端：这里我们定义一个新的回调名 onLocalImageLoaded
            // 为了区分是哪张图，我们把 path 也传回去，或者简单点，直接由前端 Promise 处理
            // 这里演示简单的回调模式：
            QString jsCode =
                QString("if(window.onLocalImageLoaded) { window.onLocalImageLoaded('%1', '%2'); }")
                    .arg(path.replace("\\", "\\\\"))  // 处理路径转义
                    .arg(base64Data);

            if (m_cefView)
                m_cefView->executeJavascript(frameId, jsCode, "");
        }
    } else if (method == "importResource") {
        if (arguments.size() >= 2) {
            QString memberId = arguments.at(0).toString();
            QString type = arguments.at(1).toString();  // "video", "photo"

            // 调用 Bridge (会阻塞 UI 直到文件选完并复制完，简单场景可接受)
            QString jsonResult = m_jsBridge->importResource(memberId, type);

            // 回调前端刷新列表
            QString jsCode =
                QString("if(window.onResourceImported) { window.onResourceImported(%1); }")
                    .arg(jsonResult);
            if (m_cefView)
                m_cefView->executeJavascript(frameId, jsCode, "");
        }
    } else if (method == "fetchMemberResources") {
        if (arguments.size() >= 2) {
            QString memberId = arguments.at(0).toString();
            QString type = arguments.at(1).toString();

            QString jsonResult = m_jsBridge->fetchMemberResources(memberId, type);

            // 回调前端
            QString jsCode = QString(
                                 "if(window.onMemberResourcesReceived) { "
                                 "window.onMemberResourcesReceived(%1, '%2'); }")
                                 .arg(jsonResult)
                                 .arg(type);  // 把 type 传回去方便前端判断
            if (m_cefView)
                m_cefView->executeJavascript(frameId, jsCode, "");
        }
    } else if (method == "updateMemberPortrait") {
        if (!arguments.isEmpty()) {
            QString memberId = arguments.first().toString();
            qInfo() << "[C++] Dispatching updateMemberPortrait for ID:" << memberId;

            // 1. 执行更新 (这会阻塞直到用户选完文件)
            m_jsBridge->updateMemberPortrait(memberId);

            // 2. 立即刷新侧边栏 (SidePanel)
            // 重新获取该成员详情，并通过 onMemberDetailReceived 推送给前端
            QString detailJson = m_jsBridge->fetchMemberDetail(memberId);
            QString detailJs =
                QString("if(window.onMemberDetailReceived) { window.onMemberDetailReceived(%1); }")
                    .arg(detailJson);
            if (m_cefView) {
                m_cefView->executeJavascript(frameId, detailJs, "");
            }

            // 3. 立即刷新族谱树 (ClanTree) TODO 局部刷新
            // 重新获取整个列表，并通过 onFamilyTreeDataReceived 推送给前端
            // 这样 ClanTree 上的节点小头像也会变
            QString treeJson = m_jsBridge->fetchFamilyTree();
            QString treeJs =
                QString(
                    "if(window.onFamilyTreeDataReceived) { window.onFamilyTreeDataReceived(%1); }")
                    .arg(treeJson);
            if (m_cefView) {
                m_cefView->executeJavascript(frameId, treeJs, "");
            }

            qInfo() << "[C++] Portrait updated, refreshed UI for member:" << memberId;
        }
    }
}
