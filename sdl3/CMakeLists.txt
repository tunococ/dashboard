cmake_minimum_required(VERSION 3.20)
project(MySDL3Project)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# Detect compiler and set module flags
if(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fmodules -fbuiltin-module-map")
  message("Using Clang")
elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++20 -fmodules-ts")
  message("Using GCC")
endif()

include(FetchContent)
FetchContent_Declare(
  CPM
  GIT_REPOSITORY https://github.com/cpm-cmake/CPM.cmake.git
  GIT_TAG        v0.40.8
)
FetchContent_MakeAvailable(CPM)

CPMAddPackage(
    NAME SDL3
    GITHUB_REPOSITORY libsdl-org/SDL
    GIT_TAG release-3.2.10
)

add_subdirectory(libs)
add_subdirectory(src)


