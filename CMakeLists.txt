cmake_minimum_required(VERSION 3.19)

project(clan-memory VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_INCLUDE_CURRENT_DIR ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
# in windows , it is also for dll.
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/bin CACHE PATH "Single Directory for all Executables.")
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/lib CACHE PATH "Single Directory for all shared Libraries")
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/lib CACHE PATH "Single Directory for all static archive")

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

configure_file(
    src/shared/version.h.in      # 輸入模板文件
    ${PROJECT_BINARY_DIR}/version.h # 輸出頭文件到構建目錄
)
if(CMAKE_BUILD_TYPE STREQUAL "Debug" OR NOT CMAKE_BUILD_TYPE)
    add_compile_definitions(PROJECT_SOURCE_DIR="${PROJECT_SOURCE_DIR}")
    if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
        add_custom_target(start_web_dev_server ALL
            COMMAND cmd /c "${CMAKE_CURRENT_SOURCE_DIR}/scripts/start_web.bat"
            COMMENT "Starting web dev server"
        )
    else()
        add_custom_target(start_web_dev_server ALL
            COMMAND bash "${CMAKE_CURRENT_SOURCE_DIR}/scripts/start_web.sh"
            COMMENT "Starting web dev server"
        )
    endif()
endif()

find_package(Qt6 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Quick
    QuickWidgets  # QWidget中嵌入QML的关键
    Qml
    Test          # 用于单元测试
    LinguistTools
)
#openssl
find_package(OpenSSL REQUIRED)

#是否启用静态 QML 模块打包（默认为 OFF）
option(USE_STATIC_QML_MODULES "Build QML modules as static" OFF)

qt_standard_project_setup(
    I18N_SOURCE_LANGUAGE en  #default language
    I18N_TRANSLATED_LANGUAGES  zh de fr
    REQUIRES 6.5)

qt_policy(SET QTP0001 NEW)
qt_policy(SET QTP0004 NEW)

#按照“从底层到上层”的依赖顺序添加
add_subdirectory(3rdparty/spdlog)
add_subdirectory(3rdparty/crashpad)
#設置EXCLUDE_FROM_ALL可以防止在默認構建時編譯這些庫的測試等無關目標，加快編譯速度
add_subdirectory(3rdparty/simpleini EXCLUDE_FROM_ALL)
add_subdirectory(3rdparty/json EXCLUDE_FROM_ALL)
add_subdirectory(3rdparty/cpp-httplib EXCLUDE_FROM_ALL)
set (TF_BUILD_TESTS OFF)
add_subdirectory(3rdparty/taskflow EXCLUDE_FROM_ALL)
add_subdirectory(3rdparty/QCefView)

add_subdirectory(src/shared)
add_subdirectory(src/core)
add_subdirectory(src/widgets)
add_subdirectory(src/qml)
add_subdirectory(src/app)

include(CTest)
if(BUILD_TESTING)
  message(STATUS "Test building is enabled.")
  add_subdirectory(3rdparty/googletest EXCLUDE_FROM_ALL)
  add_subdirectory(tests)
else()
  message(STATUS "Test building is disabled.")
endif()

