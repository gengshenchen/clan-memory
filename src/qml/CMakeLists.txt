if(USE_STATIC_QML_MODULES)
    set(QML_MODULE_STATIC STATIC)
    message(STATUS "Use static qml modules: ${QML_MODULE_STATIC}")
else()
    set(QML_MODULE_STATIC SHARED)
    message(STATUS "Use shared qml modules: ${QML_MODULE_STATIC}")
endif()

#set(QT_QML_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/qml/app/ui/)
set(QT_QML_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/resources/qml/app/ui" CACHE PATH "QML output directory" FORCE)
message(STATUS "QT_QML_OUTPUT_DIRECTORY is set to: ${QT_QML_OUTPUT_DIRECTORY}")

qt_add_qml_module(QmlUI
    URI "app.ui"
    VERSION 1.0
    ${QML_MODULE_STATIC}
    OUTPUT_DIRECTORY ${QT_QML_OUTPUT_DIRECTORY}
    RESOURCE_PREFIX /qt/qml
    SOURCES
        Dashboard/DashboardBackend.cpp Dashboard/DashboardBackend.h
    QML_FILES
        Dashboard/Dashboard.qml
)
set_target_properties(QmlUI PROPERTIES
    QT_QMLCACHEGEN_ARGUMENTS "--verbose"
)
target_link_libraries(QmlUI PRIVATE
    Core
    Qt6::Quick
)

target_include_directories(QmlUI PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/Dashboard
)

