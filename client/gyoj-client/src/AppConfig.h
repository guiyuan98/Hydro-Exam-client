#pragma once

#include <QString>
#include <QStringList>

struct AppConfig {
    QString serverBaseUrl = "http://192.168.1.149";
    QString clientVersion = "0.1.0";
    QString compilerPath = "../../../.qt/Tools/mingw1310_64/bin/g++.exe";
    QStringList defaultProcessBlacklist = {
        "chrome.exe", "msedge.exe", "firefox.exe", "qq.exe", "wechat.exe",
        "devenv.exe", "code.exe", "devcpp.exe", "teamviewer.exe", "anydesk.exe"
    };
    QStringList networkAllowlist;
    int heartbeatSeconds = 10;
    int localRunTimeoutMs = 3000;
    bool enableFirewallLock = false;

    static AppConfig load();
};
