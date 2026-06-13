#include "MainWindow.h"

#include <QCloseEvent>
#include <QCoreApplication>
#include <QEvent>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QQmlContext>
#include <QQuickItem>
#include <QQuickView>
#include <QSplitter>
#include <QStatusBar>
#include <QTextEdit>
#include <QToolBar>
#include <QVBoxLayout>
#include <QtWebView/QtWebView>

MainWindow::MainWindow(QWidget* parent)
    : QMainWindow(parent),
      m_config(AppConfig::load()),
      m_api(new ApiClient(m_config, this)),
      m_proctor(new ProctorController(m_config, this)),
      m_runner(new LocalRunner(m_config, this))
{
    m_demoMode = QCoreApplication::arguments().contains("--demo");
    buildUi();

    connect(m_api, &ApiClient::submitReceived, this, [this](const QJsonObject& payload) {
        m_output->append("\n[Remote Hydro OJ submit response]\n" +
                         QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Indented)));
        m_status->setText("Submitted to Hydro OJ");
    });
    connect(m_api, &ApiClient::apiError, this, &MainWindow::handleApiError);
    connect(m_proctor, &ProctorController::violationDetected, this,
            [this](const QString& type, const QString& msg, bool lock) {
        if (!m_sessionKey.isEmpty()) {
            m_api->reportEvent(m_sessionKey, type, lock ? "critical" : "warning", msg, {}, lock);
        }
    });
    connect(m_proctor, &ProctorController::lockedChanged, this, &MainWindow::setLocked);
    connect(&m_heartbeat, &QTimer::timeout, this, [this] {
        if (!m_sessionKey.isEmpty()) {
            m_api->heartbeat(m_sessionKey, m_proctor->machineFingerprint());
        }
    });

    setOjUrl(m_config.serverBaseUrl);
    if (m_demoMode) {
        resize(1360, 860);
        show();
    } else {
        showFullScreen();
        raise();
        activateWindow();
        m_proctor->start();
        startSession();
    }
}

void MainWindow::buildUi()
{
    setWindowTitle("GYOJ - Hydro OJ Secure Client");
    QtWebView::initialize();

    auto* toolbar = addToolBar("Hydro OJ");
    toolbar->setMovable(false);
    toolbar->addWidget(new QLabel("OJ ", toolbar));
    m_urlInput = new QLineEdit(m_config.serverBaseUrl, toolbar);
    m_urlInput->setMinimumWidth(360);
    toolbar->addWidget(m_urlInput);
    toolbar->addAction("Go", this, &MainWindow::navigateOj);
    toolbar->addSeparator();
    toolbar->addWidget(new QLabel("Cookie ", toolbar));
    m_cookieInput = new QLineEdit(toolbar);
    m_cookieInput->setPlaceholderText("sessionid=...; csrftoken=...");
    m_cookieInput->setMinimumWidth(240);
    toolbar->addWidget(m_cookieInput);
    toolbar->addWidget(new QLabel("Contest ", toolbar));
    m_contestIdInput = new QLineEdit(QString::number(m_contestId), toolbar);
    m_contestIdInput->setMaximumWidth(70);
    toolbar->addWidget(m_contestIdInput);
    toolbar->addWidget(new QLabel("ProblemId ", toolbar));
    m_problemIdInput = new QLineEdit(toolbar);
    m_problemIdInput->setPlaceholderText("internal id");
    m_problemIdInput->setMaximumWidth(80);
    toolbar->addWidget(m_problemIdInput);
    toolbar->addWidget(new QLabel("Lang ", toolbar));
    m_languageInput = new QLineEdit("C++", toolbar);
    m_languageInput->setMaximumWidth(70);
    toolbar->addWidget(m_languageInput);
    toolbar->addAction("Local Tools", this, &MainWindow::toggleLocalTools);
    toolbar->addAction("Run Sample", this, &MainWindow::runSample);
    toolbar->addAction("Submit Remote", this, &MainWindow::submitCode);

    m_webView = new QQuickView();
    m_webView->setResizeMode(QQuickView::SizeRootObjectToView);
    m_webView->rootContext()->setContextProperty("initialUrl", m_config.serverBaseUrl);
    m_webView->setSource(QUrl::fromLocalFile(QCoreApplication::applicationDirPath() + "/qml/OjWebView.qml"));
    m_webContainer = QWidget::createWindowContainer(m_webView, this);
    m_webContainer->setMinimumSize(640, 480);

    m_toolsPanel = new QWidget(this);
    auto* toolsLayout = new QVBoxLayout(m_toolsPanel);
    m_editor = new CodeEditor(m_toolsPanel);
    m_editor->setCode("#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n"
                      "    ios::sync_with_stdio(false);\n"
                      "    cin.tie(nullptr);\n\n"
                      "    int a, b;\n"
                      "    cin >> a >> b;\n"
                      "    cout << a + b << '\\n';\n"
                      "    return 0;\n}\n");
    m_sampleInput = new QTextEdit(m_toolsPanel);
    m_sampleInput->setPlaceholderText("Sample input");
    m_sampleInput->setPlainText("1 2\n");
    m_output = new QTextEdit(m_toolsPanel);
    m_output->setReadOnly(true);
    m_output->setPlaceholderText("Local run output / remote submit response");
    toolsLayout->addWidget(new QLabel("Local OI Editor / Sample Runner", m_toolsPanel));
    toolsLayout->addWidget(m_editor, 5);
    toolsLayout->addWidget(m_sampleInput, 1);
    toolsLayout->addWidget(m_output, 2);

    m_splitter = new QSplitter(this);
    m_splitter->addWidget(m_webContainer);
    m_splitter->addWidget(m_toolsPanel);
    m_splitter->setStretchFactor(0, 6);
    m_splitter->setStretchFactor(1, 2);
    m_toolsPanel->hide();
    setCentralWidget(m_splitter);

    m_status = new QLabel("Hydro OJ web page is the primary exam UI");
    statusBar()->addPermanentWidget(m_status, 1);

    m_lockOverlay = new QWidget(this);
    m_lockOverlay->setStyleSheet("background: rgba(20, 20, 20, 230); color: white; font-size: 28px;");
    auto* overlayLayout = new QVBoxLayout(m_lockOverlay);
    auto* label = new QLabel("Exam locked. Please contact the teacher.", m_lockOverlay);
    label->setAlignment(Qt::AlignCenter);
    overlayLayout->addWidget(label);
    m_lockOverlay->hide();
}

