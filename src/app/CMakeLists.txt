add_executable(${PROJECT_NAME}
    main.cpp
    mainwindow.cpp
    mainwindow.h
    mainwindow.ui
    js_bridge.cpp
    js_bridge.h
    ${PROJECT_SOURCE_DIR}/resources/resources.qrc
)

# 拷贝web app
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${PROJECT_SOURCE_DIR}/web/dist
    ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/web/dist
    COMMENT "Copying web app to build directory"
)
message(STATUS "Web app will be copied to ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/web/dist")

# 确保 Crashpad handler 被拷贝到主程序所在的目录
if(TARGET crashpad_handler)
    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        $<TARGET_FILE:crashpad_handler>          # 源文件 (自动包含 .exe)
        $<TARGET_FILE_DIR:${PROJECT_NAME}>       # 目标目录 (自动指向 bin/Debug 等)
        COMMENT "Copying crashpad_handler to executable directory..."
    )
else()
    message(WARNING "Target 'crashpad_handler' not found. Crashpad handler will not be copied.")
endif()

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

# 拷贝 QCefView 的编译产物 (包括CefViewWing, libQCefView.so, 和所有CEF资源)
# 到主程序的输出目录
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    $<TARGET_FILE_DIR:QCefView> # 源目录
    $<TARGET_FILE_DIR:${PROJECT_NAME}> # 目标目录
    COMMENT "Copying QCefView binaries and resources to application directory"
)

# --- 国际化(i18n)配置 ---
qt_add_translations(${PROJECT_NAME}
    TS_OUTPUT_DIRECTORY ../../resources/i18n
    QM_OUTPUT_DIRECTORY translations
)

