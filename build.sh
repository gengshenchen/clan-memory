#!/bin/bash
set -e

# --- Configuration ---

# Default build type. Can be overridden by passing 'Debug', 'Release', 'RelWithDebInfo', or 'MinSizeRel' as an argument.
DEFAULT_BUILD_TYPE="Debug"

# Default Qt path.
# This can be overridden in the following order of precedence:
# 1. A path given as a command-line argument to the script.
# 2. QT_PREFIX_PATH environment variable.
# 3. This DEFAULT_QT_PATH variable.
DEFAULT_QT_PATH="/home/karl/Qt/6.10.0/gcc_64"

# Use Ninja build system? Set to 'true' to use Ninja, 'false' for default (usually Makefiles).
# Can be overridden by setting the USE_NINJA environment variable (e.g., USE_NINJA=false ./build.sh)
USE_NINJA=true

# Number of parallel jobs for building. Defaults to the number of available cores.
# On systems where nproc is not available, it defaults to 4.
if command -v nproc &> /dev/null; then
    JOBS=$(nproc)
else
    JOBS=4
fi


# --- Script Logic ---

CLEAN_BUILD=false
QT_PATH_ARG=""
BUILD_TYPE_ARG=""

# Parse arguments. Usage: ./build.sh [clean] [Debug|Release|RelWithDebInfo|MinSizeRel] [/path/to/qt]
# Arguments can be in any order.
while [ "$#" -gt 0 ]; do
    case "$1" in
        clean)
            CLEAN_BUILD=true
            shift
            ;;
        Debug|Release|RelWithDebInfo|MinSizeRel)
            BUILD_TYPE_ARG="$1"
            shift
            ;;
        *)
            QT_PATH_ARG="$1"
            shift
            ;;
    esac
done

if [ -n "$BUILD_TYPE_ARG" ]; then
    BUILD_TYPE="$BUILD_TYPE_ARG"
else
    BUILD_TYPE="$DEFAULT_BUILD_TYPE"
fi

# Determine Qt Path based on precedence
if [ -n "$QT_PATH_ARG" ]; then
    # 1. Use argument if provided
    QT_PATH="$QT_PATH_ARG"
    echo "Using Qt path from command line argument: $QT_PATH"
elif [ -n "$QT_PREFIX_PATH" ]; then
    # 2. Use environment variable if set
    QT_PATH="$QT_PREFIX_PATH"
    echo "Using Qt path from QT_PREFIX_PATH environment variable: $QT_PATH"
else
    # 3. Use default from script
    QT_PATH="$DEFAULT_QT_PATH"
    echo "Using default Qt path from script: $QT_PATH"
fi

echo "To override, set QT_PREFIX_PATH or pass a path as a command-line argument."
echo "Usage: ./build.sh [clean] [Debug|Release|RelWithDebInfo|MinSizeRel] [/path/to/qt]"
echo "Build type: $BUILD_TYPE"

# Validate Qt path
if [ ! -d "$QT_PATH" ]; then
    echo "Error: Qt path not found at '$QT_PATH'"
    echo "Please ensure the path is correct."
    exit 1
fi

# Determine CMake generator and build flags
CMAKE_GENERATOR_FLAG=""
CMAKE_BUILD_JOBS_FLAG="-j$JOBS" # Default for make-like generators
BUILD_SYSTEM_NAME="Unix Makefiles (default)"

if [ "${USE_NINJA,,}" = "true" ]; then # Case-insensitive comparison
    if command -v ninja &> /dev/null; then
        CMAKE_GENERATOR_FLAG="-G Ninja"
        CMAKE_BUILD_JOBS_FLAG="" # Ninja handles parallelism automatically
        BUILD_SYSTEM_NAME="Ninja"
    else
        echo "Warning: Ninja is set to be used but 'ninja' command not found. Falling back to default build system."
        USE_NINJA=false
    fi
fi

echo "Using build system: $BUILD_SYSTEM_NAME"
echo "Using $JOBS parallel jobs for building (if applicable)."
echo "---"

# --- Build Web ---
echo "Building web application..."
if [ -f "./build_web.sh" ]; then
    chmod +x ./build_web.sh
    ./build_web.sh
else
    echo "Warning: build_web.sh not found, skipping web build."
fi
echo "---"

# --- Build Commands ---

echo "Configuring project with CMake (if needed)..."
# CMAKE_GENERATOR_FLAG is intentionally unquoted to not pass an empty string argument
cmake -S . -B out \
    $CMAKE_GENERATOR_FLAG \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_PREFIX_PATH="$QT_PATH" \
    -DUSE_STATIC_QML_MODULES=OFF

echo "---"

if [ "$CLEAN_BUILD" = "true" ]; then
    echo "Performing a clean build (recompiling project)..."
    # CMAKE_BUILD_JOBS_FLAG is intentionally unquoted to not pass an empty string argument
    cmake --build out --clean-first $CMAKE_BUILD_JOBS_FLAG
else
    echo "Updating translations..."
    # CMAKE_BUILD_JOBS_FLAG is intentionally unquoted to not pass an empty string argument
    cmake --build out --target update_translations $CMAKE_BUILD_JOBS_FLAG

    echo "---"
    echo "Building project (incrementally)..."
    # CMAKE_BUILD_JOBS_FLAG is intentionally unquoted to not pass an empty string argument
    cmake --build out $CMAKE_BUILD_JOBS_FLAG
fi
