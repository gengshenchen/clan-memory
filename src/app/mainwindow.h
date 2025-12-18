#pragma once
#include <QMainWindow>
#include <QVariantList>
#include "CefVersion.h"

#define SHORT_NAME 42
#define LONGER_NAME 0x007f
#define EVEN_LONGER_NAME (2)
#define foo(x) (x * x)
#define bar(y, z) (y + z)

QT_BEGIN_NAMESPACE
namespace Ui {
class MainWindow;
}
QT_END_NAMESPACE

class LogViewer;
class JsBridge;
class QCefView;

// Define the types that are used in the onInvokeMethod slot
using QCefBrowserId = int;
#if CEF_VERSION_MAJOR < 122
using QCefFrameId = qint64;
#else
using QCefFrameId = QString;
#endif

class MainWindow : public QMainWindow {
    Q_OBJECT

  public:
    MainWindow(QWidget* parent = nullptr);
    ~MainWindow();

private slots:
    void onInvokeMethod(const QCefBrowserId& browserId,
                           const QCefFrameId& frameId,
                           const QString& method,
                           const QVariantList& arguments);

private:
    void setupDocks();
    void setupMenus();
    void embedQmlView();
    void embedCefView();
    Ui::MainWindow* ui;
    LogViewer* m_logViewer = nullptr;
    QCefView* m_cefView = nullptr;
    JsBridge* m_jsBridge = nullptr;
};
