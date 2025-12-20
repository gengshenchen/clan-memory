# Clan-Memory

Clan-Memory is a cross-platform desktop application for building, viewing, and searching your family tree. It is built with a modern, hybrid architecture, combining a powerful C++ backend with a web-based user interface.

## Architecture

The application uses a client-server model that runs entirely on your local machine.

*   **Backend (C++):** The core application is written in C++ using the Qt 6 framework. It handles all business logic, database operations, and file management. It runs a local web server using `cpp-httplib` to expose a JSON API to the frontend.

*   **Frontend (Web):** The user interface is a modern web application written in HTML, CSS, and JavaScript. It is rendered inside the desktop application using the `QCefView` (Chromium Embedded Framework) component.

*   **Database:** Family member data is stored locally in a SQLite database file, ensuring your data remains private and accessible.

## Features

*   **Family Tree Management:** Add, edit, and manage information for family members.
*   **Search:** Quickly find members in your family tree.
*   **Cross-Platform:** Runs on Windows, macOS, and Linux from a single codebase.
*   **Private:** All your data is stored locally on your own computer.

## Building from Source

The project includes a convenient build script that handles configuration and compilation.

### Prerequisites

*   A modern C++ Compiler (GCC, Clang, or MSVC)
*   Qt (>= 6.2)
*   The `build.sh` script requires a Linux-like shell (e.g., Git Bash on Windows).

### Build Steps

The `build.sh` script will automatically configure the project, build the web frontend, and compile the C++ application.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/clan-memory.git
    cd clan-memory
    ```

2.  **Run the build script:**
    ```bash
    chmod +x build.sh
    ./build.sh
    ```

3.  **Run the application:**
    The executable will be located in the `out/bin` directory.

### Advanced Build Options

You can customize the build by passing arguments to the script. The script accepts arguments in any order.

*   **Specifying Qt Path:**
    The script automatically searches for your Qt installation. If it can't find it, or you want to use a specific version, you can provide the path.
    ```bash
    ./build.sh /path/to/your/Qt
    ```
    Alternatively, you can set the `QT_PREFIX_PATH` environment variable.

*   **Changing Build Type:**
    The default build type is `Debug`. You can change it to `Release` for better performance.
    ```bash
    ./build.sh Release
    ```

*   **Clean Build:**
    To force a complete rebuild of the project, use the `clean` argument.
    ```bash
    ./build.sh clean Release
    ```

## Directory Structure

```
.
├── src/            # C++ source code for the backend
│   ├── app/        # Main application entry point
│   ├── core/       # Core business logic (database, networking)
│   └── ...
├── web/            # HTML/CSS/JS source for the web-based UI
├── 3rdparty/       # Third-party libraries
├── resources/      # Application resources (icons, etc.)
└── tests/          # Unit tests
```