add_executable(${PROJECT_NAME}
    main.cpp
    mainwindow.cpp
    mainwindow.h
    mainwindow.ui
    js_bridge.cpp
    js_bridge.h
    ${PROJECT_SOURCE_DIR}/resources/resources.qrc
)

if(USE_STATIC_QML_MODULES)
    target_compile_definitions(${PROJECT_NAME} PRIVATE USE_STATIC_QML_MODULES)
endif()

# 链接我们创建的所有模块和必要的Qt模块
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::QuickWidgets

    Core
    WidgetsUi
    QmlUI
    QCefView
    # 静态库需要 链接插件目标
    $<$<BOOL:${USE_STATIC_QML_MODULES}>:QmlUIplugin>
    #$<IF:$<BOOL:${USE_STATIC_QML_MODULES}>,QmlUIplugin,"">        # 插件库本身
)

qt_import_qml_plugins(${PROJECT_NAME})# 静态插件引入（官方 Qt 插件）

# --- 国际化(i18n)配置 ---
qt_add_translations(${PROJECT_NAME}
    TS_OUTPUT_DIRECTORY ../../resources/i18n
    QM_OUTPUT_DIRECTORY translations
)


# =========================================================
# 统一资源部署 (Unified Resource Deployment)
# =========================================================
set(DEPLOY_BIN_DIR "$<TARGET_FILE_DIR:${PROJECT_NAME}>")
set(DEPLOY_RES_DIR "${DEPLOY_BIN_DIR}/resources")

# 1. 拷贝 Crashpad Handler 到 bin 目录 (与主程序同级)
if(TARGET crashpad_handler)
    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_FILE:crashpad_handler>
        ${DEPLOY_BIN_DIR}
        COMMENT "Copying crashpad_handler to bin directory..."
    )
endif()

# 2. 拷贝基础资源 (certs, icons) 到 bin/resources
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${DEPLOY_RES_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${PROJECT_SOURCE_DIR}/resources ${DEPLOY_RES_DIR}
    COMMENT "Deploying base resources..."
)

# 3. 拷贝 Web 前端 到 bin/resources/web/dist
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${DEPLOY_RES_DIR}/web
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${PROJECT_SOURCE_DIR}/web/dist
    ${DEPLOY_RES_DIR}/web/dist
    COMMENT "Deploying Web App..."
)

# 4. 拷贝翻译文件 到 bin/resources/translations
#    (qt_add_translations 默认输出在 build 目录的 translations 文件夹)
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${DEPLOY_RES_DIR}/translations
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${CMAKE_BINARY_DIR}/translations
    ${DEPLOY_RES_DIR}/translations
    COMMENT "Deploying translations..."
)
# 5. 拷贝 QCefView 的编译产物 (包括CefViewWing, libQCefView.so, 和所有CEF资源)
# 到主程序的输出目录
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    $<TARGET_FILE_DIR:QCefView> # 源目录
    $<TARGET_FILE_DIR:${PROJECT_NAME}> # 目标目录
    COMMENT "Copying QCefView binaries and resources to application directory"
)