void MainWindow::navigateOj()
{
    setOjUrl(m_urlInput->text().trimmed());
}

void MainWindow::setOjUrl(const QString& url)
{
    QString target = url.trimmed();
    if (target.isEmpty()) {
        target = "http://localhost";
    }
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
        target = "https://" + target;
    }
    m_urlInput->setText(target);
    m_config.serverBaseUrl = target;
    while (m_config.serverBaseUrl.endsWith('/')) {
        m_config.serverBaseUrl.chop(1);
    }
    m_api->setServerBaseUrl(m_config.serverBaseUrl);
    if (m_webView->rootObject()) {
        m_webView->rootObject()->setProperty("url", target);
    } else {
        m_webView->rootContext()->setContextProperty("initialUrl", target);
        m_webView->setSource(QUrl::fromLocalFile(QCoreApplication::applicationDirPath() + "/qml/OjWebView.qml"));
    }
    m_status->setText("Loaded Hydro OJ web UI: " + target);
}

void MainWindow::toggleLocalTools()
{
    m_toolsPanel->setVisible(!m_toolsPanel->isVisible());
}

void MainWindow::startSession()
{
    m_api->setServerBaseUrl(m_config.serverBaseUrl);
    m_api->setSessionCookie(m_cookieInput->text().trimmed().toUtf8());
    m_contestId = m_contestIdInput->text().trimmed().toInt();
    m_api->startExamSession(m_contestId, m_proctor->machineFingerprint());
}

void MainWindow::runSample()
{
    if (!m_toolsPanel->isVisible()) {
        m_toolsPanel->show();
    }
    const auto result = m_runner->runCppSample(m_editor->code(), m_sampleInput->toPlainText());
    QString report;
    if (!result.compiled) {
        report = "Compile failed:\n" + result.compileOutput;
    } else if (result.timedOut) {
        report = "Run timed out.\n" + result.stdoutText + "\n" + result.stderrText;
    } else {
        report = QString("Exit code: %1\n\n[stdout]\n%2\n[stderr]\n%3")
                     .arg(result.exitCode)
                     .arg(result.stdoutText, result.stderrText);
    }
    m_output->setPlainText(report);
}

void MainWindow::submitCode()
{
    m_api->setServerBaseUrl(m_config.serverBaseUrl);
    m_api->setSessionCookie(m_cookieInput->text().trimmed().toUtf8());
    m_contestId = m_contestIdInput->text().trimmed().toInt();
    m_problemInternalId = m_problemIdInput->text().trimmed().toInt();
    if (!m_problemInternalId) {
        m_output->append("Remote submit needs the Hydro problem id.");
        m_toolsPanel->show();
        return;
    }
    m_api->submitCode(m_contestId, m_problemInternalId, m_languageInput->text().trimmed(), m_editor->code());
}

void MainWindow::setLocked(bool locked, const QString& reason)
{
    m_lockOverlay->setGeometry(rect());
    m_lockOverlay->setVisible(locked);
    m_lockOverlay->raise();
    m_editor->setReadOnly(locked);
    m_status->setText(locked ? "Locked: " + reason : "Active");
}

void MainWindow::handleApiError(const QString& message)
{
    m_status->setText("OJ API error: " + message);
    m_output->append("OJ API error: " + message);
}

void MainWindow::changeEvent(QEvent* event)
{
    QMainWindow::changeEvent(event);
    if (m_demoMode) {
        return;
    }
    if (event->type() == QEvent::ActivationChange && !isActiveWindow()) {
        m_proctor->lockScreen("focus_lost");
        if (!m_sessionKey.isEmpty()) {
            m_api->reportEvent(m_sessionKey, "focus_lost", "critical", "Window lost focus", {}, true);
        }
    }
}

void MainWindow::closeEvent(QCloseEvent* event)
{
    if (m_demoMode) {
        event->accept();
        return;
    }
    event->ignore();
    m_proctor->lockScreen("close_blocked");
}
