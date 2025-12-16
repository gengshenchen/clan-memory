#include "mainwindow.h"

#include <QCefView.h>
#include <QDir>
#include <QDirIterator>
#include <QDockWidget>
#include <QPushButton>
#include <QQmlContext>
#include <QQmlEngine>
#include <QQuickView>
#include <QQuickWidget>
#include <QToolBar>
#include <QVBoxLayout>

#include "core/Logger.h"
#include "core/log/log.h"
#include "core/platform/path_manager.h"
#include "js_bridge.h"
#include "ui_mainwindow.h"
#include "widgets/LogViewer.h"  // from gui-widgets
MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent),
      ui(new Ui::MainWindow) {
    ui->setupUi(this);
    setWindowTitle(tr("My App"));
    setWindowIcon(QIcon(":/icons/app-icon.svg"));
    setFixedWidth(800);   // 设置窗口宽度为800像素
    setFixedHeight(600);  // 设置窗口高度为60素
    setupMenus();
    LOGINFO("hello world");

    QToolBar* toolBar = addToolBar("Main");
    QPushButton* button = new QPushButton("Call JS", this);
    toolBar->addWidget(button);
    connect(button, &QPushButton::clicked, this, [this]() {
        if (m_cefView) {
            m_cefView->executeJavascript(QCefView::MainFrameID, "alert('c++ exec js');", "");
        }
    });

    // setupDocks();
#if 0
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
#endif  // --- 调试代码结束 ---

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

    // qDebug() << "QCoreApplication::applicationDirPath:" << QCoreApplication::applicationDirPath();
    // qDebug() << "strQmlRootPath:" << strQmlRootPath;
    // 1. 获取资源根目录 (bin/resources)
    auto& paths = qt_app_template::core::PathManager::instance();

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
    auto& paths = qt_app_template::core::PathManager::instance();
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

void MainWindow::onInvokeMethod(const QCefBrowserId& browserId, const QCefFrameId& frameId,
                                const QString& method, const QVariantList& arguments) {
    if (method == "test") {
        if (arguments.size() > 0) {
            m_jsBridge->test(arguments.at(0).toString());
        }
    }
}
